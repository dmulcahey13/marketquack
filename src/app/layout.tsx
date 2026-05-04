import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
