import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Send, Copy, X, Crown, UserPlus, Link2, Tv, Play, Eye, MessageSquare, SmilePlus, Sparkles, LogOut } from 'lucide-react';
import { RecapSidebar } from '@/components/watch-party/RecapSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { setWatchPartySession, setWatchPartyPlayback, getWatchPartyPlayback, expectedPartyTime } from '@/lib/watchPartySession';

// Message validation schema
const messageSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or less'),
});

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isHost?: boolean;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user IDs
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

interface PartyInfo {
  animeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeId: string;
}

interface WatchPartyProps {
  episodeId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  animeTitle: string;
  episodeNumber: number;
  seasonNumber?: number;
  animeId?: string;
}

interface JoinedParty {
  id: string;
  code: string;
  anime_title: string;
  season_number: number;
  episode_number: number;
  episode_id: string;
  is_active: boolean;
  host_id: string;
}

export function WatchParty({ episodeId, videoRef, animeTitle, episodeNumber, seasonNumber = 1, animeId }: WatchPartyProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; name: string; isHost: boolean }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'party' | 'chat' | 'recap'>('party');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Drop ?party= once membership ends so normal history saving resumes.
  const clearPartyParam = useCallback(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('party')) return;
    url.searchParams.delete('party');
    navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
  }, [navigate]);

  // Generate a unique party code with timestamp
  const generatePartyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const timestamp = Date.now().toString(36).slice(-2).toUpperCase();
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return timestamp + randomPart;
  };

  // Create a new watch party with database
  const createParty = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to create a watch party');
      return;
    }

    if (!animeId) {
      toast.error('Anime ID is required');
      return;
    }

    const code = generatePartyCode();
    
    try {
      // Insert party into database
      const { data: party, error } = await supabase
        .from('watch_parties')
        .insert({
          code,
          host_id: user.id,
          anime_id: animeId,
          episode_id: episodeId,
          anime_title: animeTitle,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          playback_time: videoRef.current?.currentTime || 0,
          is_playing: !videoRef.current?.paused,
        })
        .select()
        .single();

      if (error) throw error;

      // Add host as member
      await supabase.from('watch_party_members').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Host',
      });

      // Add system message
      await supabase.from('watch_party_messages').insert({
        party_id: party.id,
        user_id: user.id,
        username: 'System',
        message: `Watch party created! Share the code: ${code}`,
        is_host: false,
      });

      setPartyCode(code);
      setPartyId(party.id);
      setIsHost(true);
      setPartyInfo({
        animeTitle,
        seasonNumber,
        episodeNumber,
        episodeId,
      });
      setParticipants([{ id: user.id, name: user.email?.split('@')[0] || 'Host', isHost: true }]);
      setShowCreateDialog(false);
      setIsOpen(true);

      toast.success(`Watch party created! Code: ${code}`);
    } catch (error) {
      console.error('Error creating party:', error);
      toast.error('Failed to create watch party');
    }
  }, [user, animeTitle, seasonNumber, episodeNumber, episodeId, animeId, videoRef]);

  // Join an existing party
  const joinParty = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }

    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }

    try {
      // Find the party
      const { data: party, error } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !party) {
        toast.error('Offline', { description: 'This party code is not available or has ended.' });
        return;
      }

      // Add user as member
      await supabase.from('watch_party_members').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Guest',
      });

      // Add join message
      await supabase.from('watch_party_messages').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Guest',
        message: `${user.email?.split('@')[0] || 'Guest'} joined the party!`,
        is_host: false,
      });

      setPartyCode(party.code);
      setPartyId(party.id);
      setIsHost(false);
      setPartyInfo({
        animeTitle: party.anime_title,
        seasonNumber: party.season_number,
        episodeNumber: party.episode_number,
        episodeId: party.episode_id,
      });
      setShowJoinDialog(false);
      setIsOpen(true);

      // Navigate to the episode if different
      if (party.episode_id !== episodeId) {
        navigate(`/watch/${party.episode_id}?party=${party.code}`);
      }

      toast.success('Joined the watch party!');
    } catch (error) {
      console.error('Error joining party:', error);
      toast.error('Failed to join watch party');
    }
  }, [user, joinCode, episodeId, navigate]);

  // Restore party membership when arriving via a ?party=CODE link (header Join / View Parties / episode switch)
  const restoredCodeRef = useRef<string | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('party')?.toUpperCase();
    if (!user || !code || partyCode || restoredCodeRef.current === code) return;
    restoredCodeRef.current = code;
    let cancelled = false;
    let settled = false;
    (async () => {
      const { data: party } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (cancelled) return;
      settled = true;
      if (!party) {
        toast.error('Offline', { description: 'This party code is not available or has ended.' });
        clearPartyParam();
        return;
      }
      const name = user.email?.split('@')[0] || 'Guest';
      const host = party.host_id === user.id;
      const { data: existing } = await supabase
        .from('watch_party_members')
        .select('id')
        .eq('party_id', party.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from('watch_party_members').insert({ party_id: party.id, user_id: user.id, username: name });
        if (!host) {
          await supabase.from('watch_party_messages').insert({
            party_id: party.id, user_id: user.id, username: name, message: `${name} joined the party!`, is_host: false,
          });
        }
      }
      if (cancelled) return;
      setPartyCode(party.code);
      setPartyId(party.id);
      setIsHost(host);
      setPartyInfo({
        animeTitle: party.anime_title,
        seasonNumber: party.season_number,
        episodeNumber: party.episode_number,
        episodeId: party.episode_id,
      });
    })();
    return () => { cancelled = true; if (!settled) restoredCodeRef.current = null; };
  }, [user, partyCode]);

  // Always resolve the live <video>: the element is remounted on episode and
  // server switches, so a ref captured at render time goes stale.
  const videoRefLatest = useRef(videoRef);
  videoRefLatest.current = videoRef;
  const getVideo = useCallback(
    () => (document.querySelector('video') as HTMLVideoElement | null) ?? videoRefLatest.current.current,
    [],
  );
  const episodeIdRef = useRef(episodeId);
  episodeIdRef.current = episodeId;

  // Publish membership so the Watch page can lock guest controls and skip history.
  useEffect(() => {
    setWatchPartySession(partyId && partyCode ? { partyId, code: partyCode, isHost } : null);
  }, [partyId, partyCode, isHost]);
  useEffect(() => () => setWatchPartySession(null), []);

  // Host changes episode -> move the whole room to the new episode.
  useEffect(() => {
    if (!isHost || !partyId || !episodeId) return;
    if (partyInfo?.episodeId === episodeId) return;
    setPartyInfo({ animeTitle, seasonNumber, episodeNumber, episodeId });
    supabase
      .from('watch_parties')
      .update({
        episode_id: episodeId,
        anime_id: animeId,
        anime_title: animeTitle,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        playback_time: 0,
      })
      .eq('id', partyId)
      .then(({ error }) => { if (error) console.error('Party episode sync failed:', error); });
  }, [isHost, partyId, episodeId, partyInfo?.episodeId, animeId, animeTitle, seasonNumber, episodeNumber]);

  // Real-time sync: Host syncs playback state
  useEffect(() => {
    if (!isHost || !partyId) return;

    const syncPlayback = async () => {
      const video = getVideo();
      if (!video) return;

      await supabase
        .from('watch_parties')
        .update({
          playback_time: video.currentTime,
          is_playing: !video.paused,
        })
        .eq('id', partyId);
    };

    // Sync every 2 seconds
    syncIntervalRef.current = setInterval(syncPlayback, 2000);

    // Media events don't bubble, but document capture sees every <video>,
    // including ones remounted after a server switch.
    const onMediaEvent = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) syncPlayback();
    };
    document.addEventListener('play', onMediaEvent, true);
    document.addEventListener('pause', onMediaEvent, true);
    document.addEventListener('seeked', onMediaEvent, true);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      document.removeEventListener('play', onMediaEvent, true);
      document.removeEventListener('pause', onMediaEvent, true);
      document.removeEventListener('seeked', onMediaEvent, true);
    };
  }, [isHost, partyId, getVideo]);

  // Real-time sync: Non-host follows the host and cannot drive playback.
  useEffect(() => {
    if (isHost || !partyId) return;

    let applying = false;
    const applyState = () => {
      const state = getWatchPartyPlayback();
      const video = getVideo();
      if (!state || !video || applying) return;
      applying = true;
      try {
        const target = expectedPartyTime(state);
        if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 2) {
          video.currentTime = target;
        }
        if (state.playing && video.paused) {
          video.play().catch(() => {
            // Autoplay blocked: start muted so the guest stays in sync.
            try { video.muted = true; video.play().catch(() => {}); } catch {}
          });
        } else if (!state.playing && !video.paused) {
          video.pause();
        }
      } finally {
        applying = false;
      }
    };

    const handleParty = (party: any) => {
      console.info('PARTYDBG', party.is_playing, party.playback_time);
      if (!party.is_active) {
        toast.error('Party is ended', {
          description: 'The host has ended this watch party',
          duration: 5000,
        });
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        setPartyCode(null);
        setPartyId(null);
        setIsHost(false);
        setParticipants([]);
        setMessages([]);
        setPartyInfo(null);
        clearPartyParam();
        setIsOpen(false);
        return;
      }

      setWatchPartyPlayback({ time: Number(party.playback_time) || 0, playing: !!party.is_playing, at: Date.now() });

      // Host moved to another episode -> follow.
      if (party.episode_id && party.episode_id !== episodeIdRef.current) {
        setPartyInfo({
          animeTitle: party.anime_title,
          seasonNumber: party.season_number,
          episodeNumber: party.episode_number,
          episodeId: party.episode_id,
        });
        navigate(`/watch/${party.episode_id}?party=${party.code}`, { replace: true });
        return;
      }

      applyState();
    };

    // Initial state, so guests sync immediately instead of waiting for the next tick.
    supabase
      .from('watch_parties')
      .select('*')
      .eq('id', partyId)
      .maybeSingle()
      .then(({ data }) => { if (data) handleParty(data); });

    const channel = supabase
      .channel(`party-sync-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'watch_parties',
          filter: `id=eq.${partyId}`,
        },
        (payload) => handleParty(payload.new),
      )
      .subscribe((status) => console.info('PARTYDBG status', status));

    // Revert any guest-side play/pause/seek (lock screen, PiP, native controls).
    const onMediaEvent = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) applyState();
    };
    document.addEventListener('play', onMediaEvent, true);
    document.addEventListener('pause', onMediaEvent, true);
    document.addEventListener('seeked', onMediaEvent, true);
    document.addEventListener('loadedmetadata', onMediaEvent, true);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('play', onMediaEvent, true);
      document.removeEventListener('pause', onMediaEvent, true);
      document.removeEventListener('seeked', onMediaEvent, true);
      document.removeEventListener('loadedmetadata', onMediaEvent, true);
    };
  }, [isHost, partyId, getVideo, navigate]);

  // Real-time: Listen for new messages
  useEffect(() => {
    if (!partyId) return;

    // Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('watch_party_messages')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          userId: m.user_id,
          username: m.username,
          message: m.message,
          timestamp: new Date(m.created_at),
          isHost: m.is_host,
        })));
      }
    };

    loadMessages();

    // Load participants
    const loadParticipants = async () => {
      const { data: party } = await supabase
        .from('watch_parties')
        .select('host_id')
        .eq('id', partyId)
        .single();

      const { data: members } = await supabase
        .from('watch_party_members')
        .select('*')
        .eq('party_id', partyId);

      if (members && party) {
        setParticipants(members.map(m => ({
          id: m.user_id,
          name: m.username || 'Anonymous',
          isHost: m.user_id === party.host_id,
        })));
      }
    };

    loadParticipants();

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`party-messages-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'watch_party_messages',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const msg = payload.new as any;
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, {
            id: msg.id,
            userId: msg.user_id,
            username: msg.username,
            message: msg.message,
            timestamp: new Date(msg.created_at),
            isHost: msg.is_host,
          }]);
        }
      )
      .subscribe();

    // Subscribe to member changes
    const memberChannel = supabase
      .channel(`party-members-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watch_party_members',
          filter: `party_id=eq.${partyId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [partyId]);

  // Send chat message with validation
  const sendMessage = useCallback(async () => {
    if (!user || !partyId) return;

    // Validate message using zod schema
    const result = messageSchema.safeParse({ message: newMessage });
    if (!result.success) {
      const error = result.error.issues[0];
      toast.error(error.message);
      return;
    }

    const validatedMessage = result.data.message;

    try {
      const { error } = await supabase.from('watch_party_messages').insert({
        party_id: partyId,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Anonymous',
        message: validatedMessage,
        is_host: isHost,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, [newMessage, user, partyId, isHost]);

  // Add emoji reaction to a message
  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!user) return;
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        const userReactions = reactions[emoji] || [];
        
        // Toggle reaction
        if (userReactions.includes(user.id)) {
          // Remove reaction
          const newUserReactions = userReactions.filter(id => id !== user.id);
          if (newUserReactions.length === 0) {
            const { [emoji]: _, ...rest } = reactions;
            return { ...msg, reactions: Object.keys(rest).length > 0 ? rest : undefined };
          }
          return { ...msg, reactions: { ...reactions, [emoji]: newUserReactions } };
        } else {
          // Add reaction
          return { ...msg, reactions: { ...reactions, [emoji]: [...userReactions, user.id] } };
        }
      }
      return msg;
    }));
  }, [user]);

  // Copy party code
  const copyCode = () => {
    if (partyCode) {
      navigator.clipboard.writeText(partyCode);
      toast.success('Party code copied!');
    }
  };

  // Leave party
  const leaveParty = async () => {
    if (partyId && user) {
      if (isHost) {
        // End the party
        await supabase
          .from('watch_parties')
          .update({ is_active: false })
          .eq('id', partyId);
        toast.success('Watch party ended');
      } else {
        // Remove from members
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('party_id', partyId)
          .eq('user_id', user.id);
        toast.success('Left the watch party');
      }
    }

    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    setPartyCode(null);
    setPartyId(null);
    setIsHost(false);
    setParticipants([]);
    setMessages([]);
    setPartyInfo(null);
    clearPartyParam();
    setIsOpen(false);
  };

  // End party (host or any authenticated member) - uses SECURITY DEFINER function
  const endParty = async () => {
    if (!partyId || !user) return;
    
    try {
      const { data, error } = await supabase.rpc('end_watch_party', { party_uuid: partyId });

      if (error) {
        console.error('Error ending party:', error);
        toast.error('Failed to end party');
        return;
      }

      if (!data) {
        toast.error('You are not a member of this party');
        return;
      }

      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      setPartyCode(null);
      setPartyId(null);
      setIsHost(false);
      setParticipants([]);
      setMessages([]);
      setPartyInfo(null);
      clearPartyParam();
      setIsOpen(false);
      toast.success('Watch party ended');
    } catch (error) {
      console.error('Error ending party:', error);
      toast.error('Failed to end party');
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle keyboard events for chat
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Check if user already joined via URL party code
  const searchParams = new URLSearchParams(window.location.search);
  const urlPartyCode = searchParams.get('party');
  const isJoinedViaUrl = !!urlPartyCode && !partyCode;

  if (!partyCode) {
    return (
      <div className="flex items-center gap-2">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Watch Party</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="party-v2 sm:max-w-md">
            <PartyHero icon={Crown} tone="create" eyebrow="Host · Live sync" title="Create a Watch Party" description="Start a room and share the code. Everyone watches in sync with live chat." />
            <div className="party-v2-body">
              <div className="party-v2-episode">
                <span className="party-v2-episode-icon"><Tv /></span>
                <div className="min-w-0">
                  <p className="party-v2-episode-title">{animeTitle}</p>
                  <p className="party-v2-episode-sub">Season {seasonNumber} · Episode {episodeNumber}</p>
                </div>
              </div>
              <ul className="party-v2-perks">
                <li><Play /> Synced playback</li>
                <li><MessageSquare /> Live chat</li>
                <li><Sparkles /> AI recap</li>
              </ul>
              <Button onClick={createParty} className="party-v2-cta">
                <Crown /> Create Party
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Only show Join button if user hasn't joined via URL */}
        {!isJoinedViaUrl && (
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Join</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="party-v2 sm:max-w-md">
              <PartyHero icon={UserPlus} tone="join" eyebrow="Live sync · Watch together" title="Join a Watch Party" description="Enter the 6-character code shared by your friend." />
              <div className="party-v2-body">
                <PartyCodeCells value={joinCode} onChange={setJoinCode} />
                <Button onClick={joinParty} className="party-v2-cta" disabled={joinCode.length !== 6}>
                  <Link2 /> Join Party
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1">
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-primary/10 border-primary/30">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Party</span>
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {participants.length}
            </span>
          </Button>
        </SheetTrigger>
        {/* Desktop-only Chat tab button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 hidden sm:inline-flex"
          onClick={() => { setActiveTab('chat'); setIsOpen(true); }}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </Button>
      </div>
      <SheetContent side="right" className="party-sheet w-full sm:w-96 p-0 flex flex-col gap-0">
        <SheetHeader className="party-sheet-head">
          <SheetTitle className="party-sheet-title">
            <span className="party-sheet-title-icon"><Users /></span>
            Watch Party
            <span className="party-v2-live"><span className="party-v2-live-dot" />Live</span>
          </SheetTitle>

          {/* Party code */}
          <div className="party-sheet-code">
            <div className="min-w-0 flex-1">
              <p className="party-sheet-label">Party Code</p>
              <p className="party-sheet-code-value">{partyCode}</p>
            </div>
            <Button size="sm" variant="outline" onClick={copyCode} className="party-sheet-copy">
              <Copy /> Copy
            </Button>
          </div>

          {/* Now Watching Info */}
          {partyInfo && (
            <div className="party-sheet-now">
              <p className="party-sheet-label"><Play /> {isHost ? 'Now Watching' : 'Synced with Host'}</p>
              <p className="party-sheet-now-title">{partyInfo.animeTitle}</p>
              <p className="party-sheet-now-sub">Season {partyInfo.seasonNumber} · Episode {partyInfo.episodeNumber}</p>
            </div>
          )}

          <div className="party-sheet-actions" data-host={isHost || undefined}>
            <Button variant="ghost" size="sm" onClick={endParty} className="party-v2-end">
              <X /> End Party
            </Button>
            {!isHost && (
              <Button variant="ghost" size="sm" onClick={leaveParty} className="party-sheet-leave">
                <LogOut /> Leave
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Tab switcher */}
        <div className="party-sheet-tabs" role="tablist">
          {([
            ['party', Users, 'Party'],
            ['recap', Sparkles, 'Recap'],
            ['chat', MessageSquare, 'Chat'],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className="party-sheet-tab"
              data-active={activeTab === key || undefined}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'party' ? (
          <>
            {/* Participants */}
            <div className="party-sheet-people">
              <p className="text-xs text-muted-foreground mb-2">Participants ({participants.length})</p>
              <div className="flex flex-wrap gap-2">
                {participants.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1 text-xs"
                  >
                    {p.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
              <p className="text-center">Switch to <strong>Recap</strong> for a 30s AI catch-up, or <strong>Chat</strong> to talk with friends!</p>
            </div>
          </>
        ) : activeTab === 'recap' ? (
          <RecapSidebar episodeId={episodeId} partyId={partyId} isHost={isHost} />
        ) : (
          <>
            {/* Chat messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 group ${msg.userId === 'system' || msg.username === 'System' ? 'justify-center' : ''}`}>
                    {msg.userId !== 'system' && msg.username !== 'System' && (
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary/20">
                          {msg.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`${msg.userId === 'system' || msg.username === 'System' ? 'text-center' : ''}`}>
                      {msg.userId === 'system' || msg.username === 'System' ? (
                        <p className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                          {msg.message}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{msg.username}</span>
                            {msg.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                            <span className="text-[10px] text-muted-foreground">
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm bg-muted rounded-lg px-3 py-1.5 inline-block">
                              {msg.message}
                            </p>
                            
                            {/* Emoji reaction button */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-1 transition-all">
                                  <SmilePlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" side="top" align="start">
                                <div className="flex gap-1">
                                  {EMOJI_OPTIONS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => addReaction(msg.id, emoji)}
                                      className="text-lg hover:bg-muted rounded p-1 transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Reaction display */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(msg.id, emoji)}
                                  className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                    users.includes(user?.id || '') 
                                      ? 'bg-primary/20 border-primary/50' 
                                      : 'bg-muted/50 border-border hover:bg-muted'
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat input */}
            <div className="party-sheet-composer">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SHARED PARTY PRESENTATION — scoped liquid-glass surface
// ─────────────────────────────────────────────────────────────────────
type PartyTone = 'create' | 'join' | 'view';

function PartyHero({ icon: Icon, tone, eyebrow, title, description }: {
  icon: React.ComponentType<{ className?: string }>;
  tone: PartyTone;
  eyebrow: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <DialogHeader className="party-v2-hero" data-tone={tone}>
      <span className="party-v2-hero-glow" aria-hidden="true" />
      <span className="party-v2-hero-icon"><Icon /></span>
      <span className="party-v2-eyebrow"><span className="party-v2-live-dot" />{eyebrow}</span>
      <DialogTitle className="party-v2-title">{title}</DialogTitle>
      <DialogDescription className="party-v2-desc">{description}</DialogDescription>
    </DialogHeader>
  );
}

function PartyCodeCells({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length: 6 }, (_, i) => value[i] || '');
  return (
    <div className="party-v2-code">
      <div className="party-v2-cells" data-focused={focused || undefined}>
        {cells.map((char, i) => (
          <span key={i} className="party-v2-cell" data-filled={char ? true : undefined} data-active={focused && i === Math.min(value.length, 5) ? true : undefined}>
            {char}
          </span>
        ))}
        <input
          autoFocus
          value={value}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.length === 6) onSubmit?.(); }}
          maxLength={6}
          className="party-v2-code-input"
          aria-label="Party code"
        />
      </div>
      <p className="party-v2-hint">Letters &amp; numbers only · {value.length}/6</p>
    </div>
  );
}

function useControllableOpen(open?: boolean, onOpenChange?: (v: boolean) => void) {
  const [inner, setInner] = useState(false);
  const controlled = open !== undefined;
  const value = controlled ? open : inner;
  const set = (v: boolean) => { if (!controlled) setInner(v); onOpenChange?.(v); };
  return [value, set] as const;
}

// ─────────────────────────────────────────────────────────────────────
// JOIN PARTY DIALOG
// ─────────────────────────────────────────────────────────────────────
export function JoinPartyDialog({ trigger, open: openProp, onOpenChange }: { trigger?: React.ReactNode | null; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [open, setOpen] = useControllableOpen(openProp, onOpenChange);
  const [busy, setBusy] = useState(false);

  const handleJoin = async () => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }
    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }
    setBusy(true);
    try {
      const { data: party, error } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !party) {
        toast.error('Party not found or has ended');
        setBusy(false);
        return;
      }

      toast.success(`Joining party for ${party.anime_title}...`);
      setOpen(false);
      navigate(`/watch/${party.episode_id}?party=${party.code}`);
    } catch {
      toast.error('Failed to find watch party');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
              <UserPlus className="h-4 w-4" />
              Join Party
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="party-v2 sm:max-w-md">
        <PartyHero
          icon={UserPlus}
          tone="join"
          eyebrow="Live sync · Watch together"
          title="Join a Watch Party"
          description={<>Enter the <strong>6-character code</strong> your friend shared to watch in perfect sync.</>}
        />
        <div className="party-v2-body">
          <PartyCodeCells value={joinCode} onChange={setJoinCode} onSubmit={handleJoin} />
          <Button onClick={handleJoin} disabled={joinCode.length !== 6 || busy} className="party-v2-cta">
            <Link2 /> {busy ? 'Joining…' : 'Join Party'}
          </Button>
          <ul className="party-v2-perks">
            <li><Play /> Synced playback</li>
            <li><MessageSquare /> Live chat</li>
            <li><SmilePlus /> Reactions</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VIEW PARTY DIALOG — Premium redesign + auto-cleanup of empty parties
// ─────────────────────────────────────────────────────────────────────
const EMPTY_PARTY_TIMEOUT_MS = 30_000; // 30s

export function ViewPartyDialog({ trigger, open: openProp, onOpenChange }: { trigger?: React.ReactNode | null; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useControllableOpen(openProp, onOpenChange);
  const [parties, setParties] = useState<(JoinedParty & { memberCount: number; ageMs: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);

  const sweepEmptyParties = useCallback(async (rows: JoinedParty[]) => {
    // For each party, count members. If memberCount <= 1 AND age > timeout → end it.
    const now = Date.now();
    const enriched: (JoinedParty & { memberCount: number; ageMs: number })[] = [];
    for (const p of rows) {
      const { count } = await supabase
        .from('watch_party_members')
        .select('id', { count: 'exact', head: true })
        .eq('party_id', p.id);
      const memberCount = count ?? 0;
      const ageMs = now - new Date((p as any).created_at || now).getTime();
      const isOrphan = memberCount <= 1 && ageMs > EMPTY_PARTY_TIMEOUT_MS;
      if (isOrphan) {
        // Auto-close on every device
        await supabase.from('watch_parties').update({ is_active: false }).eq('id', p.id);
        continue; // skip from list
      }
      enriched.push({ ...p, memberCount, ageMs });
    }
    return enriched;
  }, []);

  const loadJoinedParties = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('watch_party_members')
        .select('party_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const partyIds = memberships.map((m) => m.party_id);
        const { data: partyData } = await supabase
          .from('watch_parties')
          .select('*')
          .in('id', partyIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        const enriched = await sweepEmptyParties((partyData || []) as JoinedParty[]);
        setParties(enriched);
      } else {
        setParties([]);
      }
    } catch (error) {
      console.error('Error loading parties:', error);
    } finally {
      setLoading(false);
    }
  }, [user, sweepEmptyParties]);

  useEffect(() => {
    if (open && user) {
      loadJoinedParties();
      // Periodic re-sweep every 15s while dialog open
      const id = setInterval(loadJoinedParties, 15_000);
      return () => clearInterval(id);
    }
  }, [open, user, loadJoinedParties]);

  const handleJoinParty = (party: JoinedParty) => {
    setOpen(false);
    navigate(`/watch/${party.episode_id}?party=${party.code}`);
  };

  const handleEndParty = async (e: React.MouseEvent, partyId: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('watch_parties').update({ is_active: false }).eq('id', partyId);
      if (error) throw error;
      toast.success('Party ended');
      setParties((prev) => prev.filter((p) => p.id !== partyId));
    } catch {
      toast.error('Failed to end party');
    }
  };

  // Clear ALL parties this user is involved in — across every device
  const handleClearAll = async () => {
    if (!user || parties.length === 0) return;
    setPurging(true);
    try {
      const ids = parties.map((p) => p.id);
      // 1) End any party I host (this hides from all members on every device)
      const hosted = parties.filter((p) => p.host_id === user.id).map((p) => p.id);
      if (hosted.length > 0) {
        await supabase.from('watch_parties').update({ is_active: false }).in('id', hosted);
      }
      // 2) Remove my membership from non-hosted parties (clears my own device list)
      const guestIds = ids.filter((id) => !hosted.includes(id));
      if (guestIds.length > 0) {
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('user_id', user.id)
          .in('party_id', guestIds);
      }
      setParties([]);
      toast.success('All saved parties cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear parties');
    } finally {
      setPurging(false);
    }
  };

  const fmtAge = (ms: number) => {
    if (ms < 60_000) return 'just now';
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
              <Eye className="h-4 w-4" />
              View Parties
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="party-v2 sm:max-w-md">
        <PartyHero
          icon={Eye}
          tone="view"
          eyebrow={`Live parties${parties.length ? ` · ${parties.length}` : ''}`}
          title="Your Watch Parties"
          description={<>Rooms you've joined. Empty parties close after <strong>30 seconds</strong>.</>}
        />
        <div className="party-v2-body">
          {loading && parties.length === 0 ? (
            <div className="party-v2-list" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="party-v2-skeleton" />)}
            </div>
          ) : parties.length === 0 ? (
            <div className="party-v2-empty">
              <span className="party-v2-empty-icon"><Users /></span>
              <p className="party-v2-empty-title">No active parties</p>
              <p className="party-v2-empty-sub">Join a friend's room with a code, or start one from any episode.</p>
            </div>
          ) : (
            <ul className="party-v2-list">
              {parties.map((party) => {
                const isHost = party.host_id === user?.id;
                const closingSoon =
                  party.memberCount <= 1 &&
                  EMPTY_PARTY_TIMEOUT_MS - party.ageMs < 15_000 &&
                  party.ageMs < EMPTY_PARTY_TIMEOUT_MS;
                return (
                  <li key={party.id} className="party-v2-room">
                    <div className="party-v2-room-main">
                      <span className="party-v2-room-code">{party.code}</span>
                      <div className="min-w-0 flex-1">
                        <p className="party-v2-room-title">
                          {isHost && <Crown className="party-v2-host" aria-label="You host this party" />}
                          <span className="truncate">{party.anime_title}</span>
                        </p>
                        <p className="party-v2-room-meta">
                          <span className="party-v2-live"><span className="party-v2-live-dot" />Live</span>
                          <span>S{party.season_number} · E{party.episode_number}</span>
                          <span className="inline-flex items-center gap-1"><Users />{party.memberCount}</span>
                          <span>{fmtAge(party.ageMs)}</span>
                        </p>
                        {closingSoon && <span className="party-v2-warn">Closing soon</span>}
                      </div>
                    </div>
                    <div className="party-v2-room-actions">
                      <Button size="sm" onClick={() => handleJoinParty(party)} className="party-v2-watch">
                        <Play /> Watch
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => handleEndParty(e, party.id)} className="party-v2-end" aria-label={`End party ${party.code}`}>
                        <X /> End
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {parties.length > 0 && (
            <div className="party-v2-footer">
              <Button variant="ghost" onClick={handleClearAll} disabled={purging} className="party-v2-clear">
                <X /> {purging ? 'Clearing…' : `Clear all ${parties.length} ${parties.length === 1 ? 'party' : 'parties'}`}
              </Button>
              <p className="party-v2-hint">Ends parties you host for everyone and removes the rest from your list on all devices.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
