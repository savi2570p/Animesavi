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
  RefreshCw,
  Clock,
  CalendarDays
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { JoinPartyDialog, ViewPartyDialog } from '@/components/WatchParty';
import { NotificationBell } from '@/components/NotificationBell';
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
  // Resolve synchronously on first render — deriving this in an effect made the
  // navbar render a desktop layout first and then stretch on mobile.
  const [isMobileOS, setIsMobileOS] = useState(() => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod|Android/.test(navigator.userAgent) ||
      window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    const isTouchOS = /iPad|iPhone|iPod|Android/.test(ua);
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileOS(isTouchOS || mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Smooth hide-on-scroll-down / show-on-scroll-up for the floating glass navbar.
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    let idle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
        if (y < 120 || atBottom) setNavHidden(false);
        else if (delta > 12) setNavHidden(true);
        else if (delta < -6) setNavHidden(false);
        lastY = y;
        ticking = false;
      });
      // Android momentum scrolling can leave the bar stuck off-screen — always
      // bring it back once scrolling stops.
      clearTimeout(idle);
      idle = setTimeout(() => setNavHidden(false), 900);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Never keep the navbar hidden across navigations.
  useEffect(() => {
    setNavHidden(false);
  }, [location.pathname]);




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
    // Wait for the sheet exit animation to finish so the next dialog
    // isn't swallowed by the closing overlay / focus lock.
    window.setTimeout(callback, 360);
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
    <header
      className={`sticky top-0 z-[100] w-full lg-nav-floating nav-v6 transition-transform duration-300 will-change-transform ${
        navHidden ? '-translate-y-[120%]' : 'translate-y-0'
      }`}
    >
      {/* Layered glass surface */}
      <div className="relative">

        {/* Ambient gradient wash */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <div className="absolute inset-x-0 top-0 h-px bg-primary/20" />
        </div>

        <div className="container relative flex h-12 sm:h-14 items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo lockup */}
          <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
            <Link to="/welcome" className="nav-logo-v8 group relative flex-shrink-0" aria-label="Welcome">
              <span className="absolute inset-0 rounded-lg bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img
                src={logo}
                alt="Anime Savi"
                className="relative block h-6 w-6 sm:h-8 sm:w-8 rounded-lg object-contain ring-1 ring-border/50 group-hover:ring-primary/50 transition-colors duration-200"
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
              <span className="text-lg font-bold text-primary">
                Anime
              </span>
              <span className="text-lg font-black tracking-tight text-foreground">Savi</span>
              <span className="hidden xl:inline-block ml-1.5 px-1.5 py-0.5 rounded-md bg-primary/15 border border-primary/25 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                4K
              </span>
            </Link>
          </div>

          {/* Navigation - Desktop pill bar */}
          <nav className="nav-v6-links hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActivePath(link.to);
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-v6-link relative inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-semibold transition-colors duration-200 ${
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {canUpload() && (
              <Button variant="glass" size="sm"
                onClick={handleUploadClick}
                className="ml-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
            )}
          </nav>

          {/* Search — Crimson obsidian glass */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:flex">
            <div className="group relative w-full">
              <div className={`nav-v6-search relative w-full flex items-center border rounded-lg p-1 transition-colors ${isSearchFocused ? 'border-primary/40' : 'border-border/40'}`}>
                <div className="pl-3 pr-2 flex items-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  ref={desktopSearchRef}
                  type="search"
                  placeholder="Search anime, characters, or studios…"
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
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/70 text-[13px] font-medium py-2"
                />
                <div className="flex items-center gap-2 pr-1">
                  <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 bg-muted/60 border border-border/50 rounded-md text-[10px] font-bold text-muted-foreground tracking-wider">
                    /
                  </kbd>
                  <Button
                    type="submit"
                    className="h-7 px-3 rounded-md text-[11px] font-semibold"
                  >
                    <Search className="h-3.5 w-3.5 lg:hidden" />
                    <span className="hidden lg:inline">Search</span>
                  </Button>
                </div>
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
          {user && <div className="[&_button]:h-7 [&_button]:w-7 sm:[&_button]:h-9 sm:[&_button]:w-9 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4"><NotificationBell /></div>}
          
          {user && !isMobileOS ? (
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
                className="w-52 md:w-60 origin-top-right bg-card/95 border-border/60 p-0 overflow-hidden shadow-xl rounded-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-100 ease-out"
                align="end"
                sideOffset={4}
              >
                {/* Cinematic header */}
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
                  <div className="relative flex items-center gap-2 p-2.5">
                    <div className="relative shrink-0">
                      <Avatar className="relative h-8 w-8 md:h-9 md:w-9 ring-1 ring-primary/40">
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
                      <p className="text-xs md:text-sm font-bold truncate">{user.user_metadata?.username || 'User'}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-[8px] md:text-[10px] font-black text-yellow-400 uppercase tracking-wider">
                            <Crown className="h-2 w-2 md:h-2.5 md:w-2.5" /> Admin
                          </span>
                        ) : isUploader ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[8px] md:text-[10px] font-black text-primary uppercase tracking-wider">
                            <Upload className="h-2 w-2 md:h-2.5 md:w-2.5" /> Uploader
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Viewer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Library section */}
                <div className="p-1">
                  <p className="px-1.5 pt-0.5 pb-1 text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Library
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/profile" className="flex flex-col items-center gap-0.5 py-1 hover:bg-primary/10 rounded-md group">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                          <User className="h-2.5 w-2.5 md:h-3 md:w-3 text-primary" />
                        </div>
                        <span className="text-[8px] md:text-[10px] font-semibold">Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/favorites" className="flex flex-col items-center gap-0.5 py-1 hover:bg-rose-500/10 rounded-md group">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-rose-500/15 flex items-center justify-center group-hover:bg-rose-500/25 transition-colors">
                          <Heart className="h-2.5 w-2.5 md:h-3 md:w-3 text-rose-500" />
                        </div>
                        <span className="text-[8px] md:text-[10px] font-semibold">Favs</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/downloads" className="flex flex-col items-center gap-0.5 py-1 hover:bg-emerald-500/10 rounded-md group">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                          <Download className="h-2.5 w-2.5 md:h-3 md:w-3 text-emerald-500" />
                        </div>
                        <span className="text-[8px] md:text-[10px] font-semibold">Downloads</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-lg p-0">
                      <Link to="/watchlist" className="flex flex-col items-center gap-0.5 py-1 hover:bg-sky-500/10 rounded-md group">
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-sky-500/15 flex items-center justify-center group-hover:bg-sky-500/25 transition-colors">
                          <ListVideo className="h-2.5 w-2.5 md:h-3 md:w-3 text-sky-500" />
                        </div>
                        <span className="text-[8px] md:text-[10px] font-semibold">List</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuItem asChild className="rounded-lg mt-0.5">
                    <Link to="/history" className="flex items-center gap-1.5 py-1 px-1.5">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-violet-500/15 flex items-center justify-center">
                        <History className="h-2.5 w-2.5 md:h-3 md:w-3 text-violet-500" />
                      </div>
                      <span className="text-[10px] md:text-xs font-medium">Watch History</span>
                    </Link>
                  </DropdownMenuItem>
                </div>

                {(canUpload() || isAdmin) && (
                  <>
                    <DropdownMenuSeparator className="my-0" />
                    <div className="p-1">
                      <p className="px-1.5 pt-0.5 pb-1 text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Creator Tools
                      </p>
                      {canUpload() && (
                        <DropdownMenuItem asChild className="rounded-md">
                          <Link to="/upload" className="flex items-center gap-1.5 py-1 px-1.5">
                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-sm shadow-primary/30">
                              <Upload className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[10px] md:text-xs font-semibold block leading-tight">Upload Anime</span>
                              <span className="text-[8px] md:text-[10px] text-muted-foreground">Add new episodes</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem asChild className="rounded-md">
                          <Link to="/admin" className="flex items-center gap-1.5 py-1 px-1.5">
                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-sm shadow-yellow-500/30">
                              <Shield className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[10px] md:text-xs font-semibold block leading-tight">Admin Panel</span>
                              <span className="text-[8px] md:text-[10px] text-muted-foreground">Manage platform</span>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </div>
                  </>
                )}

                <DropdownMenuSeparator className="my-0" />
                <div className="p-1 [&_.account-switch-trigger]:h-7 md:[&_.account-switch-trigger]:h-8 [&_.account-switch-trigger]:gap-1.5 [&_.account-switch-trigger]:px-1.5 [&_.account-switch-trigger]:text-[10px] md:[&_.account-switch-trigger]:text-xs [&_.account-switch-trigger_svg]:h-3 [&_.account-switch-trigger_svg]:w-3">
                  <DropdownMenuItem asChild className="rounded-md">
                    <Link to="/settings" className="flex items-center gap-1.5 py-1 px-1.5">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-muted flex items-center justify-center">
                        <Settings className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] md:text-xs font-medium">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 rounded-md">
                    <AccountSwitcher />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="rounded-md text-destructive focus:text-destructive focus:bg-destructive/10 mt-0.5 py-1 px-1.5"
                  >
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-md bg-destructive/15 flex items-center justify-center mr-1.5">
                      <LogOut className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </div>
                    <span className="text-[10px] md:text-xs font-semibold">Sign Out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {!user && (
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
                ref={mobileSearchRef}
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => { if (searchQuery.trim().length >= 2) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className={`pl-6 pr-1 h-7 sm:h-8 bg-card border-border transition-all duration-200 rounded-lg text-xs ${isMobileOS ? 'w-20 sm:w-24 focus:w-28 sm:focus:w-32' : 'w-16 sm:w-20 focus:w-24 sm:focus:w-28'}`}
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
              <Button variant="ghost" size="icon" aria-label="Open menu" className="h-7 w-7 sm:h-8 sm:w-8">
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="menu-v4 w-[min(360px,calc(100vw-1rem))] sm:max-w-[360px] border-border px-5 overflow-y-auto z-[160]">
              <div className="pt-5 pb-6">
                <div className="flex items-center gap-3 mb-6"><img src={logo} alt="" className="w-9 h-9 object-contain" /><div><p className="text-lg font-bold">Anime Savi</p><p className="text-xs text-muted-foreground">Your library</p></div></div>
                {user ? <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border"><AvatarImage src={user.user_metadata?.avatar_url} alt="Profile" /><AvatarFallback className="bg-primary text-primary-foreground">{user.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{user.user_metadata?.username || 'My account'}</p><p className="text-[11px] text-muted-foreground truncate">{user.email}</p></div>
                  <Button asChild variant="glass" size="icon" title="Profile" aria-label="Open profile" className="h-8 w-8 rounded-lg"><Link to="/profile" onClick={() => setMobileMenuOpen(false)}><User /></Link></Button>
                </div> : <Button asChild className="w-full"><Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Sign In</Link></Button>}
              </div>
              {user && <div className="flex items-center gap-2 text-xs pb-4"><Crown className="h-4 w-4 text-primary" /><span>{hasPremium ? 'Premium Active' : 'Get Premium Access'}</span>{!hasPremium && <Button variant="glass" size="sm" className="ml-auto h-7 text-xs" onClick={() => closeMenuThen(() => window.open('https://t.me/getunlocktoken', '_blank', 'noopener'))}>Get</Button>}</div>}
              <form onSubmit={handleSearch} className="relative mb-3"><Input type="search" placeholder="Search anime..." aria-label="Search anime in menu" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-card/70 border-border pr-10" /><Button type="submit" size="icon" variant="ghost" aria-label="Search" className="absolute right-1 top-1 h-8 w-8"><Search /></Button></form>
              <section className="menu-v4-section"><h2 className="menu-v4-label">DISCOVER</h2><nav className="grid grid-cols-2 gap-1">
                {[...navLinks, {to: '/schedule', label: 'Schedule', icon: CalendarDays}].map(link => { const Icon = link.icon || Home; return <Button asChild variant="ghost" key={link.label} className="menu-v4-link"><Link to={link.to} aria-current={isActivePath(link.to) ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><Icon className="text-primary" />{link.label}</Link></Button>; })}
              </nav></section>
              {user && <section className="menu-v4-section"><h2 className="menu-v4-label">MY LIBRARY</h2><nav className="grid grid-cols-2 gap-1">{[{to:'/favorites',icon:Heart,label:'Favorites'},{to:'/history',icon:History,label:'History'},{to:'/downloads',icon:Download,label:'Downloads'},{to:'/watchlist',icon:Clock,label:'Watch Later'}].map(item => <Button key={item.to} asChild variant="ghost" className="menu-v4-link"><Link to={item.to} aria-current={location.pathname === item.to ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}><item.icon className="text-primary" />{item.label}</Link></Button>)}</nav></section>}
              <section className="menu-v4-section"><h2 className="menu-v4-label">WATCH TOGETHER</h2><div className="grid grid-cols-2 gap-1"><JoinPartyDialog trigger={<Button variant="glass" className="menu-v4-link"><Users />Join Party</Button>} /><ViewPartyDialog trigger={<Button variant="glass" className="menu-v4-link"><Eye />View Parties</Button>} /></div></section>
              <section className="menu-v4-section"><h2 className="menu-v4-label">APP & ACCOUNT</h2><div className="space-y-1">
                <Button variant="ghost" className="menu-v4-link w-full" onClick={() => closeMenuThen(() => setVerifyOpen(true))}><BadgeCheck />Verify Token</Button>
                <Button variant="ghost" className="menu-v4-link w-full" onClick={() => closeMenuThen(showWhatsNewManually)}><Sparkles />What's New</Button>
                <Button variant="ghost" className="menu-v4-link w-full" onClick={() => closeMenuThen(handleHardRefresh)}><RefreshCw />Refresh App</Button>
                {['savi2570p@gmail.com','shadowtoonsindia@gmail.com'].includes((user?.email || '').toLowerCase()) && <Button variant="ghost" className="menu-v4-link w-full" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/s2-home`).then(() => toast.success('Home V2 link copied'), () => toast.error('Could not copy link')); setMobileMenuOpen(false); }}><Home />Home V2</Button>}
                {canUpload() && <Button variant="glass" className="menu-v4-link w-full" onClick={() => closeMenuThen(handleUploadClick)}><Upload />Upload Anime</Button>}
                {isAdmin && <Button asChild variant="glass" className="menu-v4-link w-full"><Link to="/admin" onClick={() => setMobileMenuOpen(false)}><Shield />Admin Panel</Link></Button>}
              </div></section>
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