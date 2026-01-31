import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, Settings, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ConversionNotification {
  id: string;
  type: 'failure' | 'queue_backup' | 'success';
  title: string;
  message: string;
  episode_id?: string;
  created_at: string;
  is_read: boolean;
}

interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

export function ConversionNotifications() {
  const [notifications, setNotifications] = useState<ConversionNotification[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, processing: 0, failed: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    notifyOnFailure: true,
    notifyOnQueueBackup: true,
    queueBackupThreshold: 10,
  });

  useEffect(() => {
    fetchNotificationsAndStats();
    
    // Set up real-time subscription for video_conversions changes
    const channel = supabase
      .channel('conversion-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_conversions',
        },
        (payload) => {
          handleConversionChange(payload);
        }
      )
      .subscribe();

    // Check queue status every 30 seconds
    const interval = setInterval(checkQueueStatus, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchNotificationsAndStats = async () => {
    setIsLoading(true);
    
    // Fetch queue stats
    const { data: conversions } = await supabase
      .from('video_conversions')
      .select('status');

    if (conversions) {
      const stats = conversions.reduce((acc, c) => {
        const status = c.status as keyof QueueStats;
        if (status in acc) {
          acc[status]++;
        }
        return acc;
      }, { pending: 0, processing: 0, failed: 0, completed: 0 } as QueueStats);
      
      setQueueStats(stats);
      
      // Generate notifications from failed conversions
      const { data: failedConversions } = await supabase
        .from('video_conversions')
        .select('id, episode_id, error_message, updated_at')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (failedConversions) {
        const failureNotifications: ConversionNotification[] = failedConversions.map(c => ({
          id: `failure-${c.id}`,
          type: 'failure' as const,
          title: 'Conversion Failed',
          message: c.error_message || 'Unknown error occurred during video conversion',
          episode_id: c.episode_id || undefined,
          created_at: c.updated_at,
          is_read: false,
        }));
        
        setNotifications(failureNotifications);
      }
    }

    setIsLoading(false);
  };

  const handleConversionChange = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'UPDATE' && newRecord) {
      // Check if conversion just failed
      if (newRecord.status === 'failed' && oldRecord?.status !== 'failed' && settings.notifyOnFailure) {
        const notification: ConversionNotification = {
          id: `failure-${newRecord.id}-${Date.now()}`,
          type: 'failure',
          title: 'Conversion Failed',
          message: newRecord.error_message || 'Video conversion failed',
          episode_id: newRecord.episode_id,
          created_at: new Date().toISOString(),
          is_read: false,
        };
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)]);
        toast.error('Video Conversion Failed', {
          description: newRecord.error_message || 'Check admin dashboard for details',
        });
      }

      // Check if conversion completed successfully
      if (newRecord.status === 'completed' && oldRecord?.status !== 'completed') {
        toast.success('Video Conversion Complete', {
          description: 'A video has been successfully converted for iOS',
        });
      }
    }

    // Refresh stats on any change
    fetchNotificationsAndStats();
  };

  const checkQueueStatus = async () => {
    const { data: pendingCount } = await supabase
      .from('video_conversions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const count = pendingCount?.length || 0;
    
    if (count >= settings.queueBackupThreshold && settings.notifyOnQueueBackup) {
      const notification: ConversionNotification = {
        id: `queue-backup-${Date.now()}`,
        type: 'queue_backup',
        title: 'Queue Backup Alert',
        message: `${count} videos are waiting in the conversion queue`,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      
      setNotifications(prev => {
        // Don't add duplicate queue backup notifications within 5 minutes
        const recentBackup = prev.find(n => 
          n.type === 'queue_backup' && 
          Date.now() - new Date(n.created_at).getTime() < 5 * 60 * 1000
        );
        if (recentBackup) return prev;
        return [notification, ...prev.slice(0, 49)];
      });

      toast.warning('Conversion Queue Backed Up', {
        description: `${count} videos pending conversion`,
      });
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
    toast.success('Notifications cleared');
  };

  const retryFailedConversions = async () => {
    const { error } = await supabase
      .from('video_conversions')
      .update({ status: 'pending', error_message: null })
      .eq('status', 'failed');

    if (error) {
      toast.error('Failed to retry conversions');
    } else {
      toast.success('Retrying all failed conversions');
      fetchNotificationsAndStats();
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'failure':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'queue_backup':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueStats.processing}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueStats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queueStats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify on Conversion Failures</Label>
              <p className="text-xs text-muted-foreground">Get alerted when video conversions fail</p>
            </div>
            <Switch
              checked={settings.notifyOnFailure}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, notifyOnFailure: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify on Queue Backup</Label>
              <p className="text-xs text-muted-foreground">Alert when queue exceeds {settings.queueBackupThreshold} items</p>
            </div>
            <Switch
              checked={settings.notifyOnQueueBackup}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, notifyOnQueueBackup: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={retryFailedConversions}
          disabled={queueStats.failed === 0}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry All Failed ({queueStats.failed})
        </Button>
        <Button 
          variant="outline" 
          onClick={clearNotifications}
          disabled={notifications.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Notifications
        </Button>
        <Button variant="outline" onClick={fetchNotificationsAndStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Notifications
            </span>
            {notifications.length > 0 && (
              <Badge variant="secondary">{notifications.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No notifications</p>
              <p className="text-xs">You'll see alerts here when conversions fail or queue backs up</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      notification.type === 'failure' 
                        ? 'border-destructive/30 bg-destructive/5' 
                        : notification.type === 'queue_backup'
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    {notification.type === 'failure' && (
                      <Badge variant="destructive" className="text-[10px]">
                        Failed
                      </Badge>
                    )}
                    {notification.type === 'queue_backup' && (
                      <Badge variant="secondary" className="text-[10px]">
                        Queue
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
