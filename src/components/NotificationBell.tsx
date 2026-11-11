import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

/** Header bell: opens the dedicated Notifications page instead of a mini popup. */
export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;

  return (
    <Button asChild variant="glass" size="icon" className="notification-bell-v8 relative rounded-lg">
      <Link to="/notifications" aria-label="Notifications" title="Notifications">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="notification-count-v8 absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
