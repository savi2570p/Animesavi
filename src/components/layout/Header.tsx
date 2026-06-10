import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Menu, 
  User, 
  LogOut, 
  Upload, 
  Settings, 
  Shield,
  Heart,
  History,
  Crown,
  Users,
  Eye,
  Film,
  Tv,
  TrendingUp,
  BadgeCheck,
  Sparkles,
  Home,
  Download,
  ListVideo,
  RefreshCw
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { JoinPartyDialog, ViewPartyDialog } from '@/components/WatchParty';
import { NotificationBell } from '@/components/NotificationBell';
import { WatchLaterButton } from '@/components/WatchLater';
import { AccountSwitcher, rememberAccount } from '@/components/AccountSwitcher';
import { hasValidTokenAccess } from '@/components/AccessBanner';
import { VerifyTokenDialog } from '@/components/VerifyTokenDialog';
import { usePopupQueue } from '@/contexts/PopupQueueContext';
import { SearchSuggestions } from '@/components/SearchSuggestions';

export function Header() {
  const { user, isUploader, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { showWhatsNewManually } = usePopupQueue();
  const hasPremium = !!user && (isAdmin || hasValidTokenAccess(user?.email));
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Global "/" shortcut → focus the search bar (skip when already typing in an input/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (t?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const target = desktopSearchRef.current && desktopSearchRef.current.offsetParent !== null
        ? desktopSearchRef.current
        : mobileSearchRef.current;
      if (target) {
        e.preventDefault();
        target.focus();
        target.select?.();
      } else {
        navigate('/browse');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);


  const closeMenuThen = (callback: () => void) => {
    setMobileMenuOpen(false);
    window.setTimeout(callback, 120);
  };

  const handleHardRefresh = async () => {
    try {
      toast.info('Refreshing app... fetching latest version');
    } catch {}

    // Best-effort cache + SW cleanup, but never block the reload on it.
    // Previously a slow / hanging caches.delete() or SW unregister could leave
    // the user stuck on a black screen after we'd already torn down chunk URLs.
    const cleanup = (async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
        }
      } catch {}
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
        }
      } catch {}
      try {
        localStorage.removeItem('notice_popup_seen_version');
        // Re-arm the "entering" transition, but keep DOWNLOAD_COMPLETED flags so
        // the popup skips straight to "Explore Now" instead of re-downloading.
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('update_entering_shown_')) {
            localStorage.removeItem(k);
          }
        });
        sessionStorage.removeItem('token_expired_popup_shown');
      } catch {}
    })();

    // Hard upper-bound — reload after at most 1.2s no matter what so the
    // user is never stuck on a black "loading" screen.
    const reload = () => {
      try {
        // Always land on a known-good route (home) to avoid stuck lazy chunks
        // for routes that may have been removed in the new build.
        const target = `${window.location.origin}/?_r=${Date.now()}`;
        window.location.replace(target);
      } catch {
        window.location.href = '/';
      }
    };

    const safety = window.setTimeout(reload, 1200);
    cleanup.finally(() => {
      window.clearTimeout(safety);
      reload();
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSuggestions(false);
    }
  };

  const handleSignOut = async () => {
    if (user?.email) {
      rememberAccount(user.email, user.user_metadata?.username || user.email.split('@')[0]);
    }
    await signOut();
    navigate('/');
  };

  const canUpload = () => {
    return isUploader || isAdmin;
  };

  const handleUploadClick = () => {
    if (!user) {
      toast.error('Please sign in first');
      navigate('/auth');
      return;
    }

    if (!canUpload()) {
      toast.error('You are not authorized to upload.');
      return;
    }

    navigate('/upload');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: null },
    { to: '/browse?type=movie', label: 'Movies', icon: Film },
    { to: '/browse?type=series', label: 'TV Series', icon: Tv },
    { to: '/browse?sort=popular', label: 'Most Popular', icon: TrendingUp },
  ];

  const isActivePath = (to: string) => {
    const [path, query] = to.split('?');
    if (path !== location.pathname) return false;
    if (!query) return location.search === '' || path === '/';
    return location.search.includes(query);
  };

  return (
    <header className="sticky top-0 z-[100] w-full safe-area-top">
      {/* Layered glass surface */}
      <div className="relative bg-background/95 border-b border-border/40">
        {/* Ambient gradient wash */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <div className="absolute inset-x-0 top-0 h-px bg-primary/20" />
        </div>

        <div className="container relative flex h-12 sm:h-14 items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo lockup */}
          <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
            <Link to="/welcome" className="group relative flex-shrink-0" aria-label="Welcome">
              <span className="absolute inset-0 rounded-lg bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img
                src={logo}
                alt="Anime Savi"
                className="relative h-6 w-6 sm:h-8 sm:w-8 rounded-lg object-contain ring-1 ring-border/50 group-hover:ring-primary/50 group-hover:scale-110 transition-all duration-200"
              />
            </Link>
            {/* Mobile Home Button */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="lg:hidden h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-primary/10"
            >
              <Link to="/" aria-label="Home">
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </Link>
            </Button>
            <Link to="/" className="hidden sm:flex items-baseline gap-1 leading-none hover:opacity-90 transition-opacity">
              <span className="text-lg font-black tracking-tight bg-gradient-to-br from-primary via-primary to-pink-500 bg-clip-text text-transparent">
                Anime
              </span>
              <span className="text-lg font-black tracking-tight text-foreground">Savi</span>
              <span className="hidden xl:inline-block ml-1.5 px-1.5 py-0.5 rounded-md bg-primary/15 border border-primary/25 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                4K
              </span>
            </Link>
          </div>

          {/* Navigation - Desktop pill bar */}
          <nav className="hidden lg:flex items-center gap-0.5 p-1 rounded-full bg-card/70 border border-border/40">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActivePath(link.to);
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'text-primary-foreground bg-gradient-to-br from-primary to-pink-500 shadow-md shadow-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {canUpload() && (
              <button
                onClick={handleUploadClick}
                className="ml-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
            )}
          </nav>

          {/* Search - premium pill */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:flex">
            <div className="relative w-full transition-colors duration-100">
              {/* Glow on focus */}
              <div className={`pointer-events-none absolute -inset-px rounded-full bg-primary/20 opacity-0 transition-opacity duration-100 ${isSearchFocused ? 'opacity-100' : ''}`} />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
              <Input
                ref={desktopSearchRef}
                type="search"
                placeholder="Search anime, movies, episodes…  (press / to focus)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchQuery.trim().length >= 2) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setIsSearchFocused(false);
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="relative pl-10 pr-24 bg-card/60 border-border/50 focus:border-primary/60 rounded-full h-9 text-[13px] placeholder:text-muted-foreground/70"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <kbd className="hidden lg:inline-flex items-center px-2 h-5 rounded-md bg-muted/60 border border-border/40 text-[10px] font-bold text-muted-foreground tracking-wider">
                  /
                </kbd>
                <Button
                  type="submit"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-pink-500 hover:opacity-90 shadow-md shadow-primary/30"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={() => {
                  setSearchQuery('');
                  setShowSuggestions(false);
                }}
              />
            </div>
          </form>

          {/* User Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
          {user && <div className="[&_button]:h-7 [&_button]:w-7 sm:[&_button]:h-9 sm:[&_button]:w-9 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4"><WatchLaterButton /></div>}
          {user && <div className="[&_button]:h-7 [&_button]:w-7 sm:[&_button]:h-9 sm:[&_button]:w-9 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4"><NotificationBell /></div>}
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-7 w-7 sm:h-9 sm:w-9 rounded-full p-0">
                  <Avatar className="h-7 w-7 sm:h-9 sm:w-9">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium text-xs sm:text-sm">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {(isAdmin || hasValidTokenAccess(user?.email)) && (
                    <Crown className="absolute -top-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500 animate-crown-shimmer" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-52 origin-top-right bg-card/95 border-border/60 p-0 overflow-hidden shadow-xl rounded-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-100 ease-out"
                align="end"
                sideOffset={4}
              >
                {/* Cinematic header */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
                  <div className="relative flex items-center gap-2 p-2.5">
                    <div className="relative shrink-0">
                      <Avatar className="relative h-8 w-8 ring-1 ring-primary/40">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                        <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                          {user.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {(isAdmin || hasValidTokenAccess(user?.email)) && (
                        <Crown className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500 drop-shadow animate-crown-shimmer" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{user.user_metadata?.username || 'User'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-[8px] font-black text-yellow-400 uppercase tracking-wider">
                            <Crown className="h-2 w-2" /> Admin
                          </span>
                        ) : isUploader ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[8px] font-black text-primary uppercase tracking-wider">
                            <Upload className="h-2 w-2" /> Uploader
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                            Viewer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Library section */}
                <div className="p-1">
                  <p className="px-1.5 pt-0.5 pb-1 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                    Library
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/profile" className="flex flex-col items-center gap-0.5 py-1 hover:bg-primary/10 rounded-md group">
                        <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                          <User className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <span className="text-[8px] font-semibold">Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/favorites" className="flex flex-col items-center gap-0.5 py-1 hover:bg-rose-500/10 rounded-md group">
                        <div className="w-5 h-5 rounded-md bg-rose-500/15 flex items-center justify-center group-hover:bg-rose-500/25 transition-colors">
                          <Heart className="h-2.5 w-2.5 text-rose-500" />
                        </div>
                        <span className="text-[8px] font-semibold">Favs</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/downloads" className="flex flex-col items-center gap-0.5 py-1 hover:bg-emerald-500/10 rounded-md group">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                          <Download className="h-2.5 w-2.5 text-emerald-500" />
                        </div>
                        <span className="text-[8px] font-semibold">Downloads</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/watchlist" className="flex flex-col items-center gap-0.5 py-1 hover:bg-sky-500/10 rounded-md group">
                        <div className="w-5 h-5 rounded-md bg-sky-500/15 flex items-center justify-center group-hover:bg-sky-500/25 transition-colors">
                          <ListVideo className="h-2.5 w-2.5 text-sky-500" />
                        </div>
                        <span className="text-[8px] font-semibold">List</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuItem asChild className="rounded-lg mt-0.5">
                    <Link to="/history" className="flex items-center gap-1.5 py-1 px-1.5">
                      <div className="w-5 h-5 rounded-md bg-violet-500/15 flex items-center justify-center">
                        <History className="h-2.5 w-2.5 text-violet-500" />
                      </div>
                      <span className="text-[10px] font-medium">Watch History</span>
                    </Link>
                  </DropdownMenuItem>
                </div>

                {(canUpload() || isAdmin) && (
                  <>
                    <DropdownMenuSeparator className="my-0" />
                    <div className="p-1">
                      <p className="px-1.5 pt-0.5 pb-1 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                        Creator Tools
                      </p>
                      {canUpload() && (
                        <DropdownMenuItem asChild className="rounded-md">
                          <Link to="/upload" className="flex items-center gap-1.5 py-1 px-1.5">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-sm shadow-primary/30">
                              <Upload className="h-2.5 w-2.5 text-white" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[10px] font-semibold block leading-tight">Upload Anime</span>
                              <span className="text-[8px] text-muted-foreground">Add new episodes</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem asChild className="rounded-md">
                          <Link to="/admin" className="flex items-center gap-1.5 py-1 px-1.5">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-sm shadow-yellow-500/30">
                              <Shield className="h-2.5 w-2.5 text-white" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[10px] font-semibold block leading-tight">Admin Panel</span>
                              <span className="text-[8px] text-muted-foreground">Manage platform</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </div>
                  </>
                )}

                <DropdownMenuSeparator className="my-0" />
                <div className="p-1 [&_.account-switch-trigger]:h-7 [&_.account-switch-trigger]:gap-1.5 [&_.account-switch-trigger]:px-1.5 [&_.account-switch-trigger]:text-[10px] [&_.account-switch-trigger_svg]:h-3 [&_.account-switch-trigger_svg]:w-3">
                  <DropdownMenuItem asChild className="rounded-md">
                    <Link to="/settings" className="flex items-center gap-1.5 py-1 px-1.5">
                      <div className="w-5 h-5 rounded-md bg-muted flex items-center justify-center">
                        <Settings className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] font-medium">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 rounded-md">
                    <AccountSwitcher />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="rounded-md text-destructive focus:text-destructive focus:bg-destructive/10 mt-0.5 py-1 px-1.5"
                  >
                    <div className="w-5 h-5 rounded-md bg-destructive/15 flex items-center justify-center mr-1.5">
                      <LogOut className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-[10px] font-semibold">Sign Out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-sm px-3">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-2 sm:px-4 h-7 sm:h-9">
                <Link to="/auth">
                  <span className="hidden xs:inline">Get Started</span>
                  <span className="xs:hidden">Sign In</span>
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Search Button */}
          <form onSubmit={handleSearch} className="md:hidden flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => { if (searchQuery.trim().length >= 2) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-16 sm:w-20 pl-6 pr-1 h-7 sm:h-8 bg-card border-border focus:w-24 sm:focus:w-28 transition-all duration-200 rounded-lg text-xs"
              />
              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={() => { setSearchQuery(''); setShowSuggestions(false); }}
                className="w-[70vw] right-0 left-auto"
              />
            </div>
          </form>

          {/* Hamburger Menu - All Screens */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[19rem] sm:w-80 bg-background border-border p-0 overflow-y-auto"
            >
              {/* Cinematic header */}
              <div className="relative overflow-hidden border-b border-border/40">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/5 to-transparent" />
                <div className="absolute -top-12 -right-10 w-48 h-48 bg-primary/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 left-1/3 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl" />
                <div className="relative p-5 pt-7">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-primary/40 blur-md rounded-xl" />
                      <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-xl">
                        <img src={logo} alt="Anime Savi" className="w-7 h-7 rounded-md object-contain" />
                      </div>
                    </div>
                    <div>
                      <p className="text-base font-black leading-none">
                        <span className="text-primary">Anime</span>
                        <span className="text-foreground"> Savi</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">
                        Premium OTT
                      </p>
                    </div>
                  </div>

                  {user ? (
                    <div className="mt-4 flex items-center gap-2.5 p-2.5 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40">
                      <Avatar className="h-8 w-8 ring-1 ring-primary/30">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                          {user.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">
                          {user.user_metadata?.username || 'User'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      {(isAdmin || hasValidTokenAccess(user?.email)) && (
                        <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      )}
                    </div>
                  ) : (
                    <Button asChild size="sm" className="mt-4 w-full bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white font-bold shadow-lg shadow-primary/30">
                      <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                        Sign In to Continue
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3 space-y-4">
                {/* Premium CTA — adaptive */}
                {user && (
                  hasPremium ? (
                    <div
                      className="relative overflow-hidden rounded-2xl p-3 border border-amber-500/30"
                      style={{
                        background:
                          'linear-gradient(135deg, hsla(45,95%,55%,0.18) 0%, hsla(20,90%,55%,0.12) 50%, hsla(0,75%,55%,0.18) 100%)',
                      }}
                    >
                      <div className="absolute -top-8 -right-6 w-28 h-28 bg-amber-500/30 rounded-full blur-2xl" />
                      <div className="relative flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                          <Crown className="h-5 w-5 text-amber-950" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black text-amber-300 leading-tight">Premium Active</p>
                          <p className="text-[10px] text-amber-200/70">Enjoy 4K · Ad-free · Multi-audio</p>
                        </div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-wider">
                          PRO
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => closeMenuThen(() => window.open('https://t.me/getunlocktoken', '_blank', 'noopener'))}
                      className="group relative w-full overflow-hidden rounded-2xl p-3 border border-primary/30 text-left transition-transform active:scale-[0.99]"
                      style={{
                        background:
                          'linear-gradient(135deg, hsla(0,72%,50%,0.18) 0%, hsla(340,75%,50%,0.18) 100%)',
                        boxShadow: '0 0 25px -8px hsla(0,72%,50%,0.4)',
                      }}
                    >
                      <span
                        className="absolute inset-y-0 -inset-x-1/3 opacity-60 group-hover:opacity-100 transition-opacity"
                        style={{
                          background:
                            'linear-gradient(110deg, transparent 30%, hsla(0,0%,100%,0.12) 50%, transparent 70%)',
                          animation: 'shimmer 4s linear infinite',
                        }}
                      />
                      <div className="relative flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/40">
                          <Crown className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-black leading-tight">Get Premium Access</p>
                          <p className="text-[10px] text-muted-foreground">Unlock 4K · Ad-free · Downloads</p>
                        </div>
                        <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider shadow-md">
                          Get
                        </span>
                      </div>
                    </button>
                  )
                )}

                {/* Search */}
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search anime..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-9 bg-card border-border/60 rounded-lg h-9 text-xs"
                      autoFocus={false}
                      tabIndex={-1}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-primary"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  </div>
                </form>

                {/* Discover */}
                <div>
                  <p className="px-1 mb-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    Discover
                  </p>
                  <nav className="grid grid-cols-2 gap-1.5">
                    {navLinks.map((link) => {
                      const active = isActivePath(link.to);
                      const Icon = link.icon || Home;
                      return (
                        <Link
                          key={link.label}
                          to={link.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`relative flex items-center gap-2 text-[12px] font-semibold py-2 px-2.5 rounded-lg border transition-all ${
                            active
                              ? 'bg-gradient-to-br from-primary/20 to-pink-500/15 border-primary/40 text-foreground shadow-md shadow-primary/10'
                              : 'bg-card/50 hover:bg-card border-border/40 hover:border-primary/40'
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary' : 'text-primary'}`} />
                          <span className="truncate">{link.label}</span>
                          {active && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                {/* My Library */}
                {user && (
                  <div>
                    <p className="px-1 mb-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                      My Library
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { to: '/favorites', icon: Heart, label: 'Likes', tone: 'text-rose-500 bg-rose-500/10' },
                        { to: '/history', icon: History, label: 'History', tone: 'text-violet-500 bg-violet-500/10' },
                        { to: '/downloads', icon: Download, label: 'Saved', tone: 'text-emerald-500 bg-emerald-500/10' },
                        { to: '/watchlist', icon: ListVideo, label: 'List', tone: 'text-sky-500 bg-sky-500/10' },
                      ].map((it) => {
                        const active = location.pathname === it.to;
                        return (
                          <Link
                            key={it.to}
                            to={it.to}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-all ${
                              active
                                ? 'bg-card border-primary/50 shadow-md shadow-primary/10'
                                : 'bg-card/50 border-border/40 hover:border-primary/40 hover:-translate-y-0.5'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${it.tone}`}>
                              <it.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[10px] font-semibold">{it.label}</span>
                            {active && (
                              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Social */}
                <div>
                  <p className="px-1 mb-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    Watch Together
                  </p>
                  <div className="space-y-1">
                    <JoinPartyDialog
                      trigger={
                        <button className="flex items-center gap-2.5 text-[12px] font-semibold py-2 px-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/40 transition-all w-full text-left">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
                            <Users className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="flex-1">
                            <span className="block leading-tight">Join Party</span>
                            <span className="text-[9px] text-muted-foreground font-medium">Enter party code</span>
                          </div>
                        </button>
                      }
                    />
                    <ViewPartyDialog
                      trigger={
                        <button className="flex items-center gap-2.5 text-[12px] font-semibold py-2 px-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/40 transition-all w-full text-left">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
                            <Eye className="h-3.5 w-3.5 text-white" />
                          </div>
                          <div className="flex-1">
                            <span className="block leading-tight">View Parties</span>
                            <span className="text-[9px] text-muted-foreground font-medium">Browse live parties</span>
                          </div>
                        </button>
                      }
                    />
                  </div>
                </div>

                {/* Quick actions */}
                <div>
                  <p className="px-1 mb-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    Quick Actions
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={() => closeMenuThen(() => setVerifyOpen(true))}
                      className="flex items-center gap-2.5 text-[12px] font-semibold py-2 px-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/40 transition-all w-full text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <span>Verify Token</span>
                    </button>
                    <button
                      onClick={() => closeMenuThen(showWhatsNewManually)}
                      className="flex items-center gap-2.5 text-[12px] font-semibold py-2 px-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/40 transition-all w-full text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <span>What's New</span>
                    </button>
                    <button
                      onClick={() => closeMenuThen(handleHardRefresh)}
                      className="flex items-center gap-2.5 text-[12px] font-semibold py-2 px-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/40 transition-all w-full text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                        <RefreshCw className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div className="flex-1">
                        <span className="block leading-tight">Refresh App</span>
                        <span className="text-[9px] text-muted-foreground font-medium">Force latest update</span>
                      </div>
                    </button>
                  </div>

                  {canUpload() && (
                    <Button
                      onClick={() => closeMenuThen(handleUploadClick)}
                      className="w-full mt-2 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white font-bold shadow-lg shadow-primary/30 h-9"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload Anime
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full mt-1.5 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 h-9 font-bold"
                    >
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                        <Shield className="h-3.5 w-3.5 mr-1.5" />
                        Admin Panel
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <VerifyTokenDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
          
        </div>
        </div>
      </div>
      {/* Accent gradient underline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </header>
  );
}