import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ReleaseReminderSettings } from '@/components/ReleaseReminderSettings';
import { PinLockSettings } from '@/components/settings/PinLockSettings';
import {
  Settings as SettingsIcon,
  Moon,
  Globe,
  Keyboard,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  User as UserIcon,
  Bell,
  Lock,
  Languages,
  Gauge,
  Zap,
  Trash2,
  Subtitles,
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('pref_autoplay') !== '0');
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('pref_data_saver') === '1');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('pref_reduced_motion') === '1');
  const [subsDefault, setSubsDefault] = useState(() => localStorage.getItem('pref_subs_default') !== '0');
  const [matureFilter, setMatureFilter] = useState(() => localStorage.getItem('pref_mature_filter') === '1');
  const [defaultQuality, setDefaultQuality] = useState<string>(() => localStorage.getItem('pref_default_quality') || 'auto');
  const [subLang, setSubLang] = useState<string>(() => localStorage.getItem('pref_sub_lang') || 'en');

  useEffect(() => { localStorage.setItem('pref_autoplay', autoplay ? '1' : '0'); }, [autoplay]);
  useEffect(() => { localStorage.setItem('pref_data_saver', dataSaver ? '1' : '0'); }, [dataSaver]);
  useEffect(() => { localStorage.setItem('pref_reduced_motion', reducedMotion ? '1' : '0'); }, [reducedMotion]);
  useEffect(() => { localStorage.setItem('pref_subs_default', subsDefault ? '1' : '0'); }, [subsDefault]);
  useEffect(() => { localStorage.setItem('pref_mature_filter', matureFilter ? '1' : '0'); }, [matureFilter]);
  useEffect(() => { localStorage.setItem('pref_default_quality', defaultQuality); }, [defaultQuality]);
  useEffect(() => { localStorage.setItem('pref_sub_lang', subLang); }, [subLang]);

  const clearCache = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success('Cache cleared');
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error('Failed to change password', { description: updateError.message });
      } else {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast.error('An error occurred while changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) return null;

  const shortcuts = [
    { label: 'Play / Pause', key: 'Space' },
    { label: 'Fullscreen', key: 'F' },
    { label: 'Mute / Unmute', key: 'M' },
    { label: 'PiP Mode', key: 'P' },
    { label: 'Skip Forward', key: '→' },
    { label: 'Skip Backward', key: '←' },
  ];

  return (
    <div className="min-h-screen">
      {/* Cinematic hero */}
      <div className="relative h-[220px] md:h-[280px] overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-rose-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(0_85%_50%/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />

        <div className="relative container h-full flex items-end pb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-rose-500 blur-xl opacity-60" />
              <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center shadow-2xl">
                <SettingsIcon className="h-8 w-8 md:h-10 md:w-10 text-white" />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Preferences</p>
              <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                Settings
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Personalize your experience
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 md:py-10 max-w-4xl">
        {/* Quick stats / chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Moon, label: 'Theme', value: 'Dark' },
            { icon: Bell, label: 'Alerts', value: 'On' },
            { icon: Globe, label: 'Autoplay', value: autoplay ? 'On' : 'Off' },
            { icon: Lock, label: 'Account', value: 'Secure' },
          ].map((chip) => (
            <div
              key={chip.label}
              className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-3 hover:border-primary/40 transition-all"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <chip.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {chip.label}
                  </p>
                  <p className="text-sm font-semibold truncate">{chip.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          {/* Appearance */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Moon className="h-4 w-4 text-primary" />
                </div>
                Appearance
              </CardTitle>
              <CardDescription>
                Locked to dark mode for cinematic viewing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-rose-500/5 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">Dark Mode</span>
                <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wider">
                  Always On
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <NotificationSettings />

          {/* Release reminders */}
          <ReleaseReminderSettings />

          {/* Playback */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                Playback
              </CardTitle>
              <CardDescription>Video player preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <Label htmlFor="autoplay" className="text-sm font-medium">
                    Autoplay Next Episode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-advance when an episode ends
                  </p>
                </div>
                <Switch id="autoplay" checked={autoplay} onCheckedChange={setAutoplay} />
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password. Forgot it? Contact an admin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Current Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-muted/40 border-border/50 pr-10 h-11"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-xs uppercase tracking-wider text-muted-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-muted/40 border-border/50 pr-10 h-11"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Confirm New
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-muted/40 border-border/50 h-11"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={
                    isChangingPassword || !currentPassword || !newPassword || !confirmPassword
                  }
                  className="w-full h-11 bg-gradient-to-r from-primary to-rose-500 hover:opacity-90 text-white font-semibold"
                >
                  {isChangingPassword ? 'Changing Password...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Keyboard className="h-4 w-4 text-primary" />
                </div>
                Keyboard Shortcuts
              </CardTitle>
              <CardDescription>Quick controls for the video player</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5">
                {shortcuts.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-xs md:text-sm text-muted-foreground">{s.label}</span>
                    <kbd className="px-2 py-1 bg-background/80 border border-border rounded-md text-[10px] md:text-xs font-mono font-semibold shadow-sm">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                Privacy & Security
              </CardTitle>
              <CardDescription>Manage your account & profile</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start h-11 border-border/50 hover:border-primary/40 hover:bg-primary/5"
                onClick={() => navigate('/profile')}
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Manage Profile Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
