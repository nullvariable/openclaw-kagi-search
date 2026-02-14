/**
 * Kagi Search API client
 */

import type {
  KagiSearchParams,
  KagiSearchResponse,
  KagiSearchResult,
  KagiRelatedSearches,
  KagiToolResult,
  KagiNewsParams,
  KagiNewsResponse,
  KagiNewsToolResult,
} from "./types.js";

const KAGI_API_BASE = "https://kagi.com/api/v0";

export interface KagiClientOptions {
  apiKey: string;
  timeoutMs?: number;
}

export class KagiApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly ref?: string
  ) {
    super(message);
    this.name = "KagiApiError";
  }
}

export async function kagiSearch(
  params: KagiSearchParams,
  options: KagiClientOptions
): Promise<KagiSearchResponse> {
  const { apiKey, timeoutMs = 30000 } = options;

  const url = new URL(`${KAGI_API_BASE}/search`);
  url.searchParams.set("q", params.q);
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.freshness) {
    url.searchParams.set("freshness", params.freshness);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bot ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new KagiApiError("Invalid Kagi API key", 401);
      }
      if (response.status === 429) {
        throw new KagiApiError("Kagi API rate limit exceeded", 429);
      }
      throw new KagiApiError(
        `Kagi API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as KagiSearchResponse;

    // Check for API-level errors in response body
    if (data.error && data.error.length > 0) {
      const err = data.error[0];
      throw new KagiApiError(err.msg, err.code, err.ref);
    }

    return data;
  } catch (error) {
    if (error instanceof KagiApiError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new KagiApiError("Kagi API request timed out", 408);
    }
    throw new KagiApiError(`Kagi API request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Filter search results (t=0) from response data */
export function extractSearchResults(data: KagiSearchResponse["data"]): KagiSearchResult[] {
  return data.filter((item): item is KagiSearchResult => item.t === 0);
}

/** Extract related searches (t=1) from response data */
export function extractRelatedSearches(data: KagiSearchResponse["data"]): string[] {
  const related = data.find((item): item is KagiRelatedSearches => item.t === 1);
  return related?.list ?? [];
}

/** Transform Kagi response to tool output format */
export function formatToolResult(
  response: KagiSearchResponse,
  includeRelatedSearches: boolean
): KagiToolResult {
  const searchResults = extractSearchResults(response.data);

  const result: KagiToolResult = {
    results: searchResults.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      published: r.published,
    })),
    meta: {
      balance: response.meta.api_balance,
      queryTimeMs: response.meta.ms,
      resultCount: searchResults.length,
    },
  };

  if (includeRelatedSearches) {
    const related = extractRelatedSearches(response.data);
    if (related.length > 0) {
      result.relatedSearches = related;
    }
  }

  return result;
}

/**
 * Kagi News Enrichment API
 * Returns interesting discussions and news from non-mainstream sources.
 * @see https://help.kagi.com/kagi/api/enrich.html
 */
export async function kagiNews(
  params: KagiNewsParams,
  options: KagiClientOptions
): Promise<KagiNewsResponse> {
  const { apiKey, timeoutMs = 30000 } = options;

  const url = new URL(`${KAGI_API_BASE}/enrich/news`);
  url.searchParams.set("q", params.q);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bot ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new KagiApiError("Invalid Kagi API key", 401);
      }
      if (response.status === 429) {
        throw new KagiApiError("Kagi API rate limit exceeded", 429);
      }
      throw new KagiApiError(
        `Kagi API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as KagiNewsResponse;

    // Check for API-level errors in response body
    if (data.error && data.error.length > 0) {
      const err = data.error[0];
      throw new KagiApiError(err.msg, err.code, err.ref);
    }

    return data;
  } catch (error) {
    if (error instanceof KagiApiError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new KagiApiError("Kagi API request timed out", 408);
    }
    throw new KagiApiError(`Kagi API request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Transform Kagi news response to tool output format */
export function formatNewsToolResult(
  response: KagiNewsResponse,
  limit: number
): KagiNewsToolResult {
  const results = response.data.slice(0, limit);

  return {
    results: results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      published: r.published,
    })),
    meta: {
      balance: response.meta.api_balance,
      queryTimeMs: response.meta.ms,
      resultCount: results.length,
    },
  };
}
