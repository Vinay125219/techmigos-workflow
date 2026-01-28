-- Activity Logs table for tracking website activity
-- Logs all important actions: task updates, project changes, comments, etc.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'task_created', 'task_updated', 'task_completed', 'project_created', 'task_assigned', etc.
  entity_type TEXT NOT NULL, -- 'task', 'project', 'idea', 'comment'
  entity_id UUID NOT NULL,
  entity_title TEXT, -- Store title for quick display
  description TEXT, -- Human-readable description of the action
  metadata JSONB DEFAULT '{}', -- Additional data (old values, new values, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON public.activity_logs(action_type);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view activity logs
CREATE POLICY "Authenticated users can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Only system/triggers can insert (we'll use service role or triggers)
CREATE POLICY "Service role can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- Function to log activity (called from triggers or application)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (p_user_id, p_action_type, p_entity_type, p_entity_id, p_entity_title, p_description, p_metadata)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ... (previous content)

-- Trigger function to auto-log task changes
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.created_by,
      'task_created',
      'task',
      NEW.id,
      NEW.title,
      'Created task: ' || NEW.title,
      jsonb_build_object('status', NEW.status, 'priority', NEW.priority)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM public.log_activity(
        auth.uid(),
        'task_' || NEW.status,
        'task',
        NEW.id,
        NEW.title,
        'Task status changed to ' || NEW.status,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.log_activity(
        NEW.assigned_to,
        'task_assigned',
        'task',
        NEW.id,
        NEW.title,
        'Task assigned',
        jsonb_build_object('assigned_to', NEW.assigned_to)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      auth.uid(),
      'task_deleted',
      'task',
      OLD.id,
      OLD.title,
      'Deleted task: ' || OLD.title,
      jsonb_build_object('final_status', OLD.status)
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_activity_trigger ON public.tasks;
CREATE TRIGGER task_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();

-- Trigger function to auto-log project changes
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.created_by,
      'project_created',
      'project',
      NEW.id,
      NEW.name,
      'Created project: ' || NEW.name,
      jsonb_build_object('status', NEW.status, 'category', NEW.category)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM public.log_activity(
        auth.uid(),
        'project_' || NEW.status,
        'project',
        NEW.id,
        NEW.name,
        'Project status changed to ' || NEW.status,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      auth.uid(),
      'project_deleted',
      'project',
      OLD.id,
      OLD.name,
      'Deleted project: ' || OLD.name,
      jsonb_build_object('final_status', OLD.status)
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS project_activity_trigger ON public.projects;
CREATE TRIGGER project_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_activity();

-- Trigger for Ideas
CREATE OR REPLACE FUNCTION public.log_idea_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.created_by,
      'idea_created',
      'idea',
      NEW.id,
      NEW.title,
      'New idea proposed: ' || NEW.title,
      jsonb_build_object('category', NEW.category)
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS idea_activity_trigger ON public.ideas;
CREATE TRIGGER idea_activity_trigger
  AFTER INSERT ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_idea_activity();

-- Trigger for comments/discussions
CREATE OR REPLACE FUNCTION public.log_discussion_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      NEW.user_id,
      'comment_added',
      NEW.entity_type,
      NEW.entity_id,
      NULL, -- Cannot easily get title here without join, but that's fine
      'Added a comment',
      jsonb_build_object('content_preview', substring(NEW.content from 1 for 50))
    );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS discussion_activity_trigger ON public.discussions;
CREATE TRIGGER discussion_activity_trigger
  AFTER INSERT ON public.discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_discussion_activity();
