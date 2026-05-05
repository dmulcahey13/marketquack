"use client";

import Image from "next/image";
import Link from "next/link";

import { AuthNav } from "@/components/AuthNav";

const homeResetEvent = "marketquack:home";

export function SiteHeader() {
  function handleHomeClick() {
    window.dispatchEvent(new Event(homeResetEvent));
  }

  return (
    <header className="border-b border-line bg-black/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link className="group flex items-center gap-3" href="/" onClick={handleHomeClick}>
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

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-300">
          <Link
            className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green"
            href="/"
            onClick={handleHomeClick}
          >
            Home
          </Link>
          <Link
            className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green"
            href="/about"
          >
            About
          </Link>
          <Link
            className="rounded-md px-3 py-2 transition hover:bg-panel-soft hover:text-pulse-green"
            href="/stock-basics"
          >
            Stock Basics
          </Link>
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}

export { homeResetEvent };
