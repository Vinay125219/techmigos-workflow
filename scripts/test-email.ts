import './load-env';
import { backend } from '../integrations/backend/client';
import { sendAppwriteEmailToUser } from '../lib/appwrite-messaging';

type ProfileRow = {
  id: string;
  email: string;
};

function isEmail(value: string): boolean {
  return value.includes('@');
}

async function resolveUserId(input: string): Promise<string> {
  if (!isEmail(input)) return input;

  const normalized = input.trim().toLowerCase();
  const { data, error } = await backend
    .from('profiles')
    .select('id, email')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve user by email: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No profile found for email: ${normalized}`);
  }

  return (data as ProfileRow).id;
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    throw new Error('Usage: npm run jobs:test-email -- <userId-or-email>');
  }

  const userId = await resolveUserId(target);
  const timestamp = new Date().toISOString();
  const messageId = `etest_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_${timestamp.slice(0, 10).replace(/-/g, '')}`.slice(0, 36);

  const result = await sendAppwriteEmailToUser({
    messageId,
    userId,
    subject: 'Workflow Email Test',
    content: `<div><p>This is a test email from Workflow.</p><p>Sent at: ${timestamp}</p></div>`,
  });

  console.info('[email-test] result:', result);

  if (result.status !== 'sent' && result.status !== 'duplicate') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[email-test] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

