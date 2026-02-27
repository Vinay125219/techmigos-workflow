type AppwriteHttpError = Error & {
  status?: number;
  code?: number;
  type?: string;
};

const endpointFromEnv = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim() || '';
const endpoint = endpointFromEnv.replace(/\/+$/, '');
const endpointWithVersion = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() || '';
const apiKey = process.env.APPWRITE_API_KEY?.trim() || '';

const emailNotificationsEnabled = parseBooleanEnv(process.env.APPWRITE_EMAIL_NOTIFICATIONS_ENABLED, true);

export type EmailDispatchStatus = 'sent' | 'duplicate' | 'skipped' | 'failed';

export type EmailDispatchResult = {
  status: EmailDispatchStatus;
  reason?: string;
};

export type SendAppwriteEmailInput = {
  messageId: string;
  userId: string;
  subject: string;
  content: string;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as AppwriteHttpError;
  const message = typed.message?.toLowerCase() || '';

  return typed.status === 409 || typed.code === 409 || message.includes('already exists') || message.includes('duplicate');
}

function isMessagingUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as AppwriteHttpError;
  const message = typed.message?.toLowerCase() || '';
  const type = typed.type?.toLowerCase() || '';

  return (
    typed.status === 404 ||
    typed.code === 404 ||
    type.includes('route_not_found') ||
    type.includes('service_disabled') ||
    message.includes('route not found') ||
    message.includes('messaging service')
  );
}

function toHttpError(payload: unknown, fallbackStatus: number): AppwriteHttpError {
  if (payload && typeof payload === 'object') {
    const message = typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : `Appwrite request failed with status ${fallbackStatus}.`;

    return Object.assign(new Error(message), {
      status: fallbackStatus,
      type: (payload as { type?: string }).type,
      code: typeof (payload as { code?: unknown }).code === 'number'
        ? (payload as { code: number }).code
        : fallbackStatus,
    });
  }

  return Object.assign(new Error(`Appwrite request failed with status ${fallbackStatus}.`), {
    status: fallbackStatus,
    code: fallbackStatus,
  });
}

async function appwriteRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers || {});

  if (projectId) {
    headers.set('X-Appwrite-Project', projectId);
  }

  if (apiKey) {
    headers.set('X-Appwrite-Key', apiKey);
  }

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${endpointWithVersion}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw toHttpError(payload, response.status);
  }

  return payload as T;
}

export async function sendAppwriteEmailToUser(input: SendAppwriteEmailInput): Promise<EmailDispatchResult> {
  if (!emailNotificationsEnabled) {
    return { status: 'skipped', reason: 'disabled' };
  }

  if (!endpoint || !projectId || !apiKey) {
    return { status: 'skipped', reason: 'missing_configuration' };
  }

  const body: Record<string, unknown> = {
    messageId: input.messageId,
    subject: input.subject,
    content: input.content,
    users: [input.userId],
    html: true,
    draft: false,
  };

  try {
    await appwriteRequest('/messaging/messages/email', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return { status: 'sent' };
  } catch (error) {
    if (isConflictError(error)) {
      return { status: 'duplicate', reason: 'already_sent' };
    }

    if (isMessagingUnavailableError(error)) {
      return { status: 'skipped', reason: 'messaging_unavailable' };
    }

    const typed = error as AppwriteHttpError;
    console.error('[digest-email] Appwrite email send failed:', typed.message || error);
    return { status: 'failed', reason: typed.message || 'unknown_error' };
  }
}
