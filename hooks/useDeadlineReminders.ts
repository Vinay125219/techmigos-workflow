import { useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import { useAuth } from '@/contexts/AuthContext';
import { addHours, differenceInHours, parseISO } from 'date-fns';

type DeadlineTask = {
  id: string;
  title: string;
  deadline: string | null;
};

export function useDeadlineReminders() {
  const { user } = useAuth();

  const checkDeadlines = useCallback(async () => {
    if (!user) return;

    try {
      // Get tasks assigned to the user with deadlines
      const { data, error } = await backend
        .from('tasks')
        .select('id, title, deadline, status')
        .eq('assigned_to', user.id)
        .neq('status', 'completed')
        .not('deadline', 'is', null);

      if (error) throw error;

      const tasks = (data ?? []) as DeadlineTask[];
      const now = new Date();
      const in24Hours = addHours(now, 24);

      for (const task of tasks) {
        if (!task.deadline) continue;

        const deadline = parseISO(task.deadline);
        const hoursUntilDeadline = differenceInHours(deadline, now);

        // Check if deadline is within 24 hours and not already past
        if (deadline <= in24Hours && hoursUntilDeadline > 0 && hoursUntilDeadline <= 24) {
          // Check if we already sent a reminder for this task today
          const { data: existingNotif } = await backend
            .from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('entity_id', task.id)
            .eq('type', 'deadline_reminder')
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existingNotif) {
            // Send in-app notification
            await backend.from('notifications').insert({
              user_id: user.id,
              type: 'deadline_reminder',
              title: 'Deadline Approaching',
              message: `"${task.title}" is due in ${hoursUntilDeadline} hours`,
              entity_type: 'task',
              entity_id: task.id,
            });
          }
        }
      }
    } catch (err) {
      console.error('Error checking deadlines:', err);
    }
  }, [user]);

  useEffect(() => {
    // Check deadlines on mount
    checkDeadlines();

    // Check deadlines every hour
    const interval = setInterval(checkDeadlines, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkDeadlines]);

  return { checkDeadlines };
}
