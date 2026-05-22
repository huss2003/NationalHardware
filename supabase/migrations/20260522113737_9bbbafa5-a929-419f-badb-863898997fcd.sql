INSERT INTO public.door_types (name, rate, active)
SELECT v.name, 0, true
FROM (VALUES ('F-Hard'), ('F-Pine'), ('WF-Pine'), ('WF-Hard')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.door_types d WHERE lower(d.name) = lower(v.name)
);