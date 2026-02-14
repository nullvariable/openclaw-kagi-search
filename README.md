# Kagi Search Plugin for OpenClaw

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Web search and news enrichment via [Kagi APIs](https://help.kagi.com/kagi/api/) for [OpenClaw](https://github.com/openclaw/openclaw).

## Features

- **Web Search** — Structured search results with titles, URLs, snippets, and publication dates
- **News Enrichment** — Interesting discussions and news from non-mainstream sources
- **Balance monitoring** — Warns when balance is low, blocks searches when critically low
- **Account personalization** — Search results inherit your Kagi account's blocked/promoted sites
- **Related searches** — Optionally include Kagi's related search suggestions

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) >= 2026.1.0
- [Kagi API](https://help.kagi.com/kagi/api/) access (request at support@kagi.com)

## Installation

### Option 1: Clone to extensions directory

```bash
git clone https://github.com/nullvariable/openclaw-kagi-search.git ~/.openclaw/extensions/kagi-search
```

### Option 2: Via OpenClaw plugins (coming soon)

```bash
openclaw plugins install @nullvariable/openclaw-kagi-search
```

## Configuration

Add to your OpenClaw config (`~/.openclaw/openclaw.json` or `~/.config/openclaw/config.json5`):

```json5
{
  plugins: {
    entries: {
      "kagi-search": {
        enabled: true,
        config: {
          // Required: Get your API key from https://kagi.com/settings/api
          apiKey: "your-kagi-api-key",
          
          // Optional settings
          maxResults: 10,           // Default results per search (1-50)
          timeoutMs: 30000,         // Request timeout in ms
          
          // Balance monitoring thresholds
          balance: {
            warnThreshold: 1.00,    // Log warning when balance < $1.00
            blockThreshold: 0.25,   // Block searches when balance < $0.25
          },
          
          // Include related search suggestions in results (search only)
          includeRelatedSearches: false,
        },
      },
    },
  },
}
```

### Environment Variable

Alternatively, set the API key via environment variable:

```bash
export KAGI_API_KEY="your-kagi-api-key"
```

## Tools

The plugin registers two tools:

### `kagi_search` — Web Search

Full web search using Kagi's search index. Results reflect your account personalization (blocked/promoted sites).

| Parameter | Type    | Required | Description                              |
|-----------|---------|----------|------------------------------------------|
| `query`   | string  | Yes      | Search query                             |
| `limit`   | integer | No       | Max results (1-50, default from config)  |

**Response:**

```json
{
  "results": [
    {
      "title": "Result Title",
      "url": "https://example.com",
      "snippet": "Result snippet text...",
      "published": "2024-09-30T00:00:00Z"
    }
  ],
  "relatedSearches": ["related term 1", "related term 2"],
  "meta": {
    "balance": 9.975,
    "queryTimeMs": 213,
    "resultCount": 5
  }
}
```

### `kagi_news` — News Enrichment

Search Kagi's news enrichment index for interesting discussions and non-mainstream news. Good for finding indie perspectives, alternative viewpoints, and discussions that don't appear in mainstream search.

| Parameter | Type    | Required | Description                              |
|-----------|---------|----------|------------------------------------------|
| `query`   | string  | Yes      | Search query                             |
| `limit`   | integer | No       | Max results (1-50, default: 10)          |

**Response:**

```json
{
  "results": [
    {
      "title": "Discussion Title",
      "url": "https://blog.example.com/post",
      "snippet": "Discussion snippet...",
      "published": "2024-10-15T12:30:00Z"
    }
  ],
  "meta": {
    "balance": 9.95,
    "queryTimeMs": 275,
    "resultCount": 10
  }
}
```

**Best for:**
- Finding non-mainstream perspectives on topics
- Discovering indie/small web content
- Research on niche or emerging topics
- Alternative viewpoints and discussions

## Balance Monitoring

The plugin tracks your Kagi API balance and provides two thresholds:

| Threshold | Default | Behavior |
|-----------|---------|----------|
| `warnThreshold` | $1.00 | Logs a warning when balance drops below |
| `blockThreshold` | $0.25 | Blocks all searches until balance is replenished |

Balance is updated after each API call from the response metadata.

## Account Personalization

Kagi Search API results inherit your account settings:

- **Blocked sites** — Sites you've blocked won't appear in results
- **Promoted sites** — Sites you've promoted will be prioritized  
- **Snippet length** — Configurable under Kagi Settings → Search

This is intentional — your agent's searches reflect your preferences. See [Kagi Personalization](https://help.kagi.com/kagi/getting-started/index.html) for more details.

## Pricing

- **Search API:** $0.025 per query ($25 per 1,000 searches)
- **Enrichment API:** Pricing varies — see [Kagi API docs](https://help.kagi.com/kagi/api/enrich.html)

Check your balance: https://kagi.com/settings/api

## Comparison with Other Search Providers

| Feature              | Brave       | Perplexity  | Kagi         |
|----------------------|-------------|-------------|--------------|
| Result type          | Structured  | AI-synth    | Structured   |
| Free tier            | Yes         | No          | No           |
| Pricing              | Pay-per-use | Pay-per-use | $0.025/query |
| Personalization      | No          | No          | Yes          |
| Related searches     | No          | No          | Yes          |
| News enrichment      | No          | No          | Yes          |

## Documentation

- [Kagi Search API Documentation](https://help.kagi.com/kagi/api/search.html)
- [Kagi Enrichment API Documentation](https://help.kagi.com/kagi/api/enrich.html)
- [Kagi API Authentication](https://help.kagi.com/kagi/api/intro/auth.html)
- [Kagi API Settings](https://kagi.com/settings/api)
- [OpenClaw Plugin Documentation](https://docs.openclaw.ai/plugin)

## License

MIT © [Doug Cone](https://github.com/nullvariable)
