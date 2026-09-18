-- AS / A2 subject hygiene + code fixes (run in Supabase SQL editor).
-- All removals are REVERSIBLE soft-deletes (deleted_at). Single-tenant DB, so
-- rows are matched by program + name. Review the final SELECT before trusting it.

-- 1) Remove AS/A2 rows that are NOT real Cambridge AS & A Level subjects.
--    These exist only at O Level; they have no AS/A Level syllabus or PDF.
update subjects set deleted_at = now()
where deleted_at is null
  and program in ('AS','A2')
  and name in (
    'Additional Mathematics','Business Studies','Combined Science','Commerce',
    'Food & Nutrition','Fashion & Textiles','Islamiyat','Pakistan Studies',
    'Statistics','English (Second Language)'
  );

-- 2) Global Perspectives -> the real AS & A Level subject "Global Perspectives &
--    Research" (9239). Fills the missing code and corrects the name.
update subjects set name = 'Global Perspectives & Research', code = '9239'
where deleted_at is null and program in ('AS','A2') and name = 'Global Perspectives';

-- 3) Environmental Management (8291) is AS-only at Cambridge, so the A2 row is
--    invalid -> soft-delete it.
update subjects set deleted_at = now()
where deleted_at is null and program = 'A2' and name = 'Environmental Management';

-- 4) Urdu: AS and A Level are different Cambridge syllabuses with different codes.
update subjects set code = '8686' where deleted_at is null and program = 'AS' and name = 'Urdu';
update subjects set code = '9686' where deleted_at is null and program = 'A2' and name = 'Urdu';

-- Verify: remaining live AS & A2 subjects after the fixes.
select program, name, code
from subjects
where deleted_at is null and program in ('AS','A2')
order by program, name;
