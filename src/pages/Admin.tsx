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
          <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-rose-500/15 text-rose-300 border border-rose-400/30 backdrop-blur-md">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-400/30 backdrop-blur-md">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="admin-aurora" aria-hidden />
        <div className="container py-24 flex flex-col items-center justify-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-full border-2 border-white/10 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground tracking-[0.2em] uppercase">Booting Command Center…</p>
        </div>
      </div>
    );
  }

  const tabConfig = [
    { value: 'applications', icon: FileText, label: 'Applications', accent: 'text-amber-300', count: applications.length },
    { value: 'encoding', icon: FileVideo, label: 'Encoding', accent: 'text-violet-300' },
    { value: 'ios-conversion', icon: Smartphone, label: 'iOS Convert', accent: 'text-sky-300' },
    { value: 'hls-system', icon: Zap, label: 'HLS System', accent: 'text-yellow-300' },
    { value: 'health', icon: Activity, label: 'Health', accent: 'text-emerald-300' },
    { value: 'notifications', icon: Bell, label: 'Alerts', accent: 'text-rose-300' },
    { value: 'cdn', icon: Globe, label: 'CDN', accent: 'text-blue-300' },
    { value: 'tokens', icon: Key, label: 'Tokens', accent: 'text-fuchsia-300' },
    { value: 'embed', icon: Globe, label: 'Embed', accent: 'text-cyan-300' },
    { value: 'users', icon: Users, label: 'Users', accent: 'text-teal-300' },
    { value: 'recaps', icon: Sparkles, label: 'AI Recaps', accent: 'text-primary' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient aurora backdrop */}
      <div className="admin-aurora" aria-hidden />

      <div className="container relative py-6 md:py-10 animate-fade-in">
        {/* Cinematic Glass Hero */}
        <div className="lg-panel relative overflow-hidden rounded-3xl mb-6 md:mb-8">
          <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-primary/25 blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[100px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.18),transparent_60%)] pointer-events-none" />
          <div className="relative p-5 md:p-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-primary/50 blur-2xl" />
                  <div className="relative p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-2xl shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.5)]">
                    <Shield className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300 backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Admin Console</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-heading font-bold leading-tight tracking-tight">
                    Command <span className="anime-gradient-text">Center</span>
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1.5">Pulse-check the platform, approve creators, ship features.</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
                <Activity className="h-4 w-4 text-emerald-300" />
                <span className="text-xs font-semibold tabular-nums text-foreground/90">All systems nominal</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-7">
              {[
                { icon: Film, value: stats.totalAnime, label: 'Total Anime', accent: 'text-primary', glow: 'from-primary/25' },
                { icon: Users, value: stats.totalUsers, label: 'Total Users', accent: 'text-sky-300', glow: 'from-sky-500/25' },
                { icon: FileText, value: stats.pendingApplications, label: 'Pending Apps', accent: 'text-amber-300', glow: 'from-amber-500/25' },
                { icon: TrendingUp, value: stats.uploaders, label: 'Uploaders', accent: 'text-emerald-300', glow: 'from-emerald-500/25' },
              ].map((s) => (
                <div key={s.label} className="lg-panel group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5">
                  <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${s.glow} to-transparent blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-xl ${s.accent}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-2xl md:text-3xl font-bold tabular-nums ${s.accent}`}>{s.value}</p>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold truncate">{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="applications">
          <div className="relative mb-6">
            <div className="lg-panel rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
              <TabsList className="h-auto p-0 bg-transparent border-0 flex flex-nowrap md:flex-wrap gap-1.5 justify-start min-w-max md:min-w-0">
                {tabConfig.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 text-muted-foreground hover:text-foreground data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-white/15 data-[state=active]:backdrop-blur-xl data-[state=active]:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.4)]"
                  >
                    <t.icon className={`h-3.5 w-3.5 ${t.accent}`} />
                    <span>{t.label}</span>
                    {t.count !== undefined && t.count > 0 && (
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] tabular-nums ${t.accent}`}>
                        {t.count}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="applications" className="animate-fade-in">
            <Tabs defaultValue="pending">
              <TabsList className="mb-4 bg-white/[0.04] border border-white/10 backdrop-blur-xl rounded-xl">
                <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white/[0.08]">
                  Pending ({applications.filter((a) => a.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white/[0.08]">All Applications</TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                <div className="space-y-4">
                  {applications
                    .filter((a) => a.status === 'pending')
                    .map((app) => (
                      <div key={app.id} className="lg-panel rounded-2xl p-5 md:p-6 animate-fade-in">
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
                              className="bg-white/[0.04] border-white/10 backdrop-blur-xl rounded-xl"
                            />
                          </div>
                          <div className="flex gap-3 pt-1">
                            <Button
                              onClick={() => handleApplicationAction(app.id, 'approved', app.user_id)}
                              disabled={processingId === app.id}
                              className="bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-xl shadow-[0_8px_24px_-8px_rgb(16_185_129/0.6)]"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleApplicationAction(app.id, 'rejected', app.user_id)}
                              disabled={processingId === app.id}
                              className="rounded-xl"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                  {applications.filter((a) => a.status === 'pending').length === 0 && (
                    <div className="lg-panel rounded-2xl flex flex-col items-center justify-center py-16">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" />
                        <CheckCircle className="relative h-14 w-14 text-emerald-400" />
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
                    <div key={app.id} className="lg-panel rounded-2xl flex items-center justify-between p-4">
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

          <TabsContent value="encoding" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><VideoEncodingDashboard /></div></TabsContent>
          <TabsContent value="ios-conversion" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><VideoConversionDashboard /></div></TabsContent>
          <TabsContent value="hls-system" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><HLSConversionDashboard /></div></TabsContent>
          <TabsContent value="health" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><ConversionHealthDashboard /></div></TabsContent>
          <TabsContent value="notifications" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><ConversionNotifications /></div></TabsContent>
          <TabsContent value="cdn" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><CDNHealthDashboard /></div></TabsContent>
          <TabsContent value="tokens" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><TokenManager /></div></TabsContent>
          <TabsContent value="embed" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><EmbedAllowlistManager /></div></TabsContent>
          <TabsContent value="users" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><UserManagement /></div></TabsContent>
          <TabsContent value="recaps" className="animate-fade-in"><div className="lg-panel rounded-2xl p-4 md:p-6"><RecapAnalyticsDashboard /></div></TabsContent>
        </Tabs>

        {/* Audio debug panel */}
        <div className="mt-8 lg-panel rounded-2xl p-4 md:p-6">
          <EmbedAudioDebugPanel />
        </div>

        {/* Quick link tiles */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <button
            onClick={() => navigate('/admin/site-health')}
            className="lg-panel group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-emerald-300" />
                  <div className="text-sm font-semibold">Site Health</div>
                </div>
                <div className="text-xs text-muted-foreground">Lighthouse LCP + Search Console verification for animesavi.com.</div>
              </div>
              <div className="text-primary text-lg transition-transform group-hover:translate-x-1">→</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/featured')}
            className="lg-panel group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Featured Hero Lineup</div>
                </div>
                <div className="text-xs text-muted-foreground">Edit the homepage hero slider — reorder, swap covers, override titles.</div>
              </div>
              <div className="text-primary text-lg transition-transform group-hover:translate-x-1">→</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
