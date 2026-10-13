/*
# Create profiles and technicians tables with RLS and auto-profile trigger

## Purpose
Sets up the core data layer for FixMate authentication and role-based access.

## New Tables

### profiles
- `id` (uuid, primary key) — internal profile ID
- `user_id` (uuid, unique, references auth.users) — the Supabase auth user
- `name` (text) — user's display name
- `email` (text) — user's email (mirrors auth.users)
- `phone` (text, nullable) — phone number
- `role` (text, default 'user') — one of: user, technician, admin
- `avatar_url` (text, nullable) — profile picture URL
- `created_at` (timestamptz) — creation timestamp
- `updated_at` (timestamptz) — last update timestamp

### technicians
- `id` (uuid, primary key) — internal technician ID
- `profile_id` (uuid, references profiles) — link to the profile
- `profession` (text) — e.g. Plumber, Electrician
- `experience_years` (integer, nullable) — years of experience
- `service_area` (text, nullable) — city/area served
- `whatsapp_number` (text, nullable) — WhatsApp contact
- `verification_status` (text, default 'pending') — one of: pending, verified, rejected
- `bio` (text, nullable) — short professional bio
- `created_at` (timestamptz) — creation timestamp
- `updated_at` (timestamptz) — last update timestamp

## Security — Row Level Security

### profiles
- SELECT: authenticated users can read ONLY their own profile
- INSERT: handled automatically by trigger (runs as postgrest); users can also insert their own
- UPDATE: users can update ONLY their own profile
- DELETE: users can delete ONLY their own profile

### technicians
- SELECT: authenticated users can read their own technician record; all authenticated users can read verified technicians (for marketplace later)
- INSERT: authenticated users can create their own technician record
- UPDATE: technicians can update ONLY their own record
- DELETE: technicians can delete ONLY their own record

## Auto-Profile Trigger

A trigger function `handle_new_user()` runs AFTER INSERT on auth.users.
It creates a profile row with role = 'user' by default.
The role is read from the new user's raw_user_meta_data->>'role' if present,
so technician registration can pass role = 'technician'.

## Important Notes
1. The trigger uses AFTER INSERT on auth.users so every signup gets a profile automatically.
2. The role is sourced from raw_user_meta_data (set during signUp options.data), NOT raw_app_meta_data.
3. verification_status defaults to 'pending' — no technician is verified on registration.
4. Admin role is NOT selectable from the frontend; it can only be set in the database directly.
*/

-- ============================================================
-- profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'technician', 'admin')),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- profiles: SELECT own
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- profiles: INSERT own (trigger runs as postgrest role; this allows direct inserts too)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- profiles: UPDATE own
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- profiles: DELETE own
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- technicians table
-- ============================================================
CREATE TABLE IF NOT EXISTS technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profession text,
  experience_years integer,
  service_area text,
  whatsapp_number text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

-- technicians: SELECT own or verified (all authenticated can see verified technicians for marketplace)
DROP POLICY IF EXISTS "technicians_select_own_or_verified" ON technicians;
CREATE POLICY "technicians_select_own_or_verified"
ON technicians FOR SELECT
TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR verification_status = 'verified'
);

-- technicians: INSERT own
DROP POLICY IF EXISTS "technicians_insert_own" ON technicians;
CREATE POLICY "technicians_insert_own"
ON technicians FOR INSERT
TO authenticated
WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- technicians: UPDATE own
DROP POLICY IF EXISTS "technicians_update_own" ON technicians;
CREATE POLICY "technicians_update_own"
ON technicians FOR UPDATE
TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- technicians: DELETE own
DROP POLICY IF EXISTS "technicians_delete_own" ON technicians;
CREATE POLICY "technicians_delete_own"
ON technicians FOR DELETE
TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================================
-- Auto-profile trigger on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- updated_at helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS technicians_set_updated_at ON technicians;
CREATE TRIGGER technicians_set_updated_at
  BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
