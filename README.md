# MathsLearn.online

A mathematics learning platform: public site + admin dashboard + a
math-aware content editor, backed by Cloudflare D1.

## Folder structure

```
mathslearn/
├── index.html, notes.html, class.html, content.html, books.html, about.html, 404.html
│                        → public site (plain HTML/CSS/JS, no build step)
├── css/style.css          → shared design system (also used by admin)
├── js/
│   ├── main.js              → nav, dark mode, search, listing filters
│   └── class-page.js          → class.html: level lookup + tab logic
├── robots.txt, sitemap.xml      → SEO (sitemap is currently static — see worker/README.md)
│
├── admin/                         → admin dashboard + editor (protected, talks to /api/*)
│   ├── login.html
│   ├── index.html                   → dashboard: stats + content table
│   ├── editor.html                    → the content editor
│   ├── css/admin.css
│   └── js/ (admin-auth.js, dashboard.js, editor.js)
│
├── functions/api/[[route]].js     → the API (Cloudflare Pages Function, Hono + D1)
├── package.json                    → installs hono for the function
└── .gitignore
```

## What each class/exam looks like

`class.html?level=iit-jam` (or `class-10`, `bsc`, `isi`, `cmi`, `tifr`, …)
shows **tabs** — Notes, Important Questions, Solved Questions, Question
Papers, Formula Sheets — and each tab only shows its own content type.
Nothing is mixed together; a level with nothing added yet shows an
empty state instead of someone else's content.

## Every saved item gets its own URL

Each piece of content lives at `/{type}/{level}/{slug}/`, e.g.
`/notes/class-10/real-numbers-euclids-division-lemma/`.

- `_redirects` sends those URLs to `view.html`; `js/view.js` loads the item
  from `/api/public/content/:level/:type/:slug` and renders it (KaTeX math,
  A4 full-screen view, Download PDF — Books are read-only, no download).
- Only **published** items are public. A draft has a private admin-only
  preview (`view.html?preview=<id>`).
- Class pages, the Notes list and Books load published items automatically
  (`js/live.js`). When the API can't be reached (local preview) the demo
  cards stay.
- If you add a new content type, add its two lines to `_redirects`.
- Optional: `GET /api/sitemap.xml` on the Worker lists every published URL.

## Admin sections

- **Create** — Dashboard (stats, quick links, recent items) and New Content.
- **Manage & Edit** (`admin/manage.html`) — every saved item: reopen to edit,
  see/copy its URL, Publish / Unpublish, Archive / Restore, Delete. Filter by
  status, class/exam, type, or title.
- Editing a *published* item never autosaves over the live page — press
  **Update** to push changes live (or **Unpublish** to take it down).
- Opening `admin/*.html` locally (no Worker) shows "offline preview" mode
  instead of redirecting to login.

## Deploying (GitHub → Cloudflare Pages, one project)

Everything — site, admin and API — deploys from this one repo.

1. Push this folder to GitHub (repo root = this folder).
2. Cloudflare → Workers & Pages → your Pages project (`mathslearn-platform`)
   → connected to the GitHub repo. Build command: *(empty)*,
   output directory: `/` (or leave blank).
3. Project → Settings → Production (and Preview if you use it):
   - **Secrets:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`
     (SESSION_SECRET = any long random string, 32+ chars)
   - **Bindings → D1 database:** variable name `DB` → `mathslearn-db`
4. Every `git push` to the production branch redeploys automatically.

No migration step: the tables and the class/exam list are created
automatically on the first API request.

**Login:** `/admin/login.html` → use `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
To change the password, edit the secret in Cloudflare and redeploy.

Local test: `npm install`, create `.dev.vars` (not committed) with the
three secrets, then `npm run dev`.

## Using the editor

Once logged in at `/admin/login.html`:

- **New Content** → pick a content type (Notes / Important Questions /
  Solved Questions / Question Paper / Solved Paper / Unsolved
  Questions / Formula Sheet / Book) and a Class/Exam — this is what
  decides which tab on which `class.html` page the piece shows up on.
- Type `$x^2$` for inline math or `$$...$$` on its own line for a
  block equation, then click **Show Preview** to see it rendered
  (KaTeX).
- Use the **Formula** / **Example** toolbar buttons for the boxed
  formula and solved-example blocks you see on `content.html`.
- The writing area is sized like a real **A4 sheet** — write as much
  as you want in one note, paper or book chapter; it just grows
  downward, and printing/PDF export pages it correctly (no content
  gets cut mid-formula or mid-table, see `@page` in `css/style.css`).
- **Text size** is a fixed dropdown (Small / Normal / Large / Extra
  Large) — on purpose, so nothing ends up randomly tiny or huge.
  Select text first, then pick a size, a color (**A** button), or a
  **highlight** (🖊️ button).
- **⊞ Table**, subscript/superscript (X₂ / X²), and 🔗 link are in the
  toolbar too.
- **a/b** inserts a LaTeX fraction template; **π Ω** opens a symbol
  picker (π, fractions like ½, ±, ×, ÷, ≤, ≥, ∞, √, ∑, ∫, Greek
  letters, →, ∈, …) that inserts the character at your cursor.
- Work autosaves ~2 seconds after you stop typing, and is also backed
  up to your browser's local storage, so a refresh never loses a draft.
- **Save Draft** keeps it private; **Publish** makes it live and
  enforces a unique URL per (class/exam + content type + slug) — if
  you reuse one, you'll get a clear "already exists" error instead of
  a silent duplicate.

## Download PDF (watermarked) — everything except Books

`content.html` (the shared template for Notes, Important Questions,
Solved Questions, Question Papers, Solved Papers, Unsolved Questions
and Formula Sheets) has a **Download PDF** button. Clicking it opens
the browser's print dialog with "Save as PDF" as the destination —
this uses the browser's own print engine, so formulas/formatting come
out exactly as rendered on screen, with no extra backend or library
needed.

Two watermark layers are stamped on at print time (see `css/style.css`
→ `@media print`, and the handler in `js/main.js`):
- A tiled, light diagonal **"MathsLearn.online"** across every page.
- A single line at the bottom naming the **exact source URL and the
  download date/time** — this is what makes a given PDF traceable
  back to the specific page it came from.

**Books are excluded on purpose** — `books.html` has no Download
button, and the comment at the top of that file flags the same rule
for the future chapter-reader template, so nobody accidentally adds
one later.

If/when you wire the public pages to live D1 content (see
`worker/README.md`), this button needs no changes — it reads whatever
URL is in that page's `<link rel="canonical">`, so it keeps working
automatically.

## Notes

- `sitemap.xml` is static; `GET /api/sitemap.xml` lists every published page.
- Books reuse the `content` table; a chapter-by-chapter reader needs one more table.
- Add rate limiting on `/api/auth/login` (Cloudflare Rate Limiting rule) once the site is public.
