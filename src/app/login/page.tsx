import type { Metadata } from "next";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Log In | MarketQuack",
  description: "Log in to your MarketQuack account.",
};

export default function LoginPage() {
  return (
    <main className="px-4 py-10 text-ink sm:px-6">
      <AuthForm mode="login" />
    </main>
  );
}
