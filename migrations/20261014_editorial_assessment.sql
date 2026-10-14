-- Additive: older/unassessed articles remain ordinary news, never keyword-promoted.
ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS editorial_assessment jsonb;
COMMENT ON COLUMN public.news_items.editorial_assessment IS
  'Versioned, title-bound AI editorial interpretation at ingest. NULL means no special badge/keyword priority/VIP.';
