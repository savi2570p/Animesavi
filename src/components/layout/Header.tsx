import { Link, useNavigate } from 'react-router-dom';
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
  ListVideo
} from 'lucide-react';
import { useState } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const { showWhatsNewManually } = usePopupQueue();

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

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b border-border/50 safe-area-top">
      <div className="container flex h-12 sm:h-14 items-center justify-between gap-1.5 sm:gap-4">
        {/* Logo + Home Button (mobile) */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Link to="/welcome" className="flex-shrink-0">
            <img 
              src={logo} 
              alt="Anime Savi" 
              className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg object-contain hover:scale-110 transition-transform duration-200" 
            />
          </Link>
          {/* Mobile Home Button */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="lg:hidden h-7 w-7 sm:h-8 sm:w-8"
          >
            <Link to="/">
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </Link>
          </Button>
          <Link to="/" className="hidden sm:inline-block text-lg font-bold hover:opacity-80 transition-opacity">
            <span className="text-primary">Anime</span>
            <span className="text-foreground ml-1">Savi</span>
          </Link>
        </div>

        {/* Navigation - Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link 
              key={link.label}
              to={link.to} 
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
          
          {canUpload() && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleUploadClick}
              className="text-primary hover:text-primary hover:bg-primary/10 ml-2"
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          )}
        </nav>

        {/* Search - HiAnime Style */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:flex">
          <div className={`relative w-full transition-all duration-200 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
            <Input
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
              className="pl-4 pr-12 bg-card border-border focus:border-primary rounded-lg h-10"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-primary hover:bg-primary/90 rounded-md"
            >
              <Search className="h-4 w-4" />
            </Button>
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
        <div className="flex items-center gap-1 sm:gap-2">
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
              <DropdownMenuContent className="w-56 bg-card border-border" align="end">
                <div className="flex items-center gap-3 p-3 border-b border-border">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.user_metadata?.username || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 py-2">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorites" className="flex items-center gap-2 py-2">
                    <Heart className="h-4 w-4" /> Favorites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history" className="flex items-center gap-2 py-2">
                    <History className="h-4 w-4" /> Watch History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/downloads" className="flex items-center gap-2 py-2">
                    <Download className="h-4 w-4" /> Downloads
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/watchlist" className="flex items-center gap-2 py-2">
                    <ListVideo className="h-4 w-4" /> Watch List
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {canUpload() && (
                  <DropdownMenuItem asChild>
                    <Link to="/upload" className="flex items-center gap-2 py-2">
                      <Upload className="h-4 w-4" /> Upload Anime
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 py-2">
                      <Shield className="h-4 w-4" /> Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 py-2">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0">
                  <AccountSwitcher />
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Sign Out
                </DropdownMenuItem>
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
          <Sheet>
            <SheetTrigger asChild className="flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 sm:w-72 bg-background border-border">
              <div className="flex flex-col gap-3 mt-6">
                {/* Search */}
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Input
                      type="search"
                      placeholder="Search anime..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-3 pr-9 bg-card border-border rounded-lg h-8 text-xs"
                      autoFocus={false}
                      tabIndex={-1}
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-primary"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  </div>
                </form>

                {/* Nav Links */}
                <nav className="flex flex-col gap-0.5">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.label}
                      to={link.to} 
                      className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors"
                    >
                      {link.icon && <link.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {link.label}
                    </Link>
                  ))}
                  
                  <div className="py-1.5 px-2.5">
                    <JoinPartyDialog 
                      trigger={
                        <button className="flex items-center gap-2.5 text-[13px] font-medium hover:text-primary transition-colors w-full text-left">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          Join Party
                        </button>
                      }
                    />
                  </div>
                  
                  <div className="py-1.5 px-2.5">
                    <ViewPartyDialog 
                      trigger={
                        <button className="flex items-center gap-2.5 text-[13px] font-medium hover:text-primary transition-colors w-full text-left">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          View Parties
                        </button>
                      }
                    />
                  </div>
                  
                  {user && (
                    <>
                      <Link 
                        to="/favorites" 
                        className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors"
                      >
                        <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                        Favorites
                      </Link>
                      <Link 
                        to="/history" 
                        className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors"
                      >
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        Watch History
                      </Link>
                      <Link 
                        to="/downloads" 
                        className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        Downloads
                      </Link>
                      <Link 
                        to="/watchlist" 
                        className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors"
                      >
                        <ListVideo className="h-3.5 w-3.5 text-muted-foreground" />
                        Watch List
                      </Link>
                    </>
                  )}
                  <button
                    onClick={() => setVerifyOpen(true)}
                    className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors w-full text-left"
                  >
                     <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
                     Verify
                  </button>
                  <button
                    onClick={() => showWhatsNewManually()}
                    className="flex items-center gap-2.5 text-[13px] font-medium py-1.5 px-2.5 rounded-lg hover:bg-card transition-colors w-full text-left"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    What's New
                  </button>
                  {canUpload() && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleUploadClick}
                      className="flex items-center gap-2 justify-start mt-2 border-primary/30 text-primary text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Anime
                    </Button>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <VerifyTokenDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
          
        </div>
      </div>
    </header>
  );
}