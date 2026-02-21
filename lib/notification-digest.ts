import { format } from 'date-fns';
import { backend } from '@/integrations/backend/client';

function normalizeIdSegment(value: string, maxLength: number): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleaned.length >= maxLength) return cleaned.slice(0, maxLength);
  return cleaned.padEnd(maxLength, '0');
}

function buildDigestNotificationId(userId: string, dayKey: string): string {
  const compactDay = dayKey.replace(/-/g, '');
  const userPart = normalizeIdSegment(userId, 20);
  return `digest_${userPart}_${compactDay}`.slice(0, 36);
}

function isDuplicateInsertError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const status = (error as { status?: number }).status;
  if (status === 409) return true;

  return /already exists|duplicate/i.test(error.message || '');
}

export async function generateNotificationDigest(userId: string, now: Date = new Date()) {
  const { data: prefs } = await backend
    .from('notification_preferences')
    .select('digest_enabled, email_enabled')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!prefs) return;
  if (!prefs.digest_enabled) return;

  const todayKey = format(now, 'yyyy-MM-dd');
  const digestNotificationId = buildDigestNotificationId(userId, todayKey);
  const { data: existingDigest } = await backend
    .from('notifications')
    .select('id')
    .eq('id', digestNotificationId)
    .maybeSingle();

  if (existingDigest) return;

  const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await backend
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .neq('type', 'daily_digest')
    .gte('created_at', sinceIso)
    .limit(1);

  const updatesCount = count || 0;
  if (updatesCount === 0) return;

  const { error: digestError } = await backend.from('notifications').insert({
    id: digestNotificationId,
    user_id: userId,
    type: 'daily_digest',
    title: `Daily Digest ${todayKey}`,
    message: `You have ${updatesCount} update(s) in the last 24 hours.`,
    entity_type: null,
    entity_id: null,
    read: false,
  });

  if (digestError && !isDuplicateInsertError(digestError)) {
    throw digestError;
  }

  if (digestError && isDuplicateInsertError(digestError)) return;

  if (prefs.email_enabled) {
    // Placeholder for Appwrite Function/Webhook email dispatch.
    // This keeps parity for web + mobile until SMTP function is configured.
    console.info(`[digest-email] queued digest email for ${userId} (${updatesCount} updates).`);
  }
}
