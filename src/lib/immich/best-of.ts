import Config from "@/lib/config";
import { inatClient } from "@/lib/inat/client";
import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { immichClient } from "./client";
import { BEST_OF_CLASSES, type BestOfClass } from "./best-of-classes";

const COMMON_NAME_OVERRIDES: Record<string, string> = {
  "Cairina moschata": "Muscovy Duck",
  "Felis catus": "Cat",
  "Larus livens": "Yellow-footed gull",
};

const EXCLUDED_ICONIC_TAXA = new Set([
  "Fungi",
  "Arachnida",
  "Insecta",
  "Mollusca",
]);

/** iNat taxon id for phylum Arthropoda; catches crabs/crustaceans not covered
 * by EXCLUDED_ICONIC_TAXA. */
const ARTHROPODA_TAXON_ID = 47120;

const MISSING_SPECIES_SINCE = "2025-10-08";

export interface BestOfSummary {
  photos: Record<string, Partial<Record<BestOfClass, string[]>>>;
  speciesByName: Record<string, string>;
  missingSpecies: Set<string>;
  warnings: string[];
}

export async function computeBestOfSummary(
  summary: ObservationSummary,
  albumId: string,
): Promise<BestOfSummary> {
  const allObservations = [
    ...summary.researchGradeObservations,
    ...summary.needsIdObservations,
  ];

  const subspeciesParentIds = allObservations
    .filter(
      (obs) =>
        obs.taxon?.rank === "subspecies" && obs.taxon.parent_id !== undefined,
    )
    .map((obs) => obs.taxon!.parent_id!);
  const parentCommonNames =
    await inatClient.fetchTaxonCommonNames(subspeciesParentIds);

  const speciesByName: Record<string, string> = {};
  for (const obs of allObservations) {
    if (!obs.taxon?.name) continue;
    const name = speciesName(obs.taxon.name);
    const commonName =
      obs.taxon.rank === "subspecies" && obs.taxon.parent_id !== undefined
        ? parentCommonNames.get(obs.taxon.parent_id)
        : obs.taxon.preferred_common_name;
    if (commonName) speciesByName[name] = commonName;
  }
  Object.assign(speciesByName, COMMON_NAME_OVERRIDES);

  const missingSpecies = new Set(
    summary.researchGradeObservations
      .filter(
        (obs) =>
          obs.quality_grade === "research" &&
          obs.taxon?.name &&
          !EXCLUDED_ICONIC_TAXA.has(obs.taxon.iconic_taxon_name ?? "") &&
          !(obs.taxon.ancestor_ids ?? []).includes(ARTHROPODA_TAXON_ID) &&
          (obs.observed_on ?? "") >= MISSING_SPECIES_SINCE,
      )
      .map((obs) => speciesName(obs.taxon!.name!)),
  );

  const assets = await immichClient.getAlbumAssets(albumId);

  const photos: Record<string, Partial<Record<BestOfClass, string[]>>> = {};
  const warnings: string[] = [];

  for (const asset of assets) {
    const tags = (await immichClient.getAssetTags(asset.id)).filter((t) =>
      t.startsWith("Birding/"),
    );
    const created = asset.fileCreatedAt.split("T")[0];
    const photoUrl = `${Config.immichBaseUrl}/photos/${asset.id}`;

    if (tags.length === 0) {
      warnings.push(
        `[${asset.owner} / ${created}] no birding tags -> ${photoUrl}`,
      );
      continue;
    }
    if (tags.length > 1) {
      warnings.push(
        `[${asset.owner} / ${created}] Multiple birding tags: ${tags.join(", ")} -> ${photoUrl}`,
      );
      continue;
    }

    const [, name, klass] = tags[0].split("/");
    if (!BEST_OF_CLASSES.includes(klass as BestOfClass)) {
      warnings.push(
        `[${asset.owner} / ${created}] Invalid class '${klass}' -> ${photoUrl}`,
      );
      continue;
    }

    photos[name] ??= {};
    const bucket = (photos[name][klass as BestOfClass] ??= []);
    bucket.push(asset.id);
    missingSpecies.delete(name);
  }

  return { photos, speciesByName, missingSpecies, warnings };
}

export interface BestOfRow {
  name: string;
  commonName: string;
  counts: Partial<Record<BestOfClass, number>>;
  total: number;
}

export function buildBestOfRows(bestOf: BestOfSummary): BestOfRow[] {
  const rows: BestOfRow[] = Object.entries(bestOf.photos).map(
    ([name, speciesPhotos]) => {
      const counts: Partial<Record<BestOfClass, number>> = {};
      let total = 0;
      for (const klass of BEST_OF_CLASSES) {
        const count = speciesPhotos[klass]?.length ?? 0;
        if (count > 0) counts[klass] = count;
        total += count;
      }
      return {
        name,
        commonName: bestOf.speciesByName[name] ?? "",
        counts,
        total,
      };
    },
  );

  for (const name of bestOf.missingSpecies) {
    rows.push({
      name,
      commonName: bestOf.speciesByName[name] ?? "",
      counts: {},
      total: 0,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}
