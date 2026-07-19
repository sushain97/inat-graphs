import { sortBy, uniqBy } from "lodash-es";
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
 * memory usage. `preferred_common_name` is the only field iNat doesn't
 * always populate; everything else is validated in `trimObservation`.
 */
export type ObservationTaxon = Required<
  Pick<RawObservationTaxon, "id" | "name" | "rank" | "iconic_taxon_name">
> &
  Pick<
    RawObservationTaxon,
    "preferred_common_name" | "ancestor_ids" | "parent_id"
  >;

export type Observation = Required<
  Pick<RawObservation, "quality_grade" | "observed_on" | "place_ids">
> & { taxon: ObservationTaxon };

function trimObservation(raw: RawObservation): Observation | undefined {
  const t = raw.taxon as RawObservationTaxon | undefined;
  if (
    !raw.quality_grade ||
    !raw.observed_on ||
    !raw.place_ids ||
    !t?.id ||
    !t.name ||
    !t.rank ||
    !t.iconic_taxon_name
  ) {
    return undefined;
  }

  return {
    quality_grade: raw.quality_grade,
    observed_on: raw.observed_on,
    place_ids: raw.place_ids,
    taxon: {
      id: t.id,
      name: t.name,
      rank: t.rank,
      iconic_taxon_name: t.iconic_taxon_name,
      preferred_common_name: t.preferred_common_name,
      ancestor_ids: t.ancestor_ids,
      parent_id: t.parent_id,
    },
  };
}

/** Collapses a trinomial name to genus+species; keeps hybrid "×"
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
  const speciesObservations = observations.filter((obs) =>
    SPECIES_RANKS.has(obs.taxon.rank),
  );

  const researchGradeObservations = speciesObservations.filter(
    (obs) => obs.quality_grade === "research",
  );
  const needsIdObservations = speciesObservations.filter(
    (obs) => obs.quality_grade === "needs_id",
  );

  const researchGradeTaxons = uniqBy(researchGradeObservations, (obs) =>
    speciesName(obs.taxon.name),
  ).map((obs) => obs.taxon);
  const rgNames = new Set(researchGradeTaxons.map((t) => speciesName(t.name)));

  const needsIdTaxons = uniqBy(
    needsIdObservations.filter(
      (obs) => !rgNames.has(speciesName(obs.taxon.name)),
    ),
    (obs) => speciesName(obs.taxon.name),
  ).map((obs) => obs.taxon);

  const firstResearchObservations = uniqBy(
    sortBy(researchGradeObservations, "observed_on"),
    (obs) => speciesName(obs.taxon.name),
  );

  return {
    researchGradeObservations,
    researchGradeTaxons,
    firstResearchObservations,
    needsIdObservations,
    needsIdTaxons,
  };
}

export async function fetchAllObservations(
  userId: string,
): Promise<Observation[]> {
  const raw = await inatClient.fetchAllObservations(userId);
  return raw
    .map(trimObservation)
    .filter((obs): obs is Observation => obs !== undefined);
}

export async function getObservations(
  userId: string,
): Promise<{ summary: ObservationSummary; observations: Observation[] }> {
  const observations = await fetchAllObservations(userId);
  return { summary: summarizeObservations(observations), observations };
}
