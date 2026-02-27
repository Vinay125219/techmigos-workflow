import { Query } from 'appwrite';
import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/company-policy';

type AppwriteAccount = {
  $id: string;
  email?: string;
};

type AppwriteListResponse<T> = {
  total: number;
  documents: T[];
};

type AppwriteDocument = {
  $id: string;
  [key: string]: unknown;
};

type AppwriteHttpError = Error & {
  status?: number;
  code?: number;
  type?: string;
};

const endpointFromEnv = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim() || '';
const endpoint = endpointFromEnv.replace(/\/+$/, '');
const endpointWithVersion = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() || '';
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim() || '';
const apiKey = process.env.APPWRITE_API_KEY?.trim() || '';

const collections = {
  profiles: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES?.trim() || 'profiles',
  user_roles: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ROLES?.trim() || 'user_roles',
  workspace_members: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_WORKSPACE_MEMBERS?.trim() || 'workspace_members',
  notifications: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS?.trim() || 'notifications',
  notification_preferences:
    process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATION_PREFERENCES?.trim() || 'notification_preferences',
  user_onboarding: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ONBOARDING?.trim() || 'user_onboarding',
  tasks: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS?.trim() || 'tasks',
  company_policy: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_COMPANY_POLICY?.trim() || 'company_policy',
};

const OPTIONAL_COLLECTIONS = new Set([
  collections.notification_preferences,
  collections.user_onboarding,
  collections.company_policy,
]);

