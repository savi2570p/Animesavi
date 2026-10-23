import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  Film,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  TrendingUp,
  FileVideo,
  Globe,
  Smartphone,
  Zap,
  Bell,
  Activity,
  Key,
  Sparkles,
  Copy,
  ArrowUpRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { VideoEncodingDashboard } from '@/components/admin/VideoEncodingDashboard';
import { CDNHealthDashboard } from '@/components/admin/CDNHealthDashboard';
import { VideoConversionDashboard } from '@/components/admin/VideoConversionDashboard';
import { HLSConversionDashboard } from '@/components/admin/HLSConversionDashboard';
import { ConversionNotifications } from '@/components/admin/ConversionNotifications';
import { ConversionHealthDashboard } from '@/components/admin/ConversionHealthDashboard';
import { TokenManager } from '@/components/admin/TokenManager';
import { UserManagement } from '@/components/admin/UserManagement';
import { EmbedAllowlistManager } from '@/components/admin/EmbedAllowlistManager';
import { EmbedAudioDebugPanel } from '@/components/admin/EmbedAudioDebugPanel';
import { RecapAnalyticsDashboard } from '@/components/admin/RecapAnalyticsDashboard';
import { ClonePlatformsPanel } from '@/components/admin/ClonePlatformsPanel';

interface Application {
  id: string;
  user_id: string;
  reason: string;
  sample_work: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profile?: {
    username: string | null;
  };
}

interface Stats {
  totalAnime: number;
  totalUsers: number;
  pendingApplications: number;
  uploaders: number;
}

