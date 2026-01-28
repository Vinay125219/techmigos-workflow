import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PresenceState {
    user_id: string;
    online_at: string;
    full_name?: string;
    avatar_url?: string;
}

export function usePresence(room: string) {
    const { user, profile } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);

    useEffect(() => {
        if (!user || !room) return;

        const channel = supabase.channel(room, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState<PresenceState>();
                const users = Object.values(newState).flat();
                // Dedup by user_id
                const uniqueUsers = Array.from(new Map(users.map(u => [u.user_id, u])).values());
                setOnlineUsers(uniqueUsers);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                        full_name: profile?.full_name,
                        avatar_url: profile?.avatar_url,
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [room, user, profile]);

    return onlineUsers;
}
