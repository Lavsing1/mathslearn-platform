# MathsLearn Book Studio integration overlay

This ZIP is an **overlay** for the existing `lavsing1/mathslearn-platform` repository. Extract its contents into the repository root, preserving folder paths, then commit/push to `main`.

## Included
- `admin/studio/`: Mathematics Lecture Studio, guarded by the existing `/api/auth/me` admin session before showing the app UI.
- Cloud-save / publish / hide / delete-cloud-copy / backup buttons.
- Manual image insertion into the current lecture block (images are resized and embedded into the book data).
- `functions/api/books/index.js` and `functions/api/books/[id].js`: authenticated admin endpoints; public requests can only see `published` books.
- `migrations/0002_books.sql`: D1 table for book metadata and chapter JSON.
- `books/index.html`: public read-only published book reader at `/books/`.

## Required setup
1. Merge overlay files into the GitHub repository root. Do not replace the whole repository.
2. In Cloudflare D1 Console, select `mathslearn-db` and run `migrations/0002_books.sql` once.
3. Confirm the Pages production project has the existing `DB` D1 binding and the admin secrets already configured.
4. Commit/push to `main`, wait for Pages deployment to succeed.
5. Open `/admin/`, sign in, then open `/admin/studio/`.
6. Create/open a book and use **Save draft to cloud** first. Use **Publish / Update** when ready. Published books appear at `/books/`.

## Important limitations and safety
- This is a first integration version; test it with a small sample book before moving important material.
- Embedded images count toward the 2.5 MB book payload limit. Very large books or many high-resolution images need Cloudflare R2 object storage in a later hardening step.
- The studio's local browser copy and the D1 cloud copy are separate. Save to cloud after edits; export a JSON backup regularly.
- Hide makes the public API stop serving a book; delete removes only the cloud copy, not the local browser copy.
- No web implementation can completely prevent screenshots or manual copying of content shown to a browser. This implementation removes student download controls and keeps drafts/hidden books inaccessible through the public book API.
- Do not add admin credentials or `SESSION_SECRET` to GitHub.
