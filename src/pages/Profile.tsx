import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('anime-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
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
      toast.error(usernameResult.error.issues[0]?.message || 'Invalid username');
      return;
    }
    
    // Validate avatar URL if provided
    if (avatarUrl.trim()) {
      const avatarResult = avatarUrlSchema.safeParse(avatarUrl.trim());
      if (!avatarResult.success) {
        toast.error(avatarResult.error.issues[0]?.message || 'Invalid avatar URL');
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
    <div className="account-v4 min-h-screen pb-16">
      <header className="account-v4-header border-b border-border">
        <div className="container max-w-5xl py-8 md:py-12 flex flex-wrap items-center gap-5">
          <div className="relative shrink-0">
            <Avatar className="h-20 w-20 md:h-28 md:w-28 ring-2 ring-border ring-offset-4 ring-offset-background">
              <AvatarImage src={avatarUrl} alt="Profile photo" className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">{initial}</AvatarFallback>
            </Avatar>
            <Button variant="glass" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar} title="Change photo" aria-label="Change photo" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg"><Camera /></Button>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">My account · Member since {memberSince}</p>
            <h1 className="text-2xl md:text-4xl font-bold break-words">{username || user.email?.split('@')[0] || 'My Profile'}</h1>
            <p className="text-sm text-muted-foreground break-all">{email}</p>
            {isPremium && <span className="catalogue-chip inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs"><Crown className="h-3.5 w-3.5 text-primary animate-crown-shimmer" />Premium</span>}
          </div>
        </div>
      </header>
      <div className="container max-w-5xl py-6 md:py-8">
        <nav aria-label="Account shortcuts" className="flex flex-wrap gap-2 pb-6 border-b border-border">
          <Button variant="glass" onClick={() => navigate('/settings')}><Palette />Settings</Button>
          <Button variant="glass" onClick={() => navigate('/stats')}><User />Watch Stats</Button>
          <Button variant="glass" onClick={() => navigate('/watchlist')}><Crown />Watch List</Button>
        </nav>
        <div className="account-v4-sections">

          {/* ─── Profile Information ─── */}
          <section className="account-v4-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/15">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Profile Information
              </CardTitle>
              
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs text-muted-foreground">
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
                <Label className="text-xs text-muted-foreground">
                  Profile Picture
                </Label>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/30">
                    <AvatarImage src={avatarUrl} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
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
                <Label htmlFor="avatar" className="text-xs text-muted-foreground flex items-center gap-1.5">
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
                className="w-full md:w-auto"
              >
                {isUpdatingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </CardContent>
          </section>

          {/* ─── Email ─── */}
          <section className="account-v4-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                Email Address
              </CardTitle>
              <CardDescription>
                Current: <span className="text-foreground font-medium">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail" className="text-xs text-muted-foreground">
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
          </section>

          {/* ─── Password ─── */}
          <section className="account-v4-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription>Use 6+ characters with a mix of letters & numbers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">
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
          </section>

          {/* ─── Emergency Admin/Upload Recovery (owner only) ─── */}
          {isRecoveryAccount && (
            <section className="account-v4-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <ShieldAlert className="h-4 w-4 text-primary" />
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
                  className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  {isRecovering ? 'Restoring…' : 'Recover Admin / Upload'}
                </Button>
              </CardContent>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
