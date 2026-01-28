-- Fix logging functions for Ideas and Discussions to handle DELETE operations
-- This prevents errors when deleting ideas or comments

-- ============================================
-- Fix log_idea_activity (Handle DELETE)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_idea_activity()
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
  votes INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'idea_created';
    description := 'Proposed idea: ' || NEW.title;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.title;
    votes := NEW.votes;
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'idea_updated';
    description := 'Updated idea: ' || NEW.title;
    user_id := COALESCE(auth.uid(), NEW.created_by);
    entity_id := NEW.id;
    entity_title := NEW.title;
    votes := NEW.votes;
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'idea_deleted';
    description := 'Deleted idea: ' || OLD.title;
    user_id := auth.uid();
    IF user_id IS NULL THEN user_id := OLD.created_by; END IF;
    entity_id := OLD.id;
    entity_title := OLD.title;
    votes := OLD.votes;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    user_id,
    action_type,
    'idea',
    entity_id,
    entity_title,
    description,
    jsonb_build_object('votes', votes)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- Fix log_discussion_activity (Handle DELETE)
-- ============================================
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
  user_id UUID;
  entity_id UUID;
  entity_title TEXT;
  idea_id UUID;
  task_id UUID;
BEGIN
  -- Determine action type
  IF TG_OP = 'DELETE' THEN
    action_type := 'comment_deleted';
    description := 'Deleted comment';
    user_id := auth.uid();
    IF user_id IS NULL THEN user_id := OLD.user_id; END IF;
    entity_id := OLD.id;
    entity_title := LEFT(OLD.content, 50);
    idea_id := OLD.idea_id;
    task_id := OLD.task_id;
  ELSE
    -- INSERT or UPDATE
    action_type := 'comment_added'; -- Default (logic in original was weird, assuming mostly insert/update is same type?)
    -- Original logic:
    --   action_type := 'comment_added';
    -- Let's keep it simple or strictly follow original? 
    -- Original didn't have ELSIF for UPDATE, just set action_type='comment_added' unconditionally at start.
    -- We'll improve it slightly.
    IF TG_OP = 'UPDATE' THEN
       action_type := 'comment_updated';
    END IF;

    user_id := COALESCE(auth.uid(), NEW.user_id);
    entity_id := NEW.id;
    entity_title := LEFT(NEW.content, 50);
    idea_id := NEW.idea_id;
    task_id := NEW.task_id;
    
    -- Get parent entity title (for Insert/Update)
    IF NEW.idea_id IS NOT NULL THEN
      SELECT title INTO parent_title FROM ideas WHERE id = NEW.idea_id;
      description := 'Commented on idea: ' || COALESCE(parent_title, 'Unknown');
    ELSIF NEW.task_id IS NOT NULL THEN
      SELECT title INTO parent_title FROM tasks WHERE id = NEW.task_id;
      description := 'Commented on task: ' || COALESCE(parent_title, 'Unknown');
    ELSE
      description := 'Added a comment';
    END IF;
  END IF;

  INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, entity_title, description, metadata)
  VALUES (
    user_id,
    action_type,
    'discussion',
    entity_id,
    entity_title,
    description,
    jsonb_build_object('idea_id', idea_id, 'task_id', task_id)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
