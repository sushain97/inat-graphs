import { countBy, sortBy, sum } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { taxonLabel } from "./taxonLabels";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

function countByIconicTaxon(
  taxons: { iconic_taxon_name?: string }[],
): Record<string, number> {
  return countBy(taxons, (t) => t.iconic_taxon_name ?? "Unknown");
}

export function buildLifetimeSpeciesFigure(
  summary: ObservationSummary,
): PlotlyFigure {
  const researchGradeCounts = countByIconicTaxon(summary.researchGradeTaxons);
  const needsIdCounts = countByIconicTaxon(summary.needsIdTaxons);

  const taxons = sortBy(
    Object.keys(researchGradeCounts),
    (t) => researchGradeCounts[t] ?? 0,
  );
  const taxonLabels = taxons.map(taxonLabel);

  const needsIdTotal = sum(Object.values(needsIdCounts));
  const researchGradeTotal = sum(Object.values(researchGradeCounts));

  return {
    data: [
      {
        type: "bar",
        name: `Needs ID (${needsIdTotal})`,
        y: taxonLabels,
        x: taxons.map((t) => needsIdCounts[t] ?? 0),
        orientation: "h",
        text: taxons.map((t) => String(needsIdCounts[t] || "")),
        textposition: "outside",
        hoverinfo: "skip",
        marker: { color: "gold" },
        legendrank: 2,
      },
      {
        type: "bar",
        name: `Research Grade (${researchGradeTotal})`,
        y: taxonLabels,
        x: taxons.map((t) => researchGradeCounts[t] ?? 0),
        orientation: "h",
        text: taxons.map((t) => String(researchGradeCounts[t] || "")),
        textposition: "outside",
        hoverinfo: "skip",
        marker: { color: "mediumseagreen" },
        legendrank: 1,
      },
    ],
    layout: {
      barmode: "group",
      xaxis: { title: { text: "Species count" } },
      yaxis: { tickfont: { size: 14 } },
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };
}
