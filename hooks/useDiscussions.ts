import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Discussion, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export interface DiscussionWithUser extends Discussion {
    user?: Profile;
}

export function useDiscussions(entityType: string, entityId: string) {
    const { user } = useAuth();
    const [discussions, setDiscussions] = useState<DiscussionWithUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDiscussions = useCallback(async () => {
        if (!entityId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('discussions')
                .select('*')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Fetch user profiles
            const userIds = [...new Set((data || []).map(d => d.user_id))];
            const { data: profiles } = userIds.length > 0
                ? await supabase.from('profiles').select('*').in('id', userIds)
                : { data: [] };

            const profileMap: Record<string, Profile> = {};
            (profiles || []).forEach(p => {
                profileMap[p.id] = p as Profile;
            });

            const discussionsWithUsers = (data || []).map(d => ({
                ...d,
                user: profileMap[d.user_id],
            })) as DiscussionWithUser[];

            setDiscussions(discussionsWithUsers);
        } catch (err) {
            console.error('Error fetching discussions:', err);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId]);

    useEffect(() => {
        fetchDiscussions();

        if (entityId) {
            const channel = supabase
                .channel(`discussions-${entityType}-${entityId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'discussions',
                    filter: `entity_id=eq.${entityId}`
                }, () => {
                    fetchDiscussions();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [fetchDiscussions, entityType, entityId]);

    const addDiscussion = async (content: string) => {
        if (!user) return { error: new Error('Not authenticated') };

        const { data, error } = await supabase
            .from('discussions')
            .insert({
                entity_type: entityType,
                entity_id: entityId,
                user_id: user.id,
                content,
            })
            .select()
            .single();

        if (!error) {
            // Optimistic update handled by realtime subscription usually, 
            // but we can also manually trigger fetch or update state for instant feel
            fetchDiscussions();
        }

        return { data, error };
    };

    const deleteDiscussion = async (id: string) => {
        const { error } = await supabase
            .from('discussions')
            .delete()
            .eq('id', id);

        if (!error) {
            setDiscussions(prev => prev.filter(d => d.id !== id));
        }

        return { error };
    };

    return {
        discussions,
        loading,
        addDiscussion,
        deleteDiscussion,
        refetch: fetchDiscussions,
    };
}
