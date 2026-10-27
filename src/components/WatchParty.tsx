import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Send, Copy, X, Crown, UserPlus, Link2, Tv, Play, Eye, MessageSquare, SmilePlus, Sparkles } from 'lucide-react';
import { RecapSidebar } from '@/components/watch-party/RecapSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

// Message validation schema
const messageSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message must be 500 characters or less'),
});

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isHost?: boolean;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user IDs
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

interface PartyInfo {
  animeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeId: string;
}

interface WatchPartyProps {
  episodeId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  animeTitle: string;
  episodeNumber: number;
  seasonNumber?: number;
  animeId?: string;
}

interface JoinedParty {
  id: string;
  code: string;
  anime_title: string;
  season_number: number;
  episode_number: number;
  episode_id: string;
  is_active: boolean;
  host_id: string;
}

export function WatchParty({ episodeId, videoRef, animeTitle, episodeNumber, seasonNumber = 1, animeId }: WatchPartyProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; name: string; isHost: boolean }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'party' | 'chat' | 'recap'>('party');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Generate a unique party code with timestamp
  const generatePartyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const timestamp = Date.now().toString(36).slice(-2).toUpperCase();
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return timestamp + randomPart;
  };

  // Create a new watch party with database
  const createParty = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to create a watch party');
      return;
    }

    if (!animeId) {
      toast.error('Anime ID is required');
      return;
    }

    const code = generatePartyCode();
    
    try {
      // Insert party into database
      const { data: party, error } = await supabase
        .from('watch_parties')
        .insert({
          code,
          host_id: user.id,
          anime_id: animeId,
          episode_id: episodeId,
          anime_title: animeTitle,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          playback_time: videoRef.current?.currentTime || 0,
          is_playing: !videoRef.current?.paused,
        })
        .select()
        .single();

      if (error) throw error;

      // Add host as member
      await supabase.from('watch_party_members').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Host',
      });

      // Add system message
      await supabase.from('watch_party_messages').insert({
        party_id: party.id,
        user_id: user.id,
        username: 'System',
        message: `Watch party created! Share the code: ${code}`,
        is_host: false,
      });

      setPartyCode(code);
      setPartyId(party.id);
      setIsHost(true);
      setPartyInfo({
        animeTitle,
        seasonNumber,
        episodeNumber,
        episodeId,
      });
      setParticipants([{ id: user.id, name: user.email?.split('@')[0] || 'Host', isHost: true }]);
      setShowCreateDialog(false);
      setIsOpen(true);

      toast.success(`Watch party created! Code: ${code}`);
    } catch (error) {
      console.error('Error creating party:', error);
      toast.error('Failed to create watch party');
    }
  }, [user, animeTitle, seasonNumber, episodeNumber, episodeId, animeId, videoRef]);

  // Join an existing party
  const joinParty = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }

    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }

    try {
      // Find the party
      const { data: party, error } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !party) {
        toast.error('Offline', { description: 'This party code is not available or has ended.' });
        return;
      }

      // Add user as member
      await supabase.from('watch_party_members').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Guest',
      });

      // Add join message
      await supabase.from('watch_party_messages').insert({
        party_id: party.id,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Guest',
        message: `${user.email?.split('@')[0] || 'Guest'} joined the party!`,
        is_host: false,
      });

      setPartyCode(party.code);
      setPartyId(party.id);
      setIsHost(false);
      setPartyInfo({
        animeTitle: party.anime_title,
        seasonNumber: party.season_number,
        episodeNumber: party.episode_number,
        episodeId: party.episode_id,
      });
      setShowJoinDialog(false);
      setIsOpen(true);

      // Navigate to the episode if different
      if (party.episode_id !== episodeId) {
        navigate(`/watch/${party.episode_id}?party=${party.code}`);
      }

      toast.success('Joined the watch party!');
    } catch (error) {
      console.error('Error joining party:', error);
      toast.error('Failed to join watch party');
    }
  }, [user, joinCode, episodeId, navigate]);

  // Real-time sync: Host syncs playback state
  useEffect(() => {
    if (!isHost || !partyId || !videoRef.current) return;

    const syncPlayback = async () => {
      const video = videoRef.current;
      if (!video) return;

      await supabase
        .from('watch_parties')
        .update({
          playback_time: video.currentTime,
          is_playing: !video.paused,
        })
        .eq('id', partyId);
    };

    // Sync every 2 seconds
    syncIntervalRef.current = setInterval(syncPlayback, 2000);

    // Also sync on play/pause
    const handlePlay = () => syncPlayback();
    const handlePause = () => syncPlayback();
    const handleSeeked = () => syncPlayback();

    videoRef.current.addEventListener('play', handlePlay);
    videoRef.current.addEventListener('pause', handlePause);
    videoRef.current.addEventListener('seeked', handleSeeked);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      const video = videoRef.current;
      if (video) {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('seeked', handleSeeked);
      }
    };
  }, [isHost, partyId, videoRef]);

  // Real-time sync: Non-host receives updates - auto exit when party ends
  useEffect(() => {
    if (isHost || !partyId) return;

    const channel = supabase
      .channel(`party-sync-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'watch_parties',
          filter: `id=eq.${partyId}`,
        },
        (payload) => {
          const party = payload.new as any;
          const video = videoRef.current;

          // Check if party ended - auto exit everyone
          if (!party.is_active) {
            toast.error('Party is ended', {
              description: 'The host has ended this watch party',
              duration: 5000,
            });
            // Auto cleanup and exit
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            setPartyCode(null);
            setPartyId(null);
            setIsHost(false);
            setParticipants([]);
            setMessages([]);
            setPartyInfo(null);
            setIsOpen(false);
            return;
          }

          if (!video) return;

          // Sync playback state
          if (Math.abs(video.currentTime - party.playback_time) > 2) {
            video.currentTime = party.playback_time;
          }

          if (party.is_playing && video.paused) {
            video.play().catch(() => {});
          } else if (!party.is_playing && !video.paused) {
            video.pause();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isHost, partyId, videoRef]);

  // Real-time: Listen for new messages
  useEffect(() => {
    if (!partyId) return;

    // Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('watch_party_messages')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          userId: m.user_id,
          username: m.username,
          message: m.message,
          timestamp: new Date(m.created_at),
          isHost: m.is_host,
        })));
      }
    };

    loadMessages();

    // Load participants
    const loadParticipants = async () => {
      const { data: party } = await supabase
        .from('watch_parties')
        .select('host_id')
        .eq('id', partyId)
        .single();

      const { data: members } = await supabase
        .from('watch_party_members')
        .select('*')
        .eq('party_id', partyId);

      if (members && party) {
        setParticipants(members.map(m => ({
          id: m.user_id,
          name: m.username || 'Anonymous',
          isHost: m.user_id === party.host_id,
        })));
      }
    };

    loadParticipants();

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`party-messages-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'watch_party_messages',
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          const msg = payload.new as any;
          setMessages(prev => [...prev, {
            id: msg.id,
            userId: msg.user_id,
            username: msg.username,
            message: msg.message,
            timestamp: new Date(msg.created_at),
            isHost: msg.is_host,
          }]);
        }
      )
      .subscribe();

    // Subscribe to member changes
    const memberChannel = supabase
      .channel(`party-members-${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watch_party_members',
          filter: `party_id=eq.${partyId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [partyId]);

  // Send chat message with validation
  const sendMessage = useCallback(async () => {
    if (!user || !partyId) return;

    // Validate message using zod schema
    const result = messageSchema.safeParse({ message: newMessage });
    if (!result.success) {
      const error = result.error.issues[0];
      toast.error(error.message);
      return;
    }

    const validatedMessage = result.data.message;

    try {
      const { error } = await supabase.from('watch_party_messages').insert({
        party_id: partyId,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'Anonymous',
        message: validatedMessage,
        is_host: isHost,
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  }, [newMessage, user, partyId, isHost]);

  // Add emoji reaction to a message
  const addReaction = useCallback((messageId: string, emoji: string) => {
    if (!user) return;
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        const userReactions = reactions[emoji] || [];
        
        // Toggle reaction
        if (userReactions.includes(user.id)) {
          // Remove reaction
          const newUserReactions = userReactions.filter(id => id !== user.id);
          if (newUserReactions.length === 0) {
            const { [emoji]: _, ...rest } = reactions;
            return { ...msg, reactions: Object.keys(rest).length > 0 ? rest : undefined };
          }
          return { ...msg, reactions: { ...reactions, [emoji]: newUserReactions } };
        } else {
          // Add reaction
          return { ...msg, reactions: { ...reactions, [emoji]: [...userReactions, user.id] } };
        }
      }
      return msg;
    }));
  }, [user]);

  // Copy party code
  const copyCode = () => {
    if (partyCode) {
      navigator.clipboard.writeText(partyCode);
      toast.success('Party code copied!');
    }
  };

  // Leave party
  const leaveParty = async () => {
    if (partyId && user) {
      if (isHost) {
        // End the party
        await supabase
          .from('watch_parties')
          .update({ is_active: false })
          .eq('id', partyId);
        toast.success('Watch party ended');
      } else {
        // Remove from members
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('party_id', partyId)
          .eq('user_id', user.id);
        toast.success('Left the watch party');
      }
    }

    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    setPartyCode(null);
    setPartyId(null);
    setIsHost(false);
    setParticipants([]);
    setMessages([]);
    setPartyInfo(null);
    setIsOpen(false);
  };

  // End party (host or any authenticated member) - uses SECURITY DEFINER function
  const endParty = async () => {
    if (!partyId || !user) return;
    
    try {
      const { data, error } = await supabase.rpc('end_watch_party', { party_uuid: partyId });

      if (error) {
        console.error('Error ending party:', error);
        toast.error('Failed to end party');
        return;
      }

      if (!data) {
        toast.error('You are not a member of this party');
        return;
      }

      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      setPartyCode(null);
      setPartyId(null);
      setIsHost(false);
      setParticipants([]);
      setMessages([]);
      setPartyInfo(null);
      setIsOpen(false);
      toast.success('Watch party ended');
    } catch (error) {
      console.error('Error ending party:', error);
      toast.error('Failed to end party');
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle keyboard events for chat
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Check if user already joined via URL party code
  const searchParams = new URLSearchParams(window.location.search);
  const urlPartyCode = searchParams.get('party');
  const isJoinedViaUrl = !!urlPartyCode && !partyCode;

  if (!partyCode) {
    return (
      <div className="flex items-center gap-2">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Watch Party</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Create Watch Party
              </DialogTitle>
              <DialogDescription>
                Watch "{animeTitle}" S{seasonNumber} E{episodeNumber} together with friends
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Tv className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{animeTitle}</p>
                  <p className="text-xs text-muted-foreground">Season {seasonNumber} • Episode {episodeNumber}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Create a watch party and share the code with your friends. Everyone watches in real-time sync with chat!
              </p>
              <Button onClick={createParty} className="w-full gap-2">
                <Crown className="h-4 w-4" />
                Create Party
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Only show Join button if user hasn't joined via URL */}
        {!isJoinedViaUrl && (
          <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Join</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Join Watch Party
                </DialogTitle>
                <DialogDescription>
                  Enter the party code shared by your friend
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Enter 6-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <Button onClick={joinParty} className="w-full gap-2" disabled={joinCode.length !== 6}>
                  <Link2 className="h-4 w-4" />
                  Join Party
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-1">
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-primary/10 border-primary/30">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Party</span>
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {participants.length}
            </span>
          </Button>
        </SheetTrigger>
        {/* Desktop-only Chat tab button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 hidden sm:inline-flex"
          onClick={() => { setActiveTab('chat'); setIsOpen(true); }}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </Button>
      </div>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Watch Party
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">LIVE</span>
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={endParty} className="gap-1">
                <X className="h-3 w-3" />
                End Party
              </Button>
              <Button variant="ghost" size="icon" onClick={leaveParty}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Party code */}
          <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mt-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Party Code</p>
              <p className="text-xl font-mono font-bold tracking-widest">{partyCode}</p>
            </div>
            <Button size="sm" variant="outline" onClick={copyCode} className="gap-1">
              <Copy className="h-3 w-3" />
              Copy
            </Button>
          </div>
          
          {/* Now Watching Info */}
          {partyInfo && (
            <div className="mt-3 bg-primary/10 border border-primary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Play className="h-3 w-3" />
                <span>{isHost ? 'Now Watching' : 'Synced with Host'}</span>
              </div>
              <p className="font-medium text-sm">{partyInfo.animeTitle}</p>
              <p className="text-xs text-muted-foreground">
                Season {partyInfo.seasonNumber} • Episode {partyInfo.episodeNumber}
              </p>
            </div>
          )}
        </SheetHeader>

        {/* Tab switcher */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('party')}
            className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
              activeTab === 'party' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4 inline mr-1" />
            Party
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
              activeTab === 'recap' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4 inline mr-1" />
            Recap
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
              activeTab === 'chat' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-1" />
            Chat
          </button>
        </div>

        {activeTab === 'party' ? (
          <>
            {/* Participants */}
            <div className="p-3 border-b bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Participants ({participants.length})</p>
              <div className="flex flex-wrap gap-2">
                {participants.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center gap-1.5 bg-background rounded-full px-2 py-1 text-xs"
                  >
                    {p.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
              <p className="text-center">Switch to <strong>Recap</strong> for a 30s AI catch-up, or <strong>Chat</strong> to talk with friends!</p>
            </div>
          </>
        ) : activeTab === 'recap' ? (
          <RecapSidebar episodeId={episodeId} partyId={partyId} isHost={isHost} />
        ) : (
          <>
            {/* Chat messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 group ${msg.userId === 'system' || msg.username === 'System' ? 'justify-center' : ''}`}>
                    {msg.userId !== 'system' && msg.username !== 'System' && (
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs bg-primary/20">
                          {msg.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`${msg.userId === 'system' || msg.username === 'System' ? 'text-center' : ''}`}>
                      {msg.userId === 'system' || msg.username === 'System' ? (
                        <p className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                          {msg.message}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{msg.username}</span>
                            {msg.isHost && <Crown className="h-3 w-3 text-yellow-500" />}
                            <span className="text-[10px] text-muted-foreground">
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm bg-muted rounded-lg px-3 py-1.5 inline-block">
                              {msg.message}
                            </p>
                            
                            {/* Emoji reaction button */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-1 transition-all">
                                  <SmilePlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" side="top" align="start">
                                <div className="flex gap-1">
                                  {EMOJI_OPTIONS.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => addReaction(msg.id, emoji)}
                                      className="text-lg hover:bg-muted rounded p-1 transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Reaction display */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(msg.id, emoji)}
                                  className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                    users.includes(user?.id || '') 
                                      ? 'bg-primary/20 border-primary/50' 
                                      : 'bg-muted/50 border-border hover:bg-muted'
                                  }`}
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Chat input */}
            <div className="p-3 border-t bg-card">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────
// JOIN PARTY DIALOG — Premium cinematic redesign
// ─────────────────────────────────────────────────────────────────────
export function JoinPartyDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleJoin = async () => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }
    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }
    setBusy(true);
    try {
      const { data: party, error } = await supabase
        .from('watch_parties')
        .select('*')
        .eq('code', joinCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !party) {
        toast.error('Party not found or has ended');
        setBusy(false);
        return;
      }

      toast.success(`Joining party for ${party.anime_title}...`);
      setOpen(false);
      navigate(`/watch/${party.episode_id}?party=${party.code}`);
    } catch {
      toast.error('Failed to find watch party');
    } finally {
      setBusy(false);
    }
  };

  // Render code as 6 individual cells
  const cells = Array.from({ length: 6 }, (_, i) => joinCode[i] || '');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
            <UserPlus className="h-4 w-4" />
            Join Party
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-purple-500/30 bg-card">
        {/* Cinematic header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/25 via-pink-500/10 to-transparent" />
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl bg-purple-500/30 animate-pulse" />
          <div
            className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full blur-3xl bg-pink-500/25 animate-pulse"
            style={{ animationDelay: '0.6s' }}
          />

          <DialogHeader className="relative px-6 pt-7 pb-3">
            <div className="mx-auto relative">
              <div className="absolute inset-0 bg-purple-500/40 blur-2xl rounded-2xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl mx-auto rotate-3">
                <UserPlus className="h-7 w-7 text-white drop-shadow" strokeWidth={2.5} />
              </div>
            </div>
            <div className="mt-3 mx-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-300">
                Live Sync · Watch Together
              </span>
            </div>
            <DialogTitle className="text-center text-xl sm:text-2xl font-black mt-2">
              Join a Watch Party
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground max-w-[320px] mx-auto">
              Enter the <span className="font-bold text-foreground">6-character code</span> shared by your friend to watch in perfect sync.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Code cells display + hidden input for typing */}
        <div className="px-6 pb-2">
          <div className="relative">
            <div className="grid grid-cols-6 gap-1.5">
              {cells.map((char, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-xl flex items-center justify-center font-mono font-black text-xl sm:text-2xl uppercase border-2 transition-all ${
                    char
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/15 border-purple-500/50 text-foreground shadow-md shadow-purple-500/20'
                      : 'bg-muted/30 border-border/50 text-muted-foreground/40'
                  } ${i === joinCode.length ? 'ring-2 ring-purple-500/60 animate-pulse' : ''}`}
                >
                  {char}
                </div>
              ))}
            </div>
            <Input
              autoFocus
              placeholder=""
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              maxLength={6}
              className="absolute inset-0 opacity-0 cursor-pointer text-center"
              aria-label="Party code"
            />
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Tap or type to enter the code · letters &amp; numbers only
          </p>
        </div>

        {/* CTA */}
        <div className="p-6 pt-3">
          <Button
            onClick={handleJoin}
            disabled={joinCode.length !== 6 || busy}
            className="w-full h-11 rounded-xl font-black text-sm text-white relative overflow-hidden group disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, hsl(270, 75%, 50%) 0%, hsl(330, 75%, 55%) 100%)',
              boxShadow: '0 0 25px hsla(280, 75%, 55%, 0.4), 0 8px 20px hsla(0, 0%, 0%, 0.4)',
            }}
          >
            <span
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              style={{ background: 'linear-gradient(90deg, transparent, hsla(0,0%,100%,0.25), transparent)' }}
            />
            <Link2 className="h-4 w-4 mr-2 relative z-10" />
            <span className="relative z-10">{busy ? 'Joining...' : 'Join Party'}</span>
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Synced playback · live chat · emoji reactions
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VIEW PARTY DIALOG — Premium redesign + auto-cleanup of empty parties
// ─────────────────────────────────────────────────────────────────────
const EMPTY_PARTY_TIMEOUT_MS = 30_000; // 30s

export function ViewPartyDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState<(JoinedParty & { memberCount: number; ageMs: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);

  const sweepEmptyParties = useCallback(async (rows: JoinedParty[]) => {
    // For each party, count members. If memberCount <= 1 AND age > timeout → end it.
    const now = Date.now();
    const enriched: (JoinedParty & { memberCount: number; ageMs: number })[] = [];
    for (const p of rows) {
      const { count } = await supabase
        .from('watch_party_members')
        .select('id', { count: 'exact', head: true })
        .eq('party_id', p.id);
      const memberCount = count ?? 0;
      const ageMs = now - new Date((p as any).created_at || now).getTime();
      const isOrphan = memberCount <= 1 && ageMs > EMPTY_PARTY_TIMEOUT_MS;
      if (isOrphan) {
        // Auto-close on every device
        await supabase.from('watch_parties').update({ is_active: false }).eq('id', p.id);
        continue; // skip from list
      }
      enriched.push({ ...p, memberCount, ageMs });
    }
    return enriched;
  }, []);

  const loadJoinedParties = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memberships } = await supabase
        .from('watch_party_members')
        .select('party_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const partyIds = memberships.map((m) => m.party_id);
        const { data: partyData } = await supabase
          .from('watch_parties')
          .select('*')
          .in('id', partyIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        const enriched = await sweepEmptyParties((partyData || []) as JoinedParty[]);
        setParties(enriched);
      } else {
        setParties([]);
      }
    } catch (error) {
      console.error('Error loading parties:', error);
    } finally {
      setLoading(false);
    }
  }, [user, sweepEmptyParties]);

  useEffect(() => {
    if (open && user) {
      loadJoinedParties();
      // Periodic re-sweep every 15s while dialog open
      const id = setInterval(loadJoinedParties, 15_000);
      return () => clearInterval(id);
    }
  }, [open, user, loadJoinedParties]);

  const handleJoinParty = (party: JoinedParty) => {
    setOpen(false);
    navigate(`/watch/${party.episode_id}?party=${party.code}`);
  };

  const handleEndParty = async (e: React.MouseEvent, partyId: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('watch_parties').update({ is_active: false }).eq('id', partyId);
      if (error) throw error;
      toast.success('Party ended');
      setParties((prev) => prev.filter((p) => p.id !== partyId));
    } catch {
      toast.error('Failed to end party');
    }
  };

  // Clear ALL parties this user is involved in — across every device
  const handleClearAll = async () => {
    if (!user || parties.length === 0) return;
    setPurging(true);
    try {
      const ids = parties.map((p) => p.id);
      // 1) End any party I host (this hides from all members on every device)
      const hosted = parties.filter((p) => p.host_id === user.id).map((p) => p.id);
      if (hosted.length > 0) {
        await supabase.from('watch_parties').update({ is_active: false }).in('id', hosted);
      }
      // 2) Remove my membership from non-hosted parties (clears my own device list)
      const guestIds = ids.filter((id) => !hosted.includes(id));
      if (guestIds.length > 0) {
        await supabase
          .from('watch_party_members')
          .delete()
          .eq('user_id', user.id)
          .in('party_id', guestIds);
      }
      setParties([]);
      toast.success('All saved parties cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear parties');
    } finally {
      setPurging(false);
    }
  };

  const fmtAge = (ms: number) => {
    if (ms < 60_000) return 'just now';
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
            <Eye className="h-4 w-4" />
            View Parties
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-cyan-500/30 bg-card">
        {/* Cinematic header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/25 via-blue-500/10 to-transparent" />
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl bg-cyan-500/30 animate-pulse" />

          <DialogHeader className="relative px-6 pt-7 pb-3">
            <div className="mx-auto relative">
              <div className="absolute inset-0 bg-cyan-500/40 blur-2xl rounded-2xl animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-500 flex items-center justify-center shadow-2xl mx-auto -rotate-3">
                <Eye className="h-7 w-7 text-white drop-shadow" strokeWidth={2.5} />
              </div>
            </div>
            <div className="mt-3 mx-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">
                Live Parties
              </span>
            </div>
            <DialogTitle className="text-center text-xl sm:text-2xl font-black mt-2">
              Your Watch Parties
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground max-w-[320px] mx-auto">
              Active rooms you've joined. Empty parties auto-close after{' '}
              <span className="font-bold text-foreground">30 seconds</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            </div>
          ) : parties.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-bold">No active parties</p>
              <p className="text-xs text-muted-foreground mt-1">Join or create a party to watch together!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {parties.map((party) => {
                const isHost = party.host_id === user?.id;
                const aloneAndOld =
                  party.memberCount <= 1 &&
                  EMPTY_PARTY_TIMEOUT_MS - party.ageMs < 15_000 &&
                  party.ageMs < EMPTY_PARTY_TIMEOUT_MS;
                return (
                  <button
                    key={party.id}
                    onClick={() => handleJoinParty(party)}
                    className="group relative w-full text-left rounded-xl bg-gradient-to-br from-card to-card/60 hover:from-card hover:to-card border border-border/50 hover:border-cyan-500/40 p-3 transition-all overflow-hidden"
                  >
                    {/* Live shine */}
                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute inset-y-0 -inset-x-full bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
                    </div>

                    <div className="relative flex items-start gap-3">
                      {/* Code badge */}
                      <div className="shrink-0 flex flex-col items-center">
                        <div className="px-2 py-1 rounded-lg bg-gradient-to-br from-cyan-500/25 to-blue-500/15 border border-cyan-500/40 font-mono font-black text-xs tracking-widest text-cyan-300 shadow-md shadow-cyan-500/10">
                          {party.code}
                        </div>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          LIVE
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate flex items-center gap-1.5">
                          {isHost && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                          {party.anime_title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          S{party.season_number} · E{party.episode_number}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50 text-[9px] font-bold text-muted-foreground">
                            <Users className="h-2.5 w-2.5" />
                            {party.memberCount}
                          </span>
                          <span className="text-[9px] text-muted-foreground/70">
                            · {fmtAge(party.ageMs)}
                          </span>
                          {aloneAndOld && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-black text-amber-300 uppercase">
                              auto-close soon
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 flex flex-col gap-1">
                        <span className="inline-flex items-center justify-center gap-1 h-7 w-16 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-cyan-500/20">
                          <Play className="h-3 w-3" />
                          Watch
                        </span>
                        <button
                          onClick={(e) => handleEndParty(e, party.id)}
                          className="inline-flex items-center justify-center gap-1 h-7 w-16 rounded-lg bg-destructive/15 hover:bg-destructive/25 border border-destructive/30 text-destructive text-[10px] font-black uppercase tracking-wider transition-colors"
                        >
                          <X className="h-3 w-3" />
                          End
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {parties.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={purging}
                className="w-full h-9 text-[11px] font-bold border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                {purging ? 'Clearing...' : `Clear all ${parties.length} parties (every device)`}
              </Button>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Removes hosted parties for everyone &amp; your saved entries on all devices.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
