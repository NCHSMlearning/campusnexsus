-- Keep the academic year-of-study value separate from the legacy boolean block_program_year flag.
ALTER TABLE public.consolidated_user_profiles_table
  ADD COLUMN IF NOT EXISTS year_of_study text;

COMMENT ON COLUMN public.consolidated_user_profiles_table.year_of_study IS
  'Academic year of study selected by institution administrators (Year 1, Year 2, Year 3, Year 4).';
