import { Task } from "@/types/database";

export const MOCK_USERS = [
    {
        id: 'admin-1',
        full_name: 'Alice Admin',
        avatar_url: 'https://ui-avatars.com/api/?name=Alice+Admin&background=random',
        role: 'admin',
        email: 'alice@techmigos.com'
    },
    {
        id: 'manager-1',
        full_name: 'Bob Manager',
        avatar_url: 'https://ui-avatars.com/api/?name=Bob+Manager&background=random',
        role: 'manager',
        email: 'bob@techmigos.com'
    },
    {
        id: 'member-1',
        full_name: 'Charlie Dev',
        avatar_url: 'https://ui-avatars.com/api/?name=Charlie+Dev&background=random',
        role: 'member',
        email: 'charlie@techmigos.com'
    }
];

export const MOCK_TASKS: Task[] = [
    {
        id: 'task-1',
        title: 'Redesign Homepage Hero Section',
        description: 'Update the main banner to use the new glassmorphism style and 3D assets.',
        status: 'in-progress',
        priority: 'high',
        difficulty: 'medium',
        project_id: 'proj-1',
        workspace_id: null,
        requirements: null,
        deliverables: null,
        assigned_to: 'member-1',
        created_by: 'manager-1',
        deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        estimated_hours: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        skills: ['React', 'Tailwind', 'Design'],
        assignee: MOCK_USERS[2] as any
    },
    {
        id: 'task-2',
        title: 'Fix Login Mobile Responsiveness',
        description: 'The login form overlaps with the footer on iPhone SE screens.',
        status: 'open',
        priority: 'critical',
        difficulty: 'easy',
        project_id: 'proj-1',
        workspace_id: null,
        requirements: null,
        deliverables: null,
        assigned_to: null,
        created_by: 'admin-1',
        deadline: new Date(Date.now() + 172800000).toISOString(),
        estimated_hours: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        skills: ['CSS', 'Mobile'],
        assignee: undefined
    },
    {
        id: 'task-3',
        title: 'Integrate Stripe Payments',
        description: 'Implement the subscription checkout flow using Stripe Elements.',
        status: 'review',
        priority: 'high',
        difficulty: 'hard',
        project_id: 'proj-1',
        workspace_id: null,
        requirements: null,
        deliverables: null,
        assigned_to: 'member-1',
        created_by: 'manager-1',
        deadline: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        estimated_hours: 8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        skills: ['Node.js', 'Stripe', 'Backend'],
        assignee: MOCK_USERS[2] as any
    },
    {
        id: 'task-4',
        title: 'Write API Documentation',
        description: 'Document the new endpoints for the mobile app team.',
        status: 'completed',
        priority: 'low',
        difficulty: 'medium',
        project_id: 'proj-1',
        workspace_id: null,
        requirements: null,
        deliverables: null,
        assigned_to: 'manager-1',
        created_by: 'admin-1',
        deadline: null,
        estimated_hours: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        skills: ['Documentation', 'Markdown'],
        assignee: MOCK_USERS[1] as any
    }
];
