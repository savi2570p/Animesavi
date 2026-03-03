import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, LogIn, X, Users, KeyRound } from 'lucide-react';

import { getSavedAccounts, forgetAccount, type SavedAccount } from '@/lib/accountUtils';

export { rememberAccount, getSavedAccountCount } from '@/lib/accountUtils';

interface AccountSwitcherProps {
  trigger?: React.ReactNode;
}

export function AccountSwitcher({ trigger }: AccountSwitcherProps) {
  const { user, signIn, signOut, isAdmin, isUploader } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const maxAccounts = (isAdmin || isUploader) ? 9 : 5;
  const canAddMore = accounts.length < maxAccounts;

  useEffect(() => {
    if (open) {
      setAccounts(getSavedAccounts());
      setShowAddForm(false);
      setDeleteTarget(null);
      setDeletePassword('');
      setEmail('');
      setPassword('');
    }
  }, [open]);

  const handleSwitchTo = async (account: SavedAccount) => {
    if (account.email === user?.email) {
      toast.info('You are already signed in with this account');
      return;
    }
    setEmail(account.email);
    setShowAddForm(true);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await signOut();
      const { error } = await signIn(email, password);

      if (error) {
        toast.error('Sign in failed', { description: error.message });
      } else {
        toast.success('Switched account successfully!');
        setOpen(false);
        navigate('/');
      }
    } catch (err) {
      toast.error('Failed to switch account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAccount = (accountEmail: string) => {
    // Require password verification to remove
    setDeleteTarget(accountEmail);
    setDeletePassword('');
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || !deletePassword) return;

    setIsDeleting(true);
    try {
      // Verify password by attempting sign-in with the account to delete
      const { error } = await supabase.auth.signInWithPassword({
        email: deleteTarget,
        password: deletePassword,
      });

      if (error) {
        toast.error('Incorrect password', { description: 'Please enter the correct password for this account.' });
        setIsDeleting(false);
        return;
      }

      // Password verified - sign back in as current user if different
      // First remove the account
      forgetAccount(deleteTarget);
      setAccounts(getSavedAccounts());
      setDeleteTarget(null);
      setDeletePassword('');
      toast.success('Account removed from saved list');

      // If we verified a different account, we need to restore the current session
      if (deleteTarget !== user?.email) {
        // The sign-in above changed the session, so we need to sign out
        // The auth state listener will handle the rest
        // Since we can't re-sign-in without the current user's password,
        // we'll just close the dialog and let the user know
        toast.info('Please sign in again with your current account.');
        setOpen(false);
      }
    } catch (err) {
      toast.error('Failed to verify password');
    } finally {
      setIsDeleting(false);
    }
  };

  const otherAccounts = accounts.filter((a) => a.email !== user?.email);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
            <Users className="h-4 w-4" />
            Switch Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Switch Account
          </DialogTitle>
          <DialogDescription>
            Switch between your saved accounts or add a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Account */}
          {user && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Currently signed in</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.user_metadata?.username || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation with password */}
          {deleteTarget ? (
            <form onSubmit={handleConfirmDelete} className="space-y-3">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Verify to Remove Account
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the password for <strong>{deleteTarget}</strong> to remove it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-muted/50"
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeletePassword('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting || !deletePassword}
                  className="flex-1"
                >
                  {isDeleting ? 'Verifying...' : 'Remove Account'}
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Saved Accounts */}
              {!showAddForm && otherAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Saved Accounts</p>
                  {otherAccounts.map((account) => (
                    <div
                      key={account.email}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                          {account.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAccount(account.email);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleSwitchTo(account)}
                        >
                          <LogIn className="h-3 w-3 mr-1" />
                          Switch
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / Sign In Form */}
              {showAddForm ? (
                <form onSubmit={handleSignIn} className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {otherAccounts.some((a) => a.email === email)
                      ? 'Enter password to switch'
                      : 'Sign in with another account'}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="switch-email">Email</Label>
                    <Input
                      id="switch-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="bg-muted/50"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="switch-password">Password</Label>
                    <Input
                      id="switch-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-muted/50"
                      autoComplete="current-password"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddForm(false);
                        setEmail('');
                        setPassword('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isLoading || !email || !password}
                      className="flex-1 bg-primary"
                    >
                      {isLoading ? 'Switching...' : 'Switch'}
                    </Button>
                  </div>
                </form>
              ) : canAddMore ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Another Account
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Account limit reached ({maxAccounts} max). Remove an account to add a new one.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
