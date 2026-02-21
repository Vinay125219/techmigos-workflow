import { useState, useEffect } from 'react';
import { backend } from '@/integrations/backend/client';
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

        const channel = backend.channel(room);

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState<PresenceState>();
                const users = Object.values(newState).flat();
                // Dedup by user_id
                const uniqueUsers = Array.from(new Map(users.map((presenceUser) => [presenceUser.user_id, presenceUser])).values());
                setOnlineUsers(uniqueUsers);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    setOnlineUsers([{
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                        full_name: profile?.full_name || undefined,
                        avatar_url: profile?.avatar_url || undefined,
                    }]);
                    await channel.track();
                }
            });

        return () => {
            backend.removeChannel(channel);
        };
    }, [room, user, profile]);

    return onlineUsers;
}
