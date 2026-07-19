import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { flatMap } from "lodash-es";
import superjson from "superjson";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import type { BestOfSummary } from "@/lib/immich/best-of";
import Config from "./config";

export interface ObservationsSnapshot {
  summary: ObservationSummary;
  observations: Observation[];
  placeNames: Map<number, string>;
  updatedAt: Date;
}

export interface BestOfSnapshot extends BestOfSummary {
  updatedAt: Date;
}

const OBSERVATIONS_PATH = path.join(
  Config.cacheDir,
  "observations-snapshot.json",
);
const BEST_OF_PATH = path.join(Config.cacheDir, "best-of-snapshot.json");

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, superjson.stringify(data));
  await rename(tmpPath, filePath);
}

function cachedFileReader<T>(filePath: string): () => Promise<T | null> {
  let cache: { mtimeMs: number; data: T } | null = null;

  return async () => {
    let mtimeMs: number;
    try {
      mtimeMs = (await stat(filePath)).mtimeMs;
    } catch {
      cache = null;
      return null;
    }

    if (!cache || cache.mtimeMs !== mtimeMs) {
      const raw = await readFile(filePath, "utf-8");
      cache = { mtimeMs, data: superjson.parse<T>(raw) };
    }

    return cache.data;
  };
}

export const readObservationsSnapshot =
  cachedFileReader<ObservationsSnapshot>(OBSERVATIONS_PATH);

export async function writeObservationsSnapshot(
  snapshot: ObservationsSnapshot,
) {
  await writeJson(OBSERVATIONS_PATH, snapshot);
}

export const readBestOfSnapshot =
  cachedFileReader<BestOfSnapshot>(BEST_OF_PATH);

export async function writeBestOfSnapshot(snapshot: BestOfSnapshot) {
  await writeJson(BEST_OF_PATH, snapshot);
}

let assetIdCache: { snapshot: BestOfSnapshot; ids: Set<string> } | null = null;

export async function isKnownBestOfAsset(assetId: string): Promise<boolean> {
  const snapshot = await readBestOfSnapshot();
  if (!snapshot) return false;

  if (assetIdCache?.snapshot !== snapshot) {
    const ids = new Set(
      flatMap(Object.values(snapshot.photos), (classes) =>
        flatMap(Object.values(classes), (assetIds) => assetIds ?? []),
      ),
    );
    assetIdCache = { snapshot, ids };
  }
  return assetIdCache.ids.has(assetId);
}
