-- One-off, STEP 3 of 3 (after database/applications-store.sql): copy the old Tracker rows
-- into the Applications Store. Safe to re-run; rows already copied are skipped.
-- Owner: the auth user whose rows the board should show (Supabase > Authentication > Users).
-- agent_applications_legacy stays as a backup; drop it once the board looks right.
INSERT INTO agent_applications (user_id, company, role, url, source, stage, closed_reason, notes)
SELECT
  '4937ed9b-ea85-42b2-ad31-d724032e9b79'::uuid,
  l.company,
  l.role_title,
  NULLIF(TRIM(l.link), ''),
  'Tracker (legacy)',
  CASE l.status
    WHEN 'to_apply' THEN 'saved'
    WHEN 'rejected' THEN 'closed'
    ELSE l.status  -- applied, interviewing, offer map 1:1
  END,
  CASE WHEN l.status = 'rejected' THEN 'Rejected' END,
  NULLIF(TRIM(l.notes), '')
FROM agent_applications_legacy l
WHERE NOT EXISTS (
  SELECT 1 FROM agent_applications a
  WHERE a.company = l.company AND a.role = l.role_title
);
