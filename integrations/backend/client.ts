import type { AuthSession, AuthUser } from '@/types/auth';
import type { AppRole } from '@/types/database';
import { appwriteConfig } from './config';
import { Client, Query, type RealtimeResponseEvent } from 'appwrite';
import { getPrivilegedEmailRole } from '@/lib/company-policy';

type BackendErrorResult<TData = any> = {
  data: TData;
  error: Error | null;
  count?: number | null;
};

type AuthChangeCallback = (event: string, session: AuthSession | null) => void;

type AppwriteDocument = {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: unknown;
};

type AppwriteUser = {
  $id: string;
  email?: string | null;
  name?: string | null;
  emailVerification?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
};

type AppwriteListDocumentsResponse = {
  total: number;
  documents: AppwriteDocument[];
};

type QueryOperator =
  | 'eq'
  | 'in'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'not_null'
  | 'search';

type QueryFilter = {
  field: string;
  op: QueryOperator;
  value?: unknown;
};

type QueryState = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  payload: unknown;
  filters: QueryFilter[];
  orderBy: { field: string; ascending: boolean } | null;
  limitCount: number | null;
  offsetCount: number;
  returnRows: boolean;
  expectSingle: boolean;
  maybeSingle: boolean;
  execution: Promise<BackendErrorResult> | null;
};

type AppwriteHttpError = Error & {
  status?: number;
  type?: string;
  code?: number;
};

const authListeners = new Set<AuthChangeCallback>();
const activeChannels = new Set<{ _unsubscribe?: () => void }>();
const LIST_PAGE_SIZE = 100;
let realtimeClient: Client | null = null;
const IMMUTABLE_TABLES = new Set(['activity_logs', 'role_history']);
const ADMIN_ONLY_TABLES = new Set(['user_roles', 'role_history']);
const MANAGER_ONLY_READ_TABLES = new Set(['company_transactions']);
const MANAGER_ONLY_WRITE_TABLES = new Set([
  'projects',
  'workspaces',
  'workspace_members',
  'company_transactions',
  'approval_rules',
  'governance_actions',
]);

