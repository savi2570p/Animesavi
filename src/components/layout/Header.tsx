import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  Sparkles,
  ChevronDown,
  Users
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { JoinPartyDialog } from '@/components/WatchParty';

const genres = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
  'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports'
];

export function Header() {
  const { user, isUploader, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
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

  return (
    <header className="sticky top-0 z-50 w-full glass-effect transition-all duration-500">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
          <div className="relative">
            <img 
              src={logo} 
              alt="Anime.Savi.me" 
              className="h-10 w-10 rounded-xl object-contain transition-transform duration-300 group-hover:scale-110" 
            />
            <div className="absolute inset-0 rounded-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <span className="hidden sm:inline-block text-xl font-heading font-bold anime-gradient-text">
            Anime.Savi.me
          </span>
        </Link>

        {/* Navigation - Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link 
            to="/browse" 
            className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-300"
          >
            Browse
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-300">
              Genres
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="grid grid-cols-2 gap-1 w-60 p-2 bg-popover/95 backdrop-blur-xl border-border/50">
              {genres.map((genre) => (
                <DropdownMenuItem key={genre} asChild className="rounded-lg hover:bg-primary/10 hover:text-primary">
                  <Link to={`/browse?genre=${genre.toLowerCase()}`}>{genre}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {user && (
            <Link 
              to="/history" 
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-300"
            >
              My List
            </Link>
          )}
          
          {canUpload() && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleUploadClick}
              className="flex items-center gap-2 text-primary hover:bg-primary/10 ml-2"
            >
              <Sparkles className="h-4 w-4" />
              Upload
            </Button>
          )}
        </nav>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:flex">
          <div className={`relative w-full transition-all duration-300 ${isSearchFocused ? 'scale-[1.02]' : ''}`}>
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300 ${isSearchFocused ? 'text-primary' : 'text-muted-foreground'}`} />
            <Input
              type="search"
              placeholder="Search anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="pl-11 pr-4 bg-secondary/50 border-border/50 focus:border-primary focus:bg-secondary/80 rounded-xl transition-all duration-300"
            />
          </div>
        </form>

        {/* User Menu */}
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-primary/30 hover:ring-primary/60 transition-all duration-300">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {isAdmin && (
                    <Crown className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60 p-2 bg-popover/95 backdrop-blur-xl border-border/50" align="end">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt="Avatar" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.user_metadata?.username || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                  <Link to="/profile" className="flex items-center gap-3 py-2">
                    <User className="h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                  <Link to="/favorites" className="flex items-center gap-3 py-2">
                    <Heart className="h-4 w-4" /> Favorites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                  <Link to="/history" className="flex items-center gap-3 py-2">
                    <History className="h-4 w-4" /> Watch History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-2" />
                {canUpload() && (
                  <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                    <Link to="/upload" className="flex items-center gap-3 py-2">
                      <Upload className="h-4 w-4" /> Upload Anime
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                    <Link to="/admin" className="flex items-center gap-3 py-2">
                      <Shield className="h-4 w-4" /> Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem asChild className="rounded-lg hover:bg-primary/10">
                  <Link to="/settings" className="flex items-center gap-3 py-2">
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-3" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild className="hidden sm:inline-flex hover:bg-primary/10 hover:text-primary">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild className="anime-button">
                <Link to="/auth">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get Started
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Search Button */}
          <form onSubmit={handleSearch} className="md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-32 pl-9 pr-2 h-9 bg-secondary/50 border-border/50 focus:w-40 transition-all duration-300 rounded-xl text-sm"
              />
            </div>
          </form>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background/95 backdrop-blur-xl border-border/50">
              <div className="flex flex-col gap-6 mt-6">
                {/* Mobile Search */}
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search anime..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-11 bg-secondary/50 rounded-xl"
                    />
                  </div>
                </form>

                {/* Mobile Nav Links */}
                <nav className="flex flex-col gap-2">
                  <Link 
                    to="/browse" 
                    className="text-lg font-medium hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-primary/10"
                  >
                    Browse All
                  </Link>
                  
                  {/* Join Party Option */}
                  <div className="py-2 px-3">
                    <JoinPartyDialog 
                      trigger={
                        <button className="flex items-center gap-3 text-lg font-medium hover:text-primary transition-colors w-full text-left">
                          <Users className="h-5 w-5" />
                          Join Party
                        </button>
                      }
                    />
                  </div>
                  
                  {user && (
                    <>
                      <Link 
                        to="/favorites" 
                        className="flex items-center gap-3 text-lg font-medium hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-primary/10"
                      >
                        <Heart className="h-5 w-5" />
                        Favorites
                      </Link>
                      <Link 
                        to="/history" 
                        className="flex items-center gap-3 text-lg font-medium hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-primary/10"
                      >
                        <History className="h-5 w-5" />
                        Watch History
                      </Link>
                    </>
                  )}
                  {canUpload() && (
                    <Button 
                      variant="outline" 
                      onClick={handleUploadClick}
                      className="flex items-center gap-2 justify-start border-primary/30 hover:bg-primary/10"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Anime
                    </Button>
                  )}
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground px-3">Genres</p>
                    <div className="grid grid-cols-2 gap-1">
                      {genres.map((genre) => (
                        <Link
                          key={genre}
                          to={`/browse?genre=${genre.toLowerCase()}`}
                          className="text-sm py-2 px-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200"
                        >
                          {genre}
                        </Link>
                      ))}
                    </div>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
