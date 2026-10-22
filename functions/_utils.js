const COOKIE_NAME = "ml_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeB64url(s) {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
export async function createSession(email, secret) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  return `${payload}.${await sign(payload, secret)}`;
}
export async function getAdmin(request, env) {
  if (!env.ADMIN_EMAIL || !env.SESSION_SECRET) return null;
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = await sign(payload, env.SESSION_SECRET);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeB64url(payload)));
    if (data.email !== env.ADMIN_EMAIL || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { email: data.email };
  } catch { return null; }
}
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}
export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || new URL(origin).origin === new URL(request.url).origin;
}
export function sanitizeHtml(input) {
  let html = String(input ?? "").slice(0, 300000);
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math|link|meta|base)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math|link|meta|base)\b[^>]*\/?\s*>/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/\s+(srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Preserve only a tiny allowlist of presentation styles emitted by the editor.
  html = html.replace(/\s+style\s*=\s*("[^"]*"|'[^']*')/gi, (attr) => {
    const raw = attr.slice(attr.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    const kept = raw.split(";").map(part => part.trim()).filter(part =>
      /^(color|background-color|font-size|text-align)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|[a-z]{3,20}|(?:[1-9]|[1-5][0-9]|6[0-4])(?:px|pt|em|rem)|left|right|center|justify)\s*$/i.test(part)
    );
    return kept.length ? ' style="' + kept.join("; ") + '"' : "";
  });
  html = html.replace(/\s+(href|src)\s*=\s*("\s*(?:javascript:|vbscript:|data:text\/html)[^"]*"|'\s*(?:javascript:|vbscript:|data:text\/html)[^']*'|(?:javascript:|vbscript:|data:text\/html)[^\s>]*)/gi, "");
  return html;
}
export function cleanText(value, max = 300) { return String(value ?? "").trim().slice(0, max); }
export async function readJson(request) {
  // Content-Length may be absent for streamed/chunked requests, so enforce the
  // limit against the actual body instead of trusting the header alone.
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 350000) {
    throw new Error("Request body too large.");
  }
  return JSON.parse(text);
}
