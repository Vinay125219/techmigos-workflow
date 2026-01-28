-- Migration: Bootstrap initial admin user
-- This is a one-time operation to create the first admin
-- SAFE: Only inserts one row, no modifications to existing data

DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get user ID by email
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'm.vinay.sagar21@gmail.com';
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'User m.vinay.sagar21@gmail.com not found. Please sign up first.';
    END IF;
    
    -- Insert admin role (idempotent - safe to run multiple times)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to m.vinay.sagar21@gmail.com';
END $$;
