import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Idea, IdeaVote, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';


export function useIdeas() {
  const { user, isManager } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await backend
        .from('ideas')
        .select('*')
        .order('votes', { ascending: false });

      if (error) throw error;
      const ideasData = (data || []) as Idea[];

      // Fetch creator profiles
      const creatorIds: string[] = [
        ...new Set(
          ideasData
            .filter((idea) => idea.created_by)
            .map((idea) => idea.created_by as string)
        ),
      ];
      const { data: profiles } = creatorIds.length > 0
        ? await backend.from('profiles').select('*').in('id', creatorIds)
        : { data: [] };

      const profileMap: Record<string, Profile> = {};
      ((profiles || []) as Profile[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      // Fetch user's votes if authenticated
      const voteMap: Record<string, 'up' | 'down'> = {};
      if (user) {
        const { data: votes } = await backend
          .from('idea_votes')
          .select('idea_id, vote_type')
          .eq('user_id', user.id);

        ((votes || []) as Pick<IdeaVote, 'idea_id' | 'vote_type'>[]).forEach((vote) => {
          voteMap[vote.idea_id] = vote.vote_type;
        });
      }

      const ideasWithRelations = ideasData.map((idea) => ({
        ...idea,
        creator: idea.created_by ? profileMap[idea.created_by] : undefined,
        user_vote: voteMap[idea.id] || null,
      })) as Idea[];

      setIdeas(ideasWithRelations);
    } catch (err: any) {
      console.error('Error fetching ideas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const createIdea = async (idea: { title: string; description: string; category?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await backend
      .from('ideas')
      .insert({ ...idea, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      // Optimistic update - immediately add to local state
      setIdeas(prev => [data as Idea, ...prev]);

      // Fire-and-forget: Send notifications
      (async () => {
        try {
          const { data: creatorProfile } = await backend
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          // Notify all users about new idea (except creator)
          const { data: allProfiles } = await backend
            .from('profiles')
            .select('id, email')
            .neq('id', user.id);

          const profilesToNotify = (allProfiles || []) as Pick<Profile, 'id'>[];
          if (profilesToNotify.length > 0) {
            const notifications = profilesToNotify.map((profile) => ({
              user_id: profile.id,
              type: 'new_idea',
              title: 'New Idea',
              message: `"${data.title}" was created by ${creatorProfile?.full_name || 'someone'}`,
              entity_type: 'idea',
              entity_id: data.id,
            }));

            await backend.from('notifications').insert(notifications);
          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      })();
    }

    return { data, error };
  };

  const voteIdea = async (ideaId: string, voteType: 'up' | 'down') => {
    if (!user) return { error: new Error('Not authenticated') };

    const existingIdea = ideas.find(i => i.id === ideaId);
    const existingVote = existingIdea?.user_vote;
    const previousIdeas = ideas;

    // Calculate optimistic vote change
    let voteChange = 0;
    let newUserVote: 'up' | 'down' | null = voteType;

    if (existingVote === voteType) {
      // Removing vote
      voteChange = voteType === 'up' ? -1 : 1;
      newUserVote = null;
    } else if (existingVote) {
      // Changing vote
      voteChange = voteType === 'up' ? 2 : -2;
    } else {
      // New vote
      voteChange = voteType === 'up' ? 1 : -1;
    }

    // Optimistic update - immediately update UI
    setIdeas(prev => prev.map(i =>
      i.id === ideaId
        ? { ...i, votes: (i.votes || 0) + voteChange, user_vote: newUserVote }
        : i
    ));

    let error: Error | null = null;

    if (existingVote === voteType) {
      // Remove vote
      const result = await backend
        .from('idea_votes')
        .delete()
        .eq('idea_id', ideaId)
        .eq('user_id', user.id);
      error = result.error;

      if (!error) {
        await backend
          .from('ideas')
          .update({ votes: (existingIdea?.votes || 0) + voteChange })
          .eq('id', ideaId);
      }
    } else if (existingVote) {
      // Change vote
      const result = await backend
        .from('idea_votes')
        .update({ vote_type: voteType })
        .eq('idea_id', ideaId)
        .eq('user_id', user.id);
      error = result.error;

      if (!error) {
        await backend
          .from('ideas')
          .update({ votes: (existingIdea?.votes || 0) + voteChange })
          .eq('id', ideaId);
      }
    } else {
      // New vote
      const result = await backend
        .from('idea_votes')
        .insert({ idea_id: ideaId, user_id: user.id, vote_type: voteType });
      error = result.error;

      if (!error) {
        await backend
          .from('ideas')
          .update({ votes: (existingIdea?.votes || 0) + voteChange })
          .eq('id', ideaId);
      }
    }

    if (error) {
      // Rollback on error
      setIdeas(previousIdeas);
    }

    return { error };
  };

  const updateIdeaStatus = async (ideaId: string, status: Idea['status']) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can update idea status') };

    // Optimistic update - immediately update UI
    const previousIdeas = ideas;
    setIdeas(prev => prev.map(i =>
      i.id === ideaId ? { ...i, status } : i
    ));

    const { error } = await backend
      .from('ideas')
      .update({ status })
      .eq('id', ideaId);

    if (error) {
      // Rollback on error
      setIdeas(previousIdeas);
    }

    return { error };
  };

  return {
    ideas,
    loading,
    error,
    fetchIdeas,
    createIdea,
    voteIdea,
    updateIdeaStatus,
  };
}
