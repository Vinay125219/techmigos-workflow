# Deployment Guide for Vercel

This project is a Next.js application using Appwrite. Follow these steps to deploy it to Vercel.

## 1. Prerequisites

-   A [Vercel](https://vercel.com) account.
-   Access to the Appwrite project associated with this app.

## 2. Environment Variables

When importing the project into Vercel, configure these environment variables from `.env.local`.

| Variable Name | Description | Verified Safe? |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Appwrite endpoint with `/v1` | ✅ Yes |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite project ID | ✅ Yes |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Appwrite database ID | ✅ Yes |
| `NEXT_PUBLIC_APPWRITE_COLLECTION_*` | Collection IDs used by app | ✅ Yes |
| `NEXT_PUBLIC_APPWRITE_BUCKET_*` | Storage bucket IDs | ✅ Yes |

> [!WARNING]
> Do not add private admin or API keys to `NEXT_PUBLIC_*` variables.

## 3. Build Configuration

Vercel should automatically detect the framework, but verify these settings:

-   **Framework Preset**: Next.js
-   **Build Command**: `next build` (or `npm run build`)
-   **Output Directory**: `.next` (default)
-   **Install Command**: `npm install` (default)

## 4. Deploy

1.  Push your code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the repository in Vercel.
3.  Add the environment variables listed above.
4.  Click **Deploy**.

## 5. Post-Deploy Checks

1.  Open `/auth` and test email sign-in.
2.  Test Google OAuth sign-in.
3.  Create a workspace and a task to verify database writes.
