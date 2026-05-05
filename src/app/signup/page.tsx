import type { Metadata } from "next";

import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign Up | MarketQuack",
  description: "Create a MarketQuack account.",
};

export default function SignupPage() {
  return (
    <main className="px-4 py-10 text-ink sm:px-6">
      <AuthForm mode="signup" />
    </main>
  );
}
