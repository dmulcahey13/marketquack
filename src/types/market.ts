export type LatestNewsItem = {
  title: string;
  source: string;
  summary: string;
  url: string;
  datetime: string;
};

export type ExplanationConfidence = "low" | "medium" | "high";

export type ExplanationSource = {
  title: string;
  source: string;
  url: string;
};

export type ExplanationResponse = {
  summary: string;
  keyDrivers: string[];
  confidence: ExplanationConfidence;
  sources: ExplanationSource[];
  disclaimer: string;
};

export type StockResponse = {
  symbol: string;
  companyName: string;
  currentPrice: number;
  priceChange: number;
  percentChange: number;
  previousClose: number;
  latestNews: LatestNewsItem[];
};
