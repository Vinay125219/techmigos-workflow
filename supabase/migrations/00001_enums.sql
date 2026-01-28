-- Migration: Create application enums
-- Part of TechMigos ProTask schema

-- Create user roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
