-- Migration: Allow project creators to delete their own projects
-- Previously only admins could delete projects

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Create new policy that allows both creators and admins to delete
CREATE POLICY "Project creators and admins can delete" ON public.projects 
  FOR DELETE TO authenticated 
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Also update task delete policy to include project creator (for cascade awareness)
-- Tasks belonging to a project deleted by creator should cascade delete automatically
