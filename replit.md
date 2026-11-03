# BQ Connect on Replit

- The development workflow runs `node preview-safe.js` on port 5000. It copies the app source and public assets to a temporary directory and starts with an empty data directory; it does not read or write the imported `data/` or `backups/`.
- The isolated preview has no employee accounts, SMTP/SMS credentials, or translation model enabled. Login and employee-only features cannot be exercised there.
- The production deployment configuration remains unchanged: VM target, `node start.js`, and App Storage synchronization. Do not publish or change production storage as part of local setup.
- Dependencies are declared in `package.json` and are already present in this workspace.
