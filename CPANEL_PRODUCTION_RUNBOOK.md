# TechMigos Workflow - cPanel Production Runbook

This runbook is the exact repeatable process for deploying and operating this project on cPanel with Appwrite.

## 1. Production Topology

- App URL: `https://workflow.techmigos.com`
- Hosting: cPanel Node.js Application
- Node version: `22.x`
- App root (server): `/home/techmigo/apps/techmigos-workflow`
- Node venv activate path: `/home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate`
- Scheduler log file: `/home/techmigo/logs/workflow-scheduler.log`

## 2. One-Time Setup (First Deploy)

### 2.1 Domain and SSL

1. Create subdomain `workflow.techmigos.com` in cPanel Domains.
2. Ensure DNS A record points to the cPanel server IP.
3. Run AutoSSL in cPanel and confirm valid certificate.
4. Use HTTPS only.

### 2.2 Appwrite Platform and Auth

1. In Appwrite Project -> Integrations -> Platforms, add Web platform:
   - Identifier: `workflow.techmigos.com`
2. Also add `www.workflow.techmigos.com` if that URL might be used.
3. Confirm `.env` uses the same Appwrite project ID as that project.
4. If Google OAuth is enabled, ensure Appwrite project/provider is configured in that same project.

### 2.3 cPanel Node App

In cPanel -> Setup Node.js App:

1. Create app in Production mode.
2. Set Node.js version to `22`.
3. App root: `apps/techmigos-workflow`
4. Startup file: `app.js`
5. App URL: `workflow.techmigos.com`

## 3. Server Environment Variables

Set these in server `.env` (or Node app env vars):

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
- All `NEXT_PUBLIC_APPWRITE_COLLECTION_*`
- `APPWRITE_API_KEY`
- `APPWRITE_EMAIL_NOTIFICATIONS_ENABLED=true`
- `NEXT_PUBLIC_APPWRITE_ENABLE_REALTIME=false` (recommended on shared hosting)
- `NEXT_PUBLIC_COMPANY_ACCESS_MODE`
- `NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS`

Stability variables for shared hosting:

- `CIRCLE_NODE_TOTAL=1`
- `NODE_OPTIONS=--max-old-space-size=1536`

## 4. First Deploy Commands

Run on server terminal:

```bash
source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate
cd /home/techmigo/apps/techmigos-workflow
npm install
npm run build
```

If build fails with process spawn limits (`EAGAIN`), run:

```bash
export CIRCLE_NODE_TOTAL=1
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build
```

After successful build:

1. Restart app from cPanel Setup Node.js App.
2. Test routes:
   - `/`
   - `/auth`
   - `/dashboard`

## 5. Scheduler (Cron) Setup

Create logs folder:

```bash
mkdir -p /home/techmigo/logs
```

In cPanel -> Cron Jobs, add:

- Schedule: `*/5 * * * *`
- Command:

```bash
/bin/bash -lc 'source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate && cd /home/techmigo/apps/techmigos-workflow && npm run jobs:schedulers >> /home/techmigo/logs/workflow-scheduler.log 2>&1'
```

Validate immediately:

```bash
/bin/bash -lc 'source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate && cd /home/techmigo/apps/techmigos-workflow && npm run jobs:schedulers >> /home/techmigo/logs/workflow-scheduler.log 2>&1'
tail -n 50 /home/techmigo/logs/workflow-scheduler.log
```

## 6. Email Notification Verification

### 6.1 Provider

In Appwrite -> Messaging -> Providers:

1. Enable an Email provider (SMTP/SendGrid/etc.).
2. Confirm provider is active.

### 6.2 Test Email

```bash
source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate
cd /home/techmigo/apps/techmigos-workflow
npm run jobs:test-email -- m.vinay.sagar21@gmail.com
```

Expected output includes:

- `[email-test] result: { status: 'sent' }`

## 7. Standard Update Procedure (Future Deploys)

Run each release:

```bash
source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate
cd /home/techmigo/apps/techmigos-workflow
git pull origin main
npm install
export CIRCLE_NODE_TOTAL=1
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build
npm run jobs:schedulers
```

Then restart app in cPanel.

## 8. Git Push Workflow (SSH)

Local machine:

```bash
git checkout main
git pull origin main
git add -A
git commit -m "feat: <summary>"
git remote set-url origin git@github.com:Vinay125219/techmigos-workflow.git
git push origin main
```

## 9. Troubleshooting Matrix

### 9.1 OAuth error: `Invalid success param`

Cause: Appwrite does not recognize the request origin.

Fix:

1. Add exact host in Appwrite Web platforms:
   - `workflow.techmigos.com`
   - optionally `www.workflow.techmigos.com`
2. Ensure browser uses `https://workflow.techmigos.com`.
3. Confirm `.env` project ID matches that Appwrite project.
4. Restart app.

### 9.2 Build error: `spawn ... EAGAIN`

Cause: Host process limit.

Fix:

1. Use:
   - `CIRCLE_NODE_TOTAL=1`
   - `NODE_OPTIONS=--max-old-space-size=1536`
2. Re-run build.

### 9.3 Turbopack symlink panic on shared hosting

Cause: Turbopack incompatibility with symlinked `node_modules` layouts.

Fix:

1. Use webpack build script (`next build --webpack`).
2. Rebuild.

### 9.4 Scheduler not running

1. Check cron entry exists.
2. Check log file:
   ```bash
   tail -n 100 /home/techmigo/logs/workflow-scheduler.log
   ```
3. Run scheduler manually to compare output.

### 9.5 Emails not sending

1. Confirm Appwrite Messaging Email provider is active.
2. Confirm `APPWRITE_API_KEY` has messaging write scope.
3. Test with `npm run jobs:test-email -- <email>`.

## 10. Operational Checks (Weekly)

1. Site availability test (`/`, `/auth`, `/dashboard`).
2. Scheduler log review for failures.
3. Appwrite provider/OAuth status check.
4. Dependency/security review:
   - `npm audit`
   - apply targeted upgrades (avoid blind `npm audit fix --force`).

## 11. Recovery / Rollback

If production breaks after deploy:

```bash
source /home/techmigo/nodevenv/apps/techmigos-workflow/22/bin/activate
cd /home/techmigo/apps/techmigos-workflow
git log --oneline -10
git checkout <last_stable_commit>
npm install
export CIRCLE_NODE_TOTAL=1
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build
```

Then restart app from cPanel.
