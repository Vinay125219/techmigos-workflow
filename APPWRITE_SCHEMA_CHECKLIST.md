# Appwrite Schema Checklist

Use this checklist to create Appwrite collections compatible with the current web app and your future Flutter app.

## 1. General Rules

1. Keep collection IDs exactly as shown.
2. Keep field names exactly as shown.
3. Use string IDs for foreign keys (`user_id`, `workspace_id`, `project_id`, etc.).
4. Keep timestamps as ISO datetime strings in fields:
   - `created_at`
   - `updated_at`
5. Add indexes for fields used in filters/sorting.
6. Do not create a custom `id` attribute. The app maps Appwrite document `$id` to `id` at runtime.

## 2. Collections And Fields

### profiles
- `email` string required
- `full_name` string required
- `avatar_url` string optional
- `department` string optional
- `designation` string optional
- `skills` string[] optional
- `created_at` datetime required
- `updated_at` datetime required

### user_roles
- `user_id` string required
- `role` string required (enum in app: `admin`, `manager`, `member`)
- `created_at` datetime required

### workspaces
- `name` string required
- `description` string optional
- `owner_id` string required
- `created_at` datetime required
- `updated_at` datetime required

### workspace_members
- `workspace_id` string required
- `user_id` string required
- `role` string required (app uses: `owner`, `admin`, `member`, `viewer`)
- `created_at` datetime required

### projects
- `name` string required
- `description` string optional
- `status` string required
- `priority` string required
- `start_date` datetime optional
- `end_date` datetime optional
- `progress` integer optional (default `0`)
- `category` string optional
- `workspace_id` string optional
- `created_by` string optional
- `created_at` datetime required
- `updated_at` datetime required

### tasks
- `title` string required
- `description` string optional
- `status` string required
- `priority` string required
- `difficulty` string optional
- `estimated_hours` float optional
- `deadline` datetime optional
- `requirements` string optional
- `deliverables` string optional
- `skills` string[] optional
- `assigned_to` string optional
- `project_id` string optional
- `workspace_id` string optional
- `created_by` string optional
- `created_at` datetime required
- `updated_at` datetime required

### task_progress
- `task_id` string required
- `user_id` string required
- `content` string required
- `hours_worked` float optional
- `progress_percentage` float optional
- `attachments` string[] optional
- `created_at` datetime required

### task_dependencies
- `task_id` string required
- `depends_on_task_id` string required
- `dependency_type` string required (`blocks`, `related`)
- `created_by` string required
- `created_at` datetime required

### activity_logs
- `user_id` string optional
- `action_type` string required
- `entity_type` string required
- `entity_id` string required
- `entity_title` string optional
- `description` string optional
- `metadata` string or json-string field optional
- `created_at` datetime required

### notifications
- `user_id` string required
- `title` string required
- `message` string required
- `type` string required
- `read` boolean optional (default `false`)
- `entity_type` string optional
- `entity_id` string optional
- `created_at` datetime required

### company_transactions
- `workspace_id` string optional
- `transaction_type` string optional (enum in app)
- `category` string required
- `title` string required
- `description` string optional
- `amount` float required
- `currency` string required
- `transaction_date` string required
- `reference` string optional
- `paid_by` string optional
- `credited_to` string optional
- `proof_url` string optional
- `proof_type` string optional
- `proof_name` string optional
- `created_by` string optional
- `created_at` datetime required
- `updated_at` datetime required

### ideas
- `title` string required
- `description` string required
- `category` string optional
- `status` string required
- `votes` integer optional (default `0`)
- `created_by` string optional
- `created_at` datetime required
- `updated_at` datetime required

### idea_votes
- `idea_id` string required
- `user_id` string required
- `vote_type` string required (`up`, `down`)
- `created_at` datetime required

### discussions
- `entity_type` string required
- `entity_id` string required
- `user_id` string required
- `content` string required
- `parent_id` string optional
- `created_at` datetime required
- `updated_at` datetime required

### user_onboarding
- `user_id` string required
- `completed` boolean optional (default `false`)
- `steps_completed` string[] optional
- `created_at` datetime required
- `updated_at` datetime required

## 3. Required Indexes (Minimum)

Create these indexes to match current query patterns:

1. `profiles`: `email`, `created_at`
2. `user_roles`: `user_id`, `role`
3. `workspaces`: `owner_id`, `created_at`
4. `workspace_members`: `workspace_id`, `user_id`, `created_at`
5. `projects`: `workspace_id`, `created_by`, `created_at`
6. `tasks`: `project_id`, `workspace_id`, `assigned_to`, `status`, `deadline`, `created_at`, `updated_at`
7. `task_progress`: `task_id`, `user_id`, `created_at`
8. `task_dependencies`: `task_id`, `depends_on_task_id`, `created_at`
9. `activity_logs`: `user_id`, `entity_type`, `created_at`
10. `notifications`: `user_id`, `read`, `type`, `entity_id`, `created_at`
11. `company_transactions`: `workspace_id`, `transaction_type`, `transaction_date`, `paid_by`, `credited_to`, `created_at`
12. `ideas`: `created_by`, `votes`, `status`, `created_at`
13. `idea_votes`: `idea_id`, `user_id`, `created_at`
14. `discussions`: `entity_type`, `entity_id`, `parent_id`, `created_at`
15. `user_onboarding`: `user_id`

## 4. Permissions (Initial Working Mode)

For fast migration and parity with current app behavior, start with:

1. Read: all authenticated users for most collections.
2. Write: authenticated users for most collections.
3. Tighten later with Appwrite Functions and role checks for admin/manager workflows.

## 5. Storage Buckets

Create buckets:

1. `avatars`
2. `task-attachments`

Give authenticated users upload/read permissions to start, then harden by path ownership later.
