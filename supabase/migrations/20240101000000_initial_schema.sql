-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create Enums
create type public.app_role as enum ('admin', 'manager', 'member');
create type public.salary_period_status as enum ('draft', 'review', 'finalized', 'paid');
create type public.salary_record_status as enum ('pending', 'review', 'approved', 'disputed', 'paid');

-- Create Tables

-- PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text not null,
  full_name text,
  avatar_url text,
  department text,
  designation text,
  skills text[],
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.profiles enable row level security;

-- WORKSPACES
create table public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.workspaces enable row level security;

-- WORKSPACE MEMBERS
create table public.workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' not null,
  created_at timestamptz default now() not null,
  unique(workspace_id, user_id)
);
alter table public.workspace_members enable row level security;

-- PROJECTS
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  status text default 'planning' not null,
  priority text default 'medium' not null,
  start_date timestamptz,
  end_date timestamptz,
  progress integer default 0,
  category text,
  workspace_id uuid references public.workspaces(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.projects enable row level security;

-- TASKS
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  status text default 'open' not null,
  priority text default 'medium' not null,
  difficulty text,
  estimated_hours numeric,
  deadline timestamptz,
  requirements text,
  deliverables text,
  skills text[],
  assigned_to uuid references public.profiles(id),
  project_id uuid references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.tasks enable row level security;

-- TASK PROGRESS
create table public.task_progress (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  hours_worked numeric,
  progress_percentage numeric,
  attachments text[],
  created_at timestamptz default now() not null
);
alter table public.task_progress enable row level security;

-- TASK DEPENDENCIES
create table public.task_dependencies (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  depends_on_task_id uuid references public.tasks(id) on delete cascade not null,
  dependency_type text default 'blocks' not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  unique(task_id, depends_on_task_id)
);
alter table public.task_dependencies enable row level security;

-- ACTIVITY LOGS
create table public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  entity_title text,
  description text,
  metadata jsonb,
  created_at timestamptz default now() not null
);
alter table public.activity_logs enable row level security;

-- NOTIFICATIONS
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  message text not null,
  type text not null,
  read boolean default false not null,
  entity_type text,
  entity_id text,
  created_at timestamptz default now() not null
);
alter table public.notifications enable row level security;

-- IDEAS
create table public.ideas (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  category text,
  status text default 'new' not null,
  votes integer default 0 not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.ideas enable row level security;

-- IDEA VOTES
create table public.idea_votes (
  id uuid default uuid_generate_v4() primary key,
  idea_id uuid references public.ideas(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  vote_type text not null,
  created_at timestamptz default now() not null,
  unique(idea_id, user_id)
);
alter table public.idea_votes enable row level security;

-- DISCUSSIONS
create table public.discussions (
  id uuid default uuid_generate_v4() primary key,
  entity_type text not null,
  entity_id uuid not null, -- generic text in types, assuming uuid for FKs usually, but kept simple
  user_id uuid references public.profiles(id) not null,
  content text not null,
  parent_id uuid references public.discussions(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
alter table public.discussions enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.app_role default 'member'::public.app_role not null,
  created_at timestamptz default now() not null,
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- USER ONBOARDING
create table public.user_onboarding (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  completed boolean default false not null,
  steps_completed text[],
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id)
);
alter table public.user_onboarding enable row level security;

-- FUNCTIONS

-- Handle new user signup (Trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  -- Assign default role
  insert into public.user_roles (user_id, role)
  values (new.id, 'member');
  
  -- Create onboarding record
  insert into public.user_onboarding (user_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Utility Functions
create or replace function public.is_admin(_user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'admin'
  );
end;
$$ language plpgsql security definer;

create or replace function public.has_role(_role public.app_role, _user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
end;
$$ language plpgsql security definer;

create or replace function public.get_user_workspace_ids(_user_id uuid)
returns uuid[] as $$
begin
  return array(
    select workspace_id from public.workspace_members where user_id = _user_id
    union
    select id from public.workspaces where owner_id = _user_id
  );
end;
$$ language plpgsql security definer;

-- BASIC POLICIES (Allow authenticated access for development speed, restrict later)
create policy "Allow all for authenticated" on public.profiles for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.projects for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.tasks for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.workspaces for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.workspace_members for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.task_progress for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.task_dependencies for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.activity_logs for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.notifications for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.ideas for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.idea_votes for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.discussions for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.user_roles for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on public.user_onboarding for all using (auth.role() = 'authenticated');

-- Storage Bucket Setup (if possible via migration, usually via API/Dashboard, but we can insert into storage.buckets if using standard Supabase storage schema)
insert into storage.buckets (id, name, public) 
values ('task-attachments', 'task-attachments', true)
on conflict (id) do nothing;

create policy "Public Access" on storage.objects for select using ( bucket_id = 'task-attachments' );
create policy "Auth Upload" on storage.objects for insert with check ( bucket_id = 'task-attachments' and auth.role() = 'authenticated' );
