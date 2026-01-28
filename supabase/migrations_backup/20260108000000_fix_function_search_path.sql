-- Fix function search_path security warnings
-- This prevents search path manipulation attacks

-- Fix log_activity function
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  entity_title TEXT;
  description TEXT;
BEGIN
  -- Determine action type based on operation
  IF TG_OP = 'INSERT' THEN
    action_type := TG_TABLE_NAME || '_created';
    entity_title := COALESCE(NEW.title, NEW.name, NEW.id::text);
    description := 'Created new ' || TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      action_type := TG_TABLE_NAME || '_' || NEW.status;
      description := 'Changed status to ' || NEW.status;
    ELSE
      action_type := TG_TABLE_NAME || '_updated';
      description := 'Updated ' || TG_TABLE_NAME;
    END IF;
    entity_title := COALESCE(NEW.title, NEW.name, NEW.id::text);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := TG_TABLE_NAME || '_deleted';
    entity_title := COALESCE(OLD.title, OLD.name, OLD.id::text);
    description := 'Deleted ' || TG_TABLE_NAME;
  END IF;

  -- Insert activity log
  INSERT INTO activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    entity_title,
    description,
    metadata
  ) VALUES (
    COALESCE(auth.uid(), 
      CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END
    ),
    action_type,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    entity_title,
    description,
    jsonb_build_object('operation', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix log_task_activity function
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'task_created';
    description := 'Created task: ' || NEW.title;
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
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.created_by),
    action_type,
    'task',
    NEW.id,
    NEW.title,
    description,
    jsonb_build_object('status', NEW.status, 'priority', NEW.priority)
  );

  RETURN NEW;
END;
$$;

-- Fix log_project_activity function
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'project_created';
    description := 'Created project: ' || NEW.name;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      action_type := 'project_' || NEW.status;
      description := 'Project status changed to ' || NEW.status || ': ' || NEW.name;
    ELSE
      action_type := 'project_updated';
      description := 'Updated project: ' || NEW.name;
    END IF;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.owner_id),
    action_type,
    'project',
    NEW.id,
    NEW.name,
    description,
    jsonb_build_object('status', NEW.status)
  );

  RETURN NEW;
END;
$$;

-- Fix log_idea_activity function
CREATE OR REPLACE FUNCTION public.log_idea_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'idea_created';
    description := 'Proposed idea: ' || NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'idea_updated';
    description := 'Updated idea: ' || NEW.title;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.created_by),
    action_type,
    'idea',
    NEW.id,
    NEW.title,
    description,
    jsonb_build_object('votes', NEW.votes)
  );

  RETURN NEW;
END;
$$;

-- Fix log_discussion_activity function
CREATE OR REPLACE FUNCTION public.log_discussion_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_type TEXT;
  description TEXT;
  parent_title TEXT;
BEGIN
  action_type := 'comment_added';
  
  -- Get parent entity title
  IF NEW.idea_id IS NOT NULL THEN
    SELECT title INTO parent_title FROM ideas WHERE id = NEW.idea_id;
    description := 'Commented on idea: ' || COALESCE(parent_title, 'Unknown');
  ELSIF NEW.task_id IS NOT NULL THEN
    SELECT title INTO parent_title FROM tasks WHERE id = NEW.task_id;
    description := 'Commented on task: ' || COALESCE(parent_title, 'Unknown');
  ELSE
    description := 'Added a comment';
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    COALESCE(auth.uid(), NEW.user_id),
    action_type,
    'discussion',
    NEW.id,
    LEFT(NEW.content, 50),
    description,
    jsonb_build_object('idea_id', NEW.idea_id, 'task_id', NEW.task_id)
  );

  RETURN NEW;
END;
$$;
