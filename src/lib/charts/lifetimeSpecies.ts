import { countBy, groupBy, sortBy, sum } from "lodash-es";
import type {
  ObservationTaxon,
  ObservationSummary,
} from "@/lib/inat/observations";
import { taxonLabel } from "./taxonLabels";
import { taxonObservationsUrl, type ChartTaxon } from "./taxonLinks";
import type { BarChartFigure } from "./types";

function countByIconicTaxon(
  taxons: { iconic_taxon_name?: string }[],
): Record<string, number> {
  return countBy(taxons, (t) => t.iconic_taxon_name ?? "Unknown");
}

function speciesByIconicTaxon(
  taxons: ObservationTaxon[],
  qualityGrade: "research" | "needs_id",
): Record<string, ChartTaxon[]> {
  return groupBy(
    taxons.map((t) => ({
      ...t,
      observationsUrl: taxonObservationsUrl(t.id, qualityGrade),
    })),
    (t) => t.iconic_taxon_name ?? "Unknown",
  );
}

export function buildLifetimeSpeciesFigure(
  summary: ObservationSummary,
): BarChartFigure {
  const researchGradeCounts = countByIconicTaxon(summary.researchGradeTaxons);
  const needsIdCounts = countByIconicTaxon(summary.needsIdTaxons);
  const researchGradeSpecies = speciesByIconicTaxon(
    summary.researchGradeTaxons,
    "research",
  );
  const needsIdSpecies = speciesByIconicTaxon(
    summary.needsIdTaxons,
    "needs_id",
  );

  const taxons = sortBy(
    Object.keys(researchGradeCounts),
    (t) => researchGradeCounts[t] ?? 0,
  );

  const needsIdTotal = sum(Object.values(needsIdCounts));
  const researchGradeTotal = sum(Object.values(researchGradeCounts));

  return {
    data: taxons.map((t) => ({
      category: taxonLabel(t),
      needsId: needsIdCounts[t] ?? 0,
      researchGrade: researchGradeCounts[t] ?? 0,
      meta: {
        needsId: needsIdSpecies[t] ?? [],
        researchGrade: researchGradeSpecies[t] ?? [],
      },
    })),
    series: [
      {
        key: "researchGrade",
        name: `Research Grade (${researchGradeTotal})`,
        color: "mediumseagreen",
      },
      { key: "needsId", name: `Needs ID (${needsIdTotal})`, color: "gold" },
    ],
    mode: "group",
    xLabel: "Species count",
  };
}
