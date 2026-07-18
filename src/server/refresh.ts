import Config from "@/lib/config";
import {
  getObservations,
  type ObservationSummary,
} from "@/lib/inat/observations";
import { inatClient } from "@/lib/inat/client";
import { computeBestOfSummary } from "@/lib/immich/best-of";
import {
  readObservationsSnapshot,
  writeBestOfSnapshot,
  writeObservationsSnapshot,
} from "@/lib/snapshot";

function localityPlaceIds(summary: ObservationSummary): number[] {
  return [
    ...new Set(
      summary.firstResearchObservations
        .filter((obs) => obs.place_ids && obs.place_ids.length > 1)
        .map((obs) => obs.place_ids![1]),
    ),
  ];
}

export async function refreshObservations(): Promise<void> {
  const { summary, observations } = await getObservations(Config.inatUserId);
  const placeNames = await inatClient.fetchPlaceNames(
    localityPlaceIds(summary),
  );

  await writeObservationsSnapshot({
    summary,
    observations,
    placeNames,
    updatedAt: new Date(),
  });
}

export async function refreshBestOf(): Promise<void> {
  const observations = await readObservationsSnapshot();
  if (!observations) return;

  const bestOf = await computeBestOfSummary(
    observations.summary,
    Config.bestOfBirdingAlbumId,
  );
  await writeBestOfSnapshot({ ...bestOf, updatedAt: new Date() });
}

export async function refreshAll(): Promise<void> {
  await refreshObservations();
  await refreshBestOf();
}
