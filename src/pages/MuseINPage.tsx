import { useEffect, useState } from 'react';
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

export default function MuseINPage() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const handleOk = () => {
    setOpen(false);
    navigate('/');
  };

  return (
    <div className="container py-8">
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleOk(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl">MuseIN</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg py-4">
              Coming Soon
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center sm:justify-center">
            <AlertDialogAction onClick={handleOk}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
