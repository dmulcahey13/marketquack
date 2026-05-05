"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  getCachedSupabaseConfigError,
  getSupabaseBrowserClient,
  getSupabaseConfigError,
} from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [configError, setConfigError] = useState(getCachedSupabaseConfigError);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const isSignup = mode === "signup";

  useEffect(() => {
    let isMounted = true;

    void getSupabaseConfigError().then((message) => {
      if (isMounted) {
        setConfigError(message);
        setIsCheckingConfig(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (configError) {
      setError(configError);
      return;
    }

    if (!emailPattern.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (isSignup && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    const supabase = await getSupabaseBrowserClient();

    if (!supabase) {
      setError(configError || (await getSupabaseConfigError()) || "Supabase is not configured.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.user?.identities && data.user.identities.length === 0) {
          setError("An account with this email already exists. Try logging in instead.");
          return;
        }

        if (!data.session) {
          setSuccess("Check your email to confirm your account.");
          return;
        }

        setSuccess("Account created. You are signed in.");
        router.push("/");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      router.push("/");
    } catch (caughtError) {
      setError(getFriendlyAuthError(caughtError, mode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-soft sm:p-8">
      <div className="grid gap-2">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-pulse-green">
          MarketQuack Account
        </p>
        <h1 className="text-3xl font-black tracking-tight text-ink">
          {isSignup ? "Create Account" : "Log In"}
        </h1>
        <p className="text-sm leading-6 text-neutral-400">
          {isSignup
            ? "Create an account now so MarketQuack is ready for saved watchlists later."
            : "Log in to your MarketQuack account. Stock search still works without signing in."}
        </p>
      </div>

      {configError ? (
        <p className="mt-5 rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold leading-6 text-pulse-red">
          {configError}
        </p>
      ) : null}

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-bold text-neutral-200" htmlFor="email">
          Email
          <input
            autoComplete="email"
            className="min-h-12 rounded-md border border-line bg-paper px-4 text-base text-ink outline-none transition placeholder:text-neutral-500 focus:border-pulse-green focus:bg-black"
            disabled={isCheckingConfig || Boolean(configError) || isSubmitting}
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-neutral-200" htmlFor="password">
          Password
          <input
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="min-h-12 rounded-md border border-line bg-paper px-4 text-base text-ink outline-none transition placeholder:text-neutral-500 focus:border-pulse-green focus:bg-black"
            disabled={isCheckingConfig || Boolean(configError) || isSubmitting}
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            type="password"
            value={password}
          />
        </label>

        {error ? (
          <p className="rounded-md border border-pulse-red/40 bg-pulse-red/10 p-3 text-sm font-semibold leading-6 text-pulse-red">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-md border border-pulse-green/30 bg-pulse-green/10 p-3 text-sm font-semibold leading-6 text-pulse-green">
            {success}
          </p>
        ) : null}

        <button
          className="min-h-12 rounded-md bg-pulse-green px-5 font-black text-black shadow-glow transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-neutral-600 disabled:text-neutral-300 disabled:hover:translate-y-0"
          disabled={isCheckingConfig || Boolean(configError) || isSubmitting}
          type="submit"
        >
          {isCheckingConfig ? "Checking setup..." : isSubmitting ? "Working..." : isSignup ? "Sign Up" : "Log In"}
        </button>
      </form>

      <p className="mt-5 text-sm leading-6 text-neutral-400">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link className="font-bold text-pulse-green hover:text-white" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </section>
  );
}

function getFriendlyAuthError(error: unknown, mode: AuthMode) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("invalid") && message.includes("email")) {
    return "Enter a valid email address.";
  }

  if (message.includes("weak") || message.includes("password should") || message.includes("password must")) {
    return "Use a stronger password with at least 8 characters.";
  }

  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (message.includes("rate limit") || message.includes("too many") || message.includes("429")) {
    return "Too many auth attempts right now. Please wait a few minutes, then try again.";
  }

  if (
    message.includes("api key") ||
    message.includes("invalid key") ||
    message.includes("jwt") ||
    message.includes("project url")
  ) {
    return "Supabase is not configured correctly. Check NEXT_PUBLIC_SUPABASE_URL and your Supabase public key in .env.local.";
  }

  if (mode === "login" && (message.includes("invalid login") || message.includes("credentials"))) {
    return "Email or password is incorrect.";
  }

  return mode === "login"
    ? "Unable to log in. Check your email and password, then try again."
    : "Unable to create account. Check your details, then try again.";
}
