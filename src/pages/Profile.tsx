import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Mail, Lock, Palette, Camera } from 'lucide-react';
import { z } from 'zod';

// Input validation schemas
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]*$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .optional()
  .or(z.literal(''));

const avatarUrlSchema = z.string()
  .url('Please enter a valid URL')
  .max(500, 'URL is too long')
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

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
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
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null 
      })
      .eq('id', user.id);
    
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

  return (
    <div className="container py-12 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-16 w-16 ring-2 ring-primary/50">
            <AvatarImage src={avatarUrl} alt="Avatar" />
            <AvatarFallback className="bg-gradient-primary text-white text-2xl">
              {username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-heading font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your profile details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Display Name</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your display name"
                className="bg-muted/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <div className="flex gap-2">
                <Input
                  id="avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="bg-muted/50"
                />
                <Button variant="outline" size="icon">
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL for your profile picture
              </p>
            </div>
            
            <Button 
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="anime-button"
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Address
            </CardTitle>
            <CardDescription>
              Current email: {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="bg-muted/50"
              />
            </div>
            
            <Button 
              onClick={handleUpdateEmail}
              disabled={isUpdatingEmail}
              variant="outline"
            >
              {isUpdatingEmail ? 'Sending...' : 'Update Email'}
            </Button>
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password for security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-muted/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-muted/50"
              />
            </div>
            
            <Button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword}
              variant="outline"
            >
              {isUpdatingPassword ? 'Updating...' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>

        {/* Theme Settings in Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Preferences
            </CardTitle>
            <CardDescription>
              Customize your viewing experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/settings')}
            >
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
