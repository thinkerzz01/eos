-- Human-friendly, sequential demo numbers: DM-000001, DM-000002, ...
-- Replaces the old UUID-derived "DMO-<hex>" display code (e.g. DMO-683BC7AF)
-- with a real running counter. A dedicated SEQUENCE + a stored column keeps each
-- demo's number STABLE - it never shifts when other demos are added or removed,
-- unlike a live row-index. New demos number themselves via the column DEFAULT,
-- so no insert path (the anon booking RPC or the admin direct insert) changes.
--
-- "Reset": existing demos are renumbered from 1 in creation order, then the
-- sequence is advanced so the next new demo continues the run.

-- 1. The counter.
CREATE SEQUENCE IF NOT EXISTS public.demo_no_seq;

-- 2. The stored number on each demo.
ALTER TABLE public.demos ADD COLUMN IF NOT EXISTS demo_no BIGINT;

-- 3. Backfill existing demos from 1, oldest first (the "reset").
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM public.demos
)
UPDATE public.demos d
SET demo_no = o.rn
FROM ordered o
WHERE d.id = o.id AND d.demo_no IS NULL;

-- 4. Point the sequence just past the highest number used, so the next new demo
--    continues the run (is_called = false -> the next nextval returns this value).
SELECT setval(
    'public.demo_no_seq',
    COALESCE((SELECT MAX(demo_no) FROM public.demos), 0) + 1,
    false
);

-- 5. New demos auto-number via the sequence; enforce presence + uniqueness.
ALTER TABLE public.demos ALTER COLUMN demo_no SET DEFAULT nextval('public.demo_no_seq');
ALTER TABLE public.demos ALTER COLUMN demo_no SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS demos_demo_no_key ON public.demos (demo_no);

-- 6. Tie the sequence's lifecycle to the column, and let admin (authenticated)
--    direct inserts into demos use the sequence for the DEFAULT. The anon public
--    booking runs through a SECURITY DEFINER routine, so anon needs nothing here.
ALTER SEQUENCE public.demo_no_seq OWNED BY public.demos.demo_no;
GRANT USAGE ON SEQUENCE public.demo_no_seq TO authenticated;
