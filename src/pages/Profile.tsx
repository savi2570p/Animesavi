import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Mail, Lock, Palette, Camera, Upload, Link as LinkIcon, Crown, ShieldAlert } from 'lucide-react';
import { hasValidTokenAccess } from '@/components/AccessBanner';
import { z } from 'zod';

// Input validation schemas
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]*$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .optional()
  .or(z.literal(''));

// Allow any URL length for avatar
const avatarUrlSchema = z.string()
  .url('Please enter a valid URL')
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'Only HTTP/HTTPS URLs are allowed')
  .optional()
  .or(z.literal(''));

const MAX_PROFILE_PHOTO_SIZE_MB = 20;
const MAX_PROFILE_PHOTO_SIZE_BYTES = MAX_PROFILE_PHOTO_SIZE_MB * 1024 * 1024;

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const isRecoveryAccount = (user?.email || '').toLowerCase() === 'savi2570p@gmail.com';

  const handleRecoverAccess = async () => {
    if (!user || !isRecoveryAccount) return;
    setIsRecovering(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          [
            { user_id: user.id, role: 'admin' },
            { user_id: user.id, role: 'uploader' },
          ],
          { onConflict: 'user_id,role', ignoreDuplicates: true }
        );
      if (error) throw error;
      toast.success('Admin & uploader access restored. Reloading…');
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      console.error('Recover access failed:', e);
      toast.error(e?.message || 'Failed to recover access');
    } finally {
      setIsRecovering(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    setEmail(user.email || '');
    setUsername(user.user_metadata?.username || '');
    setAvatarUrl(user.user_metadata?.avatar_url || '');
    
    // Fetch profile data
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type — be permissive for mobile galleries (some return empty MIME)
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    const hasImageExtension = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(file.name);
    if (file.type && !validImageTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (!file.type && !hasImageExtension) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      toast.error(`Image must be less than ${MAX_PROFILE_PHOTO_SIZE_MB}MB`);
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('anime-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('anime-media')
        .getPublicUrl(filePath);

      // Update avatar URL
      setAvatarUrl(publicUrl);
      
      // Save to profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Profile picture updated!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    // Validate username
    const usernameResult = usernameSchema.safeParse(username.trim());
    if (!usernameResult.success) {
      toast.error(usernameResult.error.errors[0]?.message || 'Invalid username');
      return;
    }
    
    // Validate avatar URL if provided
    if (avatarUrl.trim()) {
      const avatarResult = avatarUrlSchema.safeParse(avatarUrl.trim());
      if (!avatarResult.success) {
        toast.error(avatarResult.error.errors[0]?.message || 'Invalid avatar URL');
        return;
      }
    }
    
    setIsUpdatingProfile(true);
    
    // Update profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null 
      })
      .eq('id', user.id);
    
    // Also update auth user metadata so it reflects in header immediately
    await supabase.auth.updateUser({
      data: {
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null
      }
    });
    
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
    }
    
    setIsUpdatingProfile(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setIsUpdatingPassword(true);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    
    setIsUpdatingPassword(false);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address');
      return;
    }
    
    setIsUpdatingEmail(true);
    
    const { error } = await supabase.auth.updateUser({
      email: newEmail.trim()
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Verification email sent to your new address');
      setNewEmail('');
    }
    
    setIsUpdatingEmail(false);
  };

  if (!user) return null;

  const isPremium = hasValidTokenAccess(user?.email);
  const initial = (username?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="relative min-h-screen pb-16">
      {/* ─── Cinematic hero ─── */}
      <div className="relative h-[260px] md:h-[320px] overflow-hidden">
        {/* Blurred avatar backdrop */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
        )}
        {/* Color washes */}
        <div className="absolute -top-24 -left-20 w-[28rem] h-[28rem] bg-primary/25 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 right-10 w-[22rem] h-[22rem] bg-rose-500/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        {/* Avatar + name */}
        <div className="container relative h-full flex items-end pb-6">
          <div className="flex items-end gap-5 md:gap-7 w-full">
            <div className="relative shrink-0 group">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl scale-110 opacity-60" />
              <div className="relative h-24 w-24 md:h-32 md:w-32 rounded-full p-[3px] bg-gradient-to-br from-primary via-rose-500 to-primary shadow-2xl">
                <Avatar className="h-full w-full ring-2 ring-background/80">
                  <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-rose-600 text-primary-foreground text-3xl md:text-4xl font-heading font-black">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </div>
              {isPremium && (
                <div className="absolute -top-1 -right-1 h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-background flex items-center justify-center shadow-lg">
                  <Crown className="h-4 w-4 text-white animate-crown-shimmer" />
                </div>
              )}
              {/* Quick camera button overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change photo"
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-background/95 hover:bg-background border-2 border-background shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              >
                <Camera className="h-4 w-4 text-foreground" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {isPremium && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black uppercase tracking-[0.15em] shadow-md">
                    <Crown className="h-3 w-3" /> Premium
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-card/70 border border-border/50 backdrop-blur-sm text-muted-foreground uppercase tracking-wider">
                  Member · {memberSince}
                </span>
              </div>
              <h1 className="text-2xl md:text-4xl font-heading font-black leading-tight truncate">
                {username || user.email?.split('@')[0] || 'Welcome'}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl -mt-4">
        {/* Quick action tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mb-8">
          <button
            onClick={() => navigate('/settings')}
            className="group flex items-center gap-3 p-3 md:p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/50 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-0.5"
          >
            <div className="p-2 rounded-lg bg-primary/15 group-hover:bg-primary/25 transition-colors">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs md:text-sm font-semibold text-left">Settings</span>
          </button>
          <button
            onClick={() => navigate('/stats')}
            className="group flex items-center gap-3 p-3 md:p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/50 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-0.5"
          >
            <div className="p-2 rounded-lg bg-rose-500/15 group-hover:bg-rose-500/25 transition-colors">
              <User className="h-4 w-4 text-rose-400" />
            </div>
            <span className="text-xs md:text-sm font-semibold text-left">Watch Stats</span>
          </button>
          <button
            onClick={() => navigate('/watchlist')}
            className="col-span-2 md:col-span-1 group flex items-center gap-3 p-3 md:p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/50 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-0.5"
          >
            <div className="p-2 rounded-lg bg-amber-500/15 group-hover:bg-amber-500/25 transition-colors">
              <Crown className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-xs md:text-sm font-semibold text-left">Watch List</span>
          </button>
        </div>

        <div className="space-y-5">
          {/* ─── Profile Information ─── */}
          <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-md">
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/15">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Profile Information
              </CardTitle>
              <CardDescription>How others see you across AnimeSavi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Display Name
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your display name"
                  className="bg-muted/40 border-border/60 h-11"
                />
              </div>

              {/* Profile Picture Upload */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Profile Picture
                </Label>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/30">
                    <AvatarImage src={avatarUrl} alt="Avatar" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-rose-600 text-primary-foreground text-xl font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="gap-2 w-fit"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {isUploadingAvatar ? 'Uploading…' : 'Upload Photo'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      JPG · PNG · GIF · WebP · HEIC — max {MAX_PROFILE_PHOTO_SIZE_MB}MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Avatar URL Input */}
              <div className="space-y-2">
                <Label htmlFor="avatar" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <LinkIcon className="h-3 w-3" />
                  Or paste an image URL
                </Label>
                <Input
                  id="avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="bg-muted/40 border-border/60 h-11"
                />
              </div>

              <Button
                onClick={handleUpdateProfile}
                disabled={isUpdatingProfile}
                className="anime-button w-full md:w-auto"
              >
                {isUpdatingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          {/* ─── Email ─── */}
          <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-md">
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-rose-500/15">
                  <Mail className="h-4 w-4 text-rose-400" />
                </div>
                Email Address
              </CardTitle>
              <CardDescription>
                Current: <span className="text-foreground font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail" className="text-xs uppercase tracking-wider text-muted-foreground">
                  New Email Address
                </Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-muted/40 border-border/60 h-11"
                />
              </div>
              <Button
                onClick={handleUpdateEmail}
                disabled={isUpdatingEmail}
                variant="outline"
                className="w-full md:w-auto"
              >
                {isUpdatingEmail ? 'Sending…' : 'Update Email'}
              </Button>
            </CardContent>
          </Card>

          {/* ─── Password ─── */}
          <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-md">
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-amber-500/15">
                  <Lock className="h-4 w-4 text-amber-400" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription>Use 6+ characters with a mix of letters & numbers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs uppercase tracking-wider text-muted-foreground">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-muted/40 border-border/60 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-muted/40 border-border/60 h-11"
                  />
                </div>
              </div>
              <Button
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                variant="outline"
                className="w-full md:w-auto"
              >
                {isUpdatingPassword ? 'Updating…' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>

          {/* ─── Emergency Admin/Upload Recovery (owner only) ─── */}
          {isRecoveryAccount && (
            <Card className="overflow-hidden border-rose-500/40 bg-card/60 backdrop-blur-md">
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-md bg-rose-500/15">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  </div>
                  Recover Admin / Upload Access
                </CardTitle>
                <CardDescription>
                  Emergency restore for the owner account. Re-grants <span className="font-semibold text-foreground">admin</span> and{' '}
                  <span className="font-semibold text-foreground">uploader</span> roles instantly. No content is touched.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleRecoverAccess}
                  disabled={isRecovering}
                  className="w-full md:w-auto bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white"
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  {isRecovering ? 'Restoring…' : 'Recover Admin / Upload'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
