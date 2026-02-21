import { useCallback, useEffect, useState } from 'react';
import { addHours } from 'date-fns';
import { backend } from '@/integrations/backend/client';
import type { NotificationPreferences } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  in_app_enabled: true,
  email_enabled: false,
  digest_enabled: false,
  muted_until: null,
  snoozed_until: null,
  type_preferences: {},
};

const LOCAL_STORAGE_PREFIX = 'tm_notification_preferences';

type BackendErrorLike = {
  message?: string;
  status?: number;
  code?: number;
  type?: string;
};

function getLocalStorageKey(userId: string): string {
  return `${LOCAL_STORAGE_PREFIX}:${userId}`;
}

function isMissingCollectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as BackendErrorLike;
  const message = typed.message?.toLowerCase() || '';
  const type = typed.type?.toLowerCase() || '';

  return (
    typed.status === 404 ||
    typed.code === 404 ||
    type.includes('collection_not_found') ||
    message.includes('collection with the requested id') ||
    message.includes('could not be found')
  );
}

function buildDefaultRecord(userId: string, overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  const now = new Date().toISOString();

  return {
    id: overrides.id || `local-${userId}`,
    user_id: userId,
    ...DEFAULT_PREFERENCES,
    ...overrides,
    updated_at: overrides.updated_at || now,
    created_at: overrides.created_at || now,
  };
}

function readLocalPreferences(userId: string): NotificationPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getLocalStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return buildDefaultRecord(userId, parsed);
  } catch {
    return null;
  }
}

function writeLocalPreferences(preferences: NotificationPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getLocalStorageKey(preferences.user_id), JSON.stringify(preferences));
  } catch {
    // Ignore storage write failures in private/hardened browser modes.
  }
}

function parseTypePreferences(raw: unknown): Record<string, boolean> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, boolean>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, boolean>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeRemotePreferences(
  userId: string,
  data: unknown
): NotificationPreferences {
  const source = (data && typeof data === 'object' ? data : {}) as Partial<NotificationPreferences> & { type_preferences?: unknown };

  return buildDefaultRecord(userId, {
    ...source,
    type_preferences: parseTypePreferences(source.type_preferences),
  });
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocalFallback, setIsLocalFallback] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      setIsLocalFallback(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await backend
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: created, error: createError } = await backend
          .from('notification_preferences')
          .insert({
            ...DEFAULT_PREFERENCES,
            user_id: user.id,
            type_preferences: JSON.stringify(DEFAULT_PREFERENCES.type_preferences),
          })
          .select()
          .single();

        if (createError) throw createError;

        if (created) {
          const createdPreferences = normalizeRemotePreferences(user.id, created);
          setPreferences(createdPreferences);
          setIsLocalFallback(false);
          writeLocalPreferences(createdPreferences);
        } else {
          const localRecord = readLocalPreferences(user.id) || buildDefaultRecord(user.id);
          setPreferences(localRecord);
          setIsLocalFallback(true);
          writeLocalPreferences(localRecord);
        }
      } else {
        const remotePreferences = normalizeRemotePreferences(user.id, data);
        setPreferences(remotePreferences);
        setIsLocalFallback(false);
        writeLocalPreferences(remotePreferences);
      }
    } catch (error) {
      if (isMissingCollectionError(error)) {
        const localRecord = readLocalPreferences(user.id) || buildDefaultRecord(user.id);
        setPreferences(localRecord);
        setIsLocalFallback(true);
        writeLocalPreferences(localRecord);
        return;
      }

      console.error('Failed to fetch notification preferences:', error);
      const localRecord = readLocalPreferences(user.id) || buildDefaultRecord(user.id);
      setPreferences(localRecord);
      setIsLocalFallback(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return { error: new Error('No preferences available') };

    const now = new Date().toISOString();
    const nextLocalRecord = buildDefaultRecord(user.id, {
      ...(preferences || {}),
      ...updates,
      updated_at: now,
    });

    if (isLocalFallback || !preferences) {
      setPreferences(nextLocalRecord);
      writeLocalPreferences(nextLocalRecord);
      return { data: nextLocalRecord, error: null };
    }

    const { data, error } = await backend
      .from('notification_preferences')
      .update({
        ...updates,
        type_preferences:
          updates.type_preferences !== undefined
            ? JSON.stringify(updates.type_preferences || {})
            : undefined,
        updated_at: now,
      })
      .eq('id', preferences.id)
      .select()
      .single();

    if (error && isMissingCollectionError(error)) {
      setIsLocalFallback(true);
      setPreferences(nextLocalRecord);
      writeLocalPreferences(nextLocalRecord);
      return { data: nextLocalRecord, error: null };
    }

    if (!error && data) {
      const remotePreferences = normalizeRemotePreferences(user.id, data);
      setPreferences(remotePreferences);
      writeLocalPreferences(remotePreferences);
    }

    return { data, error };
  };

  const snooze = async (hours: number) => {
    const until = addHours(new Date(), hours).toISOString();
    return updatePreferences({ snoozed_until: until });
  };

  const mute = async (hours: number) => {
    const until = addHours(new Date(), hours).toISOString();
    return updatePreferences({ muted_until: until });
  };

  const isMuted = preferences?.muted_until ? new Date(preferences.muted_until) > new Date() : false;
  const isSnoozed = preferences?.snoozed_until ? new Date(preferences.snoozed_until) > new Date() : false;

  return {
    preferences,
    loading,
    isMuted,
    isSnoozed,
    isLocalFallback,
    fetchPreferences,
    updatePreferences,
    mute,
    snooze,
  };
}
