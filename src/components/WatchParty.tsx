import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, Send, Copy, X, Crown, UserPlus, MessageSquare, Link2, Tv, Play } from 'lucide-react';

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
}

// Store active party info globally for Join Party feature
let activePartyInfo: PartyInfo | null = null;
let activePartyCode: string | null = null;

export function getActivePartyInfo() {
  return { partyInfo: activePartyInfo, partyCode: activePartyCode };
}

export function setActivePartyFromJoin(code: string, info: PartyInfo) {
  activePartyCode = code;
  activePartyInfo = info;
}

export function WatchParty({ episodeId, videoRef, animeTitle, episodeNumber, seasonNumber = 1 }: WatchPartyProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; name: string; isHost: boolean }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update global party info when party is created
  useEffect(() => {
    if (partyCode && isHost) {
      const info: PartyInfo = {
        animeTitle,
        seasonNumber,
        episodeNumber,
        episodeId,
      };
      setPartyInfo(info);
      activePartyInfo = info;
      activePartyCode = partyCode;
    }
    
    return () => {
      // Cleanup when party ends
      if (isHost) {
        activePartyInfo = null;
        activePartyCode = null;
      }
    };
  }, [partyCode, isHost, animeTitle, seasonNumber, episodeNumber, episodeId]);

  // Generate a party code
  const generatePartyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Create a new watch party
  const createParty = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to create a watch party');
      return;
    }

    const code = generatePartyCode();
    setPartyCode(code);
    setIsHost(true);
    setParticipants([{ id: user.id, name: user.email?.split('@')[0] || 'Host', isHost: true }]);
    
    const info: PartyInfo = {
      animeTitle,
      seasonNumber,
      episodeNumber,
      episodeId,
    };
    setPartyInfo(info);
    
    setMessages([{
      id: crypto.randomUUID(),
      userId: 'system',
      username: 'System',
      message: `Watch party created! Share the code: ${code}`,
      timestamp: new Date(),
    }, {
      id: crypto.randomUUID(),
      userId: 'system',
      username: 'System',
      message: `Now watching: ${animeTitle} - S${seasonNumber} E${episodeNumber}`,
      timestamp: new Date(),
    }]);
    setShowCreateDialog(false);
    setIsOpen(true);
    
    toast.success(`Watch party created! Code: ${code}`);
  }, [user, animeTitle, seasonNumber, episodeNumber, episodeId]);

  // Join an existing party
  const joinParty = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }

    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }

    // In a real implementation, this would connect to a WebSocket server
    // For now, simulate joining with demo info
    const demoPartyInfo: PartyInfo = {
      animeTitle: 'Demo Anime',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeId: episodeId,
    };
    
    setPartyCode(joinCode.toUpperCase());
    setIsHost(false);
    setPartyInfo(demoPartyInfo);
    setParticipants([
      { id: 'host', name: 'Host', isHost: true },
      { id: user.id, name: user.email?.split('@')[0] || 'You', isHost: false }
    ]);
    setMessages([{
      id: crypto.randomUUID(),
      userId: 'system',
      username: 'System',
      message: `You joined the watch party!`,
      timestamp: new Date(),
    }, {
      id: crypto.randomUUID(),
      userId: 'system',
      username: 'System',
      message: `Host is watching: ${demoPartyInfo.animeTitle} - S${demoPartyInfo.seasonNumber} E${demoPartyInfo.episodeNumber}`,
      timestamp: new Date(),
    }]);
    setShowJoinDialog(false);
    setIsOpen(true);
    
    toast.success('Joined the watch party!');
  }, [user, joinCode, episodeId]);

  // Send chat message
  const sendMessage = useCallback(() => {
    if (!newMessage.trim() || !user) return;

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.email?.split('@')[0] || 'Anonymous',
      message: newMessage.trim(),
      timestamp: new Date(),
      isHost,
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  }, [newMessage, user, isHost]);

  // Copy party code
  const copyCode = () => {
    if (partyCode) {
      navigator.clipboard.writeText(partyCode);
      toast.success('Party code copied!');
    }
  };

  // Leave party
  const leaveParty = () => {
    if (isHost) {
      activePartyInfo = null;
      activePartyCode = null;
    }
    setPartyCode(null);
    setIsHost(false);
    setParticipants([]);
    setMessages([]);
    setPartyInfo(null);
    setIsOpen(false);
    toast.success('Left the watch party');
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
                Create a watch party and share the code with your friends. Everyone can chat while watching the same episode in sync!
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
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={leaveParty}>
              <X className="h-4 w-4" />
            </Button>
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
                <span>{isHost ? 'Now Watching' : 'Host is Watching'}</span>
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
              <div key={msg.id} className={`flex gap-2 ${msg.userId === 'system' ? 'justify-center' : ''}`}>
                {msg.userId !== 'system' && (
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/20">
                      {msg.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`${msg.userId === 'system' ? 'text-center' : ''}`}>
                  {msg.userId === 'system' ? (
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
  const [joinCode, setJoinCode] = useState('');
  const [open, setOpen] = useState(false);

  const handleJoin = () => {
    if (!user) {
      toast.error('Please sign in to join a watch party');
      return;
    }

    if (!joinCode || joinCode.length !== 6) {
      toast.error('Please enter a valid 6-character party code');
      return;
    }

    // In a real implementation, this would redirect to the watch page with the party
    toast.success(`Joining party ${joinCode.toUpperCase()}...`);
    setOpen(false);
    
    // Navigate to a demo page - in real implementation would fetch party info
    window.location.href = `/browse?party=${joinCode.toUpperCase()}`;
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
            Enter the party code shared by your friend to watch anime together
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
