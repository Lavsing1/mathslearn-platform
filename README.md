# MathsLearn — Cloudflare D1 Edition (v2 starter)

A separate-file Mathematics Learning Platform frontend with Cloudflare Pages Functions API and Cloudflare D1 storage. It is designed to deploy as its own Cloudflare Pages project; do not replace or modify the Smart-Prompt.in project.

## Included

- Separate `index.html`, `styles.css`, and `app.js`.
- Responsive homepage, theme toggle, student editor, search, and level/course/board/topic filters.
- Working scientific calculator, graph plotter, quadratic/linear equation solver, numerical derivative, Simpson-rule integral estimate, 2×2 matrix determinant/product, descriptive statistics, common unit conversion, and trigonometry (radians). Calculator functions include `sqrt`, `sin`, `cos`, `tan`, `log`, `ln`, `abs`, `exp`, and `pow`.
- Cloudflare Pages Functions endpoints for login/logout/session and content create/read/update/delete.
- D1 migration for content records, status, metadata and question-paper type.
- Signed HttpOnly admin session cookie; writes require an authenticated session and same-origin request.
- Draft/publish/unpublish/delete and live published catalogue.
- Basic response security headers and a 404 page.

## Before public launch

This package is the deployable implementation, but it is **not live until you create the D1 database, configure secrets, deploy it, and test it on your Cloudflare account**. It has not been connected to your Cloudflare account from this workspace. The admin account is configured with Cloudflare secrets (not embedded in browser code). Use a strong unique password. Keep original student data out until your privacy policy is ready.

## 1. Create a separate GitHub repository

1. Extract the ZIP.
2. Create a new repository named `mathslearn` (or another name you choose).
3. Upload the *contents* of this folder to the repository root. `index.html`, `functions/`, `migrations/` and `wrangler.toml` must all be at the root.
4. Do not edit or replace the Smart-Prompt.in repository.

## 2. Create Cloudflare D1

Install Wrangler on a computer with Node.js installed, then authenticate:

```bash
npx wrangler login
npx wrangler d1 create mathslearn-db
```

Cloudflare prints a database ID. Put that exact ID in `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`. Do not guess or reuse another project's database ID.

Apply the schema to the remote D1 database:

```bash
npx wrangler d1 migrations apply mathslearn-db --remote
```

Confirm the `content` table was created before deploying.

## 3. Deploy as a new Cloudflare Pages project

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Choose the new `mathslearn` repository.
3. Framework preset: **None**. Build command: leave empty. Build output directory: `.` (repository root).
4. Make sure the `DB` D1 binding is attached to the Pages project. The `wrangler.toml` binding should be picked up by supported Wrangler deployments; also verify it in **Pages → Settings → Functions → D1 database bindings** and bind variable name `DB` to `mathslearn-db`.
5. Deploy. Do not change any settings for Smart-Prompt.in.

## 4. Configure admin secrets

Create three secrets for the **MathsLearn Pages project only**:

- `ADMIN_EMAIL` — the admin login email.
- `ADMIN_PASSWORD` — a long, unique password. Do not reuse an email or hosting password.
- `SESSION_SECRET` — a random secret of at least 32 bytes.

You can set them in Cloudflare Dashboard → MathsLearn Pages project → Settings → Variables and Secrets. Mark them as secrets, not plain-text variables. Alternatively, use Wrangler commands, selecting the MathsLearn project explicitly:

```bash
npx wrangler pages secret put ADMIN_EMAIL --project-name mathslearn
npx wrangler pages secret put ADMIN_PASSWORD --project-name mathslearn
npx wrangler pages secret put SESSION_SECRET --project-name mathslearn
```

Enter values only in the secure prompt. Never put these values in `app.js`, `wrangler.toml`, GitHub, screenshots, or chat. Redeploy if the dashboard requests it.

## 5. Test before connecting a custom domain

