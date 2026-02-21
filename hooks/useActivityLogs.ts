import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';

export interface ActivityLog {
    id: string;
    user_id: string | null;
    action_type: string;
    entity_type: string;
    entity_id: string;
    entity_title: string | null;
    description: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    // Joined user profile
    user?: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    };
}

export function useActivityLogs(limit: number = 50) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);

            const { data, error } = await backend
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                // Table might not exist yet, silently fail
                console.log('Activity logs not available yet:', error.message);
                setLogs([]);
                return;
            }

            const baseLogs = (data || []) as unknown as ActivityLog[];
            const userIds = Array.from(new Set(baseLogs.map(log => log.user_id).filter(Boolean))) as string[];

            if (userIds.length === 0) {
                setLogs(baseLogs);
                return;
            }

            const { data: profiles } = await backend
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            const profileMap = new Map(
                ((profiles || []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>).map(profile => [profile.id, profile])
            );

            const logsWithUsers = baseLogs.map(log => ({
                ...log,
                user: log.user_id ? profileMap.get(log.user_id) : undefined,
            }));

            setLogs(logsWithUsers);
        } catch (err) {
            console.error('Error fetching activity logs:', err);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchLogs();

        // Subscribe to real-time updates
        const channel = backend
            .channel('activity-logs-changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_logs',
            }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => {
            backend.removeChannel(channel);
        };
    }, [fetchLogs]);

    // Get activity icon based on action type
    const getActivityIcon = (actionType: string) => {
        const icons: Record<string, string> = {
            'task_created': '📋',
            'task_assigned': '👤',
            'task_in-progress': '⏳',
            'task_review': '👀',
            'task_completed': '✅',
            'task_open': '📬',
            'project_created': '📁',
            'project_active': '🚀',
            'project_completed': '🎉',
            'project_on-hold': '⏸️',
            'idea_created': '💡',
            'comment_added': '💬',
        };
        return icons[actionType] || '📝';
    };

    // Get activity color based on action type
    const getActivityColor = (actionType: string) => {
        if (actionType.includes('completed')) return 'from-success/20 to-success/10 border-success/30';
        if (actionType.includes('created')) return 'from-accent/20 to-accent/10 border-accent/30';
        if (actionType.includes('assigned')) return 'from-info/20 to-info/10 border-info/30';
        if (actionType.includes('progress')) return 'from-warning/20 to-warning/10 border-warning/30';
        if (actionType.includes('review')) return 'from-purple-500/20 to-purple-500/10 border-purple-500/30';
        return 'from-secondary to-secondary/50 border-border';
    };

    return {
        logs,
        loading,
        fetchLogs,
        getActivityIcon,
        getActivityColor,
    };
}
