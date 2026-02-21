import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { backend } from '@/integrations/backend/client';
import type { AuthSession } from '@/types/auth';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Mail, PartyPopper, Sparkles } from 'lucide-react';

function resolveRedirectPath(rawPath: string | null): string {
    if (rawPath && rawPath.startsWith('/') && !rawPath.startsWith('//')) {
        return rawPath;
    }
    return '/dashboard';
}

export function EmailVerificationHandler() {
    const router = useRouter();
    const [showVerifiedDialog, setShowVerifiedDialog] = useState(false);
    const [showVerifyEmailDialog, setShowVerifyEmailDialog] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const { data: { subscription } } = backend.auth.onAuthStateChange((event: string, session: AuthSession | null) => {
            if (event === 'SIGNED_IN' && session?.user && window.location.pathname.startsWith('/auth')) {
                const params = new URLSearchParams(window.location.search);
                router.replace(resolveRedirectPath(params.get('redirectTo')));
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    // Function to show "Please verify email" dialog after signup
    const showPendingVerification = (userEmail: string) => {
        setEmail(userEmail);
        setShowVerifyEmailDialog(true);
    };

    // Expose this for use by signup form
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).showPendingEmailVerification = showPendingVerification;
        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).showPendingEmailVerification;
        };
    }, []);

    return (
        <>
            {/* Email Verified Successfully Dialog */}
            <Dialog open={showVerifiedDialog} onOpenChange={setShowVerifiedDialog}>
                <DialogContent className="sm:max-w-md border-0 overflow-hidden">
                    {/* Decorative background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-transparent to-accent/10" />
                    <div className="absolute top-0 right-0 w-40 h-40 bg-success/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                    <div className="relative z-10 text-center py-6">
                        {/* Success Icon */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-success to-emerald-400 flex items-center justify-center mb-6 shadow-2xl shadow-success/50 animate-bounce-subtle">
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>

                        <DialogHeader className="space-y-3">
                            <DialogTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                                <PartyPopper className="w-6 h-6 text-warning" />
                                Email Verified!
                                <Sparkles className="w-6 h-6 text-accent" />
                            </DialogTitle>
                            <DialogDescription className="text-base">
                                Your email has been successfully verified. Welcome to <span className="font-semibold text-accent">TechMigos ProTask</span>!
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-6 space-y-3">
                            <p className="text-sm text-muted-foreground">
                                You now have full access to all features. Start managing your projects and tasks!
                            </p>
                            <Button
                                onClick={() => {
                                    setShowVerifiedDialog(false);
                                    router.push('/dashboard');
                                }}
                                className="w-full bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-500/90"
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Please Verify Email Dialog */}
            <Dialog open={showVerifyEmailDialog} onOpenChange={setShowVerifyEmailDialog}>
                <DialogContent className="sm:max-w-md border-0 overflow-hidden">
                    {/* Decorative background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-info/10 via-transparent to-accent/10" />

                    <div className="relative z-10 text-center py-6">
                        {/* Mail Icon */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-info to-accent flex items-center justify-center mb-6 shadow-2xl shadow-info/50 animate-float">
                            <Mail className="w-10 h-10 text-white" />
                        </div>

                        <DialogHeader className="space-y-3">
                            <DialogTitle className="text-2xl font-bold">
                                Verify Your Email
                            </DialogTitle>
                            <DialogDescription className="text-base">
                                We&apos;ve sent a verification link to:
                            </DialogDescription>
                        </DialogHeader>

                        <div className="my-4 p-3 rounded-lg bg-secondary/50 border border-border">
                            <p className="font-medium text-foreground">{email}</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Please check your inbox and click the verification link to activate your account.
                            </p>
                            <div className="text-xs text-muted-foreground/70 space-y-1">
                                <p>• Check your spam folder if you don&apos;t see the email</p>
                                <p>• The link expires in 24 hours</p>
                            </div>
                            <Button
                                onClick={() => setShowVerifyEmailDialog(false)}
                                variant="outline"
                                className="w-full"
                            >
                                Got it
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
