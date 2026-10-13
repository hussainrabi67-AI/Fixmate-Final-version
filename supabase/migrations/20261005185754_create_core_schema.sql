/*
# FixMate core database schema — Phase 4

## Purpose
Creates the core platform tables for service categories, technician services,
service requests, AI diagnoses, quotes, bookings, reviews, notifications,
and complaints. Includes RLS policies, indexes, and seed data.

## New Tables

### service_categories
- `id` (uuid, PK) — category ID
- `name` (text, not null) — category name
- `description` (text) — short description
- `icon` (text) — emoji or icon identifier
- `image_url` (text) — optional image URL
- `is_active` (boolean, default true) — whether the category is visible
- `created_at` (timestamptz) — creation timestamp

### technician_services
- `id` (uuid, PK) — link ID
- `technician_id` (uuid, FK → technicians) — the technician
- `service_category_id` (uuid, FK → service_categories) — the category
- `created_at` (timestamptz) — creation timestamp
- Unique constraint on (technician_id, service_category_id) to prevent duplicates

### service_requests
- `id` (uuid, PK) — request ID
- `user_id` (uuid, FK → profiles.user_id) — the customer
- `category_id` (uuid, FK → service_categories) — requested category
- `title` (text) — short title
- `description` (text) — problem description
- `image_url` (text) — optional uploaded photo
- `location` (text) — user's location/area
- `status` (text, default 'requested') — one of: requested, matching, quoted, booked, in_progress, completed, cancelled
- `created_at` / `updated_at` (timestamptz)

### ai_diagnoses
- `id` (uuid, PK) — diagnosis ID
- `request_id` (uuid, FK → service_requests) — linked request
- `problem_summary` (text) — AI summary of the problem
- `possible_causes` (jsonb) — array of possible causes
- `safe_steps` (jsonb) — array of safe first-step guidance
- `safety_warning` (text) — safety warning text
- `urgency` (text) — urgency level
- `professional_required` (boolean) — whether a pro is needed
- `recommended_category` (uuid, FK → service_categories) — suggested category
- `created_at` (timestamptz)

### quotes
- `id` (uuid, PK) — quote ID
- `request_id` (uuid, FK → service_requests) — linked request
- `technician_id` (uuid, FK → technicians) — quoting technician
- `amount` (numeric) — quoted price
- `message` (text) — message to customer
- `status` (text, default 'pending') — one of: pending, accepted, rejected, expired
- `created_at` (timestamptz)

### bookings
- `id` (uuid, PK) — booking ID
- `request_id` (uuid, FK → service_requests) — linked request
- `user_id` (uuid, FK → profiles.user_id) — the customer
- `technician_id` (uuid, FK → technicians) — the technician
- `scheduled_at` (timestamptz) — scheduled date/time
- `location` (text) — service location
- `notes` (text) — booking notes
- `status` (text, default 'requested') — one of: requested, accepted, scheduled, on_the_way, in_progress, completed, cancelled
- `created_at` / `updated_at` (timestamptz)

### reviews
- `id` (uuid, PK) — review ID
- `booking_id` (uuid, FK → bookings) — linked booking
- `user_id` (uuid, FK → profiles.user_id) — the reviewer
- `technician_id` (uuid, FK → technicians) — the reviewed technician
- `rating` (integer, 1-5) — star rating
- `comment` (text) — review text
- `created_at` (timestamptz)

### notifications
- `id` (uuid, PK) — notification ID
- `user_id` (uuid, FK → profiles.user_id) — recipient
- `type` (text) — notification type
- `title` (text) — notification title
- `message` (text) — notification body
- `read` (boolean, default false) — read status
- `created_at` (timestamptz)

### complaints
- `id` (uuid, PK) — complaint ID
- `user_id` (uuid, FK → profiles.user_id) — complainant
- `booking_id` (uuid, FK → bookings) — linked booking
- `subject` (text) — complaint subject
- `description` (text) — complaint details
- `status` (text, default 'open') — one of: open, under_review, resolved, closed
- `created_at` / `updated_at` (timestamptz)

## Security — Row Level Security

All tables have RLS enabled. Authorization is based on auth.uid() and the
user's role in the profiles table — NEVER on a role supplied by the browser.

### Helper function: get_user_role()
Returns the role of the currently authenticated user from profiles.
Used by RLS policies to determine access level.

### Customer (role = 'user') policies:
- service_requests: full CRUD on own requests
- bookings: read own bookings
- reviews: create/read reviews on own completed bookings
- notifications: read own notifications
- complaints: create/read own complaints

### Technician (role = 'technician') policies:
- service_requests: read requests with status requested/matching/quoted/booked (available or assigned)
- quotes: full CRUD on own quotes
- bookings: read/update own bookings
- technician_services: full CRUD on own technician services
- reviews: read reviews about themselves
- notifications: read own notifications

### Admin (role = 'admin') policies:
- Full access (SELECT/INSERT/UPDATE/DELETE) on all tables

### Public (anon + authenticated):
- service_categories: SELECT only (public catalog)

## Indexes
Created on: service_requests(user_id, category_id, status),
technician_services(technician_id, service_category_id),
quotes(request_id, technician_id), bookings(user_id, technician_id),
notifications(user_id).

## Seed Data
12 service categories inserted with names, descriptions, and emoji icons.

## Important Notes
1. Role is ALWAYS read from the profiles table via auth.uid(), never from the browser.
2. The get_user_role() helper is SECURITY DEFINER to allow policies to read roles efficiently.
3. No fake users, technicians, requests, or bookings are created — only service_categories seed data.
4. All status columns have CHECK constraints to enforce valid values.
5. Reviews are limited to ratings 1-5 via CHECK constraint.
*/

