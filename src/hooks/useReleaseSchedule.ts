import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SCHEDULE_KEY = 'anime_release_schedules';
const REMINDER_KEY = 'episode_reminders';

interface ReleasePattern {
  animeId: string;
  animeTitle: string;
  dayOfWeek: number; // 0-6, Sunday-Saturday
  typicalHour: number; // 0-23
  confidence: number; // 0-1
  lastUpdated: string;
}

interface EpisodeReminder {
  animeId: string;
  animeTitle: string;
  expectedTime: string;
  enabled: boolean;
}

export function useReleaseSchedule() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Map<string, ReleasePattern>>(new Map());
  const [reminders, setReminders] = useState<Map<string, EpisodeReminder>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load saved schedules and reminders on mount
  useEffect(() => {
    try {
      const savedSchedules = localStorage.getItem(SCHEDULE_KEY);
      if (savedSchedules) {
        const parsed = JSON.parse(savedSchedules);
        const map = new Map<string, ReleasePattern>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(key, value as ReleasePattern);
        });
        setSchedules(map);
      }

      const savedReminders = localStorage.getItem(REMINDER_KEY);
      if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        const map = new Map<string, EpisodeReminder>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(key, value as EpisodeReminder);
        });
        setReminders(map);
      }
    } catch (error) {
      console.error('Error loading release schedules:', error);
    }
  }, []);

  // Analyze release pattern for an anime based on historical data
  const analyzeReleasePattern = useCallback(async (animeId: string): Promise<ReleasePattern | null> => {
    setIsAnalyzing(true);

    try {
      // Get all seasons for this anime
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('anime_id', animeId);

      if (!seasons || seasons.length === 0) {
        setIsAnalyzing(false);
        return null;
      }

      const seasonIds = seasons.map(s => s.id);

      // Get episode creation dates
      const { data: episodes } = await supabase
        .from('episodes')
        .select('created_at')
        .in('season_id', seasonIds)
        .order('created_at', { ascending: false })
        .limit(20); // Last 20 episodes for pattern analysis

      if (!episodes || episodes.length < 3) {
        setIsAnalyzing(false);
        return null; // Need at least 3 episodes to detect a pattern
      }

      // Analyze day of week and hour patterns
      const dayFrequency: Record<number, number> = {};
      const hourFrequency: Record<number, number> = {};
      const gaps: number[] = [];

      for (let i = 0; i < episodes.length; i++) {
        const date = new Date(episodes[i].created_at);
        const day = date.getDay();
        const hour = date.getHours();

        dayFrequency[day] = (dayFrequency[day] || 0) + 1;
        hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;

        if (i < episodes.length - 1) {
          const prevDate = new Date(episodes[i + 1].created_at);
          const gapDays = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (gapDays > 0 && gapDays < 30) {
            gaps.push(gapDays);
          }
        }
      }

      // Find most common day and hour
      let mostCommonDay = 0;
      let maxDayCount = 0;
      Object.entries(dayFrequency).forEach(([day, count]) => {
        if (count > maxDayCount) {
          maxDayCount = count;
          mostCommonDay = parseInt(day);
        }
      });

      let mostCommonHour = 18; // Default to 6 PM
      let maxHourCount = 0;
      Object.entries(hourFrequency).forEach(([hour, count]) => {
        if (count > maxHourCount) {
          maxHourCount = count;
          mostCommonHour = parseInt(hour);
        }
      });

      // Calculate confidence based on consistency
      const dayConfidence = maxDayCount / episodes.length;
      const hourConfidence = maxHourCount / episodes.length;
      const overallConfidence = (dayConfidence + hourConfidence) / 2;

      // Get anime title
      const { data: anime } = await supabase
        .from('anime')
        .select('title')
        .eq('id', animeId)
        .single();

      const pattern: ReleasePattern = {
        animeId,
        animeTitle: anime?.title || 'Unknown Anime',
        dayOfWeek: mostCommonDay,
        typicalHour: mostCommonHour,
        confidence: overallConfidence,
        lastUpdated: new Date().toISOString(),
      };

      // Save to state and localStorage
      setSchedules(prev => {
        const newMap = new Map(prev);
        newMap.set(animeId, pattern);
        
        const obj: Record<string, ReleasePattern> = {};
        newMap.forEach((value, key) => {
          obj[key] = value;
        });
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(obj));
        
        return newMap;
      });

      setIsAnalyzing(false);
      return pattern;
    } catch (error) {
      console.error('Error analyzing release pattern:', error);
      setIsAnalyzing(false);
      return null;
    }
  }, []);

  // Analyze patterns for all favorite anime
  const analyzeAllFavorites = useCallback(async () => {
    if (!user) return;

    const { data: favorites } = await supabase
      .from('user_favorites')
      .select('anime_id')
      .eq('user_id', user.id);

    if (!favorites || favorites.length === 0) {
      toast.info('Add anime to your favorites to get release reminders');
      return;
    }

    toast.info('Analyzing release patterns...', { duration: 2000 });

    let analyzed = 0;
    for (const fav of favorites) {
      const pattern = await analyzeReleasePattern(fav.anime_id);
      if (pattern && pattern.confidence > 0.5) {
        analyzed++;
      }
    }

    toast.success(`Analyzed ${analyzed} anime with consistent release patterns`);
  }, [user, analyzeReleasePattern]);

  // Set reminder for an anime
  const setReminder = useCallback((animeId: string, enabled: boolean) => {
    const schedule = schedules.get(animeId);
    if (!schedule) {
      toast.error('Please analyze release pattern first');
      return;
    }

    // Calculate next expected release
    const now = new Date();
    const nextRelease = new Date();
    
    // Set to next occurrence of the typical day
    const daysUntilRelease = (schedule.dayOfWeek - now.getDay() + 7) % 7;
    nextRelease.setDate(now.getDate() + (daysUntilRelease === 0 ? 7 : daysUntilRelease));
    nextRelease.setHours(schedule.typicalHour, 0, 0, 0);

    const reminder: EpisodeReminder = {
      animeId,
      animeTitle: schedule.animeTitle,
      expectedTime: nextRelease.toISOString(),
      enabled,
    };

    setReminders(prev => {
      const newMap = new Map(prev);
      if (enabled) {
        newMap.set(animeId, reminder);
      } else {
        newMap.delete(animeId);
      }

      const obj: Record<string, EpisodeReminder> = {};
      newMap.forEach((value, key) => {
        obj[key] = value;
      });
      localStorage.setItem(REMINDER_KEY, JSON.stringify(obj));

      return newMap;
    });

    if (enabled) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      toast.success(`Reminder set! ${schedule.animeTitle} typically releases on ${dayNames[schedule.dayOfWeek]}s around ${schedule.typicalHour}:00`);
    } else {
      toast.info('Reminder disabled');
    }
  }, [schedules]);

  // Check for due reminders
  const checkReminders = useCallback(() => {
    const now = new Date();

    reminders.forEach((reminder, animeId) => {
      if (!reminder.enabled) return;

      const expectedTime = new Date(reminder.expectedTime);
      const timeDiff = expectedTime.getTime() - now.getTime();
      const hoursUntil = timeDiff / (1000 * 60 * 60);

      // Notify 1 hour before expected release
      if (hoursUntil > 0 && hoursUntil <= 1) {
        if (Notification.permission === 'granted') {
          new Notification(`${reminder.animeTitle} - Episode Soon!`, {
            body: `New episode typically releases in about ${Math.round(hoursUntil * 60)} minutes`,
            icon: 'https://storage.googleapis.com/gpt-engineer-file-uploads/9zI1yCNlGfZymWSADZuYy9FGrtQ2/uploads/1768537236542-logo.png',
            tag: `reminder-${animeId}`,
          });
        }
      }
    });
  }, [reminders]);

  // Set up periodic reminder checks
  useEffect(() => {
    if (Notification.permission === 'granted') {
      checkReminders(); // Initial check
      const interval = setInterval(checkReminders, 30 * 60 * 1000); // Check every 30 minutes
      return () => clearInterval(interval);
    }
  }, [checkReminders]);

  // Get schedule for specific anime
  const getSchedule = useCallback((animeId: string): ReleasePattern | undefined => {
    return schedules.get(animeId);
  }, [schedules]);

  // Get reminder for specific anime
  const getReminder = useCallback((animeId: string): EpisodeReminder | undefined => {
    return reminders.get(animeId);
  }, [reminders]);

  // Format schedule for display
  const formatSchedule = useCallback((pattern: ReleasePattern): string => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hour = pattern.typicalHour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${dayNames[pattern.dayOfWeek]}s around ${displayHour}:00 ${ampm}`;
  }, []);

  return {
    schedules,
    reminders,
    isAnalyzing,
    analyzeReleasePattern,
    analyzeAllFavorites,
    setReminder,
    getSchedule,
    getReminder,
    formatSchedule,
  };
}
