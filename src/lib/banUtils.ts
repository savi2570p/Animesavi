import { supabase } from '@/integrations/supabase/client';

const BAN_LOCAL_KEY = 'user_ban_expires_at';

export interface BanInfo {
  isBanned: boolean;
  expiresAt: Date | null;
  reason: string;
}

/** Check local storage first, then DB for active ban */
export async function checkBanStatus(userId?: string): Promise<BanInfo> {
  // Check localStorage first (works even when logged out)
  const localExpiry = localStorage.getItem(BAN_LOCAL_KEY);
  if (localExpiry) {
    const expiresAt = new Date(localExpiry);
    if (expiresAt > new Date()) {
      return { isBanned: true, expiresAt, reason: 'Adult content promotion' };
    } else {
      localStorage.removeItem(BAN_LOCAL_KEY);
    }
  }

  // If logged in, check DB
  if (userId) {
    const { data } = await supabase
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const expiresAt = new Date(data.expires_at);
      localStorage.setItem(BAN_LOCAL_KEY, expiresAt.toISOString());
      return { isBanned: true, expiresAt, reason: data.reason };
    }
  }

  return { isBanned: false, expiresAt: null, reason: '' };
}

/** Ban the current user for 24 hours */
export async function banUser(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Always set local ban (works even if DB insert fails)
  localStorage.setItem(BAN_LOCAL_KEY, expiresAt.toISOString());

  // Also persist to DB
  await supabase.from('user_bans').insert({
    user_id: userId,
    reason: 'Adult content promotion',
    expires_at: expiresAt.toISOString(),
  } as any);
}

/** Clear expired ban from local storage */
export function clearExpiredBan(): void {
  const localExpiry = localStorage.getItem(BAN_LOCAL_KEY);
  if (localExpiry && new Date(localExpiry) <= new Date()) {
    localStorage.removeItem(BAN_LOCAL_KEY);
  }
}
