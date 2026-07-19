import { groupBy, sortBy } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { taxonObservationsUrl } from "./taxonLinks";
import type { BarChartFigure } from "./types";

export function buildMostSeenFigure(
  summary: ObservationSummary,
): BarChartFigure {
  const eligible = summary.researchGradeObservations.filter(
    (obs) => obs.taxon.preferred_common_name,
  );
  const bySpecies = groupBy(
    eligible,
    (obs) => obs.taxon.preferred_common_name!,
  );
  const speciesDays = Object.entries(bySpecies).map(([species, obsList]) => ({
    species,
    count: new Set(obsList.map((o) => o.observed_on)).size,
    taxonId: obsList[0].taxon.id,
  }));

  // Sort alphabetically first so the stable count-sort ties off the
  // consistently.
  const topSeen = sortBy(
    sortBy(speciesDays, (s) => s.species),
    (s) => s.count,
  ).slice(-5);

  return {
    data: topSeen.map((s) => ({
      category: s.species,
      count: s.count,
      labelUrl: taxonObservationsUrl(s.taxonId, "research"),
    })),
    series: [{ key: "count", name: "Days observed", color: "mediumseagreen" }],
    mode: "group",
    xLabel: "Days observed",
    yAxisWidth: 190,
  };
}
