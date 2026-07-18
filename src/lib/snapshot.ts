import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
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

export async function readObservationsSnapshot(): Promise<ObservationsSnapshot | null> {
  return superjson.parse<ObservationsSnapshot>(
    await readFile(OBSERVATIONS_PATH, "utf-8"),
  );
}

export async function writeObservationsSnapshot(
  snapshot: ObservationsSnapshot,
) {
  await writeJson(OBSERVATIONS_PATH, snapshot);
}

export async function readBestOfSnapshot(): Promise<BestOfSnapshot | null> {
  return superjson.parse<BestOfSnapshot>(await readFile(BEST_OF_PATH, "utf-8"));
}

export async function writeBestOfSnapshot(snapshot: BestOfSnapshot) {
  await writeJson(BEST_OF_PATH, snapshot);
}
