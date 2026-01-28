"use client";
import { useState } from 'react';
import { LayoutGrid, Columns } from 'lucide-react';
import { DemoSidebar } from './DemoSidebar';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { ProductTour } from '@/components/onboarding/ProductTour';
import { MOCK_TASKS } from './DemoData';
import { Task } from '@/types/database';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';

export default function DemoDashboard() {
    const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
    const [viewMode, setViewMode] = useState<'grid' | 'board'>('board');

    const handleTaskUpdate = (task: Task, newStatus: string) => {
        // Local state update for demo
        setTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: newStatus as any } : t
        ));
        toast({ title: "Task moved", description: `Task moved to ${newStatus.replace('_', ' ')}` });
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <DemoSidebar />
            <ProductTour />

            <main className="flex-1 ml-20 min-h-screen transition-all duration-300">
                <div className="p-8 max-w-7xl mx-auto animate-fade-in">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Task Marketplace (Demo)</h1>
                            <p className="text-muted-foreground">
                                Experience the ProTask workflow with sample data.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-secondary/50 p-1 rounded-lg flex gap-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={cn("p-2 rounded-md transition-all", viewMode === 'grid' ? "bg-background shadow-sm" : "hover:bg-background/50")}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('board')}
                                    className={cn("p-2 rounded-md transition-all", viewMode === 'board' ? "bg-background shadow-sm" : "hover:bg-background/50")}
                                >
                                    <Columns className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6 flex gap-2">
                        <span className="px-3 py-1 bg-secondary rounded-full text-xs text-muted-foreground">Mock Data Mode</span>
                    </div>

                    {viewMode === 'board' ? (
                        <KanbanBoard tasks={tasks} onTaskUpdate={handleTaskUpdate} />
                    ) : (
                        <motion.div
                            layout
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                        >
                            <AnimatePresence mode='popLayout'>
                                {tasks.map((task) => (
                                    <TaskCard key={task.id} task={task} viewMode="grid" />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </main>
            <Toaster />
        </div>
    );
}
