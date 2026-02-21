"use client";

import * as React from "react";
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    Rocket,
    Lightbulb,
    Users,
    Wallet,
    FileText
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { DialogProps } from "@radix-ui/react-dialog";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useIdeas } from "@/hooks/useIdeas";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

export function CommandMenu({ ...props }: DialogProps) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const { activeWorkspaceId } = useWorkspaceContext();
    const { isManager } = useAuth();
    const { projects } = useProjects({ workspaceId: activeWorkspaceId, pageSize: 8 });
    const { tasks } = useTasks({ workspaceId: activeWorkspaceId, pageSize: 8 });
    const { ideas } = useIdeas();
    const { members } = useTeamMembers({ workspaceId: activeWorkspaceId });

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        const openEvent = () => setOpen(true);

        document.addEventListener("keydown", down);
        document.addEventListener("openCommandMenu", openEvent);
        return () => {
            document.removeEventListener("keydown", down);
            document.removeEventListener("openCommandMenu", openEvent);
        };
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/tasks'))}>
                        <ListTodo className="mr-2 h-4 w-4" />
                        <span>Tasks</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/projects'))}>
                        <FolderKanban className="mr-2 h-4 w-4" />
                        <span>Projects</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/documents'))}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Documents</span>
                    </CommandItem>
                    {isManager && (
                        <CommandItem onSelect={() => runCommand(() => router.push('/transactions'))}>
                            <Wallet className="mr-2 h-4 w-4" />
                            <span>Transactions</span>
                        </CommandItem>
                    )}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Projects">
                    {projects.slice(0, 5).map((project) => (
                        <CommandItem key={project.id} onSelect={() => runCommand(() => router.push(`/projects?highlight=${project.id}`))}>
                            <FolderKanban className="mr-2 h-4 w-4" />
                            <span>{project.name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="Tasks">
                    {tasks.slice(0, 5).map((task) => (
                        <CommandItem key={task.id} onSelect={() => runCommand(() => router.push(`/tasks?highlight=${task.id}`))}>
                            <ListTodo className="mr-2 h-4 w-4" />
                            <span>{task.title}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="Ideas">
                    {ideas.slice(0, 4).map((idea) => (
                        <CommandItem key={idea.id} onSelect={() => runCommand(() => router.push(`/ideas?highlight=${idea.id}`))}>
                            <Lightbulb className="mr-2 h-4 w-4" />
                            <span>{idea.title}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="Team">
                    {members.slice(0, 4).map((member) => (
                        <CommandItem key={member.id} onSelect={() => runCommand(() => router.push('/dashboard'))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>{member.full_name}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="Actions">
                    <CommandItem onSelect={() => runCommand(() => router.push('/planning'))}>
                        <Rocket className="mr-2 h-4 w-4" />
                        <span>Open planning view</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/ideas'))}>
                        <Lightbulb className="mr-2 h-4 w-4" />
                        <span>Capture a new idea</span>
                        <CommandShortcut>⌘I</CommandShortcut>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
