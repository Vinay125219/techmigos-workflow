-- Fix logging functions to handle DELETE operations
-- This prevents errors when deleting projects or tasks

-- ============================================
-- Fix log_project_activity (Handle DELETE)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
  user_id UUID;
  entity_id UUID;
  entity_title TEXT;
  project_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'project_created';
    description := 'Created project: ' || NEW.name;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.name;
    project_status := NEW.status;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      action_type := 'project_' || NEW.status;
      description := 'Project status changed to ' || NEW.status || ': ' || NEW.name;
    ELSE
      action_type := 'project_updated';
      description := 'Updated project: ' || NEW.name;
    END IF;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.name;
    project_status := NEW.status;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'project_deleted';
    description := 'Deleted project: ' || OLD.name;
    user_id := auth.uid(); -- Can't use created_by from OLD accurately if user deleted their own project? Or use OLD.created_by?
    -- If auth.uid() is null (e.g. system delete), try OLD.created_by
    IF user_id IS NULL THEN user_id := OLD.created_by; END IF;
    entity_id := OLD.id;
    entity_title := OLD.name;
    project_status := OLD.status;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    user_id,
    action_type,
    'project',
    entity_id,
    entity_title,
    description,
    jsonb_build_object('status', project_status)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Fix log_task_activity (Handle DELETE)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
  user_id UUID;
  entity_id UUID;
  entity_title TEXT;
  task_status TEXT;
  task_priority TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'task_created';
    description := 'Created task: ' || NEW.title;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.title;
    task_status := NEW.status;
    task_priority := NEW.priority;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      action_type := 'task_' || NEW.status;
      description := 'Task moved to ' || NEW.status || ': ' || NEW.title;
    ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      action_type := 'task_assigned';
      description := 'Task assigned: ' || NEW.title;
    ELSE
      action_type := 'task_updated';
      description := 'Updated task: ' || NEW.title;
    END IF;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.title;
    task_status := NEW.status;
    task_priority := NEW.priority;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'task_deleted';
    description := 'Deleted task: ' || OLD.title;
    user_id := auth.uid();
    IF user_id IS NULL THEN user_id := OLD.created_by; END IF;
    entity_id := OLD.id;
    entity_title := OLD.title;
    task_status := OLD.status;
    task_priority := OLD.priority;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    user_id,
    action_type,
    'task',
    entity_id,
    entity_title,
    description,
    jsonb_build_object('status', task_status, 'priority', task_priority)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
