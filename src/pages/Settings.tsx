import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Bell, Shield, Globe, Lock, Timer } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system' | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [isThemeLocked, setIsThemeLocked] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<'light' | 'dark' | 'system' | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // Load saved theme preference and lock status
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    const themeLocked = localStorage.getItem('theme_locked') === 'true';
    
    if (savedTheme) {
      setTheme(savedTheme);
    }
    setIsThemeLocked(themeLocked);
  }, [user, navigate]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && pendingTheme) {
      // Time's up, lock the theme
      localStorage.setItem('theme_locked', 'true');
      setIsThemeLocked(true);
      setPendingTheme(null);
      toast.success(`Theme locked to "${theme}". This cannot be changed.`);
    }
  }, [countdown, pendingTheme, theme]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (isThemeLocked) {
      toast.error('Theme is locked. You cannot change it anymore.');
      return;
    }
    
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Apply theme immediately
    const root = document.documentElement;
    if (newTheme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemPrefersDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
    
    // Start the 10-second countdown if not already in a countdown
    if (!pendingTheme) {
      setPendingTheme(newTheme);
      setCountdown(10);
      toast.info('You have 10 seconds to change your theme before it locks.');
    } else {
      // Reset countdown when changing theme during countdown
      setCountdown(10);
      setPendingTheme(newTheme);
    }
  };

  const cancelThemeChange = () => {
    // Revert to no theme selected if canceling during countdown
    if (pendingTheme && countdown > 0) {
      localStorage.removeItem('theme');
      setTheme(null);
      setPendingTheme(null);
      setCountdown(0);
      
      // Remove dark class
      document.documentElement.classList.remove('dark');
      toast.info('Theme selection cancelled.');
    }
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
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isThemeLocked ? <Lock className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Appearance
              {isThemeLocked && (
                <span className="text-xs text-muted-foreground ml-2">(Locked)</span>
              )}
            </CardTitle>
            <CardDescription>
              {isThemeLocked 
                ? `Theme is locked to "${theme}". This setting cannot be changed.`
                : 'Choose your preferred theme. You have 10 seconds to change after selecting.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isThemeLocked ? (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium capitalize">{theme} Theme</p>
                  <p className="text-sm text-muted-foreground">Your theme preference is locked.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Countdown Timer */}
                {countdown > 0 && (
                  <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3">
                      <Timer className="h-5 w-5 text-primary animate-pulse" />
                      <div>
                        <p className="font-medium text-primary">Theme will lock in</p>
                        <p className="text-sm text-muted-foreground">Change now or it will be permanent</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-primary">{countdown}s</span>
                      <Button variant="outline" size="sm" onClick={cancelThemeChange}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('light')}
                    className={`flex flex-col gap-2 h-auto py-4 ${theme === 'light' && countdown > 0 ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-xs">Light</span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('dark')}
                    className={`flex flex-col gap-2 h-auto py-4 ${theme === 'dark' && countdown > 0 ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-xs">Dark</span>
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => handleThemeChange('system')}
                    className={`flex flex-col gap-2 h-auto py-4 ${theme === 'system' && countdown > 0 ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="text-xs">System</span>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about new episodes
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>

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
