---
name: Release destination
description: Product destination and scope for PostgreSQL release preparation.
---

The intended final destination of PostgreSQL preparation is the existing BQ Connect application, not a new employee-facing product. Isolated candidates and synthetic test apps are validation environments, not a change to that destination.

**Why:** The user explicitly stated this product scope when authorizing autonomous safe database preparation.

**How to apply:** Keep final adoption and publication plans tied to the existing application. Do not interpret a working separate staging runtime as delivery of the production migration or approval to publish a replacement product.

Use Replit-managed PostgreSQL for BQ Connect, not an external Neon account.

**Why:** The user explicitly selected Replit's managed development/production lifecycle.

**How to apply:** Adapt connection, schema publishing and security requirements to supported managed capabilities. Document unmet controls and obtain security approval rather than substituting an external provider or claiming least privilege from owner credentials.

Do not infer published source authority from workspace bucket settings, configured secret presence or latest-build history. Source inspection must stay protected; only aggregates and keyed fingerprints may return here.

**Why:** The user forbids employee data/key exports into development, and the available deployment metadata does not expose running JSON/storage bindings or prove which generation is loaded.

**How to apply:** Require read-only attestation tied to the actually serving production process. Workspace SSH is not evidence of production access. Unknown counts/generations stay unknown; diagnostic provenance never authorizes migration or publication.
