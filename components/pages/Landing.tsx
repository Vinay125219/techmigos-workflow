import { useRouter } from 'next/navigation';

import { useEffect } from 'react';
import {
    CheckCircle2,
    Users,
    FolderKanban,
    BarChart3,
    Lightbulb,
    ArrowRight,
    Rocket,
    Shield,
    Zap,
    Clock,
    Target,
    MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const features = [
    {
        icon: FolderKanban,
        title: 'Project Management',
        description: 'Organize projects with priorities, deadlines, and progress tracking. Keep your team aligned on goals.',
    },
    {
        icon: CheckCircle2,
        title: 'Task Marketplace',
        description: 'Browse and assign tasks based on skills. Team members can take on work that matches their expertise.',
    },
    {
        icon: Users,
        title: 'Team Workspaces',
        description: 'Create collaborative workspaces. Invite members, organize projects, and manage permissions.',
    },
    {
        icon: BarChart3,
        title: 'Analytics & Insights',
        description: 'Track completion rates, monitor productivity, and identify bottlenecks with real-time analytics.',
    },
    {
        icon: Lightbulb,
        title: 'Ideas & Innovation',
        description: 'Capture ideas, vote on suggestions, and turn innovation into actionable projects.',
    },
    {
        icon: MessageSquare,
        title: 'Real-time Updates',
        description: 'Get instant notifications on task updates, deadlines, and team activities.',
    },
];

const benefits = [
    {
        icon: Zap,
        title: 'Boost Productivity',
        description: 'Streamline workflows and reduce time spent on task management.',
    },
    {
        icon: Target,
        title: 'Stay Focused',
        description: 'Clear priorities and deadlines help teams focus on what matters.',
    },
    {
        icon: Clock,
        title: 'Save Time',
        description: 'Automated tracking and reminders eliminate manual follow-ups.',
    },
    {
        icon: Shield,
        title: 'Secure & Reliable',
        description: 'Enterprise-grade security with role-based access control.',
    },
];

export default function Landing() {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    // Redirect authenticated users to dashboard
    useEffect(() => {
        if (!loading && isAuthenticated) {
            router.replace('/dashboard');
        }
    }, [isAuthenticated, loading, router]);

    // Show nothing while checking auth (prevents flash)
    if (loading) {
        return null;
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 glass-effect border-b">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                                <Rocket className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="font-bold text-lg">TechMigos</span>
                                <span className="text-muted-foreground text-sm ml-1">ProTask</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isAuthenticated ? (
                                <Button onClick={() => router.push('/dashboard')}>
                                    Go to Dashboard
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" onClick={() => router.push('/auth')}>
                                        Sign In
                                    </Button>
                                    <Button onClick={() => router.push('/auth')}>
                                        Get Started
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                    <Button variant="outline" onClick={() => router.push('/demo')} className="hidden sm:flex">
                                        Live Demo
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative overflow-hidden py-16 md:py-24 lg:py-32">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-background to-background" />
                <div className="container mx-auto px-4 relative">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <Rocket className="w-4 h-4" />
                            <span>Built by TechMigos</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                            <span className="gradient-text">Modern Task Management</span>
                            <br />
                            <span className="text-foreground">for Productive Teams</span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                            Streamline your team's workflow with ProTask. Create projects, assign tasks,
                            track progress, and collaborate seamlessly — all in one powerful platform.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="text-lg px-8 py-6" onClick={() => router.push('/auth')}>
                                Start Free Today
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>


                        <p className="text-sm text-muted-foreground mt-4">
                            No credit card required • Free tier available
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 md:py-24 bg-secondary/30">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12 md:mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Everything You Need to Manage Tasks
                        </h2>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                            From project creation to completion tracking, ProTask provides all the tools your team needs.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <Card key={feature.title} className="card-hover border-2 hover:border-accent/50">
                                    <CardContent className="p-6">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--gradient-primary)' }}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">
                                Why Teams Choose <span className="gradient-text">ProTask</span>
                            </h2>
                            <p className="text-muted-foreground text-lg mb-8">
                                ProTask is designed to help teams of all sizes stay organized, meet deadlines,
                                and deliver results. Built with modern technology for a seamless experience.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {benefits.map((benefit) => {
                                    const Icon = benefit.icon;
                                    return (
                                        <div key={benefit.title} className="flex gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                                <Icon className="w-5 h-5 text-accent" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-1">{benefit.title}</h4>
                                                <p className="text-sm text-muted-foreground">{benefit.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-8 border-2 border-accent/20">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-success" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Real-time Collaboration</p>
                                        <p className="text-sm text-muted-foreground">Changes sync instantly across all devices</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-accent" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Role-Based Access</p>
                                        <p className="text-sm text-muted-foreground">Admin, Manager, and Member roles</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                                        <BarChart3 className="w-6 h-6 text-warning" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Progress Tracking</p>
                                        <p className="text-sm text-muted-foreground">Visual analytics and reports</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 md:py-24 bg-gradient-to-br from-accent/10 via-accent/5 to-background">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to Transform Your Team's Productivity?
                    </h2>
                    <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
                        Join teams who are already using ProTask to manage projects and deliver results.
                    </p>
                    <Button size="lg" className="text-lg px-8 py-6" onClick={() => router.push('/auth')}>
                        Get Started Free
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t py-8 mt-auto">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                                <Rocket className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold">TechMigos ProTask</span>
                        </div>

                        <p className="text-sm text-muted-foreground text-center">
                            © {new Date().getFullYear()} <a href="https://www.techmigos.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">TechMigos</a>.
                            All rights reserved. Made with ❤️ in Hyderabad.
                        </p>

                        <div className="flex gap-4 text-sm">
                            <a href="https://www.techmigos.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                                About TechMigos
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
