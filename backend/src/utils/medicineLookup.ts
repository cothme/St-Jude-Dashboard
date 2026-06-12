import { config } from "../config.js";

export interface MedicineLookupResult {
  rxcui: string;
  name: string;
  type: string;
  synonym?: string;
  score?: number;
  source?: string;
}

type CacheEntry = {
  expiresAt: number;
  results: MedicineLookupResult[];
};

type ApproximateResponse = {
  approximateGroup?: {
    candidate?: Array<{
      rxcui?: string;
      name?: string;
      score?: string;
      source?: string;
    }>;
  };
};

type DrugsResponse = {
  drugGroup?: {
    conceptGroup?: Array<{
      tty?: string;
      conceptProperties?: Array<{
        rxcui?: string;
        name?: string;
        synonym?: string;
        tty?: string;
      }>;
    }>;
  };
};

const cache = new Map<string, CacheEntry>();
const maxCacheEntries = 500;

function deduplicate(results: MedicineLookupResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.rxcui}:${result.name.toLowerCase()}`;
    if (!result.rxcui || !result.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= maxCacheEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

async function fetchRxNav<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.rxNavTimeoutMs);
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(response.status === 429 ? "Medicine lookup is temporarily busy" : "Medicine lookup service failed") as Error & { status: number };
      error.status = response.status === 429 ? 429 : 502;
      throw error;
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError = new Error("Medicine lookup timed out") as Error & { status: number };
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function queryRxNav(term: string) {
  const approximate = await fetchRxNav<ApproximateResponse>(
    `/REST/Prescribe/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=20&option=1`,
  );
  const approximateResults = deduplicate(
    (approximate.approximateGroup?.candidate ?? []).map((candidate) => ({
      rxcui: candidate.rxcui ?? "",
      name: candidate.name ?? "",
      type: "Approximate match",
      score: candidate.score ? Number(candidate.score) : undefined,
      source: candidate.source,
    })),
  );
  if (approximateResults.length > 0) return approximateResults.slice(0, 20);

  const drugs = await fetchRxNav<DrugsResponse>(`/REST/drugs.json?name=${encodeURIComponent(term)}`);
  return deduplicate(
    (drugs.drugGroup?.conceptGroup ?? []).flatMap((group) =>
      (group.conceptProperties ?? []).map((concept) => ({
        rxcui: concept.rxcui ?? "",
        name: concept.name ?? "",
        synonym: concept.synonym || undefined,
        type: concept.tty ?? group.tty ?? "Drug concept",
        source: "RXNORM",
      })),
    ),
  ).slice(0, 20);
}

export async function searchMedicines(term: string) {
  const cacheKey = term.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { results: cached.results, cached: true };
  }

  const results = await queryRxNav(cacheKey);
  pruneCache();
  cache.set(cacheKey, {
    expiresAt: Date.now() + config.rxNavCacheTtlMs,
    results,
  });
  return { results, cached: false };
}
