# Appwrite Backend Setup (Web + Future Flutter)

This project now uses Appwrite through `integrations/backend/client.ts`.

Use this runbook in order.

## 1. Create Appwrite Project

1. Open Appwrite Console.
2. Create a new project.
3. Add a Web platform:
   - Name: `techmigos-web`
   - Hostname: your web domain
   - For local: add `localhost` domain for `http://localhost:3000`

## 2. Enable Auth

1. Go to `Auth -> Settings` and enable email/password auth.
2. Go to `Auth -> Providers -> OAuth2`.
3. Enable Google provider.
4. Configure callback URLs:
   - `http://localhost:3000/auth?oauth=success`
   - `http://localhost:3000/auth?oauth=error`
   - `http://localhost:3001/auth?oauth=success`
   - `http://localhost:3001/auth?oauth=error`
   - `https://YOUR_WEB_DOMAIN/auth?oauth=success`
   - `https://YOUR_WEB_DOMAIN/auth?oauth=error`
5. Reserve mobile deep link callbacks for future Flutter app:
   - `myapp://auth/oauth-success`
   - `myapp://auth/oauth-error`
6. In Google Cloud Console, open the OAuth client used by Appwrite and add this exact Authorized redirect URI:
   - `https://fra.cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/6996e6ab000c486879ce`
7. Save Google OAuth settings and wait 2-5 minutes for propagation.
8. Ensure the Google `Client ID` and `Client Secret` entered in Appwrite Google provider match the same OAuth client.

## 3. Configure Environment

1. Copy `.env.example` to `.env.local` (or use `.env`).
2. Fill all `NEXT_PUBLIC_APPWRITE_*` values.
3. Add `APPWRITE_API_KEY` (must include database/storage scopes).  
   If you are already logged in with `appwrite login`, API key is optional.

Required keys are defined in:

1. `.env.example`
2. `integrations/backend/config.ts`

## 4. Provision Database, Collections, Indexes, Buckets

Run the one-shot setup:

```bash
npm run appwrite:setup
```

Optional preview without applying changes:

```bash
npm run appwrite:setup:dry-run
```

This script creates:

1. Database (`NEXT_PUBLIC_APPWRITE_DATABASE_ID`)
2. All collections used by the app
3. Required attributes and indexes
4. Storage buckets (`avatars`, `task-attachments`)
5. Initial authenticated-user permissions

## 5. Auth Providers and Callbacks

1. Configure OAuth providers (for example Google) in Appwrite Console.
2. Add callback URLs:
   - `http://localhost:3000/auth?oauth=success`
   - `http://localhost:3000/auth?oauth=error`
   - `http://localhost:3001/auth?oauth=success`
   - `http://localhost:3001/auth?oauth=error`
   - `https://YOUR_WEB_DOMAIN/auth?oauth=success`
   - `https://YOUR_WEB_DOMAIN/auth?oauth=error`
3. Keep mobile callbacks reserved for Flutter:
   - `myapp://auth/oauth-success`
   - `myapp://auth/oauth-error`

## 6. Run And Verify

1. Start app: `npm run dev`
2. Open `/auth`.
3. Test email signup/signin.
4. Test Google signin.
5. Create a workspace and task to validate database writes.
6. Upload an avatar or task attachment to validate storage buckets.

## 7. Schedule Backend Jobs

Recurring task materialization, approval escalations, and daily digest generation must run on a backend scheduler, not in browser tabs.

Run command:

```bash
npm run jobs:schedulers
```

Recommended production setup:

1. Trigger this command from a server cron (for example every 5 minutes for recurring/escalation coverage).
2. Ensure environment includes:
   - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
   - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
   - `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
   - `APPWRITE_API_KEY`
3. Use an Appwrite API key with database read/write permissions for task, approval, notification, recurring task, workspace, and preference collections.

## 8. Future Flutter Reuse

For Android Flutter app later, reuse the same:

1. Appwrite endpoint
2. Project ID
3. Database ID
4. Collection IDs
5. Bucket IDs
6. Auth provider configuration

Flutter setup starter:

1. `FLUTTER_APPWRITE_STARTER.md`

Schema reference:

1. `APPWRITE_SCHEMA_CHECKLIST.md`

Notes:

1. Current web adapter does not require Appwrite Cloud Functions for core auth/data flow.
