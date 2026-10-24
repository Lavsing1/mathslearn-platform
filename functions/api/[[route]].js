// ============================================================
// MathsLearn API — Cloudflare Pages Function (Hono) + D1
// ============================================================
// Routes:
//   POST   /api/auth/login             sign in, sets session cookie
//   POST   /api/auth/logout            clear session
//   GET    /api/me                     current admin (requires auth)
//   GET    /api/stats                  dashboard counts (requires auth)
//   GET    /api/content                list content, with filters (auth)
//   GET    /api/content/:id            single item (auth)
//   POST   /api/content                create (auth)
//   PUT    /api/content/:id            update (auth)
//   PATCH  /api/content/:id/status     publish / unpublish / archive (auth)
//   DELETE /api/content/:id            delete (auth)
//   GET    /api/public/content         published items, no auth needed
//   GET    /api/public/content/:level/:type/:slug   single published item
//   GET    /api/sitemap.xml            sitemap of every published page URL
//   GET    /api/levels                 class/exam list (used by dropdowns)
// ============================================================

import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

// Cloudflare Pages Function — runs on every /api/* request.
// Needs (Pages > Settings > Variables and secrets / Bindings):
//   Secrets: ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
//   D1 binding: DB  ->  mathslearn-db
const app = new Hono();


const SESSION_COOKIE = "ml_session";
const SESSION_DAYS = 7;
const CONTENT_TYPES = [
  "notes", "important-questions", "solved-examples",
  "question-papers", "solved-papers", "unsolved-questions",
  "formula-sheets", "books",
];

/* ---------------------------------------------------------- *
 * Schema — created automatically on first request, so no manual
 * migration step is needed after deploying.
 * ---------------------------------------------------------- */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
    password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    level_group TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL, content_type TEXT NOT NULL,
    level TEXT NOT NULL REFERENCES levels(slug), subject TEXT, chapter TEXT,
    language TEXT NOT NULL DEFAULT 'en', body_html TEXT, short_description TEXT,
    seo_title TEXT, meta_description TEXT, status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (level, content_type, slug))`,
  `CREATE INDEX IF NOT EXISTS idx_content_level_type_status ON content(level, content_type, status)`,
  `CREATE INDEX IF NOT EXISTS idx_content_status ON content(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `INSERT OR IGNORE INTO levels (id, slug, name, level_group, sort_order) VALUES
    ('lvl-class-9','class-9','Class 9','school',10),
    ('lvl-class-10','class-10','Class 10','school',20),
    ('lvl-class-11','class-11','Class 11','school',30),
    ('lvl-class-12','class-12','Class 12','school',40),
    ('lvl-bsc','bsc','B.Sc Mathematics','undergraduate',50),
    ('lvl-iitjam','iit-jam','IIT JAM','competitive',60),
    ('lvl-isi','isi','ISI Entrance','competitive',70),
    ('lvl-cmi','cmi','CMI Entrance','competitive',80),
    ('lvl-tifr','tifr','TIFR GS','competitive',90)`,
];
let schemaReady = false;
app.use("/api/*", async (c, next) => {
  if (!c.env.DB) return c.json({ error: "D1 binding 'DB' is missing in Pages settings." }, 500);
  if (!schemaReady) {
    // Run statements one by one so a problem names the exact statement that failed.
    for (const q of SCHEMA) {
      try { await c.env.DB.prepare(q).run(); }
      catch (e) { console.error("D1 setup failed:", e, q.slice(0, 90)); return c.json({ error: "Database setup failed." }, 500); }
    }
    schemaReady = true;
  }
  await next();
});

/* ---------------------------------------------------------- *
 * Crypto helpers (Web Crypto only)
 * ---------------------------------------------------------- */
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
// Cookie value = "<sessionId>.<HMAC(sessionId, SESSION_SECRET)>"
async function signSession(c, id) {
  return `${id}.${await hmacHex(c.env.SESSION_SECRET, id)}`;
}
async function readSession(c) {
  const raw = getCookie(c, SESSION_COOKIE);
  if (!raw || !c.env.SESSION_SECRET) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  return safeEqual(sig, await hmacHex(c.env.SESSION_SECRET, id)) ? id : null;
}

/* ---------------------------------------------------------- *
 * Auth middleware — verifies the signed cookie, then the session in D1.
 * ---------------------------------------------------------- */
