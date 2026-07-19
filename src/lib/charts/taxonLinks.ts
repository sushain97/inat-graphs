import config from "@/lib/config";

export interface ChartTaxon {
  id?: number;
  name?: string;
  preferred_common_name?: string;
  observationsUrl?: string;
}

export type QualityGrade = "research" | "needs_id";

export function observationsUrl(options: {
  qualityGrade?: QualityGrade;
  on?: string;
  placeId?: number;
  taxonId?: number;
}): string {
  const params = new URLSearchParams({
    subview: "table",
    user_id: config.inatUserId,
    verifiable: "true",
  });

  if (options.qualityGrade) params.set("quality_grade", options.qualityGrade);
  if (options.on) params.set("on", options.on);
  if (options.placeId) params.set("place_id", String(options.placeId));
  if (options.taxonId) params.set("taxon_id", String(options.taxonId));

  return `https://www.inaturalist.org/observations?${params}`;
}

export function taxonObservationsUrl(
  taxonId: number | undefined,
  qualityGrade: QualityGrade,
  options?: { on?: string; placeId?: number },
): string | undefined {
  if (!taxonId) return undefined;
  return observationsUrl({ ...options, qualityGrade, taxonId });
}

/** Link to the taxon's own iNat page, falling back to a name search. */
export function taxonPageUrl(taxon: ChartTaxon): string {
  return taxon.id
    ? `https://www.inaturalist.org/taxa/${taxon.id}`
    : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(taxon.name ?? "")}`;
}
