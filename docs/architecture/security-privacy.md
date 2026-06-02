# Arbor Security And Privacy

## Current state

Arbor has rate limiting, CORS allow-listing, Helmet, safety copy, and local-only memory storage for development.

## Target state

Production Arbor uses Firebase Auth, Firestore rules, App Check, Cloud Logging, and PII-minimized observability.

## Migration path

1. Add anonymous Firebase Auth in the client.
2. Verify Firebase ID tokens in Express.
3. Require child/family scoped access for memory routes.
4. Keep raw child-sensitive content out of normal logs.

## M1 acceptance gates

- Parents see only their family and children.
- Professional access requires explicit consent/assignment.
- Handoff/export/delete operations are audit logged.
