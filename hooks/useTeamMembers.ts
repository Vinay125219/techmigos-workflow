import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Profile } from '@/types/database';

interface UseTeamMembersOptions {
    workspaceId?: string | null;
}

export function useTeamMembers(options: UseTeamMembersOptions = {}) {
    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true);
            if (options.workspaceId) {
                const { data: workspaceMembers, error: workspaceMembersError } = await backend
                    .from('workspace_members')
                    .select('user_id')
                    .eq('workspace_id', options.workspaceId);

                if (workspaceMembersError) throw workspaceMembersError;

                const userIds = ((workspaceMembers || []) as Array<{ user_id: string }>).map((member) => member.user_id);
                if (userIds.length === 0) {
                    setMembers([]);
                    return;
                }

                const { data: scopedProfiles, error: profilesError } = await backend
                    .from('profiles')
                    .select('*')
                    .in('id', userIds)
                    .order('created_at', { ascending: false });

                if (profilesError) throw profilesError;
                setMembers((scopedProfiles || []) as Profile[]);
                return;
            }

            const { data, error } = await backend
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMembers((data || []) as Profile[]);
        } catch (err: unknown) {
            console.error('Error fetching team members:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    }, [options.workspaceId]);

    useEffect(() => {
        fetchMembers();

        // Subscribe to realtime updates
        const channel = backend
            .channel('profiles-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchMembers();
            })
            .subscribe();

        return () => {
            backend.removeChannel(channel);
        };
    }, [fetchMembers]);

    return {
        members,
        loading,
        error,
        teamCount: members.length,
        fetchMembers,
    };
}
