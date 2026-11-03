# BQ Connect on Replit

- Use the **Start application** workflow (also wired to Run). It runs `node preview-safe.js` on port 5000, with a development-only alias for the imported port 4173 mapping. It copies the app source and public assets to a temporary directory and starts with an empty data directory; it does not read or write the imported `data/` or `backups/`. Restart the workflow after source changes; preview data is discarded.
- The isolated preview has no employee accounts, SMTP/SMS credentials, or translation model enabled. Login and employee-only features cannot be exercised there.
- The production deployment configuration remains unchanged: VM target, `node start.js`, and App Storage synchronization. Do not publish or change production storage as part of local setup.
- Dependencies are declared in `package.json` and are already present in this workspace.
- This is an employee platform, not a disposable prototype. Keep audit work read-only against production. Do not publish, restore/import production data, rotate credentials, migrate the database/authentication, or modify employee records until the audit is reviewed and the user explicitly approves that work. Use only synthetic records for tests.
- Do not run `npm start` or `node start.js` in the workspace for testing: those commands load the imported data directory. See `PRODUCTION_AUDIT.md` for the initial findings and unverified areas.
- Persistence forensics must use metadata and synthetic fixtures, never production snapshots copied into development. See `reports/P0_ACCOUNT_PERSISTENCE_FORENSICS.md` for findings and approval gates; its proposed production corrections are not implemented or authorized.
