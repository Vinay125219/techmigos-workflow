# Flutter + Web Shared Backend Guide (Appwrite)

This project is now multi-client ready: web and Flutter can share the same Appwrite backend, auth session model, collections, and realtime channels.

## 1. Core rule

Do **not** create a separate backend for mobile.
Use the same:

1. `endpoint`
2. `projectId`
3. `databaseId`
4. collection IDs
5. bucket IDs
6. enum strings (`status`, `role`, `priority`, etc.)

## 2. Company policy + role mapping

Company-only access is enforced by allowlist and role mapping:

1. `m.vinay.sagar21@gmail.com` is forced as `admin`
2. `ravali1952@gmail.com` is forced as `manager`
3. Other users must be in company allowlist / provisioned profile

Mirror this behavior in Flutter before login/signup submit to keep UX consistent.

## 3. Flutter dependencies

```yaml
dependencies:
  appwrite: ^13.0.0
```

## 4. Shared config (Flutter)

```dart
class AppwriteConfig {
  static const endpoint = 'https://YOUR_HOST/v1';
  static const projectId = 'YOUR_PROJECT_ID';
  static const databaseId = 'YOUR_DATABASE_ID';

  static const profiles = 'profiles';
  static const userRoles = 'user_roles';
  static const workspaces = 'workspaces';
  static const workspaceMembers = 'workspace_members';
  static const projects = 'projects';
  static const tasks = 'tasks';
  static const taskProgress = 'task_progress';
  static const taskDependencies = 'task_dependencies';
  static const taskTemplates = 'task_templates';
  static const recurringTasks = 'recurring_tasks';
  static const approvalRules = 'approval_rules';
  static const taskApprovals = 'task_approvals';
  static const notifications = 'notifications';
  static const notificationPreferences = 'notification_preferences';
  static const documents = 'documents';
  static const companyTransactions = 'company_transactions';
  static const activityLogs = 'activity_logs';
  static const roleHistory = 'role_history';
  static const governanceActions = 'governance_actions';
  static const ideas = 'ideas';
  static const ideaVotes = 'idea_votes';
  static const discussions = 'discussions';
  static const userOnboarding = 'user_onboarding';

  static const taskAttachmentsBucket = 'task-attachments';
}
```

## 5. Initialize clients

```dart
import 'package:appwrite/appwrite.dart';

final client = Client()
  ..setEndpoint(AppwriteConfig.endpoint)
  ..setProject(AppwriteConfig.projectId);

final account = Account(client);
final databases = Databases(client);
final storage = Storage(client);
final realtime = Realtime(client);
```

## 6. Auth parity requirements

Flutter app must support same flows:

1. Email/password sign in
2. Email/password sign up (company-allowed users only)
3. Google OAuth (same provider in Appwrite)
4. Session restore on app relaunch
5. Sign out across clients

For OAuth:

```dart
await account.createOAuth2Session(
  provider: OAuthProvider.google,
  success: 'myapp://auth/oauth-success',
  failure: 'myapp://auth/oauth-error',
);
```

Add mobile deep links to Appwrite provider configuration.

## 7. Realtime parity requirements

Use the same channels as web:

```dart
final sub = realtime.subscribe([
  'databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.tasks}.documents',
  'databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.projects}.documents',
  'databases.${AppwriteConfig.databaseId}.collections.${AppwriteConfig.notifications}.documents',
]);

sub.stream.listen((event) {
  // refresh local list / invalidate repository cache
});
```

## 8. Workspace-scoped repository pattern (Flutter)

Every main repository method should accept `workspaceId`:

1. `listProjects({workspaceId, page, pageSize, search, status})`
2. `listTasks({workspaceId, ...filters})`
3. `listDocuments({workspaceId, ...})`
4. `listTransactions({workspaceId})` (admin/manager only)

## 9. Transactions feature parity

Admin/Manager only screen in Flutter should use:

1. `company_transactions` for CRUD + list
2. local role check (`admin`/`manager`) for navigation visibility
3. backend permission errors as final authority

## 10. UX alignment instructions for mobile developer

Tell the Flutter developer to mirror these product behaviors:

1. Workspace switcher in top app bar
2. Dashboard cards and task lifecycle statuses
3. Manager approval queue
4. Notifications panel with mute/snooze/digest toggles
5. Document uploads with version tags
6. Transactions page only for Manager/Admin

## 11. Hand-off checklist for mobile developer

Give this checklist directly:

1. Pull `APPWRITE_SCHEMA_CHECKLIST.md`
2. Copy all environment IDs from web `.env`
3. Implement shared enums as constants in Dart
4. Implement company allowlist policy in auth screens
5. Implement realtime listeners for `tasks/projects/notifications`
6. Test with same two privileged emails (admin + manager)
7. Verify workspace scoped filtering in every list endpoint/query
8. Verify transaction page hidden for non-manager roles

## 12. Optional mobile adapter contract

If needed, create a Dart `BackendRepository` interface matching web hooks:

1. `authRepository`
2. `workspaceRepository`
3. `projectRepository`
4. `taskRepository`
5. `notificationRepository`
6. `documentRepository`
7. `transactionRepository`

This keeps feature parity and reduces mismatch risk across clients.