async function requireAuth(c, next) {
  const sessionId = await readSession(c);
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401);

  const session = await c.env.DB.prepare(
    `SELECT s.id, s.expires_at, a.id as admin_id, a.username, a.email
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ?`
  ).bind(sessionId).first();

  if (!session || new Date(session.expires_at) < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }
  c.set("admin", { id: session.admin_id, username: session.username, email: session.email });
  await next();
}

/* ---------------------------------------------------------- *
 * Login — checks against the ADMIN_EMAIL / ADMIN_PASSWORD secrets
 * set in Cloudflare. No sign-up, no bootstrap step. To change the
 * password, just change the secret in the dashboard and redeploy.
 * ---------------------------------------------------------- */
app.post("/api/auth/login", async (c) => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET } = c.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) {
    return c.json({ error: "Server is missing ADMIN_EMAIL / ADMIN_PASSWORD / SESSION_SECRET secrets." }, 500);
  }
  const { username, password } = await c.req.json().catch(() => ({}));
  if (!username || !password) return c.json({ error: "Username and password are required." }, 400);

  const [uOk, pOk] = await Promise.all([
    sha256Hex(username.trim().toLowerCase()).then(async (h) => safeEqual(h, await sha256Hex(ADMIN_EMAIL.trim().toLowerCase()))),
    sha256Hex(password).then(async (h) => safeEqual(h, await sha256Hex(ADMIN_PASSWORD.trim()))),
  ]);
  if (!uOk || !pOk) return c.json({ error: "Invalid username or password." }, 401);

  // Make sure an admin row exists for this email (reuses an old one if the DB already has it).
  const email = ADMIN_EMAIL.trim().toLowerCase();
  let adminRow = await c.env.DB.prepare("SELECT id FROM admins WHERE lower(email) = ? OR lower(username) = ?").bind(email, email).first();
  if (!adminRow) {
    await c.env.DB.prepare(
      "INSERT INTO admins (id, username, email, password_hash, password_salt) VALUES ('admin', ?, ?, 'env', 'env')"
    ).bind(email, email).run();
    adminRow = { id: "admin" };
  }

  await c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)").bind(sessionId, adminRow.id, expiresAt).run();

  setCookie(c, SESSION_COOKIE, await signSession(c, sessionId), {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
  const sessionId = await readSession(c);
  if (sessionId) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/me", requireAuth, (c) => c.json(c.get("admin")));

app.get("/api/levels", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT slug, name, level_group FROM levels ORDER BY sort_order").all();
  return c.json(results);
});

app.get("/api/stats", requireAuth, async (c) => {
  const total = await c.env.DB.prepare("SELECT COUNT(*) as n FROM content").first();
  const published = await c.env.DB.prepare("SELECT COUNT(*) as n FROM content WHERE status = 'published'").first();
  const drafts = await c.env.DB.prepare("SELECT COUNT(*) as n FROM content WHERE status = 'draft'").first();
  const books = await c.env.DB.prepare("SELECT COUNT(*) as n FROM content WHERE content_type = 'books'").first();
  return c.json({ total: total.n, published: published.n, drafts: drafts.n, books: books.n });
});

/* ---------------------------------------------------------- *
 * Admin content CRUD (all require auth)
 * ---------------------------------------------------------- */
app.get("/api/content", requireAuth, async (c) => {
  const { q, level, type, status } = c.req.query();
  const clauses = [];
  const binds = [];
  if (q) { clauses.push("title LIKE ?"); binds.push(`%${q}%`); }
  if (level) { clauses.push("level = ?"); binds.push(level); }
  if (type) { clauses.push("content_type = ?"); binds.push(type); }
  if (status) { clauses.push("status = ?"); binds.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, slug, content_type, level, subject, chapter, status, updated_at
     FROM content ${where} ORDER BY updated_at DESC LIMIT 200`
  ).bind(...binds).all();

  return c.json({ items: results });
});

app.get("/api/content/:id", requireAuth, async (c) => {
  const item = await c.env.DB.prepare("SELECT * FROM content WHERE id = ?").bind(c.req.param("id")).first();
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json(item);
});

app.post("/api/content", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const err = validateContent(body);
  if (err) return c.json({ error: err }, 400);

  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      `INSERT INTO content
        (id, title, slug, content_type, level, subject, chapter, language, body_html, seo_title, meta_description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.title, body.slug, body.content_type, body.level,
      body.subject || null, body.chapter || null, body.language || "en",
      body.body_html || "", body.seo_title || null, body.meta_description || null,
      body.status === "published" ? "published" : "draft"
    ).run();
  } catch (e) {
    return c.json({ error: "A content item with this exact URL (level + type + slug) already exists. Change the title or slug." }, 409);
  }
  return c.json({ ok: true, id });
});

app.put("/api/content/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const err = validateContent(body);
  if (err) return c.json({ error: err }, 400);

  try {
    await c.env.DB.prepare(
      `UPDATE content SET
        title = ?, slug = ?, content_type = ?, level = ?, subject = ?, chapter = ?,
        language = ?, body_html = ?, seo_title = ?, meta_description = ?, status = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      body.title, body.slug, body.content_type, body.level,
      body.subject || null, body.chapter || null, body.language || "en",
      body.body_html || "", body.seo_title || null, body.meta_description || null,
      body.status === "published" ? "published" : (body.status === "archived" ? "archived" : "draft"),
      id
    ).run();
  } catch (e) {
    return c.json({ error: "A content item with this exact URL (level + type + slug) already exists. Change the title or slug." }, 409);
  }
  return c.json({ ok: true, id });
});

app.patch("/api/content/:id/status", requireAuth, async (c) => {
  const { status } = await c.req.json().catch(() => ({}));
  if (!["draft", "published", "archived"].includes(status)) {
    return c.json({ error: "status must be draft, published or archived." }, 400);
  }
  const r = await c.env.DB.prepare(
    "UPDATE content SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, c.req.param("id")).run();
  if (!r.meta || r.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true, status });
});

app.delete("/api/content/:id", requireAuth, async (c) => {
  await c.env.DB.prepare("DELETE FROM content WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

function validateContent(body) {
  if (!body.title || !body.title.trim()) return "Title is required.";
  if (!body.slug || !body.slug.trim()) return "URL slug is required.";
  if (!body.level) return "Class/Exam is required.";
  if (!body.content_type || !CONTENT_TYPES.includes(body.content_type)) return "A valid content type is required.";
  return null;
}

/* ---------------------------------------------------------- *
 * Public, read-only routes — no auth. These are what the public
 * site (class.html, notes.html, content.html) should eventually
 * fetch from, instead of the hardcoded demo cards shipped in this
 * scaffold. Only ever returns published content.
 * ---------------------------------------------------------- */
app.get("/api/public/content", async (c) => {
  const { level, type, q } = c.req.query();
  const limit = Math.min(parseInt(c.req.query("limit"), 10) || 60, 200);
  const clauses = ["status = 'published'"];
  const binds = [];
  if (level) { clauses.push("level = ?"); binds.push(level); }
  if (type) { clauses.push("content_type = ?"); binds.push(type); }
  if (q) { clauses.push("title LIKE ?"); binds.push(`%${q}%`); }

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, slug, content_type, level, subject, chapter, updated_at
     FROM content WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ${limit}`
  ).bind(...binds).all();

  return c.json({ items: results });
});

app.get("/api/public/content/:level/:type/:slug", async (c) => {
  const { level, type, slug } = c.req.param();
  const item = await c.env.DB.prepare(
    `SELECT * FROM content WHERE level = ? AND content_type = ? AND slug = ? AND status = 'published'`
  ).bind(level, type, slug).first();
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json(item);
});

/* Every published page, as a sitemap. Serve it at /sitemap.xml. */
app.get("/api/sitemap.xml", async (c) => {
  const origin = c.env.SITE_ORIGIN || "https://mathslearn.online";
  const { results } = await c.env.DB.prepare(
    "SELECT level, content_type, slug, updated_at FROM content WHERE status = 'published' ORDER BY updated_at DESC LIMIT 5000"
  ).all();
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const urls = results.map((r) =>
    `  <url><loc>${esc(`${origin}/${r.content_type}/${r.level}/${encodeURIComponent(r.slug)}/`)}</loc><lastmod>${String(r.updated_at).slice(0, 10)}</lastmod></url>`
  ).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } }
  );
});

export const onRequest = handle(app);
