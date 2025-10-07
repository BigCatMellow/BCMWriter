// Cloudflare Worker: CORS + Google/GitHub OAuth (server-side, syntax-correct)
export default { fetch: withCors(async (request, env, ctx) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") return corsPreflight(request, env);

  if (path === "/health") return json({ ok: true });

  if (path === "/auth/google/start") return startGoogle(request, env);
  if (path === "/auth/google/callback") return googleCallback(request, env);

  if (path === "/auth/github/start") return startGitHub(request, env);
  if (path === "/auth/github/callback") return githubCallback(request, env);

  if (path === "/session") return getSession(request, env);

  return json({ error: "not_found", path }, 404);
}) };

// ---- Utilities ----
function getAllowedOrigins(env) {
  const s = (env.ALLOWED_ORIGINS || "").trim();
  return new Set(s ? s.split(",").map(x => x.trim()) : []);
}
function getAppOrigins(env) {
  const s = (env.APP_ORIGINS || "").trim();
  return new Set(s ? s.split(",").map(x => x.trim()) : []);
}
function getWorkerBase(url, env) {
  return (env.OAUTH_CALLBACK_BASE || `${url.protocol}//${url.host}`);
}
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

// ---- CORS helpers ----
function corsPreflight(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (getAllowedOrigins(env).has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return new Response(null, { headers });
}

function withCors(handler) {
  return async (request, env, ctx) => {
    if (request.method === "OPTIONS") return corsPreflight(request, env);
    const resp = await handler(request, env, ctx);
    const origin = request.headers.get("Origin") || "";
    if (resp instanceof Response) {
      if (getAllowedOrigins(env).has(origin)) {
        resp.headers.set("Access-Control-Allow-Origin", origin);
        resp.headers.set("Vary", "Origin");
      }
      return resp;
    }
    const headers = {};
    if (getAllowedOrigins(env).has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Vary"] = "Origin";
    }
    return new Response(String(resp), { headers });
  };
}

// ---- Random helpers ----
function randomId(len = 24) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => (x % 36).toString(36)).join("");
}

// ---- Session helpers (KV) ----
async function putSession(env, key, data, ttlSeconds = 3600) {
  await env.SESSIONS.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
}
async function getSessionData(env, key) {
  const s = await env.SESSIONS.get(key);
  return s ? JSON.parse(s) : null;
}

// ---- Google OAuth ----
async function startGoogle(request, env) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "missing GOOGLE_CLIENT_ID" }, 500);
  const url = new URL(request.url);
  const state = randomId(24);
  const workerBase = getWorkerBase(url, env);
  const redirect_uri = `${workerBase}/auth/google/callback`;
  const scope = encodeURIComponent([
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file"
  ].join(" "));
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

  await putSession(env, `google_state:${state}`, { created: Date.now() }, 600);
  return Response.redirect(authUrl, 302);
}

async function googleCallback(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "missing_google_secrets" }, 500);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return json({ error: "missing_code_or_state" }, 400);
  const st = await getSessionData(env, `google_state:${state}`);
  if (!st) return json({ error: "invalid_state" }, 400);

  const workerBase = getWorkerBase(url, env);
  const redirect_uri = `${workerBase}/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return json({ error: "google_token_exchange_failed", detail: t }, 502);
  }
  const tokens = await tokenRes.json();

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { "Authorization": `Bearer ${tokens.access_token}` }
  });
  const user = userRes.ok ? await userRes.json() : null;

  const sessionId = randomId(24);
  await putSession(env, `sess:${sessionId}`, { provider: "google", user, tokens }, 3600);

  const appOrigins = Array.from(getAppOrigins(env));
  const target = appOrigins[0] || "/";
  const redirect = new URL(target);
  redirect.searchParams.set("session_id", sessionId);
  return Response.redirect(redirect.toString(), 302);
}

// ---- GitHub OAuth ----
async function startGitHub(request, env) {
  if (!env.GITHUB_CLIENT_ID) return json({ error: "missing GITHUB_CLIENT_ID" }, 500);
  const url = new URL(request.url);
  const state = randomId(24);
  const workerBase = getWorkerBase(url, env);
  const redirect_uri = `${workerBase}/auth/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}&scope=repo%20read:user%20user:email`;
  await putSession(env, `github_state:${state}`, { created: Date.now() }, 600);
  return Response.redirect(authUrl, 302);
}

async function githubCallback(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json({ error: "missing_github_secrets" }, 500);
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return json({ error: "missing_code_or_state" }, 400);
  const st = await getSessionData(env, `github_state:${state}`);
  if (!st) return json({ error: "invalid_state" }, 400);

  const workerBase = getWorkerBase(url, env);
  const redirect_uri = `${workerBase}/auth/github/callback`;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri,
      state
    })
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return json({ error: "github_token_exchange_failed", detail: t }, 502);
  }
  const tokens = await tokenRes.json();

  const userRes = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${tokens.access_token}`, "User-Agent": "focus-writer" }
  });
  const user = userRes.ok ? await userRes.json() : null;

  const sessionId = randomId(24);
  await putSession(env, `sess:${sessionId}`, { provider: "github", user, tokens }, 3600);

  const appOrigins = Array.from(getAppOrigins(env));
  const target = appOrigins[0] || "/";
  const redirect = new URL(target);
  redirect.searchParams.set("session_id", sessionId);
  return Response.redirect(redirect.toString(), 302);
}

// ---- Session retrieval for the app ----
async function getSession(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || url.searchParams.get("session_id");
  if (!id) return json({ error: "missing_session_id" }, 400);
  const sess = await getSessionData(env, `sess:${id}`);
  if (!sess) return json({ error: "not_found" }, 404);
  if (sess.tokens && "refresh_token" in sess.tokens) {
    sess.tokens.refresh_token = "REDACTED";
  }
  return json({ session: sess, session_id: id });
}
