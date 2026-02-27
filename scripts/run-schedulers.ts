import './load-env';
import { backend } from '../integrations/backend/client';
import { runDueRecurringTasksForWorkspace } from '../lib/recurring-tasks';
import { runApprovalEscalations } from '../lib/approvals';
import { generateNotificationDigest } from '../lib/notification-digest';

const PAGE_SIZE = 100;

function assertSchedulerEnv(): void {
  const required = [
    'NEXT_PUBLIC_APPWRITE_ENDPOINT',
    'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
    'NEXT_PUBLIC_APPWRITE_DATABASE_ID',
    'APPWRITE_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required scheduler environment variables: ${missing.join(', ')}`);
  }
}

async function fetchWorkspaceIds(): Promise<string[]> {
  const ids: string[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await backend
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`);
    }

    const rows = (data || []) as Array<{ id: string }>;
    ids.push(...rows.map((row) => row.id));

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  return Array.from(new Set(ids));
}

async function fetchDigestEnabledUsers(): Promise<string[]> {
  const users: string[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await backend
      .from('notification_preferences')
      .select('user_id')
      .eq('digest_enabled', true)
      .order('updated_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch digest preferences: ${error.message}`);
    }

    const rows = (data || []) as Array<{ user_id: string }>;
    users.push(...rows.map((row) => row.user_id));

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  return Array.from(new Set(users));
}

async function runSchedulers(): Promise<void> {
  assertSchedulerEnv();

  const workspaces = await fetchWorkspaceIds();
  let recurringCreated = 0;
  let recurringSkipped = 0;
  let recurringFailed = 0;

  for (const workspaceId of workspaces) {
    const recurringSummary = await runDueRecurringTasksForWorkspace(workspaceId);
    recurringCreated += recurringSummary.createdTasks;
    recurringSkipped += recurringSummary.skippedTasks;
    recurringFailed += recurringSummary.failedTasks;

    await runApprovalEscalations(workspaceId);
  }

  const digestUsers = await fetchDigestEnabledUsers();
  let digestProcessed = 0;
  let digestFailed = 0;

  for (const userId of digestUsers) {
    try {
      await generateNotificationDigest(userId);
      digestProcessed += 1;
    } catch (error) {
      digestFailed += 1;
      console.error(`[scheduler] Digest generation failed for user ${userId}:`, error);
    }
  }

  console.info(
    `[scheduler] Completed. workspaces=${workspaces.length} recurring_created=${recurringCreated} recurring_skipped=${recurringSkipped} recurring_failed=${recurringFailed} digest_users=${digestUsers.length} digest_processed=${digestProcessed} digest_failed=${digestFailed}`
  );
}

runSchedulers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[scheduler] Failed:', error);
    process.exit(1);
  });
