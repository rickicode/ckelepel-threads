import fs from "node:fs";
import path from "node:path";
import { fetchWithRetry } from "./http.js";

// In-memory and disk cache for dynamic query metadata with 24h TTL
const queryMetadataCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DISK_CACHE_PATH = "/tmp/ckelepel_docid_cache.json";

function loadDiskCache() {
  try {
    if (fs.existsSync(DISK_CACHE_PATH)) {
      const data = JSON.parse(fs.readFileSync(DISK_CACHE_PATH, "utf-8"));
      for (const [k, v] of Object.entries(data)) {
        if (v && Date.now() - v.timestamp < CACHE_TTL_MS) {
          queryMetadataCache.set(k, v);
        }
      }
    }
  } catch {}
}

function saveDiskCache() {
  try {
    const obj = {};
    for (const [k, v] of queryMetadataCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(obj), "utf-8");
  } catch {}
}

loadDiskCache();

/**
 * Dynamically extract doc_id and required relay provider flags from live Threads JS bundles.
 * Caches result in memory and on disk to avoid repeated network parsing across CLI executions.
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
    // Search bundles in parallel chunks of 5
    const chunkUrls = urls.slice(0, 15);
    const inspectBundle = async (bundleUrl) => {
      try {
        const bundleRes = await fetchWithRetry(
          bundleUrl,
          {
            ...options,
            headersTimeout: 3000,
            bodyTimeout: 3000,
          },
          { maxRetries: 1 },
        );
        if (!bundleRes.ok) return null;

        const content = await bundleRes.text();
        if (!content.includes(`${operationName}_threadsRelayOperation`)) {
          return null;
        }

        let docId = null;
        const relayRegex = new RegExp(
          `__d\\("${operationName}_threadsRelayOperation"[^"]*,\\s*\\[\\],\\s*\\(function\\([^)]*\\)\\{[^}]*exports\\s*=\\s*"(\\d+)"`,
        );
        const m1 = content.match(relayRegex);
        if (m1) {
          docId = m1[1];
        }

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
          return { docId, providerVars };
        }
      } catch {}
      return null;
    };

    // Parallel inspect
    const results = await Promise.all(chunkUrls.map(inspectBundle));
    for (const found of results) {
      if (found) {
        queryMetadataCache.set(operationName, {
          data: found,
          timestamp: Date.now(),
        });
        saveDiskCache();
        return found;
      }
    }
  } catch {}

  return null;
}

export function clearQueryMetadataCache() {
  queryMetadataCache.clear();
}
