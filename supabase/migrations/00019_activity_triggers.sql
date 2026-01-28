-- Migration: Create activity logging triggers
-- Attaches logging functions to tables

-- Task activity trigger
DROP TRIGGER IF EXISTS task_activity_trigger ON public.tasks;
CREATE TRIGGER task_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();

-- Project activity trigger
DROP TRIGGER IF EXISTS project_activity_trigger ON public.projects;
CREATE TRIGGER project_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_activity();

-- Idea activity trigger
DROP TRIGGER IF EXISTS idea_activity_trigger ON public.ideas;
CREATE TRIGGER idea_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_idea_activity();

-- Discussion activity trigger
DROP TRIGGER IF EXISTS discussion_activity_trigger ON public.discussions;
CREATE TRIGGER discussion_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_discussion_activity();
