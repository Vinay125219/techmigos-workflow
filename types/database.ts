// Database types matching the shared backend schema
export type AppRole = 'admin' | 'manager' | 'member';
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type CompanyTransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'salary'
  | 'refund'
  | 'reimbursement'
  | 'investment'
  | 'tax'
  | 'subscription'
  | 'invoice'
  | 'loan'
  | 'grant'
  | 'other';

// Salary types removed

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  designation: string | null;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  // Virtual fields
  member_count?: number;
  project_count?: number;
  owner?: Profile;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  // Virtual fields
  user?: Profile;
  workspace?: Workspace;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: 'planned' | 'active' | 'completed' | 'on-hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date: string | null;
  end_date: string | null;
  progress: number;
  created_by: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields (computed on client)
  task_count?: number;
  completed_tasks?: number;
  creator?: Profile;
  workspace?: Workspace;
}

export interface Task {
  id: string;
  project_id: string | null;
  workspace_id: string | null;
  title: string;
  description: string | null;
  requirements: string | null;
  deliverables: string | null;
  status: 'open' | 'in-progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | null;
  estimated_hours: number | null;
  deadline: string | null;
  skills: string[];
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields
  project?: Project;
  assignee?: Profile;
  creator?: Profile;
  workspace?: Workspace;
}

export interface TaskProgress {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  hours_worked: number;
  progress_percentage: number;
  attachments?: string[];
  created_at: string;
  // Virtual fields
  user?: Profile;
  task?: Task;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: 'open' | 'under-review' | 'approved' | 'rejected' | 'implemented';
  votes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Virtual
  creator?: Profile;
  user_vote?: 'up' | 'down' | null;
}

export interface IdeaVote {
  id: string;
  idea_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface Discussion {
  id: string;
  parent_id: string | null;
  entity_type: 'project' | 'task' | 'idea';
  entity_id: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  // Virtual
  user?: Profile;
  replies?: Discussion[];
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  type: string;
  file_url: string;
  file_size: number;
  status: 'active' | 'draft' | 'archived' | 'reviewed';
  version: number;
  parent_document_id: string | null;
  workspace_id: string | null;
  project_id: string | null;
  task_id: string | null;
  created_by: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields
  creator?: Profile;
  project?: Project;
  task?: Task;
}

export interface WikiPage {
  id: string;
  title: string;
  content: string;
  category: string;
  status: 'published' | 'draft' | 'archived';
  views: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields
  creator?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface UserOnboarding {
  id: string;
  user_id: string;
  completed: boolean;
  steps_completed: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: Task['priority'];
  difficulty: Task['difficulty'];
  estimated_hours: number | null;
  requirements: string | null;
  deliverables: string | null;
  skills: string[];
  project_id: string | null;
  workspace_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTask {
  id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval_value: number;
  next_run_at: string;
  last_run_at: string | null;
  project_id: string | null;
  workspace_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRule {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  required_approvals: number;
  sla_hours: number;
  escalate_to_roles: AppRole[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskApproval {
  id: string;
  task_id: string;
  workspace_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  requested_by: string | null;
  requested_at: string;
  due_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  required_approvals: number;
  approval_count: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  digest_enabled: boolean;
  muted_until: string | null;
  snoozed_until: string | null;
  type_preferences: Record<string, boolean>;
  updated_at: string;
  created_at: string;
}

export interface CompanyTransaction {
  id: string;
  workspace_id: string | null;
  transaction_type: CompanyTransactionType;
  category: string;
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  transaction_date: string;
  reference: string | null;
  paid_by: string | null;
  credited_to: string | null;
  proof_url: string | null;
  proof_type: string | null;
  proof_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleHistory {
  id: string;
  user_id: string;
  changed_by: string | null;
  role: AppRole;
  change_type: 'granted' | 'revoked';
  reason: string | null;
  created_at: string;
}

export interface GovernanceAction {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  requested_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}


// Salary Management Types Removed