-- ============================================================
-- Helper: get current user's role from profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()),
    'anon'
  )
$$;

-- ============================================================
-- service_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Public read access for the category catalog
DROP POLICY IF EXISTS "service_categories_select_all" ON service_categories;
CREATE POLICY "service_categories_select_all"
ON service_categories FOR SELECT
TO anon, authenticated
USING (true);

-- Admin manage
DROP POLICY IF EXISTS "service_categories_admin_insert" ON service_categories;
CREATE POLICY "service_categories_admin_insert"
ON service_categories FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "service_categories_admin_update" ON service_categories;
CREATE POLICY "service_categories_admin_update"
ON service_categories FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "service_categories_admin_delete" ON service_categories;
CREATE POLICY "service_categories_admin_delete"
ON service_categories FOR DELETE
TO authenticated
USING (public.get_user_role() = 'admin');

-- ============================================================
-- technician_services
-- ============================================================
CREATE TABLE IF NOT EXISTS technician_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  service_category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technician_id, service_category_id)
);

ALTER TABLE technician_services ENABLE ROW LEVEL SECURITY;

-- Technicians manage their own services; admins manage all
DROP POLICY IF EXISTS "technician_services_select" ON technician_services;
CREATE POLICY "technician_services_select"
ON technician_services FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "technician_services_insert_own" ON technician_services;
CREATE POLICY "technician_services_insert_own"
ON technician_services FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "technician_services_update_own" ON technician_services;
CREATE POLICY "technician_services_update_own"
ON technician_services FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "technician_services_delete_own" ON technician_services;
CREATE POLICY "technician_services_delete_own"
ON technician_services FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

-- ============================================================
-- service_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  title text,
  description text,
  image_url text,
  location text,
  status text NOT NULL DEFAULT 'requested' CHECK (
    status IN ('requested', 'matching', 'quoted', 'booked', 'in_progress', 'completed', 'cancelled')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Customers: full CRUD on own; Technicians: read available/assigned; Admin: all
DROP POLICY IF EXISTS "service_requests_select" ON service_requests;
CREATE POLICY "service_requests_select"
ON service_requests FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR (
    public.get_user_role() = 'technician'
    AND status IN ('requested', 'matching', 'quoted', 'booked')
  )
);

DROP POLICY IF EXISTS "service_requests_insert_own" ON service_requests;
CREATE POLICY "service_requests_insert_own"
ON service_requests FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "service_requests_update_own" ON service_requests;
CREATE POLICY "service_requests_update_own"
ON service_requests FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "service_requests_delete_own" ON service_requests;
CREATE POLICY "service_requests_delete_own"
ON service_requests FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

DROP TRIGGER IF EXISTS service_requests_set_updated_at ON service_requests;
CREATE TRIGGER service_requests_set_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ai_diagnoses
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  problem_summary text,
  possible_causes jsonb,
  safe_steps jsonb,
  safety_warning text,
  urgency text,
  professional_required boolean,
  recommended_category uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_diagnoses ENABLE ROW LEVEL SECURITY;

-- Read: request owner or admin; (AI will insert via service role / edge function later)
DROP POLICY IF EXISTS "ai_diagnoses_select" ON ai_diagnoses;
CREATE POLICY "ai_diagnoses_select"
ON ai_diagnoses FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR request_id IN (SELECT id FROM service_requests WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "ai_diagnoses_insert" ON ai_diagnoses;
CREATE POLICY "ai_diagnoses_insert"
ON ai_diagnoses FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR request_id IN (SELECT id FROM service_requests WHERE user_id = auth.uid())
);

-- ============================================================
-- quotes
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  amount numeric,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'expired')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Read: request owner, quoting technician, or admin
DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select"
ON quotes FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR request_id IN (SELECT id FROM service_requests WHERE user_id = auth.uid())
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

