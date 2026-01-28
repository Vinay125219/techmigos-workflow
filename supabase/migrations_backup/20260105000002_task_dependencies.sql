-- Task Dependencies table for linking dependent tasks
-- Allows defining which tasks block or are blocked by other tasks

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (dependency_type IN ('blocks', 'related')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_task_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);

-- Enable RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view task dependencies"
  ON public.task_dependencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create task dependencies"
  ON public.task_dependencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators can delete task dependencies"
  ON public.task_dependencies FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
