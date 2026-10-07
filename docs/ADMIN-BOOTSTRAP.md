# First Owner bootstrap

There are no default credentials and no public bootstrap endpoint. The command requires an interactive terminal and prompts for Owner name, email and a hidden password plus confirmation. Passwords must be 15–128 characters; use a password manager. Never put a password in command arguments, source, shell history or documentation.

## Local development

1. Create/select a dedicated Neon development branch and place its DATABASE_URL in ignored `.env.local`. Do not overwrite an existing environment file blindly. Configure a strong AUTH_SECRET separately.
2. Run `npm ci`, then `npm run db:migrate` against that intended branch.
3. Optionally run `NODE_ENV=development ALLOW_DEVELOPMENT_SEED=true npm run db:seed:dev`. It creates roles/permissions only. Bootstrap also initializes these, so this step is not required.
4. Run `npm run admin:bootstrap` in your terminal and enter your own credentials at the prompts.
5. Set AUTH_ENABLED=true in `.env.local`, start/restart the application, and sign in at `/admin/login`.

## Production

1. Use a trusted release workstation with this exact source/lockfile and Node 22. Review and back up the intended Neon database before applying migrations. Confirm the environment target without printing the connection secret.
2. Inject the production DATABASE_URL and AUTH_SECRET through your secret manager or protected process environment. Environment values take precedence over `.env.local`; do not paste secrets into shell commands or transfer production passwords through chat. This command is a local CLI connecting to the chosen database, not a Vercel HTTP endpoint.
3. Run `npm ci` and `npm run db:migrate` once as the release migration step.
4. Run `npm run admin:bootstrap` interactively. Enter the real Owner credentials privately. Do not run the development seed against production.
5. Configure AUTH_ENABLED=true alongside existing DATABASE_URL/AUTH_SECRET in Vercel Production, release the compatible application, and verify HTTPS login/logout and authorized admin access. Keep the commerce prelaunch state until later phases are ready.

The Phase 1A implementation task has not performed these production mutations, created a real owner, enabled live login or deployed this backend. Previously configured provider secrets do not automatically enable authentication.

## Safety and recovery

Bootstrap is transactional and serialized with operator administration. It refuses if a protected Owner account or bootstrap completion marker already exists. A concurrent second attempt safely fails. The marker prevents deleting an account and silently recreating an owner through repeated initialization. Role grants, owner account, audit and completion marker commit together.

The account is active and receives the complete Owner permission set. Password hashing occurs before persistence. No password or hash appears in command success/error output. The CLI requires a TTY, and no credential is accepted as a command-line argument.

After setup, additional staff must be created through the permission-checked operator service and future UI. Rerunning bootstrap is not password reset. Document and control emergency recovery with the database owner; never delete the bootstrap marker or bypass last-owner checks as routine operations. Keep recovery access separate from application users.