const TABLE_FIELDS: Record<string, Set<string>> = {
  profiles: new Set([
    'id',
    'email',
    'full_name',
    'avatar_url',
    'department',
    'designation',
    'skills',
    'created_at',
    'updated_at',
  ]),
  user_roles: new Set(['id', 'user_id', 'role', 'created_at']),
  workspaces: new Set(['id', 'name', 'description', 'owner_id', 'created_at', 'updated_at']),
  workspace_members: new Set(['id', 'workspace_id', 'user_id', 'role', 'created_at']),
  projects: new Set([
    'id',
    'name',
    'description',
    'status',
    'priority',
    'start_date',
    'end_date',
    'progress',
    'category',
    'workspace_id',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  tasks: new Set([
    'id',
    'title',
    'description',
    'status',
    'priority',
    'difficulty',
    'estimated_hours',
    'deadline',
    'requirements',
    'deliverables',
    'skills',
    'assigned_to',
    'project_id',
    'workspace_id',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  task_progress: new Set([
    'id',
    'task_id',
    'user_id',
    'content',
    'hours_worked',
    'progress_percentage',
    'attachments',
    'created_at',
  ]),
  task_dependencies: new Set([
    'id',
    'task_id',
    'depends_on_task_id',
    'dependency_type',
    'created_by',
    'created_at',
  ]),
  task_templates: new Set([
    'id',
    'name',
    'title',
    'description',
    'priority',
    'difficulty',
    'estimated_hours',
    'requirements',
    'deliverables',
    'skills',
    'project_id',
    'workspace_id',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  recurring_tasks: new Set([
    'id',
    'template_id',
    'title',
    'description',
    'frequency',
    'interval_value',
    'next_run_at',
    'last_run_at',
    'project_id',
    'workspace_id',
    'active',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  approval_rules: new Set([
    'id',
    'workspace_id',
    'project_id',
    'required_approvals',
    'sla_hours',
    'escalate_to_roles',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  task_approvals: new Set([
    'id',
    'task_id',
    'workspace_id',
    'status',
    'requested_by',
    'requested_at',
    'due_at',
    'approved_by',
    'approved_at',
    'rejected_by',
    'rejected_at',
    'required_approvals',
    'approval_count',
    'comments',
    'created_at',
    'updated_at',
  ]),
  activity_logs: new Set([
    'id',
    'user_id',
    'action_type',
    'entity_type',
    'entity_id',
    'entity_title',
    'description',
    'metadata',
    'created_at',
  ]),
  notifications: new Set([
    'id',
    'user_id',
    'title',
    'message',
    'type',
    'read',
    'entity_type',
    'entity_id',
    'created_at',
  ]),
  ideas: new Set([
    'id',
    'title',
    'description',
    'category',
    'status',
    'votes',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  idea_votes: new Set(['id', 'idea_id', 'user_id', 'vote_type', 'created_at']),
  discussions: new Set([
    'id',
    'entity_type',
    'entity_id',
    'user_id',
    'content',
    'parent_id',
    'created_at',
    'updated_at',
  ]),
  user_onboarding: new Set(['id', 'user_id', 'completed', 'steps_completed', 'created_at', 'updated_at']),
  notification_preferences: new Set([
    'id',
    'user_id',
    'in_app_enabled',
    'email_enabled',
    'digest_enabled',
    'muted_until',
    'snoozed_until',
    'type_preferences',
    'updated_at',
    'created_at',
  ]),
  documents: new Set([
    'id',
    'title',
    'description',
    'type',
    'file_url',
    'file_size',
    'status',
    'version',
    'parent_document_id',
    'workspace_id',
    'project_id',
    'task_id',
    'created_by',
    'owner_id',
    'created_at',
    'updated_at',
  ]),
  company_transactions: new Set([
    'id',
    'workspace_id',
    'transaction_type',
    'category',
    'title',
    'description',
    'amount',
    'currency',
    'transaction_date',
    'reference',
    'paid_by',
    'credited_to',
    'proof_url',
    'proof_type',
    'proof_name',
    'created_by',
    'created_at',
    'updated_at',
  ]),
  role_history: new Set([
    'id',
    'user_id',
    'changed_by',
    'role',
    'change_type',
    'reason',
    'created_at',
  ]),
  governance_actions: new Set([
    'id',
    'action_type',
    'entity_type',
    'entity_id',
    'payload',
    'requested_by',
    'status',
    'approved_by',
    'approved_at',
    'created_at',
    'updated_at',
  ]),
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function hasAuthConfig(): boolean {
  return Boolean(appwriteConfig.endpointWithVersion && appwriteConfig.projectId);
}

function hasAppwriteSessionCookie(): boolean {
  if (!isBrowser()) return false;

  const cookieCandidates: string[] = ['tm_auth='];
  if (appwriteConfig.projectId) {
    const cookieBase = `a_session_${appwriteConfig.projectId}`;
    cookieCandidates.push(`${cookieBase}=`, `${cookieBase}_legacy=`);
  }

  const cookies = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  return cookies.some((cookie) => cookieCandidates.some((prefix) => cookie.startsWith(prefix)));
}

function consumePendingOauthProbeFlag(): boolean {
  if (!isBrowser()) return false;

  try {
    const key = 'tm_oauth_pending';
    const pending = window.sessionStorage.getItem(key) === '1';
    if (pending) {
      window.sessionStorage.removeItem(key);
    }
    return pending;
  } catch {
    return false;
  }
}

function shouldProbeAccountOnAuthCallback(): boolean {
  if (!isBrowser()) return false;

  const params = new URLSearchParams(window.location.search);
  const oauthStatus = params.get('oauth');
  const isAuthRoute = window.location.pathname.startsWith('/auth');
  const hasMagicLinkCallbackParams = Boolean(params.get('userId') && params.get('secret'));
  const shouldProbeOAuthCallback = oauthStatus === 'success';

  // Still consume the sessionStorage flag if present, to clean up.
  if (shouldProbeOAuthCallback) {
    consumePendingOauthProbeFlag();
  }

  // Probe /account for known callback scenarios where Appwrite may have set an httpOnly session cookie.
  return isAuthRoute && (
    shouldProbeOAuthCallback ||
    hasMagicLinkCallbackParams
  );
}

function hasDatabaseConfig(): boolean {
  return Boolean(hasAuthConfig() && appwriteConfig.databaseId);
}

function getRealtimeClient(): Client | null {
  if (!isBrowser() || !hasAuthConfig()) return null;

  if (!realtimeClient) {
    realtimeClient = new Client()
      .setEndpoint(appwriteConfig.endpointWithVersion)
      .setProject(appwriteConfig.projectId);
  }

  return realtimeClient;
}

function createAuthConfigError(): AppwriteHttpError {
  return Object.assign(
    new Error(
      'Appwrite auth is not configured. Set NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID.'
    ),
    { status: 500 }
  );
}

function createDatabaseConfigError(): AppwriteHttpError {
  return Object.assign(
    new Error(
      'Appwrite database is not configured. Set NEXT_PUBLIC_APPWRITE_DATABASE_ID and collection env variables.'
    ),
    { status: 500 }
  );
}

function toHttpError(payload: unknown, fallbackStatus: number): AppwriteHttpError {
  if (payload && typeof payload === 'object') {
    const message = typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : `Backend request failed with status ${fallbackStatus}.`;

    return Object.assign(new Error(message), {
      status: fallbackStatus,
      type: (payload as { type?: string }).type,
      code: typeof (payload as { code?: unknown }).code === 'number'
        ? (payload as { code: number }).code
        : fallbackStatus,
    });
  }

  return Object.assign(new Error(`Backend request failed with status ${fallbackStatus}.`), {
    status: fallbackStatus,
  });
}

function mapUser(user: AppwriteUser): AuthUser {
  return {
    id: user.$id,
    email: user.email ?? null,
    name: user.name ?? null,
    email_verified: Boolean(user.emailVerification),
    email_confirmed_at: user.emailVerification ? user.$updatedAt || user.$createdAt || null : null,
  };
}

function normalizeDocument(document: AppwriteDocument): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...document };

  normalized.id = normalized.id ?? document.$id;
  normalized.created_at = normalized.created_at ?? document.$createdAt ?? null;
  normalized.updated_at = normalized.updated_at ?? document.$updatedAt ?? null;

  return normalized;
}

function toComparable(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp) && value.includes('T')) return timestamp;
    return value;
  }
  return String(value);
}

function matchesFilter(record: Record<string, unknown>, filter: QueryFilter): boolean {
  const fieldValue = record[filter.field];

  switch (filter.op) {
    case 'eq':
      return fieldValue === filter.value;
    case 'in':
      return Array.isArray(filter.value) ? filter.value.includes(fieldValue) : false;
    case 'neq':
      return fieldValue !== filter.value;
    case 'not_null':
      return fieldValue !== null && fieldValue !== undefined;
    case 'search': {
      if (typeof fieldValue !== 'string') return false;
      if (typeof filter.value !== 'string') return false;
      return fieldValue.toLowerCase().includes(filter.value.toLowerCase());
    }
    case 'lt': {
      const left = toComparable(fieldValue);
      const right = toComparable(filter.value);
      return left !== null && right !== null && left < right;
    }
    case 'lte': {
      const left = toComparable(fieldValue);
      const right = toComparable(filter.value);
      return left !== null && right !== null && left <= right;
    }
    case 'gt': {
      const left = toComparable(fieldValue);
      const right = toComparable(filter.value);
      return left !== null && right !== null && left > right;
    }
    case 'gte': {
      const left = toComparable(fieldValue);
      const right = toComparable(filter.value);
      return left !== null && right !== null && left >= right;
    }
    default:
      return true;
  }
}

function applyFilters(records: Record<string, unknown>[], filters: QueryFilter[]): Record<string, unknown>[] {
  if (!filters.length) return records;
  return records.filter((record) => filters.every((filter) => matchesFilter(record, filter)));
}

function applySort(
  records: Record<string, unknown>[],
  orderBy: { field: string; ascending: boolean } | null
): Record<string, unknown>[] {
  if (!orderBy) return records;

  return [...records].sort((a, b) => {
    const aValue = toComparable(a[orderBy.field]);
    const bValue = toComparable(b[orderBy.field]);

    if (aValue === bValue) return 0;
    if (aValue === null) return orderBy.ascending ? 1 : -1;
    if (bValue === null) return orderBy.ascending ? -1 : 1;

    if (aValue < bValue) return orderBy.ascending ? -1 : 1;
    return orderBy.ascending ? 1 : -1;
  });
}

function appendTimestamps(table: string, payload: Record<string, unknown>, isInsert: boolean): Record<string, unknown> {
  const allowed = TABLE_FIELDS[table];
  if (!allowed) return payload;

  const withTimestamps = { ...payload };
  const now = new Date().toISOString();

  if (allowed.has('created_at') && isInsert && withTimestamps.created_at === undefined) {
    withTimestamps.created_at = now;
  }

  if (allowed.has('updated_at') && withTimestamps.updated_at === undefined) {
    withTimestamps.updated_at = now;
  }

  return withTimestamps;
}

function sanitizePayload(table: string, payload: unknown, isInsert: boolean): Record<string, unknown> {
  const source = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const allowed = TABLE_FIELDS[table];
  const clean: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || key === 'id') return;
    if (allowed && !allowed.has(key)) return;
    clean[key] = value;
  });

  return appendTimestamps(table, clean, isInsert);
}

function extractDocumentId(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const maybeId = (payload as { id?: unknown }).id;
    if (typeof maybeId === 'string' && maybeId.length > 0) return maybeId;
  }
  return 'unique()';
}

function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function collectionIdForTable(table: string): string | null {
  return (appwriteConfig.collections as Record<string, string | undefined>)[table] || null;
}

function toQueryArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function buildServerQueries(
  filters: QueryFilter[],
  orderBy: { field: string; ascending: boolean } | null
): string[] {
  const queries: string[] = [];

  const queryBuilder = Query as unknown as Record<string, (...args: any[]) => string>;

  filters.forEach((filter) => {
    const field = filter.field;

    switch (filter.op) {
      case 'eq':
        queries.push(Query.equal(field, toQueryArrayValue(filter.value)));
        break;
      case 'in':
        queries.push(Query.equal(field, toQueryArrayValue(filter.value)));
        break;
      case 'neq':
        if (typeof queryBuilder.notEqual === 'function') {
          queries.push(queryBuilder.notEqual(field, toQueryArrayValue(filter.value)));
        }
        break;
      case 'lt':
        if (typeof queryBuilder.lessThan === 'function') {
          queries.push(queryBuilder.lessThan(field, filter.value));
        }
        break;
      case 'lte':
        if (typeof queryBuilder.lessThanEqual === 'function') {
          queries.push(queryBuilder.lessThanEqual(field, filter.value));
        }
        break;
      case 'gt':
        if (typeof queryBuilder.greaterThan === 'function') {
          queries.push(queryBuilder.greaterThan(field, filter.value));
        }
        break;
      case 'gte':
        if (typeof queryBuilder.greaterThanEqual === 'function') {
          queries.push(queryBuilder.greaterThanEqual(field, filter.value));
        }
        break;
      case 'not_null':
        if (typeof queryBuilder.isNotNull === 'function') {
          queries.push(queryBuilder.isNotNull(field));
        }
        break;
      case 'search':
        if (typeof filter.value === 'string' && filter.value.trim().length > 0) {
          queries.push(Query.search(field, filter.value.trim()));
        }
        break;
      default:
        break;
    }
  });

  if (orderBy) {
    queries.push(orderBy.ascending ? Query.orderAsc(orderBy.field) : Query.orderDesc(orderBy.field));
  }

  return queries;
}

async function appwriteRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { withProjectHeader?: boolean } = {}
): Promise<{ data: T | null; error: AppwriteHttpError | null }> {
  if (!appwriteConfig.endpointWithVersion) {
    return { data: null, error: createAuthConfigError() };
  }

  const withProjectHeader = options.withProjectHeader ?? true;
  const headers = new Headers(init.headers || {});

  if (withProjectHeader && appwriteConfig.projectId) {
    headers.set('X-Appwrite-Project', appwriteConfig.projectId);
  }

  // Allow server-side cron/function runners to authenticate without browser cookies.
  if (!isBrowser() && process.env.APPWRITE_API_KEY) {
    headers.set('X-Appwrite-Key', process.env.APPWRITE_API_KEY);
  }

  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${appwriteConfig.endpointWithVersion}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;

    if (!response.ok) {
      return { data: null, error: toHttpError(payload, response.status) };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: Object.assign(
        new Error(error instanceof Error ? error.message : 'Network request failed.'),
        { status: 0 }
      ),
    };
  }
}

async function getCurrentAccount(): Promise<{ user: AuthUser | null; error: AppwriteHttpError | null }> {
  const result = await appwriteRequest<AppwriteUser>('/account', { method: 'GET' });

  if (!result.error && result.data) {
    return { user: mapUser(result.data), error: null };
  }

  if (result.error?.status === 401) {
    return { user: null, error: null };
  }

  return { user: null, error: result.error };
}

function emitAuthChange(event: string, session: AuthSession | null): void {
  authListeners.forEach((callback) => {
    try {
      callback(event, session);
    } catch (error) {
      console.error('Auth listener failed:', error);
    }
  });
}

async function resolveActorRoles(): Promise<AppRole[]> {
  const accountResult = await getCurrentAccount();
  if (!accountResult.user) return [];

  const roleQuery = await createQueryBuilder('user_roles')
    .select('*')
    .eq('user_id', accountResult.user.id);

  const roleRows = ((roleQuery.data || []) as Array<{ role?: unknown }>)
    .map((row) => row.role)
    .filter((role): role is AppRole => typeof role === 'string') as AppRole[];

  const privilegedRole = getPrivilegedEmailRole(accountResult.user.email);
  if (privilegedRole && !roleRows.includes(privilegedRole)) {
    roleRows.push(privilegedRole);
  }

  if (roleRows.length === 0) {
    roleRows.push('member');
  }

  return Array.from(new Set(roleRows));
}

function hasManagerAccess(roles: AppRole[]): boolean {
  return roles.includes('manager') || roles.includes('admin');
}

function hasAdminAccess(roles: AppRole[]): boolean {
  return roles.includes('admin');
}

async function enforceQueryAccess(state: QueryState): Promise<Error | null> {
  const isWrite = state.operation === 'insert' || state.operation === 'update' || state.operation === 'delete';

  if (IMMUTABLE_TABLES.has(state.table) && (state.operation === 'update' || state.operation === 'delete')) {
    return new Error(`${state.table} is immutable and cannot be modified.`);
  }

  if (state.operation === 'select' && MANAGER_ONLY_READ_TABLES.has(state.table)) {
    const roles = await resolveActorRoles();
    if (!hasManagerAccess(roles)) {
      return new Error(`Access denied: ${state.table} can only be read by managers/admins.`);
    }
  }

  if (isWrite && ADMIN_ONLY_TABLES.has(state.table)) {
    const roles = await resolveActorRoles();
    if (!hasAdminAccess(roles)) {
      return new Error(`Access denied: ${state.table} requires admin privileges.`);
    }
  }

  if (isWrite && MANAGER_ONLY_WRITE_TABLES.has(state.table)) {
    const roles = await resolveActorRoles();
    if (!hasManagerAccess(roles)) {
      return new Error(`Access denied: ${state.table} requires manager/admin privileges.`);
    }

    if (state.table === 'company_transactions' && (state.operation === 'update' || state.operation === 'delete')) {
      if (!hasAdminAccess(roles)) {
        return new Error('Access denied: only admins can edit or delete company transactions.');
      }
    }
  }

  return null;
}

async function fetchAllDocuments(
  table: string,
  options?: {
    filters?: QueryFilter[];
    orderBy?: { field: string; ascending: boolean } | null;
    limit?: number | null;
    offset?: number;
  }
): Promise<BackendErrorResult<Record<string, unknown>[]>> {
  if (!hasDatabaseConfig()) {
    return { data: [], error: createDatabaseConfigError() };
  }

  const collectionId = collectionIdForTable(table);
  if (!collectionId) {
    return { data: [], error: new Error(`No Appwrite collection configured for table "${table}".`) };
  }

  const basePath = `/databases/${encodePath(appwriteConfig.databaseId)}/collections/${encodePath(collectionId)}/documents`;
  const baseQueries = buildServerQueries(options?.filters || [], options?.orderBy || null);
  const allDocuments: Record<string, unknown>[] = [];
  let totalCount = 0;
  let offset = Math.max(0, options?.offset || 0);
  const requestedLimit = typeof options?.limit === 'number' ? Math.max(0, options.limit) : null;
  if (requestedLimit === 0) {
    return { data: [], error: null, count: 0 };
  }
  const pageLimit = requestedLimit !== null ? Math.min(requestedLimit, LIST_PAGE_SIZE) : LIST_PAGE_SIZE;
  let remaining = requestedLimit;

  while (true) {
    const queryParts = [...baseQueries, Query.limit(pageLimit), Query.offset(offset)];
    const params = new URLSearchParams();
    queryParts.forEach((query) => params.append('queries[]', query));

    let response = await appwriteRequest<AppwriteListDocumentsResponse>(`${basePath}?${params.toString()}`, {
      method: 'GET',
    });

    // Fallback for environments where query syntax is disabled/restricted.
    if (response.error && offset === 0) {
      response = await appwriteRequest<AppwriteListDocumentsResponse>(basePath, { method: 'GET' });
    }

    if (response.error || !response.data) {
      return { data: [], error: response.error || new Error('Failed to list documents.') };
    }

    const documents = (response.data.documents || []).map((doc) => normalizeDocument(doc));
    allDocuments.push(...documents);

    const total = typeof response.data.total === 'number'
      ? response.data.total
      : allDocuments.length;
    totalCount = total;

    if (documents.length === 0 || allDocuments.length >= total) {
      break;
    }

    offset += documents.length;
    if (remaining !== null) {
      remaining -= documents.length;
      if (remaining <= 0) {
        break;
      }
    }

    if (offset > 5000) {
      break;
    }
  }

  const limitedRows = requestedLimit !== null ? allDocuments.slice(0, requestedLimit) : allDocuments;
  return { data: limitedRows, error: null, count: totalCount || limitedRows.length };
}

async function createDocument(table: string, payload: unknown): Promise<BackendErrorResult<Record<string, unknown>>> {
  if (!hasDatabaseConfig()) {
    return { data: {}, error: createDatabaseConfigError() };
  }

  const collectionId = collectionIdForTable(table);
  if (!collectionId) {
    return { data: {}, error: new Error(`No Appwrite collection configured for table "${table}".`) };
  }

  const documentId = extractDocumentId(payload);
  const data = sanitizePayload(table, payload, true);

  const response = await appwriteRequest<AppwriteDocument>(
    `/databases/${encodePath(appwriteConfig.databaseId)}/collections/${encodePath(collectionId)}/documents`,
    {
      method: 'POST',
      body: JSON.stringify({
        documentId,
        data,
      }),
    }
  );

  if (response.error || !response.data) {
    return { data: {}, error: response.error || new Error('Failed to create document.') };
  }

  return { data: normalizeDocument(response.data), error: null };
}

async function updateDocument(
  table: string,
  documentId: string,
  payload: unknown
): Promise<BackendErrorResult<Record<string, unknown>>> {
  if (!hasDatabaseConfig()) {
    return { data: {}, error: createDatabaseConfigError() };
  }

  const collectionId = collectionIdForTable(table);
  if (!collectionId) {
    return { data: {}, error: new Error(`No Appwrite collection configured for table "${table}".`) };
  }

  const data = sanitizePayload(table, payload, false);

  const response = await appwriteRequest<AppwriteDocument>(
    `/databases/${encodePath(appwriteConfig.databaseId)}/collections/${encodePath(collectionId)}/documents/${encodePath(documentId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data,
      }),
    }
  );

  if (response.error || !response.data) {
    return { data: {}, error: response.error || new Error('Failed to update document.') };
  }

  return { data: normalizeDocument(response.data), error: null };
}

async function deleteDocument(table: string, documentId: string): Promise<BackendErrorResult<null>> {
  if (!hasDatabaseConfig()) {
    return { data: null, error: createDatabaseConfigError() };
  }

  const collectionId = collectionIdForTable(table);
  if (!collectionId) {
    return { data: null, error: new Error(`No Appwrite collection configured for table "${table}".`) };
  }

  const response = await appwriteRequest<null>(
    `/databases/${encodePath(appwriteConfig.databaseId)}/collections/${encodePath(collectionId)}/documents/${encodePath(documentId)}`,
    {
      method: 'DELETE',
    }
  );

  if (response.error) {
    return { data: null, error: response.error };
  }

  return { data: null, error: null };
}

async function executeQuery(state: QueryState): Promise<BackendErrorResult> {
  const accessError = await enforceQueryAccess(state);
  if (accessError) {
    return { data: null, error: accessError };
  }

  if (state.operation === 'select') {
    const allRowsResult = await fetchAllDocuments(state.table, {
      filters: state.filters,
      orderBy: state.orderBy,
      limit: state.limitCount,
      offset: state.offsetCount,
    });
    if (allRowsResult.error) return allRowsResult;

    let rows = applyFilters(allRowsResult.data, state.filters);
    rows = applySort(rows, state.orderBy);
    if (typeof state.offsetCount === 'number' && state.offsetCount > 0) {
      rows = rows.slice(state.offsetCount);
    }
    if (typeof state.limitCount === 'number') {
      rows = rows.slice(0, state.limitCount);
    }

    if (state.expectSingle || state.maybeSingle) {
      if (rows.length === 0) {
        if (state.maybeSingle) return { data: null, error: null };
        return { data: null, error: new Error('No rows found for single().') };
      }

      if (rows.length > 1) {
        return { data: null, error: new Error('single() returned multiple rows.') };
      }

      return { data: rows[0], error: null };
    }

    return { data: rows, error: null, count: rows.length };
  }

  if (state.operation === 'insert') {
    const rows = Array.isArray(state.payload) ? state.payload : [state.payload];
    const insertedRows: Record<string, unknown>[] = [];

    for (const row of rows) {
      const insertResult = await createDocument(state.table, row);
      if (insertResult.error) return { data: null, error: insertResult.error };
      insertedRows.push(insertResult.data);
    }

    if (!state.returnRows) return { data: null, error: null };

    if (state.expectSingle || state.maybeSingle) {
      return { data: insertedRows[0] || null, error: null };
    }

    return { data: insertedRows, error: null, count: insertedRows.length };
  }

  if (state.operation === 'update') {
    const allRowsResult = await fetchAllDocuments(state.table, {
      filters: state.filters,
    });
    if (allRowsResult.error) return allRowsResult;

    const rowsToUpdate = applyFilters(allRowsResult.data, state.filters);
    const updatedRows: Record<string, unknown>[] = [];

    for (const row of rowsToUpdate) {
      const rowId = row.id;
      if (typeof rowId !== 'string') continue;
      const updateResult = await updateDocument(state.table, rowId, state.payload);
      if (updateResult.error) return { data: null, error: updateResult.error };
      updatedRows.push(updateResult.data);
    }

    if (!state.returnRows) return { data: null, error: null };

    if (state.expectSingle || state.maybeSingle) {
      if (updatedRows.length === 0) {
        if (state.maybeSingle) return { data: null, error: null };
        return { data: null, error: new Error('No rows updated for single().') };
      }
      if (updatedRows.length > 1 && state.expectSingle) {
        return { data: null, error: new Error('single() expected one updated row.') };
      }
      return { data: updatedRows[0], error: null };
    }

    return { data: updatedRows, error: null, count: updatedRows.length };
  }

  if (state.operation === 'delete') {
    const allRowsResult = await fetchAllDocuments(state.table, {
      filters: state.filters,
    });
    if (allRowsResult.error) return allRowsResult;

    const rowsToDelete = applyFilters(allRowsResult.data, state.filters);
    for (const row of rowsToDelete) {
      const rowId = row.id;
      if (typeof rowId !== 'string') continue;
      const deleteResult = await deleteDocument(state.table, rowId);
      if (deleteResult.error) return { data: null, error: deleteResult.error };
    }

    return { data: null, error: null, count: rowsToDelete.length };
  }

  return { data: null, error: new Error('Unsupported operation.') };
}

function createQueryBuilder(table: string) {
  const state: QueryState = {
    table,
    operation: 'select',
    payload: null,
    filters: [],
    orderBy: null,
    limitCount: null,
    offsetCount: 0,
    returnRows: true,
    expectSingle: false,
    maybeSingle: false,
    execution: null,
  };

  const ensureExecution = () => {
    if (!state.execution) {
      state.execution = executeQuery(state);
    }
    return state.execution;
  };

  const builder = {
    select(_columns: string = '*') {
      if (state.operation !== 'select') state.returnRows = true;
      return builder;
    },
    insert(payload: unknown) {
      state.operation = 'insert';
      state.payload = payload;
      state.returnRows = false;
      return builder;
    },
    update(payload: unknown) {
      state.operation = 'update';
      state.payload = payload;
      state.returnRows = false;
      return builder;
    },
    delete() {
      state.operation = 'delete';
      state.payload = null;
      state.returnRows = false;
      return builder;
    },
    eq(field: string, value: unknown) {
      state.filters.push({ field, op: 'eq', value });
      return builder;
    },
    in(field: string, values: unknown[]) {
      state.filters.push({ field, op: 'in', value: values });
      return builder;
    },
    search(field: string, value: string) {
      state.filters.push({ field, op: 'search', value });
      return builder;
    },
    neq(field: string, value: unknown) {
      state.filters.push({ field, op: 'neq', value });
      return builder;
    },
    lt(field: string, value: unknown) {
      state.filters.push({ field, op: 'lt', value });
      return builder;
    },
    lte(field: string, value: unknown) {
      state.filters.push({ field, op: 'lte', value });
      return builder;
    },
    gt(field: string, value: unknown) {
      state.filters.push({ field, op: 'gt', value });
      return builder;
    },
    gte(field: string, value: unknown) {
      state.filters.push({ field, op: 'gte', value });
      return builder;
    },
    not(field: string, operator: string, value: unknown) {
      if (operator === 'is' && value === null) {
        state.filters.push({ field, op: 'not_null' });
      }
      return builder;
    },
    order(field: string, options?: { ascending?: boolean }) {
      state.orderBy = { field, ascending: options?.ascending ?? true };
      return builder;
    },
    limit(count: number) {
      state.limitCount = count;
      return builder;
    },
    offset(count: number) {
      state.offsetCount = Math.max(0, count);
      return builder;
    },
    range(from: number, to: number) {
      const start = Math.max(0, from);
      const end = Math.max(start, to);
      state.offsetCount = start;
      state.limitCount = end - start + 1;
      return builder;
    },
    single() {
      state.expectSingle = true;
      state.maybeSingle = false;
      return builder;
    },
    maybeSingle() {
      state.expectSingle = false;
      state.maybeSingle = true;
      return builder;
    },
    then<TResult1 = BackendErrorResult, TResult2 = never>(
      onfulfilled?: ((value: BackendErrorResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return ensureExecution().then(onfulfilled, onrejected);
    },
    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) {
      return ensureExecution().catch(onrejected);
    },
    finally(onfinally?: (() => void) | null) {
      return ensureExecution().finally(onfinally || undefined);
    },
  };

  return builder;
}

type ChannelListener = {
  event: string;
  filter: Record<string, unknown>;
  callback: () => void;
};

function parseRealtimeFilter(rawFilter: unknown): { field: string; op: string; value: string } | null {
  if (typeof rawFilter !== 'string') return null;
  const match = rawFilter.match(/^([a-zA-Z0-9_]+)=([a-zA-Z]+)\.(.+)$/);
  if (!match) return null;
  return { field: match[1], op: match[2], value: match[3] };
}

function eventIncludesCollection(event: RealtimeResponseEvent<unknown>, collectionId: string): boolean {
  return (event.events || []).some((entry) => entry.includes(`.collections.${collectionId}.`));
}

function callbackMatchesEvent(listener: ChannelListener, event: RealtimeResponseEvent<unknown>): boolean {
  const tableName = typeof listener.filter.table === 'string' ? listener.filter.table : '';
  if (!tableName) return true;

  const collectionId = collectionIdForTable(tableName);
  if (!collectionId) return false;
  if (!eventIncludesCollection(event, collectionId)) return false;

  const parsed = parseRealtimeFilter(listener.filter.filter);
  if (!parsed) return true;
  if (parsed.op !== 'eq') return true;

  const payload = (event.payload || {}) as Record<string, unknown>;
  const payloadValue = payload[parsed.field];
  return String(payloadValue) === parsed.value;
}

function createChannel() {
  const listeners: ChannelListener[] = [];
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let realtimeUnsubscribe: (() => void) | null = null;

  const triggerListeners = () => {
    listeners.forEach((listener) => {
      try {
        listener.callback();
      } catch (error) {
        console.error('Channel listener failed:', error);
      }
    });
  };

  const startPollingFallback = () => {
    if (pollTimer) return;
    const interval = Number.isFinite(appwriteConfig.syncPollMs) && appwriteConfig.syncPollMs > 0
      ? Math.max(3000, appwriteConfig.syncPollMs)
      : 7000;

    pollTimer = setInterval(() => {
      triggerListeners();
    }, interval);
  };

  const channel = {
    on(event: string, filter: Record<string, unknown>, callback: () => void) {
      if (typeof callback === 'function') {
        listeners.push({ event, filter, callback });
      }
      return channel;
    },
    subscribe(callback?: (status: string) => void) {
      const client = getRealtimeClient();
      const topics = listeners
        .map((listener) => {
          const tableName = typeof listener.filter.table === 'string' ? listener.filter.table : '';
          const collectionId = tableName ? collectionIdForTable(tableName) : null;
          if (!collectionId || !appwriteConfig.databaseId) return null;
          return `databases.${appwriteConfig.databaseId}.collections.${collectionId}.documents`;
        })
        .filter(Boolean) as string[];

      if (client && topics.length > 0) {
        const uniqueTopics = Array.from(new Set(topics));
        try {
          const subscription = client.subscribe(uniqueTopics, (event) => {
            listeners.forEach((listener) => {
              if (!callbackMatchesEvent(listener, event)) return;
              try {
                listener.callback();
              } catch (error) {
                console.error('Realtime callback failed:', error);
              }
            });
          });

          realtimeUnsubscribe = () => {
            try {
              subscription();
            } catch (error) {
              console.error('Failed to unsubscribe realtime channel:', error);
            }
          };

          callback?.('SUBSCRIBED');
        } catch (error) {
          console.warn('Realtime subscribe failed, falling back to polling.', error);
          startPollingFallback();
          callback?.('SUBSCRIBED');
        }
      } else {
        startPollingFallback();
        callback?.('SUBSCRIBED');
      }

      return channel;
    },
    async track() {
      return { error: null };
    },
    presenceState<T>() {
      return {} as Record<string, T[]>;
    },
    _unsubscribe() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (realtimeUnsubscribe) {
        realtimeUnsubscribe();
        realtimeUnsubscribe = null;
      }
    },
  };

  return channel;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function toStableFileId(path: string): string {
  const safe = path.replace(/[^a-zA-Z0-9]/g, '_');
  const base = safe.slice(-24) || 'file';
  const suffix = hashString(path).slice(0, 10);
  return `f_${base}_${suffix}`.slice(0, 36);
}

function resolveBucketId(bucketName: string): string {
  if (bucketName === 'avatars') return appwriteConfig.buckets.avatars;
  if (bucketName === 'task-attachments') return appwriteConfig.buckets.task_attachments;
  return bucketName;
}

function buildFileViewUrl(bucketId: string, fileId: string): string {
  if (!appwriteConfig.endpointWithVersion) return '';
  if (!appwriteConfig.projectId) return '';
  return `${appwriteConfig.endpointWithVersion}/storage/buckets/${encodePath(bucketId)}/files/${encodePath(fileId)}/view?project=${encodeURIComponent(appwriteConfig.projectId)}`;
}

export const backend = {
  auth: {
    onAuthStateChange(callback: AuthChangeCallback) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => authListeners.delete(callback),
          },
        },
      };
    },
    async getSession() {
      // Avoid /account 401 noise for anonymous visitors before any auth session exists.
      if (isBrowser() && !hasAppwriteSessionCookie() && !shouldProbeAccountOnAuthCallback()) {
        return { data: { session: null as AuthSession | null }, error: null };
      }

      const accountResult = await getCurrentAccount();

      if (accountResult.error) {
        return { data: { session: null as AuthSession | null }, error: accountResult.error };
      }

      if (!accountResult.user) {
        return { data: { session: null as AuthSession | null }, error: null };
      }

      return {
        data: { session: { user: accountResult.user } as AuthSession },
        error: null,
      };
    },
    async signUp(params: {
      email: string;
      password: string;
      options?: {
        emailRedirectTo?: string;
        data?: { full_name?: string };
      };
    }) {
      if (!hasAuthConfig()) {
        return { data: { user: null, session: null }, error: createAuthConfigError() };
      }

      const createResult = await appwriteRequest<AppwriteUser>('/account', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'unique()',
          email: params.email,
          password: params.password,
          name: params.options?.data?.full_name || undefined,
        }),
      });

      if (createResult.error) {
        return { data: { user: null, session: null }, error: createResult.error };
      }

      const signInResult = await backend.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });

      if (!signInResult.error && params.options?.emailRedirectTo) {
        await appwriteRequest('/account/verification', {
          method: 'POST',
          body: JSON.stringify({ url: params.options.emailRedirectTo }),
        });
      }

      return {
        data: {
          user: signInResult.data?.user || (createResult.data ? mapUser(createResult.data) : null),
          session: signInResult.data?.session || null,
        },
        error: null,
      };
    },
    async signInWithPassword(params: { email: string; password: string }) {
      if (!hasAuthConfig()) {
        return { data: { user: null, session: null }, error: createAuthConfigError() };
      }

      const sessionCreateResult = await appwriteRequest('/account/sessions/email', {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          password: params.password,
        }),
      });

      if (sessionCreateResult.error) {
        return { data: { user: null, session: null }, error: sessionCreateResult.error };
      }

      const accountResult = await getCurrentAccount();
      if (accountResult.error || !accountResult.user) {
        return {
          data: { user: null, session: null },
          error: accountResult.error || new Error('Unable to load authenticated account.'),
        };
      }

      const session = { user: accountResult.user } satisfies AuthSession;
      emitAuthChange('SIGNED_IN', session);

      return {
        data: { user: accountResult.user, session },
        error: null,
      };
    },
    async signInWithOAuth(params: {
      provider: string;
      options?: { redirectTo?: string; failureRedirectTo?: string };
    }) {
      if (!hasAuthConfig()) {
        return { data: null, error: createAuthConfigError() };
      }

      if (!isBrowser()) {
        return { data: null, error: new Error('OAuth sign-in is only available in the browser.') };
      }

      const successUrl = params.options?.redirectTo || `${window.location.origin}/auth?oauth=success`;
      const failureUrl = params.options?.failureRedirectTo || `${window.location.origin}/auth?oauth=error`;
      const oauthUrl =
        `${appwriteConfig.endpointWithVersion}/account/sessions/oauth2/${encodePath(params.provider)}` +
        `?project=${encodeURIComponent(appwriteConfig.projectId)}` +
        `&success=${encodeURIComponent(successUrl)}` +
        `&failure=${encodeURIComponent(failureUrl)}`;

      window.location.assign(oauthUrl);
      return { data: { provider: params.provider, url: oauthUrl }, error: null };
    },
    async signOut() {
      if (!hasAuthConfig()) {
        return { error: createAuthConfigError() };
      }

      const result = await appwriteRequest('/account/sessions/current', { method: 'DELETE' });
      if (result.error && result.error.status !== 401) {
        return { error: result.error };
      }

      emitAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  },
  from(table: string) {
    return createQueryBuilder(table);
  },
  rpc() {
    return Promise.resolve({
      data: null,
      error: new Error('RPC is not implemented for Appwrite backend adapter.'),
    });
  },
  channel(_name: string) {
    const channel = createChannel();
    activeChannels.add(channel);
    return channel;
  },
  removeChannel(channel: { _unsubscribe?: () => void }) {
    channel?._unsubscribe?.();
    activeChannels.delete(channel);
  },
  getChannels() {
    return Array.from(activeChannels);
  },
  storage: {
    from(bucketName: string) {
      const bucketId = resolveBucketId(bucketName);

      return {
        async upload(path: string, file: Blob, options?: { upsert?: boolean }) {
          if (!hasAuthConfig()) {
            return { data: null, error: createAuthConfigError() };
          }

          const fileId = toStableFileId(path);

          if (options?.upsert) {
            await appwriteRequest(
              `/storage/buckets/${encodePath(bucketId)}/files/${encodePath(fileId)}`,
              { method: 'DELETE' }
            );
          }

          const formData = new FormData();
          formData.append('fileId', fileId);
          formData.append('file', file);

          const uploadResult = await appwriteRequest(
            `/storage/buckets/${encodePath(bucketId)}/files`,
            {
              method: 'POST',
              body: formData,
            }
          );

          if (uploadResult.error) {
            return { data: null, error: uploadResult.error };
          }

          return { data: uploadResult.data, error: null };
        },
        getPublicUrl(path: string) {
          const fileId = toStableFileId(path);
          return {
            data: {
              publicUrl: buildFileViewUrl(bucketId, fileId),
            },
          };
        },
      };
    },
  },
};