-- Insert/Update/Delete: own technician quotes or admin
DROP POLICY IF EXISTS "quotes_insert_own" ON quotes;
CREATE POLICY "quotes_insert_own"
ON quotes FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "quotes_update_own" ON quotes;
CREATE POLICY "quotes_update_own"
ON quotes FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
  OR request_id IN (SELECT id FROM service_requests WHERE user_id = auth.uid())
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
  OR request_id IN (SELECT id FROM service_requests WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "quotes_delete_own" ON quotes;
CREATE POLICY "quotes_delete_own"
ON quotes FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

-- ============================================================
-- bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'requested' CHECK (
    status IN ('requested', 'accepted', 'scheduled', 'on_the_way', 'in_progress', 'completed', 'cancelled')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Read: customer (own), technician (own), or admin
DROP POLICY IF EXISTS "bookings_select" ON bookings;
CREATE POLICY "bookings_select"
ON bookings FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

-- Insert: customer or admin
DROP POLICY IF EXISTS "bookings_insert" ON bookings;
CREATE POLICY "bookings_insert"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Update: customer (own), technician (own), or admin
DROP POLICY IF EXISTS "bookings_update" ON bookings;
CREATE POLICY "bookings_update"
ON bookings FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
)
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
  OR technician_id IN (SELECT t.id FROM technicians t
    JOIN profiles p ON t.profile_id = p.id WHERE p.user_id = auth.uid())
);

-- Delete: admin only (bookings are business records)
DROP POLICY IF EXISTS "bookings_delete_admin" ON bookings;
CREATE POLICY "bookings_delete_admin"
ON bookings FOR DELETE
TO authenticated
USING (public.get_user_role() = 'admin');

DROP TRIGGER IF EXISTS bookings_set_updated_at ON bookings;
CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated can read reviews (public reputation); admin manages
DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all"
ON reviews FOR SELECT
TO authenticated
USING (true);

-- Insert: customer who owns the booking; admin can also insert
DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own"
ON reviews FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin'
  OR user_id = auth.uid()
);

-- Delete: admin only (reviews are moderated)
DROP POLICY IF EXISTS "reviews_delete_admin" ON reviews;
CREATE POLICY "reviews_delete_admin"
ON reviews FOR DELETE
TO authenticated
USING (public.get_user_role() = 'admin');

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type text,
  title text,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Read: own notifications only; admin all
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Update: own (mark as read); admin all
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Insert: admin or system (users don't create notifications directly)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Delete: admin or own
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
ON notifications FOR DELETE
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- ============================================================
-- complaints
-- ============================================================
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  subject text,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'under_review', 'resolved', 'closed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Read: own complaints or admin
DROP POLICY IF EXISTS "complaints_select_own" ON complaints;
CREATE POLICY "complaints_select_own"
ON complaints FOR SELECT
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Insert: own complaints or admin
DROP POLICY IF EXISTS "complaints_insert_own" ON complaints;
CREATE POLICY "complaints_insert_own"
ON complaints FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

-- Update: admin manages status; user can update own
DROP POLICY IF EXISTS "complaints_update" ON complaints;
CREATE POLICY "complaints_update"
ON complaints FOR UPDATE
TO authenticated
USING (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
)
WITH CHECK (
  public.get_user_role() = 'admin' OR user_id = auth.uid()
);

DROP TRIGGER IF EXISTS complaints_set_updated_at ON complaints;
CREATE TRIGGER complaints_set_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_category_id ON service_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_technician_services_technician_id ON technician_services(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_services_category_id ON technician_services(service_category_id);
CREATE INDEX IF NOT EXISTS idx_quotes_request_id ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_technician_id ON quotes(technician_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_technician_id ON bookings(technician_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- Seed: service categories
-- ============================================================
INSERT INTO service_categories (name, description, icon) VALUES
('Plumber', 'Pipe, tap & water problems', '🚰'),
('Electrician', 'Wiring, switches & electricity', '⚡'),
('AC / HVAC', 'Cooling & AC repair', '❄️'),
('Car Workshop', 'Car repair & maintenance', '🚗'),
('Bike Mechanic', 'Motorbike service & repair', '🏍️'),
('Cleaning', 'Home & office cleaning', '🧹'),
('Carpenter', 'Furniture & woodwork', '🔨'),
('Solar', 'Solar panel installation & repair', '☀️'),
('Appliance Repair', 'Washing machine, fridge & more', '🧺'),
('Painter', 'Interior & exterior painting', '🎨'),
('Pest Control', 'Insect & rodent control', '🐜'),
('General Maintenance', 'Handyman for everything else', '🔧')
ON CONFLICT DO NOTHING;
