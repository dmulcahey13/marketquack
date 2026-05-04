import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
          <header className="border-b border-line bg-black/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Link className="group flex items-center gap-3" href="/">
                <Image
                  alt=""
                  className="h-11 w-11 rounded-md border border-line object-cover shadow-glow transition group-hover:-translate-y-0.5"
                  height={44}
                  priority
                  src="/marketquack-logo.png"
                  width={44}
                />
                <span>
                  <span className="block text-lg font-black tracking-tight text-ink">
                    Market<span className="text-pulse-green">Quack</span>
                  </span>
                  <span className="block text-xs font-semibold text-neutral-400">
                    The market is loud. We make it make sense.
                  </span>
                </span>
              </Link>

              <nav className="flex items-center gap-2 text-sm font-semibold text-neutral-300">
                <Link className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green" href="/">
                  Home
                </Link>
                <Link
                  className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green"
                  href="/about"
                >
                  About
                </Link>
              </nav>
            </div>
          </header>

          <div className="flex-1">{children}</div>

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
