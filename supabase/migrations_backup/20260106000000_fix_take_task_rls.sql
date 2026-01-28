-- Fix: Allow any authenticated user to "Take Task" on open, unassigned tasks
-- This resolves the "Cannot coerce the result to a single JSON object" error
-- that occurs when non-creator, non-admin users try to assign themselves to available tasks

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Task owners and assigned users can update" ON public.tasks;

-- Create new policy that allows:
-- 1. Task creators to update their tasks
-- 2. Currently assigned users to update their tasks
-- 3. Any authenticated user to "take" an open, unassigned task
-- 4. Admins to update any task
CREATE POLICY "Task owners, assignees, and takers can update" ON public.tasks 
FOR UPDATE TO authenticated 
USING (
  -- Creator can always update
  created_by = auth.uid() 
  -- Currently assigned user can update
  OR assigned_to = auth.uid() 
  -- Admins can update any task
  OR public.is_admin(auth.uid())
  -- Anyone can "take" an open unassigned task
  OR (status = 'open' AND assigned_to IS NULL)
);
