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
  RefreshCw,
  Clock,
  CalendarDays,
  Bookmark,
  X,
  LogIn,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { ViewPartyDialog } from '@/components/WatchParty';
import { NotificationBell } from '@/components/NotificationBell';
import { rememberAccount } from '@/components/AccountSwitcher';
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
  const menuContentRef = useRef<HTMLDivElement>(null);
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


  const [viewPartiesOpen, setViewPartiesOpen] = useState(false);
  const closeMenuThen = (callback: () => void) => {
    setMobileMenuOpen(false);
    // Wait for the sheet exit animation to finish so the next dialog
    // isn't swallowed by the closing overlay / focus lock.
    window.setTimeout(callback, 200);
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


  const isActivePath = (to: string) => {
    const [path, query] = to.split('?');
    if (path !== location.pathname) return false;
    if (!query) return location.search === '' || path === '/';
    return location.search.includes(query);
  };

  const joinedLabel = (() => {
    if (!user?.created_at) return '';
    const days = Math.max(0, Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000));
    if (days === 0) return 'Joined today';
    return `Joined ${days} day${days === 1 ? '' : 's'} ago`;
  })();

  type MenuItem = { label: string; icon: LucideIcon; to?: string; onClick?: () => void };
  const menuSections: { label: string; items: MenuItem[] }[] = [
    {
      label: 'BROWSE',
      items: [
        { to: '/', label: 'Home', icon: Home },
        { to: '/browse', label: 'Search', icon: Search },
        { to: '/browse?type=movie', label: 'Movies', icon: Film },
        { to: '/browse?type=series', label: 'TV Series', icon: Tv },
        { to: '/browse?sort=popular', label: 'Most Popular', icon: TrendingUp },
        { to: '/schedule', label: 'Schedule', icon: CalendarDays },
      ],
    },
    ...(user ? [{
      label: 'LIBRARY',
      items: [
        { to: '/favorites', label: 'Favorites', icon: Heart },
        { to: '/history', label: 'History', icon: History },
        { to: '/downloads', label: 'Downloads', icon: Download },
        { to: '/watchlist', label: 'Watch Later', icon: Clock },
      ],
    }] : []),
    {
      label: 'MORE',
      items: [
        ...(!user ? [{ to: '/auth', label: 'Sign In', icon: LogIn }] : []),
        { label: 'Watch Party', icon: Users, onClick: () => closeMenuThen(() => setViewPartiesOpen(true)) },
        ...(user && !hasPremium ? [{ label: 'Get Premium', icon: Crown, onClick: () => closeMenuThen(() => window.open('https://t.me/getunlocktoken', '_blank', 'noopener')) }] : []),
        { label: 'Verify Token', icon: BadgeCheck, onClick: () => closeMenuThen(() => setVerifyOpen(true)) },
        { label: "What's New", icon: Sparkles, onClick: () => closeMenuThen(showWhatsNewManually) },
        { label: 'Refresh App', icon: RefreshCw, onClick: () => closeMenuThen(handleHardRefresh) },
        ...(['savi2570p@gmail.com', 'shadowtoonsindia@gmail.com'].includes((user?.email || '').toLowerCase()) ? [{
          label: 'Home V2', icon: Home, onClick: () => {
            navigator.clipboard?.writeText(`${window.location.origin}/s2-home`).then(() => toast.success('Home V2 link copied'), () => toast.error('Could not copy link'));
            setMobileMenuOpen(false);
          },
        }] : []),
      ],
    },
  ];

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

        <div className="container lg:max-w-none relative flex h-12 sm:h-14 items-center justify-between gap-1.5 sm:gap-4">
          {/* Logo lockup */}
          <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
            {/* Hamburger menu — left side on every screen */}
            <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <PopoverTrigger asChild className="flex-shrink-0">
                <Button variant="ghost" size="icon" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} className="nav-menu-trigger-v10 h-7 w-7 sm:h-8 sm:w-8" data-open={mobileMenuOpen || undefined}>
                  {mobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                ref={menuContentRef}
                tabIndex={-1}
                align="start"
                side="bottom"
                sideOffset={8}
                collisionPadding={10}
                onOpenAutoFocus={(event) => {
                  // Focus the menu itself so no phone keyboard opens.
                  event.preventDefault();
                  menuContentRef.current?.focus({ preventScroll: true });
                }}
                className="nav-menu-v10"
                aria-label="Main menu"
              >
                {menuSections.map(section => (
                  <section key={section.label} className="nav-menu-v10-section">
                    <h2 className="nav-menu-v10-label">{section.label}</h2>
                    <nav className="flex flex-col">
                      {section.items.map(item => {
                        const Icon = item.icon;
                        const active = item.to ? isActivePath(item.to) : false;
                        const content = <><span className="nav-menu-v10-icon"><Icon /></span><span className="truncate">{item.label}</span></>;
                        return item.to ? (
                          <Link key={item.label} to={item.to} className="nav-menu-v10-item" aria-current={active ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}>{content}</Link>
                        ) : (
                          <button key={item.label} type="button" className="nav-menu-v10-item" onClick={item.onClick}>{content}</button>
                        );
                      })}
                    </nav>
                  </section>
                ))}
              </PopoverContent>
            </Popover>
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
            <Link to="/" className="nav-v6-brand hidden sm:flex items-center gap-1 leading-none whitespace-nowrap hover:opacity-90 transition-opacity">
              <span className="text-lg font-bold text-primary">
                Anime
              </span>
              <span className="text-lg font-black tracking-tight text-foreground">Savi</span>
              <span className="text-lg font-black text-primary">+</span>
            </Link>
          </div>

          {/* Search — Crimson obsidian glass */}
          <form onSubmit={handleSearch} className="nav-v6-searchform flex-1 min-w-0 max-w-sm mr-auto hidden md:flex">
            <div className="group relative w-full">
              <div className={`nav-v6-search relative w-full flex items-center border rounded-lg p-1 transition-colors ${isSearchFocused ? 'border-primary/40' : 'border-border/40'}`}>
                <div className="pl-3 pr-2 flex items-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  ref={desktopSearchRef}
                  type="search"
                  placeholder="Search anime..."
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
                  <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 bg-muted/60 border border-border/50 rounded-md text-[10px] font-bold text-muted-foreground tracking-wider">
                    /
                  </kbd>
                  <Button
                    type="submit"
                    className="h-7 px-3 rounded-md text-[11px] font-semibold"
                  >
                    <Search className="h-3.5 w-3.5 xl:hidden" />
                    <span className="hidden xl:inline">Search</span>
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
          <div className="nav-v6-actions flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          {user && <div className="[&_button]:h-7 [&_button]:w-7 sm:[&_button]:h-9 sm:[&_button]:w-9 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4"><NotificationBell /></div>}
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Open account menu" className="account-trigger-v9 relative h-7 w-7 sm:h-9 sm:w-9 rounded-full p-0">
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
                className="account-menu-v10"
                aria-label="Account menu"
                align="end"
                sideOffset={10}
                collisionPadding={12}
              >
                <header className="account-menu-v10-header">
                  <Avatar className="h-11 w-11 shrink-0 rounded-lg border border-border">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt="Profile" className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-primary/15 text-primary font-bold">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="account-menu-v10-name">{user.user_metadata?.username || 'My account'}</p>
                    <p className="account-menu-v10-email">{user.email}</p>
                    {joinedLabel && <p className="account-menu-v10-joined"><CalendarDays />{joinedLabel}</p>}
                  </div>
                </header>
                <div className="account-menu-v10-list">
                  {[
                    { to: '/profile', label: 'Profile', icon: User },
                    { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
                    { to: '/continue-watching', label: 'Continue Watching', icon: History },
                  ].map(item => (
                    <DropdownMenuItem asChild key={item.to} className="account-menu-v10-item">
                      <Link to={item.to}><item.icon /><span>{item.label}</span></Link>
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator className="account-menu-v10-sep" />
                <div className="account-menu-v10-list">
                  <DropdownMenuItem onClick={handleSignOut} className="account-menu-v10-item account-menu-v10-signout">
                    <LogOut /><span>Sign Out</span>
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

          <VerifyTokenDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
          <ViewPartyDialog trigger={null} open={viewPartiesOpen} onOpenChange={setViewPartiesOpen} />
          
        </div>
        </div>
      </div>
      {/* Accent gradient underline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </header>
  );
}