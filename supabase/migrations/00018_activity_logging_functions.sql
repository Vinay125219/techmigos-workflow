-- Migration: Create activity logging functions
-- Functions for logging activities from triggers
-- FIXED: Uses entity_type/entity_id instead of non-existent idea_id/task_id

-- ============================================
-- Task Activity Logging
-- ============================================
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type TEXT;
  v_description TEXT;
  v_user_id UUID;
  v_entity_id UUID;
  v_entity_title TEXT;
  v_task_status TEXT;
  v_task_priority TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'task_created';
    v_description := 'Created task: ' || NEW.title;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.title;
    v_task_status := NEW.status;
    v_task_priority := NEW.priority;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action_type := 'task_' || NEW.status;
      v_description := 'Task moved to ' || NEW.status || ': ' || NEW.title;
    ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      v_action_type := 'task_assigned';
      v_description := 'Task assigned: ' || NEW.title;
    ELSE
      v_action_type := 'task_updated';
      v_description := 'Updated task: ' || NEW.title;
    END IF;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.title;
    v_task_status := NEW.status;
    v_task_priority := NEW.priority;
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'task_deleted';
    v_description := 'Deleted task: ' || OLD.title;
    v_user_id := COALESCE(auth.uid(), OLD.created_by);
    v_entity_id := OLD.id;
    v_entity_title := OLD.title;
    v_task_status := OLD.status;
    v_task_priority := OLD.priority;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    v_user_id,
    v_action_type,
    'task',
    v_entity_id,
    v_entity_title,
    v_description,
    jsonb_build_object('status', v_task_status, 'priority', v_task_priority)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Project Activity Logging
-- ============================================
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type TEXT;
  v_description TEXT;
  v_user_id UUID;
  v_entity_id UUID;
  v_entity_title TEXT;
  v_project_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'project_created';
    v_description := 'Created project: ' || NEW.name;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.name;
    v_project_status := NEW.status;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action_type := 'project_' || NEW.status;
      v_description := 'Project status changed to ' || NEW.status || ': ' || NEW.name;
    ELSE
      v_action_type := 'project_updated';
      v_description := 'Updated project: ' || NEW.name;
    END IF;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.name;
    v_project_status := NEW.status;
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'project_deleted';
    v_description := 'Deleted project: ' || OLD.name;
    v_user_id := COALESCE(auth.uid(), OLD.created_by);
    v_entity_id := OLD.id;
    v_entity_title := OLD.name;
    v_project_status := OLD.status;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    v_user_id,
    v_action_type,
    'project',
    v_entity_id,
    v_entity_title,
    v_description,
    jsonb_build_object('status', v_project_status)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Idea Activity Logging
-- ============================================
CREATE OR REPLACE FUNCTION public.log_idea_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type TEXT;
  v_description TEXT;
  v_user_id UUID;
  v_entity_id UUID;
  v_entity_title TEXT;
  v_votes INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'idea_created';
    v_description := 'Proposed idea: ' || NEW.title;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.title;
    v_votes := NEW.votes;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'idea_updated';
    v_description := 'Updated idea: ' || NEW.title;
    v_user_id := COALESCE(auth.uid(), NEW.created_by);
    v_entity_id := NEW.id;
    v_entity_title := NEW.title;
    v_votes := NEW.votes;
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'idea_deleted';
    v_description := 'Deleted idea: ' || OLD.title;
    v_user_id := COALESCE(auth.uid(), OLD.created_by);
    v_entity_id := OLD.id;
    v_entity_title := OLD.title;
    v_votes := OLD.votes;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    v_user_id,
    v_action_type,
    'idea',
    v_entity_id,
    v_entity_title,
    v_description,
    jsonb_build_object('votes', v_votes)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Discussion Activity Logging (FIXED)
-- Uses entity_type and entity_id properly
-- ============================================
CREATE OR REPLACE FUNCTION public.log_discussion_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_type TEXT;
  v_description TEXT;
  v_parent_title TEXT;
  v_user_id UUID;
  v_entity_id UUID;
  v_entity_title TEXT;
  v_entity_type TEXT;
  v_ref_entity_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action_type := 'comment_deleted';
    v_description := 'Deleted comment';
    v_user_id := COALESCE(auth.uid(), OLD.user_id);
    v_entity_id := OLD.id;
    v_entity_title := LEFT(OLD.content, 50);
    v_entity_type := OLD.entity_type;
    v_ref_entity_id := OLD.entity_id;
  ELSE
    -- INSERT or UPDATE
    IF TG_OP = 'UPDATE' THEN
      v_action_type := 'comment_updated';
    ELSE
      v_action_type := 'comment_added';
    END IF;

    v_user_id := COALESCE(auth.uid(), NEW.user_id);
    v_entity_id := NEW.id;
    v_entity_title := LEFT(NEW.content, 50);
    v_entity_type := NEW.entity_type;
    v_ref_entity_id := NEW.entity_id;
    
    -- Get parent entity title based on entity_type
    IF NEW.entity_type = 'idea' THEN
      SELECT title INTO v_parent_title FROM ideas WHERE id = NEW.entity_id;
      v_description := 'Commented on idea: ' || COALESCE(v_parent_title, 'Unknown');
    ELSIF NEW.entity_type = 'task' THEN
      SELECT title INTO v_parent_title FROM tasks WHERE id = NEW.entity_id;
      v_description := 'Commented on task: ' || COALESCE(v_parent_title, 'Unknown');
    ELSIF NEW.entity_type = 'project' THEN
      SELECT name INTO v_parent_title FROM projects WHERE id = NEW.entity_id;
      v_description := 'Commented on project: ' || COALESCE(v_parent_title, 'Unknown');
    ELSE
      v_description := 'Added a comment';
    END IF;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    v_user_id,
    v_action_type,
    'discussion',
    v_entity_id,
    v_entity_title,
    v_description,
    jsonb_build_object('parent_entity_type', v_entity_type, 'parent_entity_id', v_ref_entity_id)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
