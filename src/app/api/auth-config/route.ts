import { NextResponse } from "next/server";

const missingConfigMessage =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.";
const invalidUrlMessage =
  "Supabase is not configured correctly. NEXT_PUBLIC_SUPABASE_URL must be the project URL only, like https://your-project-ref.supabase.co.";
const unsafeKeyMessage =
  "Supabase is not configured safely. Use the anon public key or publishable key, not a secret or service role key.";
const invalidKeyMessage =
  "Supabase is not configured correctly. Use a Supabase publishable key or anon public key.";

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !supabasePublicKey) {
    return authConfigError(missingConfigMessage);
  }

  if (!isValidHttpUrl(supabaseUrl)) {
    return authConfigError(invalidUrlMessage);
  }

  if (isUnsafeSupabaseKey(supabasePublicKey)) {
    return authConfigError(unsafeKeyMessage);
  }

  if (!isAllowedPublicSupabaseKey(supabasePublicKey)) {
    return authConfigError(invalidKeyMessage);
  }

  return NextResponse.json(
    {
      configured: true,
      supabaseAnonKey: supabasePublicKey,
      supabaseUrl,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function authConfigError(message: string) {
  return NextResponse.json(
    {
      configured: false,
      error: message,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
      status: 200,
    },
  );
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUnsafeSupabaseKey(value: string) {
  if (value.startsWith("sb_secret_")) {
    return true;
  }

  const jwtRole = getJwtRole(value);
  return jwtRole === "service_role";
}

function isAllowedPublicSupabaseKey(value: string) {
  if (value.startsWith("sb_publishable_")) {
    return true;
  }

  return value.startsWith("eyJ") && getJwtRole(value) !== "service_role";
}

function getJwtRole(value: string) {
  const [, payload] = value.split(".");

  if (!payload) {
    return "";
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = Buffer.from(normalizedPayload, "base64").toString("utf8");
    const parsedPayload = JSON.parse(decodedPayload) as { role?: unknown };

    return typeof parsedPayload.role === "string" ? parsedPayload.role : "";
  } catch {
    return "";
  }
}
