# Access cache account isolation

Reviewed during C11 on 2026-10-07; starting revision `ab2a072a05998eba46847b867a24bb997a3e7a55`.

The previous `/access/me` query used the same cache key for every account and kept results fresh for one minute. Logout does not universally clear the query client (the global 401 handler only logs out). A subsequent login could therefore render the previous account's capabilities until invalidation/refetch. This was a frontend authorization-display and reliability issue; server permission checks still rejected unauthorized requests.

The query now includes the authenticated user ID, requires a logged-in user and token, and passes the cancellation signal to Axios. The original `accessKeys.me()` prefix is retained so realtime membership updates and 403 handlers still invalidate all principal variants. No permission policy, endpoint or database behavior changes.

Regression coverage in `frontend/src/features/access/model/access.keys.test.ts` checks account/logged-out cache separation and prefix invalidation. `pnpm.cmd preflight` passed before the fix commit: 866 backend tests in 120 files, 33 frontend tests in 5 files, both typechecks/builds and lint with no errors (298 backend and 3 frontend existing warnings). This gate ran with the C11 feature work still uncommitted; 21 of the frontend cases belong to that forthcoming feature. Live database checks and browser account-switch verification are not performed for this change.
