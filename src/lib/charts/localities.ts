import { countBy, groupBy, sortBy, sum } from "lodash-es";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { taxonLabel } from "./taxonLabels";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

function countryFlag(displayName: string): string {
  const code = displayName.split(",").pop()?.trim() ?? "";
  if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
    return [...code]
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join("");
  }
  return "";
}

export function buildLocalitiesFigure(
  summary: ObservationSummary,
  placeNames: ReadonlyMap<number, string>,
): PlotlyFigure {
  const eligible = summary.firstResearchObservations.filter(
    (obs) =>
      obs.place_ids && obs.place_ids.length > 1 && obs.taxon?.iconic_taxon_name,
  );
  const localityOf = (obs: Observation) =>
    placeNames.get(obs.place_ids![1]) ?? String(obs.place_ids![1]);

  const byLocalityTaxon = Object.entries(groupBy(eligible, localityOf)).map(
    ([locality, obsList]) =>
      [locality, countBy(obsList, "taxon.iconic_taxon_name")] as const,
  );
  const taxonCounts = countBy(eligible, "taxon.iconic_taxon_name");

  const bestLocalities = sortBy(byLocalityTaxon, ([, counts]) =>
    sum(Object.values(counts)),
  ).slice(-10);
  const taxons = sortBy(Object.keys(taxonCounts), (t) => -taxonCounts[t]);
  const labels = bestLocalities.map(([loc]) => {
    const flag = countryFlag(loc);
    return flag ? `${flag} ${loc}` : loc;
  });
  const totals = bestLocalities.map(([, counts]) => sum(Object.values(counts)));

  return {
    data: [
      ...taxons.map((taxon) => ({
        type: "bar" as const,
        name: taxonLabel(taxon),
        y: labels,
        x: bestLocalities.map(([, counts]) => counts[taxon] ?? 0),
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
      xaxis: { title: { text: "New species count" }, rangemode: "tozero" },
      yaxis: { type: "category", tickfont: { size: 14 } },
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };
}
