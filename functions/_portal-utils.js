export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export function cleanText(value, limit) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function readJson(request, maxBytes = 12000) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return { error: "Send the form as JSON." };
  const text = await request.text();
  if (text.length > maxBytes) return { error: "The submitted details are too large." };
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : { error: "The submitted details are invalid." };
  }
  catch { return { error: "The submitted details are invalid." }; }
}

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function tokenDigest(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function findProject(db, token) {
  if (!validToken(token)) return null;
  return db.prepare("SELECT * FROM projects WHERE portal_token_hash = ? LIMIT 1")
    .bind(await tokenDigest(token)).first();
}

export async function paidTotal(db, projectId) {
  const row = await db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM project_payments WHERE project_id = ? AND status = 'verified'")
    .bind(projectId).first();
  return Number(row?.total ?? 0);
}

export async function requireAdmin(request, env) {
  const expected = String(env.PORTAL_ADMIN_KEY ?? "");
  const supplied = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}

export function safeObjectKey(value) {
  const key = String(value ?? "").trim();
  return key.length <= 180 && /^[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(key) && !key.startsWith("/") && !key.includes("..") ? key : "";
}

export function portalUrl(request, token) {
  const url = new URL(request.url);
  url.pathname = "/project.html";
  url.search = `?token=${encodeURIComponent(token)}`;
  return url.toString();
}
