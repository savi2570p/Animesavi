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

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold">
            Admin <span className="anime-gradient-text">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">Manage platform content and users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalAnime}</p>
              <p className="text-sm text-muted-foreground">Total Anime</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-anime-blue/10">
              <Users className="h-6 w-6 text-anime-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-anime-orange/10">
              <FileText className="h-6 w-6 text-anime-orange" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingApplications}</p>
              <p className="text-sm text-muted-foreground">Pending Apps</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-green-500/10">
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.uploaders}</p>
              <p className="text-sm text-muted-foreground">Uploaders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="applications">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="applications">
            Applications ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="encoding" className="flex items-center gap-2">
            <FileVideo className="h-4 w-4" />
            Encoding
          </TabsTrigger>
          <TabsTrigger value="ios-conversion" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            iOS Conversion
          </TabsTrigger>
          <TabsTrigger value="hls-system" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            HLS System
          </TabsTrigger>
           <TabsTrigger value="health" className="flex items-center gap-2">
             <Activity className="h-4 w-4" />
             Health
           </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="cdn" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            CDN Health
          </TabsTrigger>
          <TabsTrigger value="tokens" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Token Manager
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
