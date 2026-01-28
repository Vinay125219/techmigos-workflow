import { useState, useEffect } from 'react';
import { useTaskDependencies } from '@/hooks/useTaskDependencies';
import { useTasks } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link, Link2, Trash2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from '@/types/database';

interface TaskDependenciesProps {
    taskId: string;
    task?: Task; // Optional task to check completion status
}

export function TaskDependencies({ taskId, task }: TaskDependenciesProps) {
    const {
        dependencies,
        blockingTasks,
        blockedByTasks,
        loading,
        fetchDependencies,
        addDependency,
        removeDependency
    } = useTaskDependencies(taskId);

    const { tasks: allTasks, loading: tasksLoading } = useTasks();
    const [selectedTaskId, setSelectedTaskId] = useState('');
    const [dependencyType, setDependencyType] = useState<'blocks' | 'related'>('blocks');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchDependencies(taskId);
    }, [taskId, fetchDependencies]);

    // Check if task is completed (100% by definition)
    const isComplete = task?.status === 'completed';

    // Filter tasks that can be blocked (not self, not already linked)
    const availableTasks = allTasks.filter(t =>
        t.id !== taskId &&
        !dependencies.some(d => d.task_id === t.id || d.depends_on_task_id === t.id)
    );

    const handleAddDependency = async () => {
        if (!selectedTaskId) return;
        setAdding(true);
        await addDependency(taskId, selectedTaskId, dependencyType);
        setSelectedTaskId('');
        setAdding(false);
    };

    const getStatusColor = (status: string) => {
        if (status === 'completed') return 'text-success';
        return 'text-muted-foreground';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-accent" />
                <h4 className="font-medium text-base">Dependencies</h4>
            </div>

            {/* Add Dependency Form - Always enabled */}
            <div className="flex flex-col sm:flex-row gap-2 items-end p-3 rounded-lg bg-muted/30 border">
                <div className="w-full sm:w-1/2 space-y-1">
                    <Label className="text-xs">Task that blocks this one</Label>
                    <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select a task..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTasks.map(task => (
                                <SelectItem key={task.id} value={task.id} className="text-sm">
                                    <span className="truncate max-w-[200px] inline-block align-bottom">{task.title}</span>
                                </SelectItem>
                            ))}
                            {availableTasks.length === 0 && <div className="p-2 text-xs text-muted-foreground">No available tasks</div>}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full sm:w-[120px] space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={dependencyType} onValueChange={(v) => setDependencyType(v as 'blocks' | 'related')}>
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="blocks">Blocks</SelectItem>
                            <SelectItem value="related">Related</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button
                    onClick={handleAddDependency}
                    disabled={!selectedTaskId || adding}
                    size="sm"
                    className="h-8"
                >
                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusIcon className="w-3 h-3 mr-1" />}
                    Add
                </Button>
            </div>

            {/* Blocking Tasks (Upstream) */}
            <div className="space-y-2">
                <h5 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-3 h-3" />
                    Blocked By ({blockingTasks.length})
                </h5>
                {loading ? (
                    <div className="p-2 text-center text-xs text-muted-foreground">Loading...</div>
                ) : blockingTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-5">No blocking tasks.</p>
                ) : (
                    <div className="space-y-2">
                        {blockingTasks.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className={cn("text-sm font-medium truncate", dep.depends_on_task?.status === 'completed' && "line-through text-muted-foreground")}>
                                            {dep.depends_on_task?.title}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline" className="text-xs py-0 h-4">
                                                {dep.depends_on_task?.status}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                                {dep.dependency_type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeDependency(dep.id)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Blocked By (Downstream) */}
            <div className="space-y-2">
                <h5 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3" />
                    Blocks ({blockedByTasks.length})
                </h5>
                {blockedByTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-5">This task blocks no others.</p>
                ) : (
                    <div className="space-y-2">
                        {blockedByTasks.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/20">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {dep.task?.title}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline" className="text-xs py-0 h-4">
                                                {dep.task?.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                {/* Cannot delete downstream dependencies from here easily without confusion, maybe view only */}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    );
}
