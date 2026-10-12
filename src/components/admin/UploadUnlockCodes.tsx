import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Lock, Unlock } from 'lucide-react';

export function UploadUnlockCodes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<{ email: string; code: string; unlocked_at: string | null }[]>([]);
  const isOwner = (user?.email || '').toLowerCase() === 'savi2570p@gmail.com';
  useEffect(() => {
    if (!isOwner) return;
    supabase.from('upload_locks').select('email, code, unlocked_at').then(({ data }) => setRows(data || []));
  }, [isOwner]);
  if (!isOwner || rows.length === 0) return null;
  return (
    <div className="lg-panel rounded-2xl p-4 md:p-6 mt-6">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Upload unlock passwords</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <p className="text-xs text-muted-foreground">{r.email}</p>
              <p className="font-mono text-lg tracking-widest">{r.code.replace(/(\d{4})(?=\d)/g, '$1 ')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {r.unlocked_at ? <><Unlock className="h-3 w-3" /> Unlocked</> : <><Lock className="h-3 w-3" /> Locked</>}
              </span>
              <button onClick={() => { navigator.clipboard.writeText(r.code); toast.success('Password copied'); }}
                className="rounded-lg border border-border p-2 hover:text-primary"><Copy className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
