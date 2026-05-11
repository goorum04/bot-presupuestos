-- =========================================================
-- Bot Presupuestos — Schema inicial
-- =========================================================

-- ========================
-- PROFILES
-- ========================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================
-- SUPPLIERS (Fournisseurs)
-- ========================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  siret       TEXT UNIQUE,
  tva_number  TEXT,
  address     TEXT,
  city        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- PROJECTS (Chantiers)
-- ========================
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  client_name  TEXT,
  address      TEXT,
  city         TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  start_date   DATE,
  end_date     DATE,
  total_budget NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- BUDGET CATEGORIES
-- ========================
CREATE TABLE IF NOT EXISTS public.budget_categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL CHECK (slug IN (
                       'materiaux', 'main_oeuvre', 'materiel', 'sous_traitants', 'divers'
                     )),
  budget_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  alert_threshold_pct NUMERIC(5,2) DEFAULT 80,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, slug)
);

-- ========================
-- INVOICES (Factures)
-- ========================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES public.budget_categories(id),
  supplier_id       UUID REFERENCES public.suppliers(id),
  uploaded_by       UUID NOT NULL REFERENCES public.profiles(id),

  -- File
  image_path        TEXT NOT NULL,

  -- OCR State
  ocr_status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (ocr_status IN ('pending','processing','completed','failed','needs_review')),
  ocr_confidence    NUMERIC(4,3),
  ocr_raw_response  JSONB,

  -- Extracted fields
  invoice_number    TEXT,
  invoice_date      DATE,
  due_date          DATE,
  supplier_name     TEXT,
  supplier_siret    TEXT,
  supplier_tva_num  TEXT,
  supplier_address  TEXT,

  -- Amounts
  amount_ht         NUMERIC(15,2),
  tva_rate          NUMERIC(5,2),
  tva_amount        NUMERIC(15,2),
  amount_ttc        NUMERIC(15,2),
  tva_breakdown     JSONB,

  -- Validation
  is_validated      BOOLEAN DEFAULT false,
  validated_by      UUID REFERENCES public.profiles(id),
  validated_at      TIMESTAMPTZ,
  notes             TEXT,

  -- Payment
  payment_status    TEXT DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','partial','paid')),
  payment_date      DATE,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_project_id   ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_category_id  ON public.invoices(category_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_ocr_status   ON public.invoices(ocr_status);
CREATE INDEX IF NOT EXISTS idx_invoices_uploaded_by  ON public.invoices(uploaded_by);

-- ========================
-- ALERTS
-- ========================
CREATE TABLE IF NOT EXISTS public.alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES public.budget_categories(id),
  invoice_id   UUID REFERENCES public.invoices(id),
  type         TEXT NOT NULL CHECK (type IN (
                 'budget_threshold', 'budget_exceeded',
                 'unusual_amount', 'duplicate_invoice', 'ocr_failed'
               )),
  severity     TEXT NOT NULL DEFAULT 'warning'
               CHECK (severity IN ('info', 'warning', 'critical')),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  metadata     JSONB,
  is_read      BOOLEAN DEFAULT false,
  read_by      UUID REFERENCES public.profiles(id),
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_project_id  ON public.alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read     ON public.alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at  ON public.alerts(created_at DESC);

-- ========================
-- RLS
-- ========================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts           ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- PROFILES
CREATE POLICY "own_profile_read"    ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin_all_profiles"  ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "own_profile_update"  ON public.profiles FOR UPDATE USING (id = auth.uid());

-- PROJECTS
CREATE POLICY "auth_read_projects"  ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_projects" ON public.projects
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- BUDGET CATEGORIES
CREATE POLICY "auth_read_categories" ON public.budget_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_categories" ON public.budget_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SUPPLIERS
CREATE POLICY "auth_read_suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- INVOICES
CREATE POLICY "auth_read_invoices"   ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "admin_update_invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "admin_delete_invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.is_admin());

-- ALERTS
CREATE POLICY "auth_read_alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_alerts" ON public.alerts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auth_read_own_alerts" ON public.alerts FOR UPDATE TO authenticated
  USING (true);
