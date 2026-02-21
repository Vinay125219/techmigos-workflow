import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Project, Task, TaskProgress, Profile, WorkspaceRole } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { addDays, format, startOfDay, subDays } from 'date-fns';

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
    limitsSource: 'env' | 'default';
    storageSource: 'documents';
  };
}

const DATA_LIMITS = {
  PROJECTS: Math.max(1, Number(process.env.NEXT_PUBLIC_PROJECTS_LIMIT || 50) || 50),
  TASKS: Math.max(1, Number(process.env.NEXT_PUBLIC_TASKS_LIMIT || 500) || 500),
  STORAGE_MB: Math.max(1, Number(process.env.NEXT_PUBLIC_STORAGE_LIMIT_MB || 1024) || 1024),
};

const PROJECT_PROGRESS_LIMIT = 30;
const TASK_SAMPLE_LIMIT = 500;
const PROGRESS_SAMPLE_LIMIT = 1000;
const DOCUMENT_PAGE_SIZE = 200;

function getLimitsSource(): 'env' | 'default' {
  return process.env.NEXT_PUBLIC_PROJECTS_LIMIT ||
    process.env.NEXT_PUBLIC_TASKS_LIMIT ||
    process.env.NEXT_PUBLIC_STORAGE_LIMIT_MB
    ? 'env'
    : 'default';
}

function buildFallbackAnalytics(): AnalyticsData {
  return {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    openTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    reviewTasks: 0,
    completionRate: 0,
    weeklyCompletionRate: 0,
    tasksByPriority: [
      { priority: 'low', count: 0 },
      { priority: 'medium', count: 0 },
      { priority: 'high', count: 0 },
      { priority: 'critical', count: 0 },
    ],
    tasksByStatus: [
      { status: 'open', count: 0 },
      { status: 'in-progress', count: 0 },
      { status: 'review', count: 0 },
      { status: 'completed', count: 0 },
    ],
    projectProgress: [],
    topContributors: [],
    weeklyActivity: Array.from({ length: 7 }).map((_, index) => ({
      day: format(subDays(new Date(), 6 - index), 'EEE'),
      tasksCreated: 0,
      tasksCompleted: 0,
      hoursWorked: 0,
    })),
    userStats: {
      tasksAssigned: 0,
      tasksCompleted: 0,
      hoursWorked: 0,
      currentStreak: 0,
    },
    dataUsage: {
      projectsCount: 0,
      projectsLimit: DATA_LIMITS.PROJECTS,
      tasksCount: 0,
      tasksLimit: DATA_LIMITS.TASKS,
      storageUsed: 0,
      storageLimit: DATA_LIMITS.STORAGE_MB,
      limitsSource: getLimitsSource(),
      storageSource: 'documents',
    },
  };
}

function buildProfileFallback(userId: string): Profile {
  const now = new Date().toISOString();
  return {
    id: userId,
    email: '',
    full_name: 'Unknown User',
    avatar_url: null,
    department: null,
    designation: null,
    skills: [],
    created_at: now,
    updated_at: now,
  };
}

type WorkspaceDocumentMetrics = {
  storageBytes: number;
};

type BackendQueryBuilder = ReturnType<typeof backend.from>;

async function fetchWorkspaceDocumentMetrics(workspaceId: string): Promise<WorkspaceDocumentMetrics> {
  let storageBytes = 0;
  let page = 0;

  while (true) {
    const from = page * DOCUMENT_PAGE_SIZE;
    const to = from + DOCUMENT_PAGE_SIZE - 1;
    const { data, error } = await backend
      .from('documents')
      .select('id, file_size')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data || []) as Array<{ id: string; file_size: number | null }>;
    rows.forEach((row) => {
      storageBytes += Number(row.file_size || 0);
    });

    if (rows.length < DOCUMENT_PAGE_SIZE) break;
    page += 1;
  }

  return { storageBytes };
}

