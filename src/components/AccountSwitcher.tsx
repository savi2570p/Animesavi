import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { UserPlus, LogIn, X, Users } from 'lucide-react';

const SAVED_ACCOUNTS_KEY = 'anime_saved_accounts';

interface SavedAccount {
  email: string;
  username: string;
  lastUsed: number;
}

/** Reads saved accounts from localStorage. */
function getSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Saves the account list to localStorage. */
function setSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** Adds or updates an account in the saved list. Always saves on successful login. */
export function rememberAccount(email: string, username: string) {
  const accounts = getSavedAccounts();
  const existing = accounts.find((a) => a.email === email);
  // Update username and lastUsed if account already exists, otherwise add new
  const filtered = accounts.filter((a) => a.email !== email);
  filtered.unshift({ email, username: username || existing?.username || email.split('@')[0], lastUsed: Date.now() });
  // Keep at most 5 accounts
  setSavedAccounts(filtered.slice(0, 5));
}

/** Removes an account from the saved list. */
function forgetAccount(email: string) {
  const accounts = getSavedAccounts().filter((a) => a.email !== email);
  setSavedAccounts(accounts);
}

interface AccountSwitcherProps {
  trigger?: React.ReactNode;
}

export function AccountSwitcher({ trigger }: AccountSwitcherProps) {
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAccounts(getSavedAccounts());
      setShowAddForm(false);
      setEmail('');
      setPassword('');
    }
  }, [open]);

  const handleSwitchTo = async (account: SavedAccount) => {
    if (account.email === user?.email) {
      toast.info('You are already signed in with this account');
      return;
    }
    // Show password prompt for the selected account
    setEmail(account.email);
    setShowAddForm(true);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      // Sign out current user first
      await signOut();

      // Sign in with the new account
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
    forgetAccount(accountEmail);
    setAccounts(getSavedAccounts());
    toast.success('Account removed from saved list');
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
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Another Account
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
