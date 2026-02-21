# TechMigos ProTask - Setup Guide

Welcome to your new Project Management System. Follow these steps to get up and running.

## 1. Prerequisites
-   **Node.js**: Install Node.js (v18 or higher).
-   **Appwrite Project**: Create an Appwrite project (cloud or self-hosted).

## 2. Installation
1.  Unzip the project folder.
2.  Open a terminal in the folder.
3.  Run:
    ```bash
    npm install
    ```

## 3. Backend Setup (Appwrite)
1.  Follow `APPWRITE_SETUP.md`.
2.  Create collections/fields from `APPWRITE_SCHEMA_CHECKLIST.md`.
3.  Configure Google sign-in callback URLs in Appwrite Console.

## 4. Configuration
1.  Copy `.env.example` to `.env.local`.
2.  Open `.env.local` and fill your Appwrite values:
    ```
    NEXT_PUBLIC_APPWRITE_ENDPOINT=https://your-appwrite-host/v1
    NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
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

## 7. Future Flutter App

Use the same Appwrite project/database for Flutter:

-   See `FLUTTER_APPWRITE_STARTER.md`.
