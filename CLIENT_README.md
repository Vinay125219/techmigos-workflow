# TechMigos ProTask - Setup Guide

Welcome to your new Project Management System. Follow these steps to get up and running.

## 1. Prerequisites
-   **Node.js**: Install Node.js (v18 or higher).
-   **Supabase Account**: You need a free account at [supabase.com](https://supabase.com).

## 2. Installation
1.  Unzip the project folder.
2.  Open a terminal in the folder.
3.  Run:
    ```bash
    npm install
    ```

## 3. Database Setup (Supabase)
1.  Create a new Project on Supabase.
2.  Go to **Project Settings -> API** to find your URL and ANON KEY.
3.  Go to the **SQL Editor** in the side menu.
4.  Copy/Paste the contents of `schema.sql` (if provided) or ask the developer for the migration scripts.

## 4. Configuration
1.  Rename `.env.example` to `.env.local`.
2.  Open `.env.local` and paste your Supabase keys:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
    ```

## 5. Running the App
Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 6. Features Overview
-   **Dashboard**: High-level view of your projects.
-   **Tasks**: Kanban board and list view.
-   **Demo Mode**: Visit `/demo` to train your staff without affecting real data.
