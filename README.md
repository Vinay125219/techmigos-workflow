# TechMigos Workflow

Next.js web app with Appwrite backend integration.

## Quick Start

1. Copy env template:
```bash
cp .env.example .env.local
```
2. Fill `.env.local` with your Appwrite values.
3. Provision Appwrite schema and buckets:
```bash
npm run appwrite:setup
```
4. Follow backend setup docs:
   - `APPWRITE_SETUP.md`
   - `APPWRITE_SCHEMA_CHECKLIST.md`
5. Run:
```bash
npm run dev
```
6. Open `http://localhost:3000`.

## Backend Documents

1. `APPWRITE_SETUP.md`
2. `APPWRITE_SCHEMA_CHECKLIST.md`
3. `FLUTTER_APPWRITE_STARTER.md`

## Notes

1. Current web adapter uses Appwrite auth/storage and database access via REST.
2. Sync updates in web are polling-based (`NEXT_PUBLIC_APPWRITE_SYNC_POLL_MS`).
3. Flutter can use the same Appwrite project/database for shared cross-platform data.
4. Access policy is configurable with `NEXT_PUBLIC_COMPANY_ACCESS_MODE` (`open` or `allowlist`).
