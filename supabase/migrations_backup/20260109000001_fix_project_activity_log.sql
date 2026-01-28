-- Fix log_project_activity function: projects table uses created_by, not owner_id

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
    COALESCE(auth.uid(), NEW.created_by),
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
