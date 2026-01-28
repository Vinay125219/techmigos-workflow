# Deployment Guide for Vercel

This project is a Next.js application using Supabase. Follow these steps to deploy it to Vercel.

## 1. Prerequisites

-   A [Vercel](https://vercel.com) account.
-   Access to the [Supabase](https://supabase.com) project associated with this app.

## 2. Environment Variables

When importing the project into Vercel, you must configure the following environment variables. You can find these values in your local `.env.local` file (EXCEPT for the password).

| Variable Name | Description | Verified Safe? |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Anon Key | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_PROJECT_ID` | Your Supabase Project ID | ✅ Yes |

> [!WARNING]
> **DO NOT** add `NEXT_PUBLIC_SUPABASE_DB_PASSWORD` or `TEST_USER_PASSWORD` to your Vercel environment variables. These are not used in the client-side code and exposing them is a security risk.

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
