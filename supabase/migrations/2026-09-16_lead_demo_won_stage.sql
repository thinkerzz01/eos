-- Add a distinct 'demo_won' lead stage: the demo was WON but the student is not
-- yet enrolled ('won' still means enrolled, set only by Convert). Recorded when a
-- demo outcome is logged as Won. Widen the status CHECK constraint to allow it.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'public.leads'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'demo_booked', 'demo_won', 'won', 'lost'));
