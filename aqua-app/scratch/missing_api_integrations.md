# Missing API Integrations

- [ ] `admin_routes_simple.py` - Numerous super-admin routes are missing from frontend (reports resolution, cache clearing, system restart, user bans).
- [ ] `users.myPostRequests` - Required for frontend UI (was mocked), but currently missing from `api.ts` definitions.
- [ ] Token Refresh Flow: The backend has `POST /v1/auth/refresh`, but the frontend `request()` wrapper doesn't currently implement automatic 401 retries using it (or it needs auditing to ensure it uses the latest secure store tokens).
