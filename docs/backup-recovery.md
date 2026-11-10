# Backup and recovery

1. Configure a persistent SQLite path and uploads directory outside the public web root.
2. Use `npm run db:backup -- /secure-persistent-path/foundation.sqlite` to take an online SQLite backup.
3. Back up authorized uploads and configuration metadata separately; never include secrets in a source archive or public backup.
4. Encrypt backups, restrict access, set a reviewed retention period, and monitor backup age.
5. Restore by stopping the service, preserving the current database, restoring the selected database and matching media snapshot, checking ownership/permissions, then restarting under a controlled maintenance window.
6. Test restores in an isolated environment and record recovery time/data-point objectives before launch.

A database-only restore may not match uploaded media. Store backups off-host and do not assume ephemeral disks persist.