1. Open the `*.pages.dev` URL and verify CSS, JavaScript, calculator and mobile navigation.
2. `/api/auth/me` should return `authenticated: false` when signed out.
3. Public notes/papers should initially be empty; that is expected. No unverified sample content is presented as real teaching material.
4. Open **Admin Studio**, sign in with the configured email/password, create a draft, and confirm it appears in Admin → Manage Content but not the public catalogue.
5. Publish it and confirm it appears publicly; unpublish it and confirm it disappears; delete it and confirm it is removed.
6. Sign out and verify create/update/delete API requests are rejected.
7. Check browser console, mobile layout, backups and privacy/legal pages before launch.

## Local preview

Static preview (UI only; API requires Cloudflare Pages Functions):

```bash
python -m http.server 8000
```

For a full local Pages Functions + D1 preview, use Wrangler Pages dev after setting up the D1 binding and local secrets in `.dev.vars` (never commit `.dev.vars`).

## API endpoints

- `GET /api/auth/me` — session status.
- `POST /api/auth/login` — sign in; creates an HttpOnly signed session cookie.
- `POST /api/auth/logout` — sign out.
- `GET /api/content` — published content for visitors; all content for an authenticated admin.
- `POST /api/content` — create draft or published item (admin only).
- `PUT /api/content/:id` — update status/content (admin only).
- `DELETE /api/content/:id` — delete item (admin only).

## Known scope limits

- Graphing, equation solving, numerical calculus, 2×2 matrix operations, descriptive statistics, unit conversion, and trigonometry are included. Symbolic differentiation/integration, general-purpose matrix algebra, student accounts, quiz attempts, PDF/file uploads, email reset flow, analytics, and automated backups are not implemented yet; do not advertise those as working features.
- The admin login uses a single Cloudflare secret-configured admin account. Add rate limiting/monitoring and a tested account-recovery process before a high-traffic public launch.
- Content body HTML is filtered on the server but should still be treated as admin-authored content; do not allow untrusted users to submit HTML.
- No real content has been seeded. Add original, verified teaching notes and question papers after deployment.


## UI update
The Popular Maths Tools section and the Scientific Calculator panel have been removed from this build at the user's request. The remaining content/admin frontend and backend files are otherwise preserved.


## Separate admin URL, maths editor and watermarked PDF

- Student site: `https://mathslearn.online/`
- Admin sign-in/studio: `https://mathslearn.online/admin/` (`admin/index.html`)
- Admin frontend uses the existing `/api/auth/*` and `/api/content*` Pages Functions endpoints.
- The editor accepts inline KaTeX `\( ... \)` and display `$$ ... $$` formulas. Use Preview math before publishing.
- Students can open published notes/papers and download a PDF. The PDF includes a MathsLearn header/footer and a light diagonal `mathslearn.online` watermark on every page.
- PDF export uses CDN libraries `html2canvas` and `jsPDF`; visitors need internet access for those libraries to load. The generated PDF is image-based to preserve rendered equations and is not ideal for copying/searching text.

## Required production setup

1. Configure a D1 binding named `DB` and apply `migrations/0001_initial.sql`.
2. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `SESSION_SECRET` as Cloudflare secrets. Do not commit secrets.
3. Deploy Pages Functions and verify `/api/auth/me`, login, create draft, publish, unpublish, edit and delete.
4. Add the custom domain in Cloudflare Pages and verify HTTPS.
5. Test PDF output on desktop and mobile and keep database backups.

The domain name is used in branding and PDF watermark. This archive does not itself register a domain, configure a Cloudflare account, or deploy code.


## Separate admin URL

The public homepage does not display an Admin link or embed the admin workspace. Open the admin directly at `https://mathslearn.online/admin/` after the custom domain is configured. The `/admin/` route is a separate page and still requires server-side authentication. Keeping the URL unlinked is not a security boundary; configure `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as Cloudflare secrets, apply D1 migrations, and test access controls before production use.
