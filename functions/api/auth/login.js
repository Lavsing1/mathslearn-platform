import { json, createSession, sessionCookie, sameOrigin, readJson } from "../../_utils.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: "Admin secrets are not configured in Cloudflare yet." }, 503);
  }
  let body;
  try { body = await readJson(request); } catch { return json({ error: "Invalid request body." }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (email !== env.ADMIN_EMAIL.toLowerCase() || !password || password !== env.ADMIN_PASSWORD) {
    await new Promise(resolve => setTimeout(resolve, 350));
    return json({ error: "Email or password is incorrect." }, 401);
  }
  const token = await createSession(env.ADMIN_EMAIL, env.SESSION_SECRET);
  return json({ ok: true, email: env.ADMIN_EMAIL }, 200, { "set-cookie": sessionCookie(token, request) });
}
