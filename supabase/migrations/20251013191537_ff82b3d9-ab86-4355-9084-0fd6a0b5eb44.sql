-- Create enums
CREATE TYPE public.app_role AS ENUM ('agent', 'broker_admin', 'owner');
CREATE TYPE public.org_plan AS ENUM ('Trial', 'Solo', 'Team', 'Broker');
CREATE TYPE public.lead_source AS ENUM ('Zillow', 'Realtor', 'FB', 'Website', 'Referral', 'Manual', 'Unknown');
CREATE TYPE public.lead_stage AS ENUM ('New', 'Conversation', 'Nurture', 'Hot', 'Under_Contract', 'Closed', 'Lost');
CREATE TYPE public.interaction_channel AS ENUM ('email', 'sms', 'call', 'note', 'site_chat', 'form');
CREATE TYPE public.interaction_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.sentiment AS ENUM ('pos', 'neu', 'neg');
CREATE TYPE public.purchase_window AS ENUM ('ASAP', '1-3mo', '3-6mo', '6-12mo', 'unknown');
CREATE TYPE public.gating_factor AS ENUM ('rates', 'downpayment', 'inventory', 'credit', 'just_browsing', 'unknown');

-- Create orgs table
CREATE TABLE public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan org_plan DEFAULT 'Trial',
  seats INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Create user_roles table (CRITICAL: separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source lead_source DEFAULT 'Unknown',
  stage lead_stage DEFAULT 'New',
  budget_min NUMERIC,
  budget_max NUMERIC,
  beds INT,
  baths NUMERIC,
  city TEXT,
  zip TEXT,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create interactions table
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel interaction_channel NOT NULL,
  direction interaction_direction NOT NULL,
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- Create intent_snapshots table
CREATE TABLE public.intent_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  model_version TEXT DEFAULT 'v1',
  sentiment sentiment DEFAULT 'neu',
  purchase_window purchase_window DEFAULT 'unknown',
  gating_factor gating_factor DEFAULT 'unknown',
  urgency_score INT CHECK (urgency_score >= 0 AND urgency_score <= 100) DEFAULT 50,
  price_ceiling NUMERIC,
  neighborhoods JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_snapshots ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user's org_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS Policies for orgs
CREATE POLICY "Users can view their own org"
  ON public.orgs FOR SELECT
  USING (id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Owners can update their org"
  ON public.orgs FOR UPDATE
  USING (
    id = public.get_user_org_id(auth.uid()) 
    AND public.has_role(auth.uid(), 'owner')
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their org"
  ON public.profiles FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can manage roles in their org"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), 'owner')
    AND user_id IN (
      SELECT id FROM public.profiles 
      WHERE org_id = public.get_user_org_id(auth.uid())
    )
  );

-- RLS Policies for leads
CREATE POLICY "Users can view leads in their org"
  ON public.leads FOR SELECT
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create leads in their org"
  ON public.leads FOR INSERT
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can update leads in their org"
  ON public.leads FOR UPDATE
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Admins can delete leads in their org"
  ON public.leads FOR DELETE
  USING (
    org_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'owner') 
      OR public.has_role(auth.uid(), 'broker_admin')
    )
  );

-- RLS Policies for interactions
CREATE POLICY "Users can view interactions for their org's leads"
  ON public.interactions FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE org_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "Users can create interactions for their org's leads"
  ON public.interactions FOR INSERT
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE org_id = public.get_user_org_id(auth.uid())
    )
  );

-- RLS Policies for intent_snapshots
CREATE POLICY "Users can view intent snapshots for their org's leads"
  ON public.intent_snapshots FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE org_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "System can create intent snapshots"
  ON public.intent_snapshots FOR INSERT
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads 
      WHERE org_id = public.get_user_org_id(auth.uid())
    )
  );

-- Create trigger function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a new org for the user
  INSERT INTO public.orgs (name, plan, seats)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Organization',
    'Trial',
    1
  )
  RETURNING id INTO new_org_id;

  -- Create profile
  INSERT INTO public.profiles (id, org_id, full_name, email, timezone)
  VALUES (
    NEW.id,
    new_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'America/New_York'
  );

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Trigger on auth.users creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at trigger to leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();