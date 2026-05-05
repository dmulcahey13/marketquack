export type LatestNewsItem = {
  title: string;
  source: string;
  summary: string;
  url: string;
  datetime: string;
  relevanceLabel?: "company" | "market";
  relevanceScore?: number;
};

export type ChartRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y";

export type ChartPoint = {
  date: string;
  price: number;
};

export type ChartHistoryResponse = {
  symbol: string;
  range: ChartRange;
  points: ChartPoint[];
  error?: string;
};

export type ExplanationSource = {
  title: string;
  source: string;
  url: string;
};

export type ExplanationResponse = {
  summary: string;
  keyDrivers: string[];
  sources: ExplanationSource[];
  disclaimer: string;
};

export type StockResponse = {
  symbol: string;
  companyName: string;
  companyDescription?: string;
  currentPrice: number;
  priceChange: number;
  percentChange: number;
  previousClose: number;
  latestNews: LatestNewsItem[];
};
