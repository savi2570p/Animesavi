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
import { Users, Send, Copy, X, Crown, UserPlus, Link2, Tv, Play, Eye, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  isHost?: boolean;
}

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
        toast.error('Party not found or has ended');
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

  // Real-time sync: Non-host receives updates
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

          // Check if party ended
          if (!party.is_active) {
            toast.error('Party is ended', {
              description: 'The host has ended this watch party',
              duration: 5000,
            });
            leaveParty();
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

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !user || !partyId) return;

    await supabase.from('watch_party_messages').insert({
      party_id: partyId,
      user_id: user.id,
      username: user.email?.split('@')[0] || 'Anonymous',
      message: newMessage.trim(),
      is_host: isHost,
    });

    setNewMessage('');
  }, [newMessage, user, partyId, isHost]);

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

  // End party (host only)
  const endParty = async () => {
    if (!partyId || !isHost) return;
    
    await supabase
      .from('watch_parties')
      .update({ is_active: false })
      .eq('id', partyId);
    
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    setPartyCode(null);
    setPartyId(null);
    setIsHost(false);
    setParticipants([]);
    setMessages([]);
    setPartyInfo(null);
    setIsOpen(false);
    toast.success('Watch party ended');
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
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-primary/10 border-primary/30">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Party</span>
          <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
            {participants.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Watch Party
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">LIVE</span>
            </SheetTitle>
            <div className="flex items-center gap-2">
              {isHost && (
                <Button variant="destructive" size="sm" onClick={endParty} className="gap-1">
                  <X className="h-3 w-3" />
                  End Party
                </Button>
              )}
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

        {/* Chat messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.userId === 'system' || msg.username === 'System' ? 'justify-center' : ''}`}>
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
                      <p className="text-sm bg-muted rounded-lg px-3 py-1.5 mt-0.5 inline-block">
                        {msg.message}
                      </p>
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
      </SheetContent>
    </Sheet>
  );
}

// Join Party Dialog Component for use in Header/Menu
export function JoinPartyDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [open, setOpen] = useState(false);

  const handleJoin = async () => {
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
        toast.error('Party not found or has ended');
        return;
      }

      toast.success(`Joining party for ${party.anime_title}...`);
      setOpen(false);
      
      // Navigate to the episode with party code
      navigate(`/watch/${party.episode_id}?party=${party.code}`);
    } catch (error) {
      console.error('Error finding party:', error);
      toast.error('Failed to find watch party');
    }
  };

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Join Watch Party
          </DialogTitle>
          <DialogDescription>
            Enter the party code shared by your friend to watch anime together in sync
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
          <Button onClick={handleJoin} className="w-full gap-2" disabled={joinCode.length !== 6}>
            <Link2 className="h-4 w-4" />
            Join Party
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// View Party Component - Shows joined parties
export function ViewPartyDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState<JoinedParty[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadJoinedParties();
    }
  }, [open, user]);

  const loadJoinedParties = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get parties user is a member of
      const { data: memberships } = await supabase
        .from('watch_party_members')
        .select('party_id')
        .eq('user_id', user.id);

      if (memberships && memberships.length > 0) {
        const partyIds = memberships.map(m => m.party_id);
        const { data: partyData } = await supabase
          .from('watch_parties')
          .select('*')
          .in('id', partyIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        setParties((partyData || []) as JoinedParty[]);
      } else {
        setParties([]);
      }
    } catch (error) {
      console.error('Error loading parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = (party: JoinedParty) => {
    setOpen(false);
    navigate(`/watch/${party.episode_id}?party=${party.code}`);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Your Watch Parties
          </DialogTitle>
          <DialogDescription>
            Active watch parties you've joined
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : parties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active watch parties</p>
              <p className="text-sm mt-1">Join or create a party to watch together!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {parties.map((party) => (
                <div
                  key={party.id}
                  className="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => handleJoinParty(party)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-primary/20 text-primary px-2 py-0.5 rounded">
                          {party.code}
                        </span>
                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">
                          LIVE
                        </span>
                      </div>
                      <p className="font-medium text-sm mt-2">{party.anime_title}</p>
                      <p className="text-xs text-muted-foreground">
                        Season {party.season_number} • Episode {party.episode_number}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Play className="h-3 w-3" />
                      Join
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}