# Backup And Recovery

Project: `baugbpqdgslfogggaqen` (`Creative House`), region `sa-east-1`.

No paid Supabase add-on was enabled by this phase. PITR and paid backup retention must be checked in the Supabase dashboard before relying on them.

Official references reviewed on 2026-08-11:

- Supabase Database Backups: https://supabase.com/docs/guides/platform/backups
- Supabase CLI reference: https://supabase.com/docs/reference/cli/introduction
- Supabase CLI backup/restore guide: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Database Backup

Use logical dumps for operator-controlled backups:

```bash
npx supabase db dump --linked --schema public --file backups/casa-criativa-public-YYYY-MM-DD.sql
```

Rules:

- Never commit dumps to Git.
- Store dumps in encrypted storage with restricted access.
- Keep database dumps separate from Storage object backups.
- Record the migration version with each dump using `npx supabase migration list`.

## Storage Objects

Student photos use the private `student-photos` bucket. Back up its objects
separately, preserving object paths, and retain the corresponding `students.photo_path`
references and bucket policies. Temporary signed URLs are not backups. Reconcile
object counts and sample photo downloads in an isolated restore rehearsal.
Database backups alone do not restore these image files.

The logical schema dump command above is not a complete backup: schema, record
data, Auth identities and Storage objects each need a verified recovery procedure.
Verify what the installed CLI version exports before relying on the result.
No backup or restore was executed during the November engineering audit.

## Restore

Do not test restore against the production project. Restore into an isolated project or local database, then validate:

- migrations align;
- private tables keep RLS;
- owner login works;
- dashboard loads;
- money and inventory totals reconcile.

Backup is not considered reliable until a restore rehearsal has succeeded in a disposable environment.
