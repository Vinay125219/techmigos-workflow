-- TechMigos ProTask - Seed Data for Development
-- Run this after initial migrations to populate test data

-- Note: This seed file creates sample data for development/testing
-- In production, users would create their own data through the app

-- Sample Projects (will be created by first admin user)
-- These are templates that can be uncommented and used with a valid user ID

/*
-- After creating your first user through the app, replace 'YOUR_USER_ID' with their UUID

INSERT INTO public.projects (name, description, category, status, priority, progress, created_by) VALUES
('Website Redesign', 'Complete overhaul of the company website with modern design', 'Development', 'active', 'high', 30, 'YOUR_USER_ID'),
('Mobile App MVP', 'Build minimum viable product for the mobile application', 'Development', 'active', 'critical', 15, 'YOUR_USER_ID'),
('Q1 Marketing Campaign', 'Plan and execute Q1 marketing initiatives', 'Marketing', 'planned', 'medium', 0, 'YOUR_USER_ID'),
('Infrastructure Upgrade', 'Upgrade cloud infrastructure for better performance', 'DevOps', 'active', 'high', 50, 'YOUR_USER_ID');

-- Sample Tasks (use project IDs from above)

INSERT INTO public.tasks (project_id, title, description, status, priority, difficulty, estimated_hours, skills, created_by) VALUES
((SELECT id FROM projects WHERE name = 'Website Redesign'), 'Design Homepage Mockup', 'Create high-fidelity mockup for the new homepage', 'open', 'high', 'medium', 8, ARRAY['UI/UX', 'Figma'], 'YOUR_USER_ID'),
((SELECT id FROM projects WHERE name = 'Website Redesign'), 'Implement Responsive Navigation', 'Build mobile-friendly navigation component', 'open', 'medium', 'medium', 6, ARRAY['React', 'CSS'], 'YOUR_USER_ID'),
((SELECT id FROM projects WHERE name = 'Mobile App MVP'), 'Setup React Native Project', 'Initialize project with required dependencies', 'open', 'high', 'easy', 4, ARRAY['React Native', 'Mobile'], 'YOUR_USER_ID'),
((SELECT id FROM projects WHERE name = 'Mobile App MVP'), 'Design App Architecture', 'Plan the overall app structure and state management', 'open', 'critical', 'hard', 12, ARRAY['Architecture', 'React Native'], 'YOUR_USER_ID');

-- Sample Ideas

INSERT INTO public.ideas (title, description, category, status, votes, created_by) VALUES
('Dark Mode Support', 'Add system-wide dark mode toggle for better accessibility', 'Feature', 'open', 5, 'YOUR_USER_ID'),
('Keyboard Shortcuts', 'Implement keyboard shortcuts for power users', 'Enhancement', 'under-review', 8, 'YOUR_USER_ID'),
('Slack Integration', 'Connect with Slack for notifications and updates', 'Integration', 'approved', 12, 'YOUR_USER_ID');
*/

-- Storage bucket for task attachments (if not created by config.toml)
-- This is handled by Supabase config.toml storage section

-- You can run this file using:
-- npx supabase db push
-- or through Supabase Dashboard SQL Editor
