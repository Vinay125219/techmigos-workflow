import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOnboarding, ONBOARDING_STEPS } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/AuthContext';

export function OnboardingOverlay() {
  const { isAuthenticated } = useAuth();
  const { isOnboardingActive, currentStep, currentStepData, totalSteps, nextStep, prevStep, skipOnboarding, loading } = useOnboarding();

  if (!isAuthenticated || loading || !isOnboardingActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              {ONBOARDING_STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= currentStep ? 'bg-accent' : 'bg-secondary'}`} />
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={skipOnboarding}><X className="w-4 h-4" /></Button>
          </div>

          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center text-3xl">
              {currentStep === 0 ? '👋' : currentStep === totalSteps - 1 ? '🎉' : '📍'}
            </div>
            <h3 className="text-xl font-bold mb-2">{currentStepData.title}</h3>
            <p className="text-muted-foreground">{currentStepData.description}</p>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Button onClick={nextStep}>{currentStep === totalSteps - 1 ? 'Get Started' : 'Next'}<ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
