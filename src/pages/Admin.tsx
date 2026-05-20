import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { user, isAdmin } = useAuth();
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
  }, [user, isAdmin]);

  const fetchData = async () => {
    // Fetch applications
    const { data: appsData } = await supabase
      .from('uploader_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (appsData) {
      // Fetch profiles for applications
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

    // Fetch stats
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

    // Update application status
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

    // If approved, add uploader role
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
          <Badge className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-anime-orange">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const tabConfig = [
    { value: 'applications', icon: FileText, label: 'Applications', tone: 'from-amber-500/20 to-orange-500/10', accent: 'text-amber-400', count: applications.length },
    { value: 'encoding', icon: FileVideo, label: 'Encoding', tone: 'from-violet-500/20 to-fuchsia-500/10', accent: 'text-violet-400' },
    { value: 'ios-conversion', icon: Smartphone, label: 'iOS Convert', tone: 'from-sky-500/20 to-cyan-500/10', accent: 'text-sky-400' },
    { value: 'hls-system', icon: Zap, label: 'HLS System', tone: 'from-yellow-500/20 to-amber-500/10', accent: 'text-yellow-400' },
    { value: 'health', icon: Activity, label: 'Health', tone: 'from-emerald-500/20 to-green-500/10', accent: 'text-emerald-400' },
    { value: 'notifications', icon: Bell, label: 'Alerts', tone: 'from-rose-500/20 to-pink-500/10', accent: 'text-rose-400' },
    { value: 'cdn', icon: Globe, label: 'CDN', tone: 'from-blue-500/20 to-indigo-500/10', accent: 'text-blue-400' },
    { value: 'tokens', icon: Key, label: 'Tokens', tone: 'from-fuchsia-500/20 to-purple-500/10', accent: 'text-fuchsia-400' },
    { value: 'embed', icon: Globe, label: 'Embed', tone: 'from-cyan-500/20 to-sky-500/10', accent: 'text-cyan-400' },
    { value: 'users', icon: Users, label: 'Users', tone: 'from-teal-500/20 to-emerald-500/10', accent: 'text-teal-400' },
  ];

  return (
    <div className="container py-6 md:py-8">
      {/* Cinematic Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/60 to-card/30 backdrop-blur-xl mb-6">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.12),transparent_60%)] pointer-events-none" />
        <div className="relative p-5 md:p-7">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-xl" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
                  <Shield className="h-7 w-7 text-primary-foreground" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Control
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Console</span>
                </div>
                <h1 className="text-2xl md:text-4xl font-heading font-bold leading-tight">
                  Command <span className="anime-gradient-text">Center</span>
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Pulse-check the platform, approve creators, ship features.</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-card/60 border border-border/40 backdrop-blur-sm">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold tabular-nums">All systems nominal</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Film, value: stats.totalAnime, label: 'Total Anime', tone: 'from-primary/20 to-primary/5', accent: 'text-primary', ring: 'ring-primary/30' },
              { icon: Users, value: stats.totalUsers, label: 'Total Users', tone: 'from-sky-500/20 to-sky-500/5', accent: 'text-sky-400', ring: 'ring-sky-500/30' },
              { icon: FileText, value: stats.pendingApplications, label: 'Pending Apps', tone: 'from-amber-500/20 to-amber-500/5', accent: 'text-amber-400', ring: 'ring-amber-500/30' },
              { icon: TrendingUp, value: stats.uploaders, label: 'Uploaders', tone: 'from-emerald-500/20 to-emerald-500/5', accent: 'text-emerald-400', ring: 'ring-emerald-500/30' },
            ].map((s) => (
              <div key={s.label} className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${s.tone} border border-border/40 p-4 ring-1 ${s.ring} transition-all hover:scale-[1.02]`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-card/70 ${s.accent}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-2xl font-bold tabular-nums ${s.accent}`}>{s.value}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="applications">
        <div className="relative -mx-2 px-2 mb-6">
          <TabsList className="w-full h-auto p-1.5 bg-card/40 border border-border/40 backdrop-blur-md rounded-2xl flex flex-wrap gap-1.5 justify-start">
            {tabConfig.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all data-[state=active]:bg-gradient-to-br data-[state=active]:${t.tone} data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/40`}
              >
                <t.icon className={`h-3.5 w-3.5 ${t.accent}`} />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full bg-card/80 text-[10px] tabular-nums ${t.accent}`}>
                    {t.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="applications">
          {/* Applications Sub-Tabs */}
          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending ({applications.filter((a) => a.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="all">All Applications</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <div className="space-y-4">
                {applications
                  .filter((a) => a.status === 'pending')
                  .map((app) => (
                    <Card key={app.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {app.profile?.username || 'Unknown User'}
                            </CardTitle>
                            <CardDescription>
                              Applied {new Date(app.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Reason</p>
                          <p>{app.reason}</p>
                        </div>

                        {app.sample_work && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Sample Work</p>
                            <p>{app.sample_work}</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Admin Notes (Optional)</p>
                          <Textarea
                            placeholder="Add notes for the applicant..."
                            value={adminNotes[app.id] || ''}
                            onChange={(e) =>
                              setAdminNotes({ ...adminNotes, [app.id]: e.target.value })
                            }
                            className="bg-muted/50"
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <Button
                            onClick={() => handleApplicationAction(app.id, 'approved', app.user_id)}
                            disabled={processingId === app.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleApplicationAction(app.id, 'rejected', app.user_id)}
                            disabled={processingId === app.id}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                {applications.filter((a) => a.status === 'pending').length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <p className="text-lg font-medium">No pending applications</p>
                      <p className="text-muted-foreground">All caught up!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all">
              <div className="space-y-4">
                {applications.map((app) => (
                  <Card key={app.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{app.profile?.username || 'Unknown User'}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(app.status)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="encoding">
          <VideoEncodingDashboard />
        </TabsContent>

        <TabsContent value="ios-conversion">
          <VideoConversionDashboard />
        </TabsContent>

        <TabsContent value="hls-system">
          <HLSConversionDashboard />
        </TabsContent>

         <TabsContent value="health">
           <ConversionHealthDashboard />
         </TabsContent>
 
        <TabsContent value="notifications">
          <ConversionNotifications />
        </TabsContent>

        <TabsContent value="cdn">
          <CDNHealthDashboard />
        </TabsContent>

        <TabsContent value="tokens">
          <TokenManager />
        </TabsContent>

        <TabsContent value="embed">
          <EmbedAllowlistManager />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>
      </Tabs>

      {/* Quick link to dedicated Site Health (Lighthouse LCP + GSC verification) */}
      <div className="mt-8 p-4 rounded-lg border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Site Health</div>
          <div className="text-xs text-muted-foreground">Latest Lighthouse LCP results after each publish and Search Console verification status for animesavi.com.</div>
        </div>
        <button
          onClick={() => navigate('/admin/site-health')}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors self-start sm:self-auto"
        >
          Open Site Health →
        </button>
      </div>
    </div>
  );
}
