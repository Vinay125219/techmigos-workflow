import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { UserOnboarding } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to ProjectHub!',
    description: 'Your comprehensive project and task management platform. Let\'s get you started.',
    target: null,
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'This is your command center. View project stats, urgent tasks, and team activity at a glance.',
    target: 'dashboard',
  },
  {
    id: 'projects',
    title: 'Browse Projects',
    description: 'View all company projects, their status, and progress. You can create new projects from here.',
    target: 'projects',
  },
  {
    id: 'tasks',
    title: 'Task Marketplace',
    description: 'Find available tasks, filter by skills and priority, and take on work that matches your expertise.',
    target: 'tasks',
  },
  {
    id: 'take-task',
    title: 'Take a Task',
    description: 'Click "Take Task" on any available task to assign it to yourself and start working.',
    target: 'take-task',
  },
  {
    id: 'progress',
    title: 'Track Your Progress',
    description: 'Update your daily progress on assigned tasks to keep the team informed.',
    target: 'progress',
  },
  {
    id: 'ideas',
    title: 'Share Ideas',
    description: 'Submit new ideas or vote on existing ones in the Ideas section under Planning.',
    target: 'ideas',
  },
  {
    id: 'analytics',
    title: 'View Analytics',
    description: 'Track company-wide and individual performance metrics in the Analytics section.',
    target: 'analytics',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start exploring and contributing to projects. Need help? Check the Help menu anytime.',
    target: null,
  },
];

export function useOnboarding() {
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<UserOnboarding | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const getOrCreateOnboardingRecord = useCallback(async (): Promise<UserOnboarding | null> => {
    if (!user) return null;

    if (onboarding?.id && onboarding.user_id === user.id) {
      return onboarding;
    }

    const { data: existing, error: fetchError } = await backend
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      const record = existing as UserOnboarding;
      setOnboarding(record);
      return record;
    }

    const { data: created, error: createError } = await backend
      .from('user_onboarding')
      .insert({
        id: user.id,
        user_id: user.id,
        completed: false,
        steps_completed: [],
      })
      .select('*')
      .single();

    if (createError) {
      // Handle races where another client created the row between fetch and insert.
      const { data: fallback, error: fallbackError } = await backend
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fallbackError) throw fallbackError;
      if (!fallback) throw createError;

      const record = fallback as UserOnboarding;
      setOnboarding(record);
      return record;
    }

    const record = created as UserOnboarding;
    setOnboarding(record);
    return record;
  }, [onboarding, user]);

  const persistOnboarding = useCallback(
    async (updates: Partial<Pick<UserOnboarding, 'completed' | 'steps_completed'>>) => {
      if (!user) return;

      try {
        const record = await getOrCreateOnboardingRecord();
        if (!record) return;

        const { data, error } = await backend
          .from('user_onboarding')
          .update(updates)
          .eq('id', record.id)
          .select('*')
          .single();

        if (error) throw error;
        if (data) {
          setOnboarding(data as UserOnboarding);
        }
      } catch (err) {
        console.error('Error persisting onboarding:', err);
      }
    },
    [getOrCreateOnboardingRecord, user]
  );

  const fetchOnboarding = useCallback(async () => {
    setLoading(true);

    if (!user) {
      setOnboarding(null);
      setCurrentStep(0);
      setIsOnboardingActive(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await backend
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOnboarding(data as UserOnboarding);
        if (!data.completed) {
          setCurrentStep(data.steps_completed?.length || 0);
          setIsOnboardingActive(true);
        } else {
          setCurrentStep(0);
          setIsOnboardingActive(false);
        }
      } else {
        // First time user - show onboarding
        setOnboarding(null);
        setCurrentStep(0);
        setIsOnboardingActive(true);
      }
    } catch (err) {
      console.error('Error fetching onboarding:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOnboarding();
  }, [fetchOnboarding]);

  const nextStep = async () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);

      if (user) {
        const stepsCompleted = ONBOARDING_STEPS.slice(0, newStep).map(s => s.id);
        await persistOnboarding({
          completed: false,
          steps_completed: stepsCompleted,
        });
      }
    } else {
      await completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = async () => {
    setIsOnboardingActive(false);

    await persistOnboarding({ completed: true });
  };

  const completeOnboarding = async () => {
    setIsOnboardingActive(false);

    await persistOnboarding({
      completed: true,
      steps_completed: ONBOARDING_STEPS.map(s => s.id),
    });
  };

  const restartOnboarding = () => {
    setCurrentStep(0);
    setIsOnboardingActive(true);
  };

  return {
    onboarding,
    currentStep,
    currentStepData: ONBOARDING_STEPS[currentStep],
    totalSteps: ONBOARDING_STEPS.length,
    isOnboardingActive,
    loading,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    restartOnboarding,
  };
}
