import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  const fetchOnboarding = useCallback(async () => {
    if (!user) {
      setOnboarding(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
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
        }
      } else {
        // First time user - show onboarding
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
        await supabase
          .from('user_onboarding')
          .update({ steps_completed: stepsCompleted })
          .eq('user_id', user.id);
      }
    } else {
      completeOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = async () => {
    setIsOnboardingActive(false);
    
    if (user) {
      await supabase
        .from('user_onboarding')
        .update({ completed: true })
        .eq('user_id', user.id);
    }
  };

  const completeOnboarding = async () => {
    setIsOnboardingActive(false);
    
    if (user) {
      await supabase
        .from('user_onboarding')
        .update({ 
          completed: true,
          steps_completed: ONBOARDING_STEPS.map(s => s.id),
        })
        .eq('user_id', user.id);
    }
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
