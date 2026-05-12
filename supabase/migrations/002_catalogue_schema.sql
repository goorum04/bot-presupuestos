-- =========================================================
-- Bot Presupuestos — Catálogo de proveedores
-- =========================================================

-- ========================
-- EXTENSIONS
-- ========================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================
-- SUPPLIERS — extend existing table
-- ========================
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS catalog_url      TEXT,
  ADD COLUMN IF NOT EXISTS scrape_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scraper_config   JSONB,
  ADD COLUMN IF NOT EXISTS last_scraped_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_count    INT NOT NULL DEFAULT 0;

-- ========================
-- MATERIAL CATEGORIES
-- ========================
CREATE TABLE IF NOT EXISTS public.material_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.material_categories(id),
  devis_type  TEXT CHECK (devis_type IN (
                'materiaux','main_oeuvre','materiel','sous_traitance','forfait'
              )),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- CATALOG PRODUCTS
-- ========================
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES public.material_categories(id),
  reference        TEXT,
  name             TEXT NOT NULL,
  description      TEXT,
  unit             TEXT NOT NULL DEFAULT 'u',
  unit_price_ht    NUMERIC(15,4),
  currency         TEXT NOT NULL DEFAULT 'EUR',
  is_available     BOOLEAN NOT NULL DEFAULT true,
  source           TEXT NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('scrape','csv_import','manual')),
  price_updated_at TIMESTAMPTZ,
  search_vector    TSVECTOR,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_supplier      ON public.catalog_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category      ON public.catalog_products(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_search        ON public.catalog_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_catalog_products_price_updated ON public.catalog_products(price_updated_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_catalog_products_name_trgm     ON public.catalog_products USING GIN(name gin_trgm_ops);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION public.catalog_products_fts_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.reference, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_products_fts ON public.catalog_products;
CREATE TRIGGER catalog_products_fts
  BEFORE INSERT OR UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_products_fts_update();

-- ========================
-- SCRAPE JOBS
-- ========================
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','completed','failed','skipped')),
  source_type      TEXT NOT NULL DEFAULT 'web'
                   CHECK (source_type IN ('web','pdf','csv','manual')),
  source_url       TEXT,
  products_found   INT NOT NULL DEFAULT 0,
  products_updated INT NOT NULL DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  triggered_by     UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_supplier ON public.scrape_jobs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status   ON public.scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created  ON public.scrape_jobs(created_at DESC);

-- ========================
-- PURCHASE FREQUENCY VIEW
-- ========================
CREATE OR REPLACE VIEW public.supplier_purchase_frequency AS
SELECT
  i.supplier_id,
  s.name                  AS supplier_name,
  COUNT(*)::INT           AS invoice_count,
  SUM(i.amount_ht)        AS total_spent_ht,
  MAX(i.invoice_date)     AS last_purchase_date
FROM public.invoices i
JOIN public.suppliers s ON s.id = i.supplier_id
WHERE i.supplier_id IS NOT NULL
  AND i.is_validated = true
GROUP BY i.supplier_id, s.name;

-- ========================
-- RPC: search_catalog_products
-- ========================
CREATE OR REPLACE FUNCTION public.search_catalog_products(
  query_text   TEXT,
  item_type    TEXT DEFAULT NULL,
  result_limit INT  DEFAULT 5
)
RETURNS TABLE (
  product_id        UUID,
  product_name      TEXT,
  reference         TEXT,
  unit              TEXT,
  unit_price_ht     NUMERIC,
  price_updated_at  TIMESTAMPTZ,
  category_name     TEXT,
  supplier_id       UUID,
  supplier_name     TEXT,
  invoice_count     INT,
  relevance_score   FLOAT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cp.id,
    cp.name,
    cp.reference,
    cp.unit,
    cp.unit_price_ht,
    cp.price_updated_at,
    mc.name,
    s.id,
    s.name,
    COALESCE(spf.invoice_count, 0),
    (
      ts_rank(cp.search_vector, websearch_to_tsquery('french', query_text)) * 0.6
      + similarity(cp.name, query_text) * 0.3
      + LEAST(COALESCE(spf.invoice_count, 0)::FLOAT / 20.0, 0.1)
    ) AS relevance_score
  FROM public.catalog_products cp
  JOIN public.suppliers s ON s.id = cp.supplier_id
  LEFT JOIN public.material_categories mc ON mc.id = cp.category_id
  LEFT JOIN public.supplier_purchase_frequency spf ON spf.supplier_id = cp.supplier_id
  WHERE
    cp.is_available = true
    AND cp.unit_price_ht IS NOT NULL
    AND (
      cp.search_vector @@ websearch_to_tsquery('french', query_text)
      OR similarity(cp.name, query_text) > 0.15
    )
    AND (item_type IS NULL OR mc.devis_type = item_type)
  ORDER BY relevance_score DESC, cp.unit_price_ht ASC NULLS LAST
  LIMIT result_limit;
$$;

-- ========================
-- RLS
-- ========================
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs         ENABLE ROW LEVEL SECURITY;

-- material_categories: read for all auth, write for admin
CREATE POLICY "auth_read_mat_cats"   ON public.material_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_mat_cats" ON public.material_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- catalog_products: read for all auth, write for admin
CREATE POLICY "auth_read_catalog"    ON public.catalog_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_catalog"  ON public.catalog_products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- scrape_jobs: admin only
CREATE POLICY "admin_scrape_jobs" ON public.scrape_jobs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ========================
-- SEED: material categories
-- ========================
INSERT INTO public.material_categories (slug, name, devis_type) VALUES
  ('ciment_beton',        'Ciment & Béton',               'materiaux'),
  ('ferraillage',         'Ferraillage & Acier',           'materiaux'),
  ('bois_charpente',      'Bois & Charpente',              'materiaux'),
  ('isolation',           'Isolation',                     'materiaux'),
  ('carrelage',           'Carrelage & Revêtements',       'materiaux'),
  ('peinture',            'Peinture & Finitions',          'materiaux'),
  ('plomberie',           'Plomberie',                     'materiaux'),
  ('electricite',         'Électricité',                   'materiaux'),
  ('menuiserie',          'Menuiserie',                    'materiaux'),
  ('toiture',             'Toiture & Couverture',          'materiaux'),
  ('enduits_mortiers',    'Enduits & Mortiers',            'materiaux'),
  ('etancheite',          'Étanchéité',                    'materiaux'),
  ('quincaillerie',       'Quincaillerie & Fixations',     'materiaux'),
  ('terrassement',        'Terrassement & Granulats',      'materiaux'),
  ('prefabriques',        'Préfabriqués & Béton armé',     'materiaux'),
  ('facades',             'Façades & Bardage',             'materiaux'),
  ('sanitaires',          'Sanitaires',                    'materiaux'),
  ('chauffage_ventil',    'Chauffage & Ventilation',       'materiaux'),
  ('outils_location',     'Outillage & Location',          'materiel'),
  ('echafaudage',         'Échafaudage',                   'materiel')
ON CONFLICT (slug) DO NOTHING;
