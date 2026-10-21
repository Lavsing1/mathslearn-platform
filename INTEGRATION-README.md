# MathsLearn + Mathematics Lecture Studio (merged project)

This archive combines the existing MathsLearn website with the Book Studio integration overlay. Existing root homepage, admin files, authentication APIs, D1 migration 0001, and Cloudflare configuration are preserved. New Book Studio files live under `admin/studio/`, student reader under `books/`, API under `functions/api/books/`, and migration under `migrations/0002_books.sql`.

## Important
- The D1 `books` table migration was reported as successfully executed in the user's Cloudflare console. The SQL is idempotent and may also be retained in migrations for tracking.
- Do not upload secrets or credentials to GitHub.
- Test the preview before using production. Check `/admin/`, `/admin/studio/`, `/api/books`, and `/books/`.
- This is an integration build, not a claim of full production validation. Test cloud save, update, publish, hide, delete, image insertion, and rendering with a small sample book before relying on it.
- Student downloads are not exposed in the reader, but screenshots/manual copying cannot be fully prevented in a browser.
