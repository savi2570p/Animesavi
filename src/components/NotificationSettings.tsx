import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, BellRing, Volume2, VolumeX, Heart, Smartphone, Monitor, Tablet, Trash2, Laptop } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Separator } from '@/components/ui/separator';

function parseUA(ua: string | null) {
  if (!ua) return { name: 'Unknown device', icon: Monitor };
  const isIPad = /iPad/.test(ua);
  const isIOS = /iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh/.test(ua);
  const isWin = /Windows/.test(ua);
  const isLinux = /Linux/.test(ua) && !isAndroid;
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
    : 'Browser';
  if (isIPad) return { name: `iPad · ${browser}`, icon: Tablet };
  if (isIOS) return { name: `iPhone · ${browser}`, icon: Smartphone };
  if (isAndroid) return { name: `Android · ${browser}`, icon: Smartphone };
  if (isMac) return { name: `Mac · ${browser}`, icon: Laptop };
  if (isWin) return { name: `Windows · ${browser}`, icon: Monitor };
  if (isLinux) return { name: `Linux · ${browser}`, icon: Monitor };
  return { name: browser, icon: Monitor };
}

export function NotificationSettings() {
  const { isSupported, permission, settings, isSubscribed, updateSettings, requestPermission, sendTestNotification, unsubscribe, devices, removeDevice } = usePushNotifications();
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true);

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
      <CardContent className="space-y-6">
        {/* Main Notification Toggle */}
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
            <div className="flex items-center gap-2">
              {isSubscribed && (
                <>
                  <Button size="sm" variant="outline" onClick={sendTestNotification}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={unsubscribe} className="gap-1 text-destructive hover:text-destructive">
                    <BellOff className="h-4 w-4" /> Unsubscribe
                  </Button>
                </>
              )}
              {!isSubscribed && (
                <Button size="sm" onClick={requestPermission} className="gap-2">
                  <Bell className="h-4 w-4" /> Subscribe
                </Button>
              )}
            </div>
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

        {isIOS && !isStandalone && (
          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/40">
            <strong>iPhone tip:</strong> Web Push only works on iOS when AnimeSavi is added to your Home Screen. Tap Share → Add to Home Screen, then open it from the icon to enable notifications.
          </p>
        )}

        {permission === 'granted' && (
          <>
            <Separator />
            
            {/* Notification Preferences */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Preferences</h4>
              
              {/* New Episodes Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="new-episodes">New Episodes</Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified when new episodes are uploaded
                    </p>
                  </div>
                </div>
                <Switch
                  id="new-episodes"
                  checked={settings.newEpisodes}
                  onCheckedChange={(checked) => updateSettings({ newEpisodes: checked })}
                />
              </div>

              {/* Favorites Only Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="favorites-only">Favorites Only</Label>
                    <p className="text-xs text-muted-foreground">
                      Only notify for anime in your favorites
                    </p>
                  </div>
                </div>
                <Switch
                  id="favorites-only"
                  checked={settings.favorites}
                  onCheckedChange={(checked) => updateSettings({ favorites: checked })}
                />
              </div>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings.sound ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label htmlFor="notification-sound">Notification Sound</Label>
                    <p className="text-xs text-muted-foreground">
                      Play sound when notifications arrive
                    </p>
                  </div>
                </div>
                <Switch
                  id="notification-sound"
                  checked={settings.sound}
                  onCheckedChange={(checked) => updateSettings({ sound: checked })}
                />
              </div>
            </div>
          </>
        )}

        {permission === 'denied' && (
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            Notifications are blocked. To enable them, click the lock icon in your browser's address bar and allow notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
