"use client";
import { useState, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types/database';
import { TaskCard } from '@/components/tasks/TaskCard';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
    tasks: Task[];
    onTaskUpdate: (task: Task, newStatus: string) => void;
}

const COLUMNS = [
    { id: 'open', title: 'To Do', color: 'bg-slate-500/10 border-slate-500/20' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'review', title: 'Review', color: 'bg-orange-500/10 border-orange-500/20' },
    { id: 'completed', title: 'Done', color: 'bg-green-500/10 border-green-500/20' },
];

export function KanbanBoard({ tasks, onTaskUpdate }: KanbanBoardProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const activeTask = tasks.find(t => t.id === active.id);

        // If dropped over a container (column)
        if (over && activeTask) {
            const overId = over.id as string;
            // Check if dropped directly on a column
            const isOverColumn = COLUMNS.some(col => col.id === overId);
            // Or dropped on a task in that column (not implementing reordering within column for simple status update yet, just status change)

            if (isOverColumn && activeTask.status !== overId) {
                onTaskUpdate(activeTask, overId);
            }
        }
        setActiveId(null);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        // Find the container (status) for the active item
        const activeTask = tasks.find(t => t.id === active.id);
        if (!activeTask) return;

        // If hovering over a different column, could give visual feedback, 
        // but the overlay handles the visual "floating".
    };

    // Group tasks by status
    const tasksByStatus = useMemo(() => {
        const grouped: Record<string, Task[]> = {
            open: [],
            'in-progress': [],
            review: [],
            completed: []
        };
        tasks.forEach(task => {
            const status = task.status || 'open';
            if (grouped[status]) {
                grouped[status].push(task);
            } else {
                // Fallback for unknown statuses
                if (!grouped['open']) grouped['open'] = [];
                grouped['open'].push(task);
            }
        });
        return grouped;
    }, [tasks]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            <div id="kanban-board" className="flex gap-6 overflow-x-auto pb-6 h-[calc(100vh-12rem)]">
                {COLUMNS.map((column) => (
                    <div
                        key={column.id}
                        className={cn(
                            "flex-1 min-w-[300px] flex flex-col rounded-xl border bg-secondary/30",
                            column.color
                        )}
                    >
                        <div className="p-4 font-semibold flex items-center justify-between sticky top-0 bg-transparent z-10">
                            <span className="capitalize">{column.title}</span>
                            <span className="text-xs bg-background/50 px-2 py-1 rounded-full text-muted-foreground w-6 h-6 flex items-center justify-center">
                                {tasksByStatus[column.id]?.length || 0}
                            </span>
                        </div>

                        <DroppableColumn id={column.id} tasks={tasksByStatus[column.id] || []}>
                            <div className="flex-1 p-2 space-y-3 overflow-y-auto min-h-[150px]">
                                <SortableContext
                                    items={(tasksByStatus[column.id] || []).map(t => t.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {(tasksByStatus[column.id] || []).map((task) => (
                                        <SortableTaskCard key={task.id} task={task} />
                                    ))}
                                </SortableContext>
                                {/* Empty placeholder if no tasks */}
                                {(!tasksByStatus[column.id] || tasksByStatus[column.id].length === 0) && (
                                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-lg m-2">
                                        No tasks
                                    </div>
                                )}
                            </div>
                        </DroppableColumn>
                    </div>
                ))}
            </div>

            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                        active: {
                            opacity: '0.5',
                        },
                    },
                }),
            }}>
                {activeId ? (
                    <div className="transform rotate-3 scale-105 cursor-grabbing opacity-90">
                        <TaskCard task={tasks.find(t => t.id === activeId)!} viewMode="grid" />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// Wrapper for Droppable Column
import { useDroppable } from '@dnd-kit/core';

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode; tasks?: Task[] }) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-1 flex flex-col transition-colors rounded-b-xl",
                isOver ? "bg-accent/5 ring-2 ring-inset ring-accent/20" : ""
            )}
        >
            {children}
        </div>
    );
}

// Wrapper for Sortable Task Card
function SortableTaskCard({ task }: { task: Task }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn("touch-none", isDragging && "opacity-0")}>
            <TaskCard task={task} viewMode="grid" />
        </div>
    );
}
