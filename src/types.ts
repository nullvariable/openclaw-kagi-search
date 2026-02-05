/**
 * Kagi Search API types
 * @see https://help.kagi.com/kagi/api/search.html
 */

export interface KagiSearchParams {
  q: string;
  limit?: number;
}

export interface KagiMeta {
  id: string;
  node: string;
  ms: number;
  api_balance: number;
}

/** Standard search result (t=0) */
export interface KagiSearchResult {
  t: 0;
  rank?: number;
  url: string;
  title: string;
  snippet?: string;
  published?: string;
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
}

/** Related searches (t=1) */
export interface KagiRelatedSearches {
  t: 1;
  list: string[];
}

export type KagiDataItem = KagiSearchResult | KagiRelatedSearches;

export interface KagiSearchResponse {
  meta: KagiMeta;
  data: KagiDataItem[];
  error?: Array<{ code: number; msg: string; ref?: string }>;
}

/** Plugin config from openclaw.plugin.json schema */
export interface KagiPluginConfig {
  apiKey?: string;
  maxResults?: number;
  timeoutMs?: number;
  balance?: {
    warnThreshold?: number;
    blockThreshold?: number;
  };
  includeRelatedSearches?: boolean;
}

/** Tool output format */
export interface KagiToolResult {
  results: Array<{
    title: string;
    url: string;
    snippet?: string;
    published?: string;
  }>;
  relatedSearches?: string[];
  meta: {
    balance: number;
    queryTimeMs: number;
    resultCount: number;
  };
}
