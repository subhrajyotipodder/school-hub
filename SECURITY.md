# Security Policy

## Current Safety Boundary

This repository is now hardened for development and migration planning, but it is **not yet approved for real student or payment data**. The application still uses a local JSON data store and a local demo authentication mode.

The server refuses to start in `NODE_ENV=production` while either of these unsafe MVP modes is configured:

- `AUTH_MODE=local`
- `DATA_BACKEND=json`

## Implemented Controls

- Protected data APIs require an authenticated session.
- Sessions expire after a configurable interval.
- Failed sign-in attempts are rate-limited by client address.
- Authentication comparison uses timing-safe comparison.
- Authentication events are emitted as structured security log entries.
- Content Security Policy, clickjacking protection, MIME sniffing protection, permissions policy, and referrer protection headers are applied.
- HSTS is emitted in production mode.
- API responses and HTML authentication state are delivered with `no-store` caching.

## Required Before Production Data

1. Replace local authentication with Microsoft Entra External ID for school users and Microsoft Entra ID for privileged operations.
2. Replace JSON persistence with Azure Database for PostgreSQL Flexible Server over private networking.
3. Store documents only in private Azure Blob Storage with managed-identity access.
4. Configure Azure Key Vault, backup recovery tests, centralized logs, alerts, and incident procedures.
5. Implement authorization by role, audit trails for record changes, retention rules, and privacy/compliance review.

## Secrets

Never commit `.env` files, passwords, connection strings, certificates, or exported student data. In Azure, use managed identities where possible and Key Vault for remaining secrets.
