import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseAuthConfig =
  | {
      configured: true;
      supabaseAnonKey: string;
      supabaseUrl: string;
    }
  | {
      configured: false;
      error: string;
    };

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<SupabaseAuthConfig> | null = null;
let configError = "";

export async function getSupabaseConfigError() {
  const config = await getSupabaseAuthConfig();
  return config.configured ? "" : config.error;
}

export async function getSupabaseBrowserClient() {
  const config = await getSupabaseAuthConfig();

  if (!config.configured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  return browserClient;
}

export function getCachedSupabaseConfigError() {
  return configError;
}

async function getSupabaseAuthConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/auth-config", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return {
            configured: false,
            error: "Supabase is not configured correctly. Check your Supabase project settings.",
          } satisfies SupabaseAuthConfig;
        }

        return (await response.json()) as SupabaseAuthConfig;
      })
      .catch(
        () =>
          ({
            configured: false,
            error: "Supabase is not configured correctly. Check your Supabase project settings.",
          }) satisfies SupabaseAuthConfig,
      )
      .then((config) => {
        configError = config.configured ? "" : config.error;
        return config;
      });
  }

  return configPromise;
}
