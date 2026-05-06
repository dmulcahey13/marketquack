import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketQuack",
  description: "The market is loud. We make it make sense.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col">

          <div className="flex-1">{children}</div>
<Analytics />
          <footer className="border-t border-line bg-black/95">
            <div className="mx-auto w-full max-w-5xl px-4 py-5 text-sm leading-6 text-neutral-400 sm:px-6">
              MarketQuack is for educational purposes only and does not provide financial advice.
              Always do your own research before making investment decisions.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
