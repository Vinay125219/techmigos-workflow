const endpointFromEnv = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim();

const normalizedEndpoint = endpointFromEnv
  ? endpointFromEnv.replace(/\/+$/, '')
  : '';

function normalizeCollectionId(table: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  // Backward-compat: early setups used singular names for some collections.
  if (table === 'company_transactions' && trimmed === 'company_transaction') {
    return 'company_transactions';
  }

  if (table === 'notification_preferences' && trimmed === 'notification_preference') {
    return 'notification_preferences';
  }

  return trimmed;
}

export const appwriteConfig = {
  endpoint: normalizedEndpoint,
  endpointWithVersion: normalizedEndpoint.endsWith('/v1')
    ? normalizedEndpoint
    : `${normalizedEndpoint}/v1`,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() || '',
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim() || '',
  collections: {
    profiles: normalizeCollectionId('profiles', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES?.trim() || 'profiles'),
    user_roles: normalizeCollectionId('user_roles', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ROLES?.trim() || 'user_roles'),
    workspaces: normalizeCollectionId('workspaces', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_WORKSPACES?.trim() || 'workspaces'),
    workspace_members:
      normalizeCollectionId('workspace_members', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_WORKSPACE_MEMBERS?.trim() || 'workspace_members'),
    projects: normalizeCollectionId('projects', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROJECTS?.trim() || 'projects'),
    tasks: normalizeCollectionId('tasks', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASKS?.trim() || 'tasks'),
    task_progress: normalizeCollectionId('task_progress', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_PROGRESS?.trim() || 'task_progress'),
    task_dependencies:
      normalizeCollectionId('task_dependencies', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_DEPENDENCIES?.trim() || 'task_dependencies'),
    task_templates:
      normalizeCollectionId('task_templates', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_TEMPLATES?.trim() || 'task_templates'),
    recurring_tasks:
      normalizeCollectionId('recurring_tasks', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_RECURRING_TASKS?.trim() || 'recurring_tasks'),
    approval_rules:
      normalizeCollectionId('approval_rules', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_APPROVAL_RULES?.trim() || 'approval_rules'),
    task_approvals:
      normalizeCollectionId('task_approvals', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_TASK_APPROVALS?.trim() || 'task_approvals'),
    activity_logs: normalizeCollectionId('activity_logs', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ACTIVITY_LOGS?.trim() || 'activity_logs'),
    notifications: normalizeCollectionId('notifications', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS?.trim() || 'notifications'),
    notification_preferences:
      normalizeCollectionId('notification_preferences', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATION_PREFERENCES?.trim() || 'notification_preferences'),
    documents: normalizeCollectionId('documents', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_DOCUMENTS?.trim() || 'documents'),
    company_transactions:
      normalizeCollectionId('company_transactions', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_COMPANY_TRANSACTIONS?.trim() || 'company_transactions'),
    role_history: normalizeCollectionId('role_history', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ROLE_HISTORY?.trim() || 'role_history'),
    governance_actions:
      normalizeCollectionId('governance_actions', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_GOVERNANCE_ACTIONS?.trim() || 'governance_actions'),
    ideas: normalizeCollectionId('ideas', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_IDEAS?.trim() || 'ideas'),
    idea_votes: normalizeCollectionId('idea_votes', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_IDEA_VOTES?.trim() || 'idea_votes'),
    discussions: normalizeCollectionId('discussions', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_DISCUSSIONS?.trim() || 'discussions'),
    user_onboarding:
      normalizeCollectionId('user_onboarding', process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_USER_ONBOARDING?.trim() || 'user_onboarding'),
  },
  buckets: {
    avatars: process.env.NEXT_PUBLIC_APPWRITE_BUCKET_AVATARS?.trim() || 'avatars',
    task_attachments:
      process.env.NEXT_PUBLIC_APPWRITE_BUCKET_TASK_ATTACHMENTS?.trim() || 'task-attachments',
  },
  syncPollMs: Number(process.env.NEXT_PUBLIC_APPWRITE_SYNC_POLL_MS || 7000),
};

export type BackendCollectionName = keyof typeof appwriteConfig.collections;
