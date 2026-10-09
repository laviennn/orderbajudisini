# Batch D: Migration & Rollback

## PostgreSQL (Neon) Backup
1. Access the Neon Console.
2. Select the `orderbajudisini-production` database project.
3. Establish a Point-In-Time Restore (PITR) snapshot before running major structural updates or initial launch schemas.
4. Export logical backups via `pg_dump` when making catastrophic-risk mutations.

## Migration Runbook
1. Secure the isolated production PostgreSQL URI.
2. Store it locally in `.env` (temporarily, **DO NOT COMMIT**).
3. Validate schema alignments using:
   ```bash
   npm run db:check
   ```
4. Push initial state to production database:
   ```bash
   npx drizzle-kit push
   # Alternatively: npx drizzle-kit migrate if using strict sequential migration generation
   ```
5. Remove the production `DATABASE_URL` from local `.env` immediately.

## Rollback Procedure
1. In the event of a corrupt migration, **DO NOT attempt a live destructive downgrade script** for major commerce tables without extreme caution (data loss risk).
2. Utilize Neon's Point-In-Time Restore to instantly fork the database from a timestamp exactly before the flawed migration.
3. Swap the Vercel `DATABASE_URL` target to the newly restored branch connection string.
4. Re-deploy the last known stable Git commit from Vercel.
