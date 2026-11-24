-- Provision the original Campus Nexus institution (school 101) with the
-- same module entitlement baseline as institution 102, without overwriting
-- any module settings that an institution administrator already configured.

INSERT INTO public.institution_modules (institution_id, module_key, enabled, updated_at)
SELECT target.id, source_module.module_key, source_module.enabled, now()
FROM public.institutions target
JOIN public.institutions source_institution
  ON source_institution.school_code = '102'
JOIN public.institution_modules source_module
  ON source_module.institution_id = source_institution.id
WHERE target.school_code = '101'
ON CONFLICT (institution_id, module_key) DO NOTHING;
