import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Notification } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseNotificationsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  unreadOnly?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 50);
  const offset = (page - 1) * pageSize;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = backend
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (options.unreadOnly) {
        query = query.eq('read', false);
      }
      if (options.search && options.search.trim()) {
        query = query.search('title', options.search.trim());
      }

      query = query.range(offset, offset + pageSize - 1);

      const [{ data, error, count }, unreadResult] = await Promise.all([
        query,
        backend
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('read', false),
      ]);

      if (error) throw error;

      const notifs = (data || []) as Notification[];
      const unreadRows = (unreadResult.data || []) as Array<{ id: string }>;
      setTotalCount(count || notifs.length);
      setNotifications(notifs);
      setUnreadCount(unreadRows.length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, options.unreadOnly, options.search, offset, pageSize]);

  useEffect(() => {
    fetchNotifications();

    if (user) {
      const channel = backend
        .channel(`notifications-${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        backend.removeChannel(channel);
      };
    }
  }, [fetchNotifications, user]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await backend
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    return { error };
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await backend
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }

    return { error };
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    
    const { error } = await backend
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }

    return { error };
  };

  return {
    notifications,
    loading,
    unreadCount,
    page,
    pageSize,
    totalCount,
    hasMore: offset + notifications.length < totalCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
