-- Migration: Create workspace_members table and workspace helper functions
-- Manages workspace memberships and provides helper functions for RLS

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================

-- Get all workspace IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Check if user is workspace admin
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

-- Check if user owns the workspace
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

-- ============================================
-- Workspace Members RLS Policies
-- ============================================

CREATE POLICY "Members can view workspace members" 
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    OR public.is_workspace_owner(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace owners and admins can add members" 
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace owners and admins can update members" 
  ON public.workspace_members FOR UPDATE
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "Workspace owners, admins, or self can remove members" 
  ON public.workspace_members FOR DELETE
  USING (
    public.is_workspace_owner(auth.uid(), workspace_id)
    OR public.is_workspace_admin(auth.uid(), workspace_id)
    OR user_id = auth.uid()
  );

-- ============================================
-- Workspaces RLS Policies (deferred from 00004)
-- ============================================

CREATE POLICY "Users can view workspaces they are members of" 
  ON public.workspaces FOR SELECT
  USING (
    id IN (SELECT public.get_user_workspace_ids(auth.uid()))
    OR owner_id = auth.uid()
  );

CREATE POLICY "Authenticated users can create workspaces" 
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Workspace owners and admins can update" 
  ON public.workspaces FOR UPDATE
  USING (
    owner_id = auth.uid() 
    OR public.is_workspace_admin(auth.uid(), id)
  );

CREATE POLICY "Only workspace owners can delete" 
  ON public.workspaces FOR DELETE
  USING (owner_id = auth.uid());
