import { NextResponse } from "next/server";

import type {
  ExplanationResponse,
  ExplanationSource,
  LatestNewsItem,
  StockResponse,
} from "@/types/market";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultModel = "gpt-5-nano";
const maxNewsItemsForAI = 5;
const maxNewsSummaryCharacters = 360;
const maxOutputTokens = 900;
const minExplanationWords = 150;
const maxExplanationWords = 250;
const aiInstruction =
  "You are a financial news explainer. Explain possible reasons why a stock is moving using only the provided quote data and news headlines/summaries. Be clear, cautious, and beginner-friendly. If the evidence is weak, say that. Do not recommend buying, selling, or holding.";
const disclaimer = "This is not financial advice.";

type OpenAIErrorType =
  | "missing_openai_key"
  | "invalid_openai_key"
  | "quota_or_billing"
  | "invalid_model"
  | "openai_request_failed";

export const dynamic = "force-dynamic";

type OpenAIResponsesPayload = {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  incomplete_details?: {
    reason?: string;
  };
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  output_text?: string;
  status?: string;
};

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST with cleaned stock data." }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    const stock = await parseStockRequest(request);
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new RouteError("missing_openai_key", 503);
    }

    if (stock.latestNews.length === 0) {
      return NextResponse.json(fitExplanationWordBudget(createInsufficientEvidenceExplanation(stock), stock));
    }

    const rawExplanation = await requestOpenAIExplanation(stock, apiKey);
    const explanation = fitExplanationWordBudget(normalizeExplanation(rawExplanation, stock), stock);

    return NextResponse.json(explanation);
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logOpenAIError({
      errorType: "openai_request_failed",
      message: error instanceof Error ? error.message : "Unknown OpenAI route error.",
      model: getOpenAIModel(),
      status: "unexpected_exception",
    });

    return NextResponse.json({ error: "openai_request_failed" }, { status: 503 });
  }
}