const PAGE_SIZE = 100;

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function isMissingCollectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as AppwriteHttpError;
  const message = typed.message?.toLowerCase() || '';
  const type = typed.type?.toLowerCase() || '';

  return (
    typed.status === 404 ||
    typed.code === 404 ||
    type.includes('collection_not_found') ||
    message.includes('collection with the requested id') ||
    message.includes('could not be found')
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

async function appwriteRequest<T>(
  path: string,
  init: RequestInit = {},
  options: {
    withApiKey?: boolean;
    cookieHeader?: string;
    withProjectHeader?: boolean;
  } = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const withProjectHeader = options.withProjectHeader ?? true;

  if (withProjectHeader && projectId) {
    headers.set('X-Appwrite-Project', projectId);
  }

  if (options.withApiKey) {
    headers.set('X-Appwrite-Key', apiKey);
  }

  if (options.cookieHeader) {
    headers.set('Cookie', options.cookieHeader);
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

async function listDocuments(
  collectionId: string,
  queries: string[] = []
): Promise<AppwriteDocument[]> {
  const allDocuments: AppwriteDocument[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams();
    [...queries, Query.limit(PAGE_SIZE), Query.offset(offset)].forEach((query) => {
      params.append('queries[]', query);
    });

    const response = await appwriteRequest<AppwriteListResponse<AppwriteDocument>>(
      `/databases/${encodePath(databaseId)}/collections/${encodePath(collectionId)}/documents?${params.toString()}`,
      { method: 'GET' },
      { withApiKey: true }
    );

    const documents = response.documents || [];
    allDocuments.push(...documents);

    if (documents.length < PAGE_SIZE) break;

    offset += documents.length;
    if (offset > 5000) break;
  }

  return allDocuments;
}

async function deleteDocumentsByField(
  collectionId: string,
  field: string,
  value: string
): Promise<void> {
  try {
    const documents = await listDocuments(collectionId, [Query.equal(field, [value])]);
    await Promise.all(
      documents.map((document) =>
        appwriteRequest(
          `/databases/${encodePath(databaseId)}/collections/${encodePath(collectionId)}/documents/${encodePath(document.$id)}`,
          { method: 'DELETE' },
          { withApiKey: true }
        )
      )
    );
  } catch (error) {
    if (OPTIONAL_COLLECTIONS.has(collectionId) && isMissingCollectionError(error)) {
      return;
    }
    throw error;
  }
}

async function clearTaskAssignments(userId: string): Promise<void> {
  try {
    const documents = await listDocuments(collections.tasks, [Query.equal('assigned_to', [userId])]);
    const now = new Date().toISOString();

    await Promise.all(
      documents.map((document) =>
        appwriteRequest(
          `/databases/${encodePath(databaseId)}/collections/${encodePath(collections.tasks)}/documents/${encodePath(document.$id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                assigned_to: null,
                updated_at: now,
              },
            }),
          },
          { withApiKey: true }
        )
      )
    );
  } catch (error) {
    if (isMissingCollectionError(error)) return;
    throw error;
  }
}

async function tryDeleteProfileDocument(userId: string): Promise<{ email: string | null }> {
  try {
    const document = await appwriteRequest<AppwriteDocument>(
      `/databases/${encodePath(databaseId)}/collections/${encodePath(collections.profiles)}/documents/${encodePath(userId)}`,
      { method: 'GET' },
      { withApiKey: true }
    );

    const email = typeof document.email === 'string' ? normalizeEmail(document.email) : null;

    await appwriteRequest(
      `/databases/${encodePath(databaseId)}/collections/${encodePath(collections.profiles)}/documents/${encodePath(userId)}`,
      { method: 'DELETE' },
      { withApiKey: true }
    );

    return { email };
  } catch (error) {
    const typed = error as AppwriteHttpError;
    if (typed.status === 404 || typed.code === 404 || isMissingCollectionError(error)) {
      return { email: null };
    }
    throw error;
  }
}

function parseEmailArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean);
  }

  return [];
}

async function removeEmailFromPolicy(removedEmail: string | null, actorId: string): Promise<void> {
  if (!removedEmail) return;

  try {
    const policies = await listDocuments(collections.company_policy, [Query.limit(1)]);
    const policy = policies[0];
    if (!policy) return;

    const allowed = parseEmailArray(policy.allowed_emails);
    const nextAllowed = allowed.filter((email) => email !== removedEmail);
    if (nextAllowed.length === allowed.length) return;

    await appwriteRequest(
      `/databases/${encodePath(databaseId)}/collections/${encodePath(collections.company_policy)}/documents/${encodePath(policy.$id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            allowed_emails: nextAllowed,
            updated_by: actorId,
            updated_at: new Date().toISOString(),
          },
        }),
      },
      { withApiKey: true }
    );
  } catch (error) {
    if (isMissingCollectionError(error)) return;
    throw error;
  }
}

async function ensureActorIsAdmin(request: Request): Promise<AppwriteAccount> {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) {
    throw Object.assign(new Error('Missing session.'), { status: 401 });
  }

  const account = await appwriteRequest<AppwriteAccount>(
    '/account',
    { method: 'GET' },
    { cookieHeader, withProjectHeader: true }
  );

  const adminRoles = await listDocuments(collections.user_roles, [
    Query.equal('user_id', [account.$id]),
    Query.equal('role', ['admin']),
    Query.limit(1),
  ]);

  if (adminRoles.length === 0) {
    throw Object.assign(new Error('Only admins can remove users.'), { status: 403 });
  }

  return account;
}

async function deleteAuthUser(userId: string): Promise<{ deleted: boolean; email: string | null }> {
  try {
    const targetUser = await appwriteRequest<{ $id: string; email?: string }>(
      `/users/${encodePath(userId)}`,
      { method: 'GET' },
      { withApiKey: true }
    );

    const email = typeof targetUser.email === 'string' ? normalizeEmail(targetUser.email) : null;

    await appwriteRequest(
      `/users/${encodePath(userId)}`,
      { method: 'DELETE' },
      { withApiKey: true }
    );

    return { deleted: true, email };
  } catch (error) {
    const typed = error as AppwriteHttpError;
    if (typed.status === 404 || typed.code === 404) {
      return { deleted: false, email: null };
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    if (!endpoint || !projectId || !databaseId) {
      return NextResponse.json(
        { error: 'Appwrite endpoint/project/database environment variables are not configured.' },
        { status: 500 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'APPWRITE_API_KEY is required on server to remove users.' },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const actor = await ensureActorIsAdmin(request);
    if (actor.$id === userId) {
      return NextResponse.json({ error: 'You cannot remove your own user account.' }, { status: 400 });
    }

    await clearTaskAssignments(userId);
    await deleteDocumentsByField(collections.user_roles, 'user_id', userId);
    await deleteDocumentsByField(collections.workspace_members, 'user_id', userId);
    await deleteDocumentsByField(collections.notifications, 'user_id', userId);
    await deleteDocumentsByField(collections.notification_preferences, 'user_id', userId);
    await deleteDocumentsByField(collections.user_onboarding, 'user_id', userId);

    const profileDeleteResult = await tryDeleteProfileDocument(userId);
    const authDeleteResult = await deleteAuthUser(userId);
    const removedEmail = authDeleteResult.email || profileDeleteResult.email;

    await removeEmailFromPolicy(removedEmail, actor.$id);

    return NextResponse.json({
      success: true,
      userId,
      authUserDeleted: authDeleteResult.deleted,
      removedEmail,
    });
  } catch (error) {
    const typed = error as AppwriteHttpError;
    const status = typeof typed.status === 'number' ? typed.status : 500;
    const message = typed.message || 'Failed to remove user.';

    return NextResponse.json({ error: message }, { status });
  }
}
