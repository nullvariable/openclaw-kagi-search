/**
 * Kagi Search Plugin for OpenClaw
 *
 * Provides web search via Kagi Search API with balance monitoring.
 * @see https://help.kagi.com/kagi/api/search.html
 */

import { kagiSearch, formatToolResult, KagiApiError } from "./src/api.js";
import type { KagiPluginConfig } from "./src/types.js";

/** Runtime state for balance tracking */
interface PluginState {
  lastKnownBalance: number | null;
  lastBalanceCheck: number | null;
  warningIssued: boolean;
}

const state: PluginState = {
  lastKnownBalance: null,
  lastBalanceCheck: null,
  warningIssued: false,
};

/** Tool parameter schema (plain JSON Schema) */
const KagiSearchToolSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search query" },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      description: "Maximum results to return (default: from plugin config or 10)",
    },
  },
  required: ["query"],
};

/** Resolve config with defaults and env var fallback */
function resolveConfig(raw: unknown): KagiPluginConfig {
  const cfg = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    apiKey: (cfg.apiKey as string) || process.env.KAGI_API_KEY,
    maxResults: typeof cfg.maxResults === "number" ? cfg.maxResults : 10,
    timeoutMs: typeof cfg.timeoutMs === "number" ? cfg.timeoutMs : 30000,
    balance: {
      warnThreshold:
        typeof (cfg.balance as Record<string, unknown>)?.warnThreshold === "number"
          ? ((cfg.balance as Record<string, unknown>).warnThreshold as number)
          : 1.0,
      blockThreshold:
        typeof (cfg.balance as Record<string, unknown>)?.blockThreshold === "number"
          ? ((cfg.balance as Record<string, unknown>).blockThreshold as number)
          : 0.25,
    },
    includeRelatedSearches: cfg.includeRelatedSearches === true,
  };
}

const kagiSearchPlugin = {
  id: "kagi-search",
  name: "Kagi Search",
  description: "Web search via Kagi Search API with balance monitoring",

  configSchema: {
    parse(value: unknown): KagiPluginConfig {
      return resolveConfig(value);
    },
    uiHints: {
      apiKey: {
        label: "Kagi API Key",
        sensitive: true,
        help: "Get your API key from https://kagi.com/settings/api",
      },
      maxResults: {
        label: "Max Results",
        help: "Default number of search results (1-50)",
      },
      timeoutMs: {
        label: "Timeout (ms)",
        advanced: true,
      },
      "balance.warnThreshold": {
        label: "Balance Warning Threshold",
        help: "Log warning when balance falls below this (USD)",
      },
      "balance.blockThreshold": {
        label: "Balance Block Threshold",
        help: "Block searches when balance falls below this (USD)",
      },
      includeRelatedSearches: {
        label: "Include Related Searches",
        help: "Include Kagi's related search suggestions in results",
        advanced: true,
      },
    },
  },

  register(api: {
    pluginConfig: unknown;
    logger: {
      info: (msg: string) => void;
      warn: (msg: string) => void;
      error: (msg: string) => void;
      debug: (msg: string) => void;
    };
    registerTool: (tool: {
      name: string;
      label?: string;
      description: string;
      parameters: unknown;
      execute: (
        toolCallId: string,
        params: unknown
      ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown }>;
    }) => void;
  }) {
    const config = resolveConfig(api.pluginConfig);

    // Validate API key is present
    if (!config.apiKey) {
      api.logger.warn(
        "[kagi-search] No API key configured. Set apiKey in plugin config or KAGI_API_KEY env var."
      );
    }

    api.registerTool({
      name: "kagi_search",
      label: "Kagi Search",
      description:
        "Search the web using Kagi Search API. Returns structured results with titles, URLs, and snippets. Kagi results reflect account-level personalization (blocked/promoted sites).",
      parameters: KagiSearchToolSchema,

      async execute(_toolCallId, params) {
        const json = (payload: unknown) => ({
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          details: payload,
        });

        const p = params as { query?: string; limit?: number };

        // Validate query
        const query = typeof p.query === "string" ? p.query.trim() : "";
        if (!query) {
          return json({ error: "Query is required" });
        }

        // Check API key
        if (!config.apiKey) {
          return json({
            error: "Kagi API key not configured. Set apiKey in plugin config or KAGI_API_KEY env var.",
          });
        }

        // Check balance threshold (if we have a known balance)
        const blockThreshold = config.balance?.blockThreshold ?? 0.25;
        if (state.lastKnownBalance !== null && state.lastKnownBalance < blockThreshold) {
          return json({
            error: `Kagi API balance too low ($${state.lastKnownBalance.toFixed(2)}). Searches blocked until balance exceeds $${blockThreshold.toFixed(2)}.`,
            balance: state.lastKnownBalance,
          });
        }

        try {
          const limit = typeof p.limit === "number" ? p.limit : config.maxResults ?? 10;

          const response = await kagiSearch(
            { q: query, limit },
            { apiKey: config.apiKey, timeoutMs: config.timeoutMs }
          );

          // Update balance state
          const balance = response.meta.api_balance;
          state.lastKnownBalance = balance;
          state.lastBalanceCheck = Date.now();

          // Check warning threshold
          const warnThreshold = config.balance?.warnThreshold ?? 1.0;
          if (balance < warnThreshold && !state.warningIssued) {
            api.logger.warn(
              `[kagi-search] API balance low: $${balance.toFixed(2)} (warn threshold: $${warnThreshold.toFixed(2)})`
            );
            state.warningIssued = true;
          } else if (balance >= warnThreshold) {
            state.warningIssued = false; // Reset warning flag when balance recovers
          }

          // Check if balance dropped below block threshold for next request
          if (balance < blockThreshold) {
            api.logger.warn(
              `[kagi-search] API balance critically low: $${balance.toFixed(2)}. Future searches will be blocked until balance exceeds $${blockThreshold.toFixed(2)}.`
            );
          }

          const result = formatToolResult(response, config.includeRelatedSearches ?? false);
          return json(result);
        } catch (err) {
          if (err instanceof KagiApiError) {
            api.logger.error(`[kagi-search] API error: ${err.message} (code: ${err.code})`);
            return json({
              error: err.message,
              code: err.code,
              ref: err.ref,
            });
          }
          const message = err instanceof Error ? err.message : String(err);
          api.logger.error(`[kagi-search] Search failed: ${message}`);
          return json({ error: message });
        }
      },
    });

    api.logger.info("[kagi-search] Plugin registered");
  },
};

export default kagiSearchPlugin;
