-- Fix Idea and Discussion triggers to fire on DELETE and UPDATE events
-- This ensures the updated logging functions (from previous migration) are actually called

-- ============================================
-- Fix Idea Trigger
-- ============================================
DROP TRIGGER IF EXISTS idea_activity_trigger ON public.ideas;
CREATE TRIGGER idea_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_idea_activity();

-- ============================================
-- Fix Discussion/Comment Trigger
-- ============================================
DROP TRIGGER IF EXISTS discussion_activity_trigger ON public.discussions;
CREATE TRIGGER discussion_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_discussion_activity();