export default function Admin() {
  const { user, isAdmin, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAnime: 0,
    totalUsers: 0,
    pendingApplications: 0,
    uploaders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isAuthLoading || !isRolesLoaded) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isAdmin) {
      toast.error('Access denied. Admin only.');
      navigate('/');
      return;
    }

    fetchData();
  }, [user, isAdmin, isRolesLoaded, isAuthLoading]);

  const fetchData = async () => {
    const { data: appsData } = await supabase
      .from('uploader_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (appsData) {
      const userIds = [...new Set(appsData.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      setApplications(
        appsData.map((a) => ({
          ...a,
          profile: profileMap.get(a.user_id) || { username: null },
        }))
      );
    }

    const [animeCount, profileCount, uploaderCount] = await Promise.all([
      supabase.from('anime').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'uploader'),
    ]);

    setStats({
      totalAnime: animeCount.count || 0,
      totalUsers: profileCount.count || 0,
      pendingApplications: appsData?.filter((a) => a.status === 'pending').length || 0,
      uploaders: uploaderCount.count || 0,
    });

    setIsLoading(false);
  };

  const handleApplicationAction = async (
    applicationId: string,
    action: 'approved' | 'rejected',
    userId: string
  ) => {
    setProcessingId(applicationId);

    const { error: updateError } = await supabase
      .from('uploader_applications')
      .update({
        status: action,
        admin_notes: adminNotes[applicationId] || null,
      })
      .eq('id', applicationId);

    if (updateError) {
      toast.error('Failed to update application');
      setProcessingId(null);
      return;
    }

    if (action === 'approved') {
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'uploader',
      });

      if (roleError) {
        toast.error('Failed to assign uploader role');
        setProcessingId(null);
        return;
      }
    }

    toast.success(`Application ${action}`);
    fetchData();
    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="admin-v10-status admin-v10-approved">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="admin-v10-status admin-v10-rejected">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="admin-v10-status admin-v10-pending">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (isLoading) {
    return <div className="admin-v10 min-h-screen grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Loading admin panel" /></div>;
  }

  const tabConfig = [
    { value: 'applications', icon: FileText, label: 'Applications', accent: 'text-primary', count: applications.length },
    { value: 'encoding', icon: FileVideo, label: 'Encoding', accent: 'text-primary' },
    { value: 'ios-conversion', icon: Smartphone, label: 'iOS Convert', accent: 'text-primary' },
    { value: 'hls-system', icon: Zap, label: 'HLS System', accent: 'text-primary' },
    { value: 'health', icon: Activity, label: 'Health', accent: 'text-primary' },
    { value: 'notifications', icon: Bell, label: 'Alerts', accent: 'text-primary' },
    { value: 'cdn', icon: Globe, label: 'CDN', accent: 'text-primary' },
    { value: 'tokens', icon: Key, label: 'Tokens', accent: 'text-primary' },
    { value: 'embed', icon: Globe, label: 'Embed', accent: 'text-primary' },
    { value: 'users', icon: Users, label: 'Users', accent: 'text-primary' },
    { value: 'recaps', icon: Sparkles, label: 'AI Recaps', accent: 'text-primary' },
    { value: 'clone-page', icon: Copy, label: 'Clone', accent: 'text-primary' },
  ];

  return (
    <div className="admin-v10 min-h-screen">
      <div className="container py-6 md:py-10">
        <header className="admin-v10-header">
          <div className="flex items-center gap-3 min-w-0">
            <span className="admin-v10-mark"><Shield className="h-6 w-6" /></span>
            <div><p className="text-[10px] font-semibold text-muted-foreground mb-1">ANIMESAVI</p><h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="glass" size="icon" aria-label="Refresh admin panel" title="Refresh" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
            <Button variant="glass" onClick={() => navigate('/upload')}><FileVideo className="h-4 w-4 mr-2" />Upload</Button>
          </div>
        </header>
        <div className="admin-v10-stats grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Film, value: stats.totalAnime, label: 'Anime', tone: 'catalogue' },
            { icon: Users, value: stats.totalUsers, label: 'Users', tone: 'users' },
            { icon: FileText, value: stats.pendingApplications, label: 'Pending Applications', tone: 'pending' },
            { icon: TrendingUp, value: stats.uploaders, label: 'Uploaders', tone: 'uploaders' },
          ].map(stat => <div key={stat.label} className="admin-v10-stat" data-tone={stat.tone}>
            <stat.icon className="h-5 w-5" /><strong>{stat.value}</strong><span>{stat.label}</span>
          </div>)}
        </div>
        <nav className="admin-v10-shortcuts" aria-label="Admin shortcuts">
          {[
            {path:'/admin/site-health',label:'Site Health',icon:Activity},
            {path:'/admin/partners',label:'Partners',icon:Globe},
            {path:'/admin/featured',label:'Featured Lineup',icon:Sparkles},
          ].map(item => <Button key={item.path} variant="glass" className="justify-start" onClick={() => navigate(item.path)}><item.icon className="h-4 w-4 mr-2" /><span>{item.label}</span><ArrowUpRight className="h-3 w-3 ml-auto" /></Button>)}
        </nav>
        <Tabs defaultValue="applications" className="admin-v10-workspace">
          <aside className="admin-v10-navigation utility-glass-v6">
            <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-3 pb-2">MANAGEMENT</p>
            <TabsList className="admin-v10-tabs">
              {tabConfig.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="admin-v10-tab">
                <tab.icon className="h-4 w-4" /><span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className="admin-v10-count">{tab.count}</span>}
              </TabsTrigger>)}
            </TabsList>
          </aside>
          <div className="admin-v10-content">
          <TabsContent value="applications" className="admin-v10-tab-content">
            <Tabs defaultValue="pending">
              <TabsList className="mb-5 bg-muted/50 border border-border rounded-md">
                <TabsTrigger value="pending" className="rounded data-[state=active]:bg-accent">
                  Pending ({applications.filter((a) => a.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded data-[state=active]:bg-accent">All Applications</TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <div className="space-y-4">
                  {applications
                    .filter((a) => a.status === 'pending')
                    .map((app) => (
                      <div key={app.id} className="admin-v10-application">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{app.profile?.username || 'Unknown User'}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Applied {new Date(app.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1">Reason</p>
                            <p className="text-sm">{app.reason}</p>
                          </div>
                          {app.sample_work && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-1">Sample Work</p>
                              <p className="text-sm">{app.sample_work}</p>
                            </div>
                          )}
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Admin Notes (Optional)</p>
                            <Textarea
                              placeholder="Add notes for the applicant..."
                              value={adminNotes[app.id] || ''}
                              onChange={(e) =>
                                setAdminNotes({ ...adminNotes, [app.id]: e.target.value })
                              }
                              className="bg-background/60 border-border rounded-md"
                            />
                          </div>
                          <div className="flex gap-3 pt-1">
                            <Button
                              onClick={() => handleApplicationAction(app.id, 'approved', app.user_id)}
                              disabled={processingId === app.id}
                              variant="glass" className="text-primary rounded-md"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleApplicationAction(app.id, 'rejected', app.user_id)}
                              disabled={processingId === app.id}
                              className="rounded-md"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                  {applications.filter((a) => a.status === 'pending').length === 0 && (
                    <div className="admin-v10-empty flex flex-col items-center justify-center py-16">
                      <div className="relative mb-4">
                        
                        <CheckCircle className="relative h-10 w-10 text-primary" />
                      </div>
                      <p className="text-lg font-semibold">No pending applications</p>
                      <p className="text-sm text-muted-foreground">All caught up!</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="all">
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="admin-v10-application flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{app.profile?.username || 'Unknown User'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="encoding" className="admin-v10-tab-content"><div className="admin-v10-tool"><VideoEncodingDashboard /></div></TabsContent>
          <TabsContent value="ios-conversion" className="admin-v10-tab-content"><div className="admin-v10-tool"><VideoConversionDashboard /></div></TabsContent>
          <TabsContent value="hls-system" className="admin-v10-tab-content"><div className="admin-v10-tool"><HLSConversionDashboard /></div></TabsContent>
          <TabsContent value="health" className="admin-v10-tab-content"><div className="admin-v10-tool"><ConversionHealthDashboard /></div></TabsContent>
          <TabsContent value="notifications" className="admin-v10-tab-content"><div className="admin-v10-tool"><ConversionNotifications /></div></TabsContent>
          <TabsContent value="cdn" className="admin-v10-tab-content"><div className="admin-v10-tool"><CDNHealthDashboard /></div></TabsContent>
          <TabsContent value="tokens" className="admin-v10-tab-content"><div className="admin-v10-tool"><TokenManager /></div></TabsContent>
          <TabsContent value="embed" className="admin-v10-tab-content"><div className="admin-v10-tool"><EmbedAllowlistManager /></div></TabsContent>
          <TabsContent value="users" className="admin-v10-tab-content"><div className="admin-v10-tool"><UserManagement /></div></TabsContent>
          <TabsContent value="recaps" className="admin-v10-tab-content"><div className="admin-v10-tool"><RecapAnalyticsDashboard /></div></TabsContent>
          <TabsContent value="clone-page" className="admin-v10-tab-content"><div className="admin-v10-tool"><ClonePlatformsPanel /></div></TabsContent>
          </div>
        </Tabs>
        <section className="admin-v10-debug"><EmbedAudioDebugPanel /></section>
      </div>
    </div>
  );
}
