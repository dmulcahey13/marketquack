import type { Metadata } from "next";

import { PracticePortfolio } from "@/components/PracticePortfolio";

export const metadata: Metadata = {
  title: "Practice Portfolio | MarketQuack",
  description: "Test investment ideas with virtual money in MarketQuack.",
};

export default function PortfolioPage() {
  return <PracticePortfolio />;
}
