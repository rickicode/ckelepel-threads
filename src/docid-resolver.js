import { fetchWithRetry } from "./http.js";

// In-memory cache for dynamic query metadata with 30m TTL
const queryMetadataCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Dynamically extract doc_id and required relay provider flags from live Threads JS bundles.
 * Caches result in memory to avoid repeated network parsing.
 *
 * @param {string} operationName - e.g. "BarcelonaPostPageDirectQuery"
 * @param {object} options - fetch & proxy options
 * @returns {Promise<{ docId: string|null, providerVars: Record<string, boolean> }>}
 */
export async function getLiveQueryMetadata(
  operationName = "BarcelonaPostPageDirectQuery",
  options = {},
) {
  const cached = queryMetadataCache.get(operationName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const pageUrl = options.targetUrl || "https://www.threads.net/";
    const res = await fetchWithRetry(pageUrl, options, { maxRetries: 1 });
    if (!res.ok) return null;

    const html = await res.text();
    const rawMatches =
      html.match(
        /https:\\\/\\\/static\.cdninstagram\.com\\\/rsrc\.php\\\/[^"]+\.js/g,
      ) ||
      html.match(
        /https:\/\/static\.cdninstagram\.com\/rsrc\.php\/[^"]+\.js/g,
      ) ||
      [];

    const urls = [...new Set(rawMatches.map((u) => u.replaceAll("\\/", "/")))];
    // Search bundles containing Relay Operation
    for (const bundleUrl of urls) {
      try {
        const bundleRes = await fetchWithRetry(bundleUrl, options, {
          maxRetries: 1,
        });
        if (!bundleRes.ok) continue;

        const content = await bundleRes.text();
        if (!content.includes(`${operationName}_threadsRelayOperation`))
          continue;

        let docId = null;
        const relayRegex = new RegExp(
          `__d\\("${operationName}_threadsRelayOperation"[^"]*,\\s*\\[\\],\\s*\\(function\\([^)]*\\)\\{[^}]*exports\\s*=\\s*"(\\d+)"`,
        );
        const m1 = content.match(relayRegex);
        if (m1) {
          docId = m1[1];
        }

        // Extract required Relay provider variable keys
        const providerVars = {};
        const idx = content.indexOf(`${operationName}$Parameters.threads`);
        if (idx !== -1) {
          const block = content.slice(idx, idx + 4000);
          const keys =
            block.match(/__relay_internal__pv__[a-zA-Z0-9_]+/g) || [];
          for (const key of keys) {
            providerVars[key] = key.includes("IsLoggedIn");
          }
        }

        if (docId) {
          const result = { docId, providerVars };
          queryMetadataCache.set(operationName, {
            data: result,
            timestamp: Date.now(),
          });
          return result;
        }
      } catch {}
    }
  } catch {}

  return null;
}

export function clearQueryMetadataCache() {
  queryMetadataCache.clear();
}
