import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_ORIGINS = new Set([
  "https://raazimtech.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const usernamePattern = /^[A-Za-z0-9_]{3,16}$/;
const emailFor = (name: string) => `${name.toLowerCase()}@players.blackout.invalid`;

function response(body: unknown, status = 200, origin = "https://raazimtech.github.io") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin);
  const corsOrigin = allowedOrigin ? origin : "https://raazimtech.github.io";

  if (req.method === "OPTIONS") {
    if (!allowedOrigin) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    }});
  }
  if (req.method !== "POST" || !allowedOrigin) return response({ error: "Forbidden" }, 403, corsOrigin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ error: "Invalid request." }, 400, corsOrigin); }

  const nickname = String(body.nickname || "").trim();
  const password = String(body.password || "");
  const action = String(body.action || "");

  if (!usernamePattern.test(nickname)) {
    return response({ error: "Use 3–16 letters, numbers or underscores for your callsign." }, 400, corsOrigin);
  }
  if (action === "signup") {
    if (password.length < 8 || password.length > 72) {
      return response({ error: "Password must contain 8–72 characters." }, 400, corsOrigin);
    }

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const now = Date.now();
    const attempt = signupAttempts.get(ip);
    if (attempt && attempt.resetAt > now && attempt.count >= 5) {
      return response({ error: "Too many account attempts. Try again in an hour." }, 429, corsOrigin);
    }
    if (!attempt || attempt.resetAt <= now) signupAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    else signupAttempts.set(ip, { count: attempt.count + 1, resetAt: attempt.resetAt });

    const { data, error } = await db.auth.admin.createUser({
      email: emailFor(nickname),
      password,
      email_confirm: true,
      user_metadata: { app: "blackout", username: nickname },
    });
    if (error || !data.user) {
      const message = error?.message || "Unable to create account.";
      if (/already|registered|exists/i.test(message)) {
        return response({ error: "That callsign already has an account. Switch to SIGN IN." }, 409, corsOrigin);
      }
      console.error("LOOP OUT account creation failed:", message);
      return response({ error: "Account creation failed. Please try again." }, 400, corsOrigin);
    }
    return response({ ok: true }, 201, corsOrigin);
  }

  if (action === "confirm_legacy") {
    // These old synthetic addresses cannot receive email. Password verification
    // still happens immediately afterwards through signInWithPassword in the client.
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("LOOP OUT legacy account lookup failed:", error.message);
        return response({ error: "Could not prepare this account for sign-in." }, 500, corsOrigin);
      }
      const user = data.users.find((u) =>
        u.email?.toLowerCase() === emailFor(nickname) &&
        u.user_metadata?.app === "blackout" &&
        u.user_metadata?.username?.toLowerCase() === nickname.toLowerCase()
      );
      if (user) {
        if (!user.email_confirmed_at) {
          const { error: updateError } = await db.auth.admin.updateUserById(user.id, { email_confirm: true });
          if (updateError) {
            console.error("LOOP OUT legacy confirmation failed:", updateError.message);
            return response({ error: "Could not prepare this account for sign-in." }, 500, corsOrigin);
          }
        }
        return response({ ok: true }, 200, corsOrigin);
      }
      if (data.users.length < 1000) break;
    }
    return response({ ok: true }, 200, corsOrigin);
  }

  return response({ error: "Unknown action." }, 400, corsOrigin);
});