export function useAnalytics() {
  const { user, isManager, isAdmin } = useAuth();
  const { activeWorkspaceId } = useWorkspaceContext();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      if (!user || !activeWorkspaceId) {
        setAnalytics(buildFallbackAnalytics());
        return;
      }

      const { data: membershipRow, error: membershipError } = await backend
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membershipRow && !isAdmin) {
        setAnalytics(buildFallbackAnalytics());
        return;
      }

      const workspaceRole = (membershipRow as { role?: WorkspaceRole } | null)?.role;
      const canViewWorkspaceWide =
        isAdmin || isManager || workspaceRole === 'owner' || workspaceRole === 'admin';
      const restrictToAssignee = canViewWorkspaceWide ? null : user.id;

      const countProjects = async (
        mutator?: (query: BackendQueryBuilder) => BackendQueryBuilder
      ) => {
        let query = backend
          .from('projects')
          .select('id')
          .eq('workspace_id', activeWorkspaceId);
        if (mutator) {
          query = mutator(query);
        }
        const { count, error } = await query.limit(1);
        if (error) throw error;
        return count || 0;
      };

      const countTasks = async (
        mutator?: (query: BackendQueryBuilder) => BackendQueryBuilder
      ) => {
        let query = backend
          .from('tasks')
          .select('id')
          .eq('workspace_id', activeWorkspaceId);
        if (restrictToAssignee) {
          query = query.eq('assigned_to', restrictToAssignee);
        }
        if (mutator) {
          query = mutator(query);
        }
        const { count, error } = await query.limit(1);
        if (error) throw error;
        return count || 0;
      };

      const [
        totalProjects,
        activeProjects,
        completedProjects,
        totalTasks,
        openTasks,
        inProgressTasks,
        completedTasks,
        reviewTasks,
      ] = await Promise.all([
        countProjects(),
        countProjects((query) => query.eq('status', 'active')),
        countProjects((query) => query.eq('status', 'completed')),
        countTasks(),
        countTasks((query) => query.eq('status', 'open')),
        countTasks((query) => query.eq('status', 'in-progress')),
        countTasks((query) => query.eq('status', 'completed')),
        countTasks((query) => query.eq('status', 'review')),
      ]);

      const [lowCount, mediumCount, highCount, criticalCount] = await Promise.all([
        countTasks((query) => query.eq('priority', 'low')),
        countTasks((query) => query.eq('priority', 'medium')),
        countTasks((query) => query.eq('priority', 'high')),
        countTasks((query) => query.eq('priority', 'critical')),
      ]);

      let tasksQuery = backend
        .from('tasks')
        .select('id, project_id, assigned_to, status, created_at, updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(TASK_SAMPLE_LIMIT);
      if (restrictToAssignee) {
        tasksQuery = tasksQuery.eq('assigned_to', restrictToAssignee);
      }

      const { data: sampledTaskRows, error: sampledTaskError } = await tasksQuery;
      if (sampledTaskError) throw sampledTaskError;
      const sampledTasks = (sampledTaskRows || []) as Array<
        Pick<Task, 'id' | 'project_id' | 'assigned_to' | 'status' | 'created_at' | 'updated_at'>
      >;

      const sampledTaskIds = sampledTasks.map((task) => task.id);
      const { data: progressRows, error: progressError } = sampledTaskIds.length > 0
        ? await backend
          .from('task_progress')
          .select('task_id, user_id, hours_worked, created_at')
          .in('task_id', sampledTaskIds)
          .order('created_at', { ascending: false })
          .limit(PROGRESS_SAMPLE_LIMIT)
        : { data: [], error: null };

      if (progressError) throw progressError;
      const sampledProgress = (progressRows || []) as Array<
        Pick<TaskProgress, 'task_id' | 'user_id' | 'hours_worked' | 'created_at'>
      >;

      const { data: projectRows, error: projectError } = await backend
        .from('projects')
        .select('id, name, progress')
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(PROJECT_PROGRESS_LIMIT);
      if (projectError) throw projectError;

      const projects = (projectRows || []) as Array<Pick<Project, 'id' | 'name' | 'progress'>>;
      const projectProgress = await Promise.all(
        projects.map(async (project) => {
          const [taskCount, completedTaskCount] = await Promise.all([
            countTasks((query) => query.eq('project_id', project.id)),
            countTasks((query) => query.eq('project_id', project.id).eq('status', 'completed')),
          ]);

          return {
            id: project.id,
            name: project.name,
            progress: project.progress,
            taskCount,
            completedTasks: completedTaskCount,
          };
        })
      );

      const weeklyActivity = await Promise.all(
        Array.from({ length: 7 }).map(async (_, index) => {
          const dayDate = subDays(new Date(), 6 - index);
          const start = startOfDay(dayDate);
          const end = addDays(start, 1);
          const startIso = start.toISOString();
          const endIso = end.toISOString();

          const [tasksCreated, tasksCompleted] = await Promise.all([
            countTasks((query) =>
              query.gte('created_at', startIso).lt('created_at', endIso)
            ),
            countTasks((query) =>
              query
                .eq('status', 'completed')
                .gte('updated_at', startIso)
                .lt('updated_at', endIso)
            ),
          ]);

          const hoursWorked = sampledProgress.reduce((sum, progress) => {
            const createdAt = new Date(progress.created_at);
            if (createdAt >= start && createdAt < end) {
              return sum + (Number(progress.hours_worked) || 0);
            }
            return sum;
          }, 0);

          return {
            day: format(dayDate, 'EEE'),
            tasksCreated,
            tasksCompleted,
            hoursWorked,
          };
        })
      );

      const contributorMap: Record<string, { tasksCompleted: number; hoursWorked: number; progressUpdates: number }> = {};

      sampledTasks.forEach((task) => {
        if (task.status !== 'completed' || !task.assigned_to) return;
        if (!contributorMap[task.assigned_to]) {
          contributorMap[task.assigned_to] = { tasksCompleted: 0, hoursWorked: 0, progressUpdates: 0 };
        }
        contributorMap[task.assigned_to].tasksCompleted += 1;
      });

      sampledProgress.forEach((progress) => {
        if (!contributorMap[progress.user_id]) {
          contributorMap[progress.user_id] = { tasksCompleted: 0, hoursWorked: 0, progressUpdates: 0 };
        }
        contributorMap[progress.user_id].hoursWorked += Number(progress.hours_worked) || 0;
        contributorMap[progress.user_id].progressUpdates += 1;
      });

      const rankedContributorIds = Object.entries(contributorMap)
        .sort(([, left], [, right]) => {
          if (right.tasksCompleted !== left.tasksCompleted) {
            return right.tasksCompleted - left.tasksCompleted;
          }
          if (right.hoursWorked !== left.hoursWorked) {
            return right.hoursWorked - left.hoursWorked;
          }
          return right.progressUpdates - left.progressUpdates;
        })
        .slice(0, 10)
        .map(([userId]) => userId);

      const contributorIds = rankedContributorIds.length > 0 ? rankedContributorIds : [user.id];
      const { data: profileRows, error: profileError } = await backend
        .from('profiles')
        .select('*')
        .in('id', contributorIds);
      if (profileError) throw profileError;

      const profileMap = new Map<string, Profile>(
        ((profileRows || []) as Profile[]).map((profile) => [profile.id, profile])
      );

      const topContributors = rankedContributorIds
        .map((userId) => ({
          user: profileMap.get(userId) || buildProfileFallback(userId),
          tasksCompleted: contributorMap[userId]?.tasksCompleted || 0,
          hoursWorked: contributorMap[userId]?.hoursWorked || 0,
          progressUpdates: contributorMap[userId]?.progressUpdates || 0,
        }))
        .slice(0, 10);

      const [tasksAssigned, userCompletedTasks] = await Promise.all([
        countTasks((query) => query.eq('assigned_to', user.id)),
        countTasks((query) => query.eq('assigned_to', user.id).eq('status', 'completed')),
      ]);

      const userHoursWorked = sampledProgress.reduce(
        (sum, progress) => sum + (progress.user_id === user.id ? Number(progress.hours_worked) || 0 : 0),
        0
      );

      const { data: userCompletionRows, error: userCompletionError } = await backend
        .from('tasks')
        .select('created_at, updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('assigned_to', user.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(120);
      if (userCompletionError) throw userCompletionError;

      const completionDays = new Set(
        ((userCompletionRows || []) as Array<Pick<Task, 'created_at' | 'updated_at'>>).map((task) =>
          format(new Date(task.updated_at || task.created_at), 'yyyy-MM-dd')
        )
      );

      let currentStreak = 0;
      for (let i = 0; i < 90; i += 1) {
        const dateKey = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (completionDays.has(dateKey)) {
          currentStreak += 1;
        } else if (i > 0) {
          break;
        }
      }

      const { storageBytes } = await fetchWorkspaceDocumentMetrics(activeWorkspaceId);
      const storageUsedMb = Number((storageBytes / (1024 * 1024)).toFixed(2));

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const weeklyCreated = weeklyActivity.reduce((sum, day) => sum + day.tasksCreated, 0);
      const weeklyCompleted = weeklyActivity.reduce((sum, day) => sum + day.tasksCompleted, 0);
      const weeklyCompletionRate = weeklyCreated > 0 ? Math.round((weeklyCompleted / weeklyCreated) * 100) : 0;

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
        tasksByPriority: [
          { priority: 'low', count: lowCount },
          { priority: 'medium', count: mediumCount },
          { priority: 'high', count: highCount },
          { priority: 'critical', count: criticalCount },
        ],
        tasksByStatus: [
          { status: 'open', count: openTasks },
          { status: 'in-progress', count: inProgressTasks },
          { status: 'review', count: reviewTasks },
          { status: 'completed', count: completedTasks },
        ],
        projectProgress,
        topContributors,
        weeklyActivity,
        userStats: {
          tasksAssigned,
          tasksCompleted: userCompletedTasks,
          hoursWorked: userHoursWorked,
          currentStreak,
        },
        dataUsage: {
          projectsCount: totalProjects,
          projectsLimit: DATA_LIMITS.PROJECTS,
          tasksCount: totalTasks,
          tasksLimit: DATA_LIMITS.TASKS,
          storageUsed: storageUsedMb,
          storageLimit: DATA_LIMITS.STORAGE_MB,
          limitsSource: getLimitsSource(),
          storageSource: 'documents',
        },
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setAnalytics(buildFallbackAnalytics());
    } finally {
      setLoading(false);
    }
  }, [user, activeWorkspaceId, isManager, isAdmin]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    refetch: fetchAnalytics,
  };
}
