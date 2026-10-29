import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NotificationSettings } from '@/components/NotificationSettings';
import { ReleaseReminderSettings } from '@/components/ReleaseReminderSettings';
import { PinLockSettings } from '@/components/settings/PinLockSettings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { rememberAccount } from '@/components/AccountSwitcher';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  LogOut,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { clearImageData } from '@/lib/clearAccountCache';
import { PREFERENCES_EVENT } from '@/lib/playbackPreferences';
import { markHistoryReset } from '@/lib/watchHistoryReset';

export default function Settings() {
  const { user, signOut, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('pref_autoplay') !== '0');
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('pref_data_saver') === '1');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('pref_reduced_motion') === '1');
  const [subsDefault, setSubsDefault] = useState(() => localStorage.getItem('pref_subs_default') !== '0');
  const [matureFilter, setMatureFilter] = useState(() => localStorage.getItem('pref_mature_filter') === '1');
  const [defaultQuality, setDefaultQuality] = useState<string>(() => localStorage.getItem('pref_default_quality') || 'auto');
  const [subLang, setSubLang] = useState<string>(() => localStorage.getItem('pref_sub_lang') || 'en');

  useEffect(() => { localStorage.setItem('pref_autoplay', autoplay ? '1' : '0'); }, [autoplay]);
  useEffect(() => { localStorage.setItem('pref_data_saver', dataSaver ? '1' : '0'); window.dispatchEvent(new Event(PREFERENCES_EVENT)); }, [dataSaver]);
  useEffect(() => { localStorage.setItem('pref_reduced_motion', reducedMotion ? '1' : '0'); }, [reducedMotion]);
  useEffect(() => { localStorage.setItem('pref_subs_default', subsDefault ? '1' : '0'); }, [subsDefault]);
  useEffect(() => { localStorage.setItem('pref_mature_filter', matureFilter ? '1' : '0'); }, [matureFilter]);
  useEffect(() => { localStorage.setItem('pref_default_quality', defaultQuality); }, [defaultQuality]);
  useEffect(() => { localStorage.setItem('pref_sub_lang', subLang); }, [subLang]);

  const [cacheOpen, setCacheOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const clearCache = async () => {
    if (!user || clearingCache) return;
    setClearingCache(true);
    try {
      markHistoryReset();
      const { error } = await supabase.from('watch_history').delete().eq('user_id', user.id);
      if (error) throw error;
      const { error: shadowError } = await supabase.from('shadow_flix_continue_watching').delete().eq('user_id', user.id);
      if (shadowError) throw shadowError;
      await clearImageData(localStorage, 'caches' in window ? caches : undefined);
      window.dispatchEvent(new Event('watch-history-updated'));
      setCacheOpen(false);
      toast.success('Cached images and Continue Watching cleared');
      window.location.assign('/settings');
    } catch {
      toast.error('Could not finish clearing data. Please try again.');
    } finally {
      setClearingCache(false);
    }
  };

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } | string }
        | null;

      if (!response.ok || payload?.success === false) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || `Delete failed (${response.status})`;
        throw new Error(message);
      }

      toast.success('Account deleted. You have been signed out.');
      await signOut();
      navigate('/auth?mode=signup', { replace: true });
    } catch (err) {
      toast.error('Failed to delete account', { description: (err as Error).message });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

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
    <div className="account-v4 settings-v5 min-h-screen">
      <header className="account-v4-header border-b border-border">
        <div className="container max-w-5xl py-8 md:py-12 flex flex-wrap items-center gap-4">
          <div className="account-v4-icon h-14 w-14 rounded-lg flex items-center justify-center"><SettingsIcon className="h-6 w-6 text-primary" /></div>
          <div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground mb-2">My account</p><h1 className="text-3xl md:text-4xl font-bold">Settings</h1></div>
          <Button variant="glass" onClick={() => navigate('/profile')}><UserIcon />My Profile</Button>
        </div>
      </header>
      <div className="container py-6 md:py-8 max-w-5xl">
        <div className="account-v4-sections">

          {/* Appearance */}
          <section className="account-v4-section">
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
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">Dark Mode</span>
                <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wider">
                  Always On
                </span>
              </div>
            </CardContent>
          </section>

          {/* Notifications */}
          <NotificationSettings />

          {/* Release reminders */}
          <ReleaseReminderSettings />

          {/* Playback */}
          <section className="account-v4-section">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                Playback
              </CardTitle>
              <CardDescription>Video player preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <Label htmlFor="subs" className="text-sm font-medium flex items-center gap-2">
                    <Subtitles className="h-3.5 w-3.5 text-primary" /> Subtitles on by default
                  </Label>
                  <p className="text-xs text-muted-foreground">Auto-enable captions on every video</p>
                </div>
                <Switch id="subs" checked={subsDefault} onCheckedChange={setSubsDefault} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PlayCircle className="h-3 w-3" /> Default quality
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(dataSaver ? ['1080p'] : ['auto', '480p', '720p', '1080p', '4K']).map((q) => (
                      <Button variant="ghost"
                        key={q}
                        type="button"
                        onClick={() => setDefaultQuality(q)}
                        size="sm" aria-pressed={dataSaver || defaultQuality === q}
                        className={`h-8 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          dataSaver || defaultQuality === q
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border/50 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Languages className="h-3 w-3" /> Subtitle language
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { v: 'en', l: 'EN' },
                      { v: 'es', l: 'ES' },
                      { v: 'fr', l: 'FR' },
                      { v: 'hi', l: 'HI' },
                      { v: 'ja', l: 'JA' },
                    ].map((o) => (
                      <Button variant="ghost"
                        key={o.v}
                        type="button"
                        onClick={() => setSubLang(o.v)}
                        size="sm" aria-pressed={subLang === o.v}
                        className={`h-8 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          subLang === o.v
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border/50 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {o.l}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </section>

          {/* PIN Lock */}
          <PinLockSettings />

          {/* Data & Performance */}
          <section className="account-v4-section">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Gauge className="h-4 w-4 text-primary" />
                </div>
                Data & Performance
              </CardTitle>
              <CardDescription>Bandwidth, motion and cache controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <Label htmlFor="data-saver" className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary" /> Data Saver
                  </Label>
                  <p className="text-xs text-muted-foreground">1080p playback when available</p>
                </div>
                <Switch id="data-saver" checked={dataSaver} onCheckedChange={setDataSaver} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Reduce Motion</Label>
                  <p className="text-xs text-muted-foreground">Minimize animations across the app</p>
                </div>
                <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="space-y-0.5">
                  <Label htmlFor="mature-filter" className="text-sm font-medium">Mature Content Filter</Label>
                  <p className="text-xs text-muted-foreground">Hide titles marked Hentai</p>
                </div>
                <Switch id="mature-filter" checked={matureFilter} onCheckedChange={setMatureFilter} />
              </div>
              <Button
                variant="outline"
                onClick={() => setCacheOpen(true)}
                className="w-full justify-start h-10 border-border/50 hover:border-destructive/40 hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                Clear cached images & data
              </Button>
            </CardContent>
          </section>


          {/* Change Password */}
          <section className="account-v4-section">
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
                    <Button variant="ghost"
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      size="icon" aria-label="Toggle password visibility" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground rounded-lg"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
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
                      <Button variant="ghost"
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        size="icon" aria-label="Toggle password visibility" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground rounded-lg"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
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
                  className="w-full h-11 font-semibold"
                >
                  {isChangingPassword ? 'Changing Password...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="account-v4-section">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Keyboard className="h-4 w-4 text-primary" />
                </div>
                Keyboard Shortcuts
              </CardTitle>
              
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
          </section>

          {/* Account & Session — Profile summary + Sign Out */}
          <section className="account-v4-section">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                Account & Session
              </CardTitle>
              <CardDescription>Your profile, security and session controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <Avatar className="h-11 w-11 ring-2 ring-primary/40 shrink-0">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate flex items-center gap-1.5">
                    {user.user_metadata?.username || 'User'}
                    {isAdmin && <Crown className="h-3.5 w-3.5 text-primary" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 border border-border text-[9px] font-black text-primary uppercase tracking-wider">
                      Signed in
                    </span>
                    {isAdmin ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 border border-border text-[9px] font-black text-primary uppercase tracking-wider">Admin</span>
                    ) : isUploader ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[9px] font-black text-primary uppercase tracking-wider">Uploader</span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[9px] font-black text-muted-foreground uppercase tracking-wider">Viewer</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Button
                  variant="outline"
                  className="justify-start h-11 border-border/50 hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => navigate('/profile')}
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Manage Profile
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={async () => {
                    if (user?.email) rememberAccount(user.email, user.user_metadata?.username || user.email.split('@')[0]);
                    await signOut();
                    toast.success('Signed out');
                    navigate('/');
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-11 border-destructive/60 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:text-destructive"
                  onClick={() => { setDeleteConfirm(''); setDeleteOpen(true); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete my Account
                </Button>
              </div>
            </CardContent>
          </section>
        </div>
      </div>

      {/* Delete account confirmation */}
      <Dialog open={cacheOpen} onOpenChange={open => { if (!clearingCache) setCacheOpen(open); }}>
        <DialogContent className="utility-glass-v6 max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear cached images & data?</DialogTitle>
            <DialogDescription>This removes cached images on this device and all Continue Watching entries for your account, including Shadow. Saved offline videos, favorites and your sign-in are kept. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="glass" disabled={clearingCache} onClick={() => setCacheOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={clearingCache} onClick={clearCache}>{clearingCache ? 'Clearing…' : 'Clear data'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md border-destructive/40 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="mx-auto mb-2 h-14 w-14 rounded-2xl bg-destructive flex items-center justify-center shadow-2xl">
              <AlertTriangle className="h-7 w-7 text-destructive-foreground" />
            </div>
            <DialogTitle className="text-center text-xl">Delete your account?</DialogTitle>
            <DialogDescription className="text-center leading-relaxed pt-1">
              Within <span className="font-semibold text-foreground">24 hours</span> all of your data — profile,
              watch history, favorites, saved list and preferences — will be permanently removed from our servers.
              <br /><br />
              This action <span className="font-semibold text-destructive">cannot be undone</span>. You will be
              signed out immediately and will need to sign up again to use AnimeSavi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <Label htmlFor="del-confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
              Type <span className="text-destructive font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="del-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="bg-muted/40 border-border/50 h-11 uppercase tracking-widest text-center font-bold"
              autoComplete="off"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              {isDeleting ? 'Deleting…' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
