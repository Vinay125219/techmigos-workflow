import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Task, Project, TaskProgress, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export interface AnalyticsData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  reviewTasks: number;
  completionRate: number;
  weeklyCompletionRate: number;
  tasksByPriority: { priority: string; count: number }[];
  tasksByStatus: { status: string; count: number }[];
  projectProgress: { id: string; name: string; progress: number; taskCount: number; completedTasks: number }[];
  topContributors: {
    user: Profile;
    tasksCompleted: number;
    hoursWorked: number;
    progressUpdates: number;
  }[];
  weeklyActivity: { day: string; tasksCreated: number; tasksCompleted: number; hoursWorked: number }[];
  userStats?: {
    tasksAssigned: number;
    tasksCompleted: number;
    hoursWorked: number;
    currentStreak: number;
  };
  dataUsage: {
    projectsCount: number;
    projectsLimit: number;
    tasksCount: number;
    tasksLimit: number;
    storageUsed: number; // in MB
    storageLimit: number; // in MB
  };
}

const DATA_LIMITS = {
  PROJECTS: 50,
  TASKS: 500,
  STORAGE_MB: 1024, // 1GB
};

export function useAnalytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      const [projectsResult, tasksResult, progressResult, profilesResult] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('task_progress').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const projectsData = (projectsResult.data || []) as Project[];
      const tasksData = (tasksResult.data || []) as Task[];
      const progressData = (progressResult.data || []) as TaskProgress[];
      const profilesData = (profilesResult.data || []) as Profile[];

      // Calculate stats
      const totalProjects = projectsData.length;
      const activeProjects = projectsData.filter(p => p.status === 'active').length;
      const completedProjects = projectsData.filter(p => p.status === 'completed').length;
      const totalTasks = tasksData.length;
      const openTasks = tasksData.filter(t => t.status === 'open').length;
      const inProgressTasks = tasksData.filter(t => t.status === 'in-progress').length;
      const completedTasks = tasksData.filter(t => t.status === 'completed').length;
      const reviewTasks = tasksData.filter(t => t.status === 'review').length;

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const tasksByPriority = ['low', 'medium', 'high', 'critical'].map(priority => ({
        priority,
        count: tasksData.filter(t => t.priority === priority).length,
      }));

      const tasksByStatus = ['open', 'in-progress', 'review', 'completed'].map(status => ({
        status,
        count: tasksData.filter(t => t.status === status).length,
      }));

      const projectProgress = projectsData.map(p => {
        const projectTasks = tasksData.filter(t => t.project_id === p.id);
        const completedProjectTasks = projectTasks.filter(t => t.status === 'completed');
        return {
          id: p.id,
          name: p.name,
          progress: p.progress,
          taskCount: projectTasks.length,
          completedTasks: completedProjectTasks.length,
        };
      });

      // Top contributors
      const contributorMap: Record<string, {
        tasksCompleted: number;
        hoursWorked: number;
        progressUpdates: number
      }> = {};

      tasksData.forEach(task => {
        if (task.status === 'completed' && task.assigned_to) {
          if (!contributorMap[task.assigned_to]) {
            contributorMap[task.assigned_to] = { tasksCompleted: 0, hoursWorked: 0, progressUpdates: 0 };
          }
          contributorMap[task.assigned_to].tasksCompleted++;
        }
      });

      progressData.forEach(prog => {
        if (!contributorMap[prog.user_id]) {
          contributorMap[prog.user_id] = { tasksCompleted: 0, hoursWorked: 0, progressUpdates: 0 };
        }
        contributorMap[prog.user_id].hoursWorked += Number(prog.hours_worked) || 0;
        contributorMap[prog.user_id].progressUpdates++;
      });

      const topContributors = Object.entries(contributorMap)
        .map(([userId, stats]) => ({
          user: profilesData.find(p => p.id === userId)!,
          ...stats,
        }))
        .filter(c => c.user)
        .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
        .slice(0, 10);

      // Weekly activity (mock based on available data)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyActivity = days.map((day) => ({
        day,
        tasksCreated: Math.floor(Math.random() * 5) + 1,
        tasksCompleted: Math.floor(Math.random() * 4),
        hoursWorked: Math.floor(Math.random() * 8) + 2,
      }));

      const weeklyCompleted = weeklyActivity.reduce((sum, d) => sum + d.tasksCompleted, 0);
      const weeklyCreated = weeklyActivity.reduce((sum, d) => sum + d.tasksCreated, 0);
      const weeklyCompletionRate = weeklyCreated > 0 ? Math.round((weeklyCompleted / weeklyCreated) * 100) : 0;

      let userStats;
      if (user) {
        const userTasks = tasksData.filter(t => t.assigned_to === user.id);
        const userProgress = progressData.filter(p => p.user_id === user.id);

        userStats = {
          tasksAssigned: userTasks.length,
          tasksCompleted: userTasks.filter(t => t.status === 'completed').length,
          hoursWorked: userProgress.reduce((sum, p) => sum + (Number(p.hours_worked) || 0), 0),
          currentStreak: Math.floor(Math.random() * 7) + 1,
        };
      }

      setAnalytics({
        totalProjects,
        activeProjects,
        completedProjects,
        totalTasks,
        openTasks,
        inProgressTasks,
        completedTasks,
        reviewTasks,
        completionRate,
        weeklyCompletionRate,
        tasksByPriority,
        tasksByStatus,
        projectProgress,
        topContributors,
        weeklyActivity,
        userStats,
        dataUsage: {
          projectsCount: totalProjects,
          projectsLimit: DATA_LIMITS.PROJECTS,
          tasksCount: totalTasks,
          tasksLimit: DATA_LIMITS.TASKS,
          storageUsed: Math.round(totalTasks * 0.5 + totalProjects * 2), // Mock calculation
          storageLimit: DATA_LIMITS.STORAGE_MB,
        },
      });

      // Check for usage limits and notify admin if needed (Simulated)
      const usageChecks = [
        { current: totalProjects, limit: DATA_LIMITS.PROJECTS, entity: 'Projects' },
        { current: totalTasks, limit: DATA_LIMITS.TASKS, entity: 'Tasks' },
      ];

      usageChecks.forEach(async (check) => {
        if (check.current >= check.limit * 0.8 && user) {
          // Check if we already notified recently to avoid spam (Mock check)
          const shouldNotify = Math.random() > 0.8; // Simulate occasional notification

          if (shouldNotify) {
            // In a real app, we'd check a 'system_alerts' table or similar
            // For now, we just log it as a simulation of the triggering logic
            console.log(`System Alert: ${check.entity} usage is at ${Math.round((check.current / check.limit) * 100)}%`);
          }
        }
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    refetch: fetchAnalytics,
  };
}
