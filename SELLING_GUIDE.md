# 💼 How to Sell & Share "TechMigos ProTask"

This guide explains how to package this application for clients while protecting your personal data and credentials.

## 1. Protecting Your Credentials (CRITICAL)
Your `Supabase` keys and secrets are currently in your `.env.local` file. **NEVER share this file.**

### Before Sending Code to Client:
1.  **Delete `.env.local`**: Ensure this file is NOT included in the zip/transfer.
2.  **Create `.env.example`**: Create a template file so they know what to fill in.
    ```bash
    # .env.example
    NEXT_PUBLIC_SUPABASE_URL=your_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
    ```
3.  **Check `.gitignore`**: Ensure `.env*` is listed in your `.gitignore` file so it doesn't get pushed to GitHub.

## 2. Using "Demo Mode" for Sales
You don't need to give clients access to your database to sell the product.
1.  **Send them the Drop Link**: Deploy the app (e.g., to Vercel) and send them the URL with `/demo`.
    *   Example: `https://your-app.vercel.app/demo`
2.  **Why?**: 
    *   It bypasses login.
    *   It shows "fake" high-quality data (populated in `DemoData.ts`).
    *   It runs the **Product Tour** automatically to show off features.
    *   **Zero Risk**: They cannot mess up your real database.

## 3. Handing Over to a Client
When a client buys the software, they need their own database.

### Step-by-Step Handover:
1.  **Source Code**: Give them the clean code (no `.env.local`).
2.  **Supabase Setup Guide** (See `CLIENT_README.md`):
    *   Tell them to create a **new** Supabase project.
    *   They must run the SQL scripts (provided below) to set up their tables.
3.  **Deployment**:
    *   They connect their GitHub repo to Vercel.
    *   They add *their* Supabase keys to Vercel Environment Variables.

## 4. SQL Scripts for Client Setup
Save this as `schema.sql` in your project so clients can run it in their Supabase SQL Editor.

```sql
-- Profiles Table
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  avatar_url text,
  role user_role default 'member'
);

-- Projects Table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id)
);

-- Tasks Table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text default 'open',
  project_id uuid references public.projects(id),
  assigned_to uuid references public.profiles(id)
);
```

*(Schema and collection setup are now managed through Appwrite setup scripts and `APPWRITE_SCHEMA_CHECKLIST.md`.)*
