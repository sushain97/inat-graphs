import { countBy, groupBy, sortBy, sum, uniq } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import { taxonLabel } from "./taxonLabels";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

export function buildNewSpeciesDaysFigure(
  summary: ObservationSummary,
): PlotlyFigure {
  const eligible = summary.firstResearchObservations.filter(
    (obs) => obs.observed_on && obs.taxon?.iconic_taxon_name,
  );
  const byDayTaxon = Object.entries(groupBy(eligible, "observed_on")).map(
    ([day, obsList]) =>
      [day, countBy(obsList, "taxon.iconic_taxon_name")] as const,
  );

  const bestDays = sortBy(byDayTaxon, ([, counts]) =>
    sum(Object.values(counts)),
  ).slice(-10);

  const taxons = sortBy(
    uniq(bestDays.flatMap(([, counts]) => Object.keys(counts))),
  );
  const labels = bestDays.map(([day]) => formatDate(day));
  const totals = bestDays.map(([, counts]) => sum(Object.values(counts)));

  return {
    data: [
      ...taxons.map((taxon) => ({
        type: "bar" as const,
        name: taxonLabel(taxon),
        y: labels,
        x: bestDays.map(([, counts]) => counts[taxon] ?? 0),
        orientation: "h" as const,
        hovertemplate: "%{x}<extra></extra>",
      })),
      {
        type: "scatter" as const,
        y: labels,
        x: totals,
        mode: "text" as const,
        text: totals.map((t) => ` ${t}`),
        textposition: "middle right" as const,
        showlegend: false,
        hoverinfo: "skip" as const,
      },
    ],
    layout: {
      barmode: "stack",
      xaxis: { title: { text: "New species count" } },
      yaxis: { type: "category" },
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };
}