async function requestOpenAIExplanation(
  stock: StockResponse,
  apiKey: string,
): Promise<unknown> {
  let response: Response;
  const model = getOpenAIModel();

  try {
    response = await fetch(openAiResponsesUrl, {
      body: JSON.stringify({
        input: JSON.stringify({
          instructions:
            "Return structured JSON only. Write 150-250 words total across summary and keyDrivers. summary must be exactly 4 beginner-friendly sentences totaling about 100-140 words. keyDrivers should contain exactly 4 bullet strings when evidence is available, each about 15-25 words. sources must include only source titles and URLs from latestNews that were actually used. Keep source links out of summary and keyDrivers. If there is not enough evidence, say so clearly.",
          stock: createOpenAIStockInput(stock),
        }),
        instructions: aiInstruction,
        max_output_tokens: maxOutputTokens,
        model,
        ...(model.startsWith("gpt-5") ? { reasoning: { effort: "minimal" } } : {}),
        store: false,
        text: {
          format: {
            name: "stock_movement_explanation",
            schema: explanationSchema,
            strict: true,
            type: "json_schema",
          },
          verbosity: "low",
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    logOpenAIError({
      errorType: "openai_request_failed",
      message: error instanceof Error ? error.message : "Network request to OpenAI failed.",
      model,
      status: "network_error",
    });

    throw new RouteError("openai_request_failed", 503);
  }

  const payload = await readOpenAIResponse(response, model);

  if (!response.ok) {
    const errorType = classifyOpenAIError(response.status, payload);

    logOpenAIError({
      code: payload.error?.code,
      errorType,
      message: payload.error?.message ?? "OpenAI returned an error without a message.",
      model,
      openAIType: payload.error?.type,
      status: response.status,
    });

    throw new RouteError(errorType, 503);
  }

  if (payload.status === "incomplete") {
    logOpenAIError({
      code: payload.incomplete_details?.reason,
      errorType: "openai_request_failed",
      message: `OpenAI response was incomplete: ${payload.incomplete_details?.reason ?? "unknown_reason"}`,
      model,
      status: response.status,
    });

    throw new RouteError("openai_request_failed", 503);
  }

  const outputText = extractOutputText(payload);

  if (!outputText) {
    logOpenAIError({
      errorType: "openai_request_failed",
      message: "OpenAI response did not contain output_text.",
      model,
      status: response.status,
    });

    throw new RouteError("openai_request_failed", 503);
  }

  try {
    return JSON.parse(outputText) as unknown;
  } catch (error) {
    logOpenAIError({
      errorType: "openai_request_failed",
      message: error instanceof Error ? error.message : "OpenAI output was not valid JSON.",
      model,
      status: response.status,
    });

    throw new RouteError("openai_request_failed", 503);
  }
}

async function parseStockRequest(request: Request): Promise<StockResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new RouteError("Request body must be valid JSON.", 400);
  }

  const candidate =
    isRecord(body) && "stock" in body ? (body as { stock?: unknown }).stock : body;

  if (!isRecord(candidate)) {
    throw new RouteError("Request body must contain cleaned stock data.", 400);
  }

  const symbol = cleanText(candidate.symbol).toUpperCase();
  const companyName = cleanText(candidate.companyName) || symbol;
  const currentPrice = candidate.currentPrice;
  const priceChange = candidate.priceChange;
  const percentChange = candidate.percentChange;
  const previousClose = candidate.previousClose;

  if (!symbol) {
    throw new RouteError("Stock data must include symbol.", 400);
  }

  if (
    !isFiniteNumber(currentPrice) ||
    !isFiniteNumber(priceChange) ||
    !isFiniteNumber(percentChange) ||
    !isFiniteNumber(previousClose)
  ) {
    throw new RouteError(
      "Stock data must include numeric currentPrice, priceChange, percentChange, and previousClose.",
      400,
    );
  }

  return {
    symbol,
    companyName,
    currentPrice,
    priceChange,
    percentChange,
    previousClose,
    latestNews: cleanLatestNews(candidate.latestNews),
  };
}

function cleanLatestNews(value: unknown): LatestNewsItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      datetime: cleanText(item.datetime),
      source: cleanText(item.source) || "Unknown source",
      summary: cleanText(item.summary),
      title: cleanText(item.title),
      url: cleanText(item.url),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 8);
}

function normalizeExplanation(value: unknown, stock: StockResponse): ExplanationResponse {
  if (!isRecord(value)) {
    throw new RouteError("openai_request_failed", 503);
  }

  const summary = cleanText(value.summary);

  return {
    disclaimer,
    keyDrivers: normalizeKeyDrivers(value.keyDrivers, stock),
    sources: normalizeSources(value.sources, stock.latestNews),
    summary:
      summary && !hasDirectRecommendation(summary)
        ? summary
        : createInsufficientEvidenceExplanation(stock).summary,
  };
}

function normalizeKeyDrivers(value: unknown, stock: StockResponse): string[] {
  const fallbackDrivers = createInsufficientEvidenceExplanation(stock).keyDrivers;

  if (!Array.isArray(value)) {
    return fallbackDrivers;
  }

  const drivers = value
    .map(cleanText)
    .filter((driver) => driver && !hasDirectRecommendation(driver))
    .slice(0, 5);

  return [...drivers, ...fallbackDrivers].slice(0, Math.max(3, drivers.length));
}

function normalizeSources(value: unknown, latestNews: LatestNewsItem[]): ExplanationSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedSources = new Map(latestNews.map((item) => [item.url, item]));

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => {
      const url = cleanText(item.url);
      const matchingSource = allowedSources.get(url);

      if (!matchingSource) {
        return null;
      }

      return {
        source: cleanText(item.source) || matchingSource.source,
        title: cleanText(item.title) || matchingSource.title,
        url,
      };
    })
    .filter((item): item is ExplanationSource => item !== null)
    .slice(0, 5);
}

function extractOutputText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new RouteError("openai_request_failed", 503);
      }

      if ((content.type === "output_text" || content.type === "text") && content.text) {
        return content.text;
      }
    }
  }

  return "";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createOpenAIStockInput(stock: StockResponse) {
  return {
    companyName: stock.companyName,
    currentPrice: stock.currentPrice,
    latestNews: stock.latestNews.slice(0, maxNewsItemsForAI).map((article) => ({
      source: article.source,
      summary: truncateText(article.summary, maxNewsSummaryCharacters),
      title: article.title,
      url: article.url,
    })),
    percentChange: stock.percentChange,
    previousClose: stock.previousClose,
    priceChange: stock.priceChange,
    symbol: stock.symbol,
  };
}

function createInsufficientEvidenceExplanation(stock: StockResponse): ExplanationResponse {
  const direction = stock.priceChange >= 0 ? "up" : "down";
  const formattedPercent = `${stock.percentChange.toFixed(2)}%`;

  return {
    disclaimer,
    keyDrivers: [
      `${stock.symbol} is ${direction} ${formattedPercent} from the previous close in the provided quote data.`,
      "There is not enough recent company news in the provided data to identify a clear catalyst.",
      "The move may reflect broader market or sector factors, but those inputs were not provided.",
    ],
    sources: [],
    summary: `${stock.companyName} is moving ${direction} based on the provided quote data. However, there is not enough recent company news in the provided data to clearly explain the move. The evidence is limited, so this explanation stays cautious.`,
  };
}

