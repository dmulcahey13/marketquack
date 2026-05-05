"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthNav() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    void getSupabaseBrowserClient().then((supabase) => {
      if (!isMounted) {
        return;
      }

      if (!supabase) {
        setIsConfigured(false);
        return;
      }

      setIsConfigured(true);

      void supabase.auth.getSession().then(({ data }) => {
        if (isMounted) {
          setEmail(data.session?.user.email ?? "");
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setEmail(session?.user.email ?? "");
      });

      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = await getSupabaseBrowserClient();

    if (!supabase) {
      setEmail("");
      return;
    }

    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setEmail("");
    setIsLoggingOut(false);
    router.refresh();
  }

  if (!isConfigured || !email) {
    return (
      <>
        <Link
          className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green"
          href="/login"
        >
          Log In
        </Link>
        <Link
          className="rounded-md border border-pulse-green/60 px-3 py-2 text-pulse-green transition hover:bg-pulse-green hover:text-black"
          href="/signup"
        >
          Sign Up
        </Link>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="max-w-48 truncate rounded-md border border-line bg-panel px-3 py-2 text-neutral-300">
        {email || "Account"}
      </span>
      <button
        className="rounded-md border border-line px-3 py-2 font-semibold text-neutral-300 transition hover:border-pulse-green hover:text-pulse-green disabled:cursor-not-allowed disabled:text-neutral-600"
        disabled={isLoggingOut}
        onClick={handleLogout}
        type="button"
      >
        {isLoggingOut ? "Logging Out..." : "Log Out"}
      </button>
    </div>
  );
}
