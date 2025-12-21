import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

interface Application {
  id: string;
  reason: string;
  sample_work: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function ApplyUploader() {
  const { user, isUploader } = useAuth();
  const navigate = useNavigate();
  const [existingApplication, setExistingApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [reason, setReason] = useState('');
  const [sampleWork, setSampleWork] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isUploader) {
      navigate('/upload');
      return;
    }

    checkExistingApplication();
  }, [user, isUploader]);

  const checkExistingApplication = async () => {
    const { data } = await supabase
      .from('uploader_applications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setExistingApplication(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      toast.error('Please provide a reason for your application');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from('uploader_applications').insert({
      user_id: user!.id,
      reason: reason.trim(),
      sample_work: sampleWork.trim() || null,
    });

    if (error) {
      toast.error('Failed to submit application');
    } else {
      toast.success('Application submitted successfully!');
      checkExistingApplication();
    }

    setIsSubmitting(false);
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
    <div className="container py-12 max-w-2xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary mb-4">
          <Upload className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-heading font-bold mb-2">
          Become an <span className="anime-gradient-text">Uploader</span>
        </h1>
        <p className="text-muted-foreground">
          Share your favorite anime with the community
        </p>
      </div>

      {existingApplication ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Application</CardTitle>
              {getStatusBadge(existingApplication.status)}
            </div>
            <CardDescription>
              Submitted on {new Date(existingApplication.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Your Reason</Label>
              <p className="mt-1">{existingApplication.reason}</p>
            </div>

            {existingApplication.sample_work && (
              <div>
                <Label className="text-muted-foreground">Sample Work</Label>
                <p className="mt-1">{existingApplication.sample_work}</p>
              </div>
            )}

            {existingApplication.admin_notes && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <Label className="text-muted-foreground">Admin Notes</Label>
                <p className="mt-1">{existingApplication.admin_notes}</p>
              </div>
            )}

            {existingApplication.status === 'rejected' && (
              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  You can submit a new application if you&apos;d like to try again.
                </p>
                <Button onClick={() => setExistingApplication(null)} variant="outline">
                  Submit New Application
                </Button>
              </div>
            )}

            {existingApplication.status === 'pending' && (
              <p className="text-sm text-muted-foreground">
                Your application is being reviewed. We&apos;ll notify you once it&apos;s processed.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Application Form
            </CardTitle>
            <CardDescription>
              Tell us why you want to become an uploader and share any relevant experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reason">Why do you want to be an uploader? *</Label>
                <Textarea
                  id="reason"
                  placeholder="I'm passionate about anime and want to contribute to the community by sharing high-quality content..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="min-h-[120px] bg-muted/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleWork">
                  Sample Work / Portfolio Links (Optional)
                </Label>
                <Textarea
                  id="sampleWork"
                  placeholder="Links to any previous work, uploads, or relevant portfolio..."
                  value={sampleWork}
                  onChange={(e) => setSampleWork(e.target.value)}
                  className="bg-muted/50"
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Uploader Guidelines</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Upload only content you have rights to share</li>
                  <li>• Maintain high video quality standards</li>
                  <li>• Provide accurate metadata and descriptions</li>
                  <li>• Respect community guidelines</li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full anime-button"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