function fitExplanationWordBudget(
  explanation: ExplanationResponse,
  stock: StockResponse,
): ExplanationResponse {
  let nextExplanation = {
    ...explanation,
    keyDrivers: explanation.keyDrivers.slice(0, 5),
  };

  if (countExplanationWords(nextExplanation) < minExplanationWords) {
    nextExplanation = {
      ...nextExplanation,
      summary: `${nextExplanation.summary} This explanation is intentionally cautious because the app only receives the current quote and recent news headlines/summaries, not full market, sector, volume, or earnings-calendar context.`,
    };
  }

  if (
    countExplanationWords(nextExplanation) < minExplanationWords &&
    nextExplanation.keyDrivers.length < 5
  ) {
    nextExplanation = {
      ...nextExplanation,
      keyDrivers: [
        ...nextExplanation.keyDrivers,
        `${stock.symbol} may also be affected by market-wide or sector-related factors, but those inputs were not provided here.`,
      ],
    };
  }

  while (
    countExplanationWords(nextExplanation) > maxExplanationWords &&
    nextExplanation.keyDrivers.length > 3
  ) {
    nextExplanation = {
      ...nextExplanation,
      keyDrivers: nextExplanation.keyDrivers.slice(0, -1),
    };
  }

  return nextExplanation;
}

function countExplanationWords(explanation: ExplanationResponse): number {
  return [explanation.summary, ...explanation.keyDrivers]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

async function readOpenAIResponse(
  response: Response,
  model: string,
): Promise<OpenAIResponsesPayload> {
  const rawResponse = await response.text();

  try {
    return rawResponse ? (JSON.parse(rawResponse) as OpenAIResponsesPayload) : {};
  } catch (error) {
    logOpenAIError({
      errorType: "openai_request_failed",
      message:
        error instanceof Error
          ? `OpenAI returned non-JSON response: ${error.message}`
          : "OpenAI returned non-JSON response.",
      model,
      status: response.status,
    });

    throw new RouteError("openai_request_failed", 503);
  }
}

function classifyOpenAIError(status: number, payload: OpenAIResponsesPayload): OpenAIErrorType {
  const code = payload.error?.code?.toLowerCase() ?? "";
  const type = payload.error?.type?.toLowerCase() ?? "";
  const message = payload.error?.message?.toLowerCase() ?? "";

  if (status === 401 || code.includes("invalid_api_key") || message.includes("api key")) {
    return "invalid_openai_key";
  }

  if (
    status === 402 ||
    status === 429 ||
    code.includes("quota") ||
    code.includes("billing") ||
    type.includes("quota") ||
    type.includes("billing") ||
    message.includes("quota") ||
    message.includes("billing")
  ) {
    return "quota_or_billing";
  }

  if (
    code.includes("model") ||
    type.includes("model") ||
    message.includes("model") ||
    message.includes("does not exist")
  ) {
    return "invalid_model";
  }

  return "openai_request_failed";
}

function getOpenAIModel() {
  return defaultModel;
}

function logOpenAIError({
  code,
  errorType,
  message,
  model,
  openAIType,
  status,
}: {
  code?: string;
  errorType: OpenAIErrorType;
  message: string;
  model: string;
  openAIType?: string;
  status: number | string;
}) {
  console.error("[MarketQuack] OpenAI explanation error", {
    code: code ?? "none",
    errorType,
    message,
    model,
    openAIType: openAIType ?? "none",
    status,
  });
}

function hasDirectRecommendation(value: string): boolean {
  return /\b(you|users|investors)\s+should\s+(buy|sell|hold)\b/i.test(value);
}

function truncateText(value: string, maxLength: number): string {
  const cleanValue = cleanText(value);

  if (cleanValue.length <= maxLength) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, maxLength - 1).trim()}...`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const explanationSchema = {
  additionalProperties: false,
  properties: {
    disclaimer: {
      type: "string",
    },
    keyDrivers: {
      items: {
        type: "string",
      },
      type: "array",
    },
    sources: {
      items: {
        additionalProperties: false,
        properties: {
          source: {
            type: "string",
          },
          title: {
            type: "string",
          },
          url: {
            type: "string",
          },
        },
        required: ["title", "source", "url"],
        type: "object",
      },
      type: "array",
    },
    summary: {
      type: "string",
    },
  },
  required: ["summary", "keyDrivers", "sources", "disclaimer"],
  type: "object",
} as const;
