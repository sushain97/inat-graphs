import { inatClient, type RawObservation } from "./client";

type RawObservationTaxon = NonNullable<RawObservation["taxon"]> & {
  /**
   * `parent_id` is present on live API responses but missing from iNat's
   * Swagger spec, so it isn't in the generated type.
   */
  parent_id?: number;
};

/**
 * Trimmed to just the fields this app reads. Raw API responses balloon
 * memory usage.
 */
export type ObservationTaxon = Partial<
  Pick<
    RawObservationTaxon,
    | "name"
    | "rank"
    | "iconic_taxon_name"
    | "preferred_common_name"
    | "ancestor_ids"
    | "parent_id"
  >
>;

export type Observation = Partial<
  Pick<RawObservation, "quality_grade" | "observed_on" | "place_ids">
> & { taxon?: ObservationTaxon };

function trimObservation(raw: RawObservation): Observation {
  const t = raw.taxon as RawObservationTaxon | undefined;
  return {
    quality_grade: raw.quality_grade,
    observed_on: raw.observed_on,
    place_ids: raw.place_ids,
    taxon: t && {
      name: t.name,
      rank: t.rank,
      iconic_taxon_name: t.iconic_taxon_name,
      preferred_common_name: t.preferred_common_name,
      ancestor_ids: t.ancestor_ids,
      parent_id: t.parent_id,
    },
  };
}

/** Collapses a subspecies/trinomial name to genus+species; keeps hybrid "×"
 * names intact. */
export function speciesName(name: string): string {
  if (name.includes("×")) return name;
  return name.split(" ").slice(0, 2).join(" ");
}

export interface ObservationSummary {
  researchGradeObservations: Observation[];
  researchGradeTaxons: ObservationTaxon[];
  /** First-ever research-grade observation per species, by date. */
  firstResearchObservations: Observation[];
  needsIdObservations: Observation[];
  /** Excludes anything already present in researchGradeTaxons. */
  needsIdTaxons: ObservationTaxon[];
}

const SPECIES_RANKS = new Set(["species", "hybrid", "variety", "subspecies"]);

export function summarizeObservations(
  observations: readonly Observation[],
): ObservationSummary {
  const speciesObservations = observations.filter(
    (obs) => obs.taxon?.rank !== undefined && SPECIES_RANKS.has(obs.taxon.rank),
  );

  const researchGradeObservations = speciesObservations.filter(
    (obs) => obs.quality_grade === "research",
  );
  const needsIdObservations = speciesObservations.filter(
    (obs) => obs.quality_grade === "needs_id",
  );

  const researchGradeTaxons = new Map<string, ObservationTaxon>();
  for (const obs of researchGradeObservations) {
    if (!obs.taxon?.name) continue;
    researchGradeTaxons.set(speciesName(obs.taxon.name), obs.taxon);
  }

  const needsIdTaxons = new Map<string, ObservationTaxon>();
  for (const obs of needsIdObservations) {
    if (!obs.taxon?.name) continue;
    const name = speciesName(obs.taxon.name);
    if (!researchGradeTaxons.has(name)) needsIdTaxons.set(name, obs.taxon);
  }

  const seenSpecies = new Set<string>();
  const firstResearchObservations: Observation[] = [];
  for (const obs of [...researchGradeObservations].sort((a, b) =>
    (a.observed_on ?? "").localeCompare(b.observed_on ?? ""),
  )) {
    if (!obs.taxon?.name) continue;
    const name = speciesName(obs.taxon.name);
    if (!seenSpecies.has(name)) {
      seenSpecies.add(name);
      firstResearchObservations.push(obs);
    }
  }

  return {
    researchGradeObservations,
    researchGradeTaxons: [...researchGradeTaxons.values()],
    firstResearchObservations,
    needsIdObservations,
    needsIdTaxons: [...needsIdTaxons.values()],
  };
}

export async function fetchAllObservations(
  userId: string,
): Promise<Observation[]> {
  const raw = await inatClient.fetchAllObservations(userId);
  return raw.map(trimObservation);
}

export async function getObservations(
  userId: string,
): Promise<{ summary: ObservationSummary; observations: Observation[] }> {
  const observations = await fetchAllObservations(userId);
  return { summary: summarizeObservations(observations), observations };
}
