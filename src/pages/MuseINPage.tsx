import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { CalendarClock, Sparkles } from 'lucide-react';
import museinLogo from '@/assets/musein-logo.jpg';

export default function MuseINPage() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const handleOk = () => {
    setOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen">
      <ContentNavTabs />
      <div className="container py-8">
        <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleOk(); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader className="flex flex-col items-center gap-3">
              <img
                src={museinLogo}
                alt="MuseIN"
                className="h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow-lg"
              />
              <AlertDialogTitle className="text-center text-2xl font-bold">
                MuseIN
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-semibold text-sm">A New Experience Awaits</span>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    MuseIN brings you a handpicked collection of Muse India anime — dubbed in Hindi for the ultimate viewing experience. Discover exclusive titles, curated playlists, and more.
                  </p>
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Launching Soon — Stay Tuned!</span>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="justify-center sm:justify-center pt-2">
              <AlertDialogAction onClick={handleOk} className="px-8">OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
