import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationSettings() {
  const { isSupported, permission, requestPermission } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported on this device or browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified when new episodes are released for your favorite anime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {permission === 'granted' ? (
              <BellRing className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <Label>Episode Notifications</Label>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' 
                  ? 'You\'ll be notified when new episodes are available' 
                  : 'Enable to get notified of new episodes'}
              </p>
            </div>
          </div>
          
          {permission === 'granted' ? (
            <Switch checked disabled />
          ) : permission === 'denied' ? (
            <Button variant="outline" size="sm" disabled>
              Blocked
            </Button>
          ) : (
            <Button onClick={requestPermission} size="sm" className="gap-2">
              <Bell className="h-4 w-4" />
              Enable
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            Notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
