import { groupBy, mapValues, sortBy } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

export function buildMostSeenFigure(summary: ObservationSummary): PlotlyFigure {
  const eligible = summary.researchGradeObservations.filter(
    (obs) => obs.taxon?.preferred_common_name && obs.observed_on,
  );
  const daysCountBySpecies = mapValues(
    groupBy(eligible, (obs) => obs.taxon!.preferred_common_name!),
    (obsList) => new Set(obsList.map((o) => o.observed_on!)).size,
  );

  // Sort alphabetically first so the stable count-sort ties off the consistently.
  const topSeen = sortBy(
    sortBy(Object.entries(daysCountBySpecies), ([species]) => species),
    ([, count]) => count,
  ).slice(-5);

  return {
    data: [
      {
        type: "bar",
        y: topSeen.map(([species]) => species),
        x: topSeen.map(([, n]) => n),
        orientation: "h",
        text: topSeen.map(([, n]) => String(n)),
        textposition: "outside",
        hoverinfo: "skip",
        marker: { color: "mediumseagreen" },
      },
    ],
    layout: {
      xaxis: { title: { text: "Days observed" } },
      height: 250,
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };
}
