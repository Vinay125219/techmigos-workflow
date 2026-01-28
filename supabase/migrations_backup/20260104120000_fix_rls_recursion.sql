-- Fix RLS infinite recursion for workspace_members
-- The issue is that workspace_members policies reference workspace_members in subqueries
-- This creates a recursive policy check that Supabase cannot resolve

-- Create a security definer function to check workspace membership
-- This bypasses RLS when checking membership, breaking the recursion cycle
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Create a function to check if user is workspace owner or admin
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE user_id = _user_id 
    AND workspace_id = _workspace_id 
    AND role IN ('owner', 'admin')
  )
$$;

-- Create a function to check if user owns the workspace
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = _workspace_id 
    AND owner_id = _user_id
  )
$$;

-- Drop existing workspace_members policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can remove members" ON public.workspace_members;

-- Recreate policies using security definer functions (no recursion)
CREATE POLICY "Members can view workspace members" ON public.workspace_members FOR SELECT
USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR public.is_workspace_owner(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners and admins can add members" ON public.workspace_members FOR INSERT
WITH CHECK (
  public.is_workspace_owner(auth.uid(), workspace_id)
  OR public.is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners and admins can update members" ON public.workspace_members FOR UPDATE
USING (
  public.is_workspace_owner(auth.uid(), workspace_id)
  OR public.is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Workspace owners and admins can remove members" ON public.workspace_members FOR DELETE
USING (
  public.is_workspace_owner(auth.uid(), workspace_id)
  OR public.is_workspace_admin(auth.uid(), workspace_id)
  OR user_id = auth.uid()
);

-- Also fix workspaces policies that reference workspace_members
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners and admins can update" ON public.workspaces;

CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces FOR SELECT
USING (
  id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR owner_id = auth.uid()
);

CREATE POLICY "Workspace owners and admins can update" ON public.workspaces FOR UPDATE
USING (
  owner_id = auth.uid() 
  OR public.is_workspace_admin(auth.uid(), id)
);

-- Fix projects policies
DROP POLICY IF EXISTS "Projects viewable by workspace members or public" ON public.projects;
CREATE POLICY "Projects viewable by workspace members or public" ON public.projects FOR SELECT
USING (
  workspace_id IS NULL 
  OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR public.is_workspace_owner(auth.uid(), workspace_id)
);

-- Fix tasks policies
DROP POLICY IF EXISTS "Tasks viewable by workspace members or public" ON public.tasks;
CREATE POLICY "Tasks viewable by workspace members or public" ON public.tasks FOR SELECT
USING (
  workspace_id IS NULL 
  OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR public.is_workspace_owner(auth.uid(), workspace_id)
);
