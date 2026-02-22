import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ReleaseReminderSettings } from '@/components/ReleaseReminderSettings';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Shield, Globe, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [autoplay, setAutoplay] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    
    // Add transition class for smooth theme change
    root.classList.add('theme-transitioning');
    
    if (newTheme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemPrefersDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
    
    // Remove transition class after animation completes
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 500);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
    
    setTimeout(() => setIsTransitioning(false), 500);
  };

  if (!user) return null;

  return (
    <div className="container py-12 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-primary">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">Manage your app preferences</p>
      </div>

      <div className="space-y-6">
        {/* Theme - Locked to Dark */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Theme is locked to dark mode for the best viewing experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Moon className="h-5 w-5 text-primary" />
              <span className="font-medium">Dark Mode</span>
              <span className="text-xs text-muted-foreground ml-auto">Always On</span>
            </div>
          </CardContent>
        </Card>

        {/* Push Notification Settings */}
        <NotificationSettings />

        {/* Release Reminder Settings */}
        <ReleaseReminderSettings />

        {/* Playback Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Playback
            </CardTitle>
            <CardDescription>
              Video playback preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoplay">Autoplay Next Episode</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically play the next episode when current one ends
                </p>
              </div>
              <Switch
                id="autoplay"
                checked={autoplay}
                onCheckedChange={setAutoplay}
              />
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </CardTitle>
            <CardDescription>
              Quick controls for the video player
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Play/Pause</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Fullscreen</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Mute/Unmute</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">PiP Mode</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">P</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Skip Forward</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">→</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">Skip Backward</span>
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono">←</kbd>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/profile')}
            >
              Manage Profile Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}