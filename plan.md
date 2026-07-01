1. **Add security headers in `next.config.mjs`**
   - Update `next.config.mjs` to add the `headers` method which returns the requested security headers.
2. **Update `lib/api-error.ts` to include `statusCode` instead of `status`**
   - Update the `ApiError` class signature to take `statusCode`, `code`, and `message` as per user instructions.
   - Update `handleApiError` to use `crypto.randomUUID()` and to format the response to `{ error: { code, message, requestId } }`.
3. **Update `components/error-boundary.tsx`**
   - Refactor `ErrorBoundary` to show a "Reload page" button and error message if `hasError` is true. Ensure it is exported as default.
4. **Update `app/error.tsx`**
   - Modify `app/error.tsx` to match the required UI: a heading "Something went wrong", the `error.message`, a "Go to Dashboard" link, and a "Try again" button. Add `'use client'`.
5. **Update `app/not-found.tsx`**
   - Modify `app/not-found.tsx` to be a 404 page with a "Go to Dashboard" link.
6. **Update `lib/env.ts` to log clearly if validation fails**
   - Use `.safeParse()` instead of `.parse()`. If `.success` is false, log a clear message listing the missing variables and throw an error.
7. **Replace `process.env` usage with `env` from `lib/env.ts` across the codebase**
   - Go through the list of files obtained from the grep search and replace `process.env.VARIABLE` with `env.VARIABLE`. Use `import { env } from "@/lib/env"` or relative paths. Note that in `next.config.mjs` and `drizzle.config.ts`, and test files, `process.env` might still be used if `lib/env.ts` cannot be safely imported. Specifically focus on `app/api/`, `lib/` and `db/`.
8. **Pre-commit checks**
   - Ensure proper testing, verifications, reviews and reflections are done by executing `pre_commit_instructions`.

