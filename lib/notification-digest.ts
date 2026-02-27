import { format } from 'date-fns';
import { backend } from '@/integrations/backend/client';
import { sendAppwriteEmailToUser } from '@/lib/appwrite-messaging';

type NotificationPreferenceRow = {
  digest_enabled?: boolean;
  email_enabled?: boolean;
  muted_until?: string | null;
  snoozed_until?: string | null;
  type_preferences?: unknown;
};

type DigestNotificationSource = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
};

const DIGEST_EMAIL_ELIGIBLE_TYPES = [
  'announcement',
  'approval_escalation',
  'deadline_reminder',
  'new_assignment',
  'task_approved',
  'task_assigned',
  'task_rejected',
  'task_submitted',
  'workspace_invite',
] as const;

const MAX_EMAIL_PREVIEW_ITEMS = 6;

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

function buildDigestEmailMessageId(userId: string, dayKey: string): string {
  const compactDay = dayKey.replace(/-/g, '');
  const userPart = normalizeIdSegment(userId, 20);
  return `dmail_${userPart}_${compactDay}`.slice(0, 36);
}

function isDuplicateInsertError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const status = (error as { status?: number }).status;
  if (status === 409) return true;

  return /already exists|duplicate/i.test(error.message || '');
}

function isFutureTimestamp(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > now.getTime();
}

function parseTypePreferences(raw: unknown): Record<string, boolean> {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, boolean>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function resolveDigestEligibleTypes(rawTypePreferences: unknown): string[] {
  const typePreferences = parseTypePreferences(rawTypePreferences);
  return DIGEST_EMAIL_ELIGIBLE_TYPES.filter((type) => typePreferences[type] !== false);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDigestEmailContent(
  dayKey: string,
  updates: DigestNotificationSource[]
): string {
  const previewItems = updates
    .slice(0, MAX_EMAIL_PREVIEW_ITEMS)
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br/>${escapeHtml(item.message)}</li>`)
    .join('');

  const extraCount = Math.max(0, updates.length - MAX_EMAIL_PREVIEW_ITEMS);
  const extraLine = extraCount > 0 ? `<p>+ ${extraCount} more update(s) waiting in your inbox.</p>` : '';

  return [
    '<div>',
    `<p><strong>Workflow Daily Digest (${escapeHtml(dayKey)})</strong></p>`,
    `<p>You have ${updates.length} important unread update(s) from the last 24 hours.</p>`,
    `<ul>${previewItems}</ul>`,
    extraLine,
    '<p>Open Workflow to review and mark them done.</p>',
    '</div>',
  ].join('');
}

export async function generateNotificationDigest(userId: string, now: Date = new Date()) {
  const { data: prefs, error: prefsError } = await backend
    .from('notification_preferences')
    .select('digest_enabled, email_enabled, muted_until, snoozed_until, type_preferences')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (prefsError) throw prefsError;
  const preferences = (prefs || null) as NotificationPreferenceRow | null;
  if (!preferences) return;
  if (!preferences.digest_enabled) return;

  if (isFutureTimestamp(preferences.muted_until, now) || isFutureTimestamp(preferences.snoozed_until, now)) {
    return;
  }

  const eligibleTypes = resolveDigestEligibleTypes(preferences.type_preferences);
  if (eligibleTypes.length === 0) return;

  const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentUpdatesData, error: recentUpdatesError } = await backend
    .from('notifications')
    .select('id, type, title, message, created_at')
    .eq('user_id', userId)
    .eq('read', false)
    .in('type', eligibleTypes)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (recentUpdatesError) throw recentUpdatesError;

  const recentUpdates = (recentUpdatesData || []) as DigestNotificationSource[];
  if (recentUpdates.length === 0) return;

  const todayKey = format(now, 'yyyy-MM-dd');
  const digestNotificationId = buildDigestNotificationId(userId, todayKey);
  const { data: existingDigest, error: digestLookupError } = await backend
    .from('notifications')
    .select('id')
    .eq('id', digestNotificationId)
    .maybeSingle();

  if (digestLookupError) throw digestLookupError;

  if (!existingDigest) {
    const { error: digestInsertError } = await backend.from('notifications').insert({
      id: digestNotificationId,
      user_id: userId,
      type: 'daily_digest',
      title: `Daily Digest ${todayKey}`,
      message: `You have ${recentUpdates.length} important update(s) in the last 24 hours.`,
      entity_type: null,
      entity_id: null,
      read: false,
    });

    if (digestInsertError && !isDuplicateInsertError(digestInsertError)) {
      throw digestInsertError;
    }
  }

  if (!preferences.email_enabled) return;

  const emailResult = await sendAppwriteEmailToUser({
    messageId: buildDigestEmailMessageId(userId, todayKey),
    userId,
    subject: `Workflow Daily Digest - ${todayKey}`,
    content: renderDigestEmailContent(todayKey, recentUpdates),
  });

  if (emailResult.status === 'failed') {
    console.error(`[digest-email] failed for ${userId}: ${emailResult.reason || 'unknown_error'}`);
  }
}
