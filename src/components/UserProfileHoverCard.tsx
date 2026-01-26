import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { User } from 'lucide-react';

interface UserProfileHoverCardProps {
  username: string | null;
  avatarUrl: string | null;
  children: React.ReactNode;
}

export function UserProfileHoverCard({ username, avatarUrl, children }: UserProfileHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-4" side="top" align="start">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src={avatarUrl || undefined} alt={username || 'User'} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {username ? username.charAt(0).toUpperCase() : <User className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">
              {username || 'Anonymous User'}
            </h4>
            <p className="text-sm text-muted-foreground">Member</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
