-- Enable HaveIBeenPwned leaked password protection
-- This is handled at the auth config level, not via SQL migration.
-- Adding a comment migration to track this audit action.
SELECT 1; -- No-op: leaked password protection must be enabled via auth config