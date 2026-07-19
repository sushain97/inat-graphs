import { countBy, groupBy, sortBy, sum, uniq } from "lodash-es";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import { taxonLabel } from "./taxonLabels";
import {
  observationsUrl,
  taxonObservationsUrl,
  type ChartTaxon,
} from "./taxonLinks";
import type { BarChartFigure } from "./types";
import { paletteColor } from "@/components/charts/palette";

/** day -> iconicTaxon -> species first observed that day for that taxon */
function taxaByDayAndTaxon(
  observations: readonly Observation[],
): Map<string, Map<string, ChartTaxon[]>> {
  return new Map(
    Object.entries(groupBy(observations, "observed_on")).map(
      ([day, obsList]) => [
        day,
        new Map(
          Object.entries(groupBy(obsList, "taxon.iconic_taxon_name")).map(
            ([taxon, taxonObs]) => [
              taxon,
              taxonObs.map((obs) => ({
                id: obs.taxon.id,
                name: obs.taxon.name,
                preferred_common_name: obs.taxon.preferred_common_name,
                observationsUrl: taxonObservationsUrl(
                  obs.taxon.id,
                  "research",
                  { on: day },
                ),
              })),
            ],
          ),
        ),
      ],
    ),
  );
}

export function buildNewSpeciesDaysFigure(
  summary: ObservationSummary,
): BarChartFigure {
  const eligible = summary.firstResearchObservations;
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

  const taxaByDay = taxaByDayAndTaxon(eligible);

  return {
    data: bestDays.map(([day, counts]) => ({
      category: formatDate(day),
      ...Object.fromEntries(taxons.map((t) => [t, counts[t] ?? 0])),
      total: sum(Object.values(counts)),
      meta: Object.fromEntries(
        taxons.map((t) => [t, taxaByDay.get(day)?.get(t) ?? []]),
      ),
      labelUrl: observationsUrl({ qualityGrade: "research", on: day }),
    })),
    series: taxons.map((taxon, i) => ({
      key: taxon,
      name: taxonLabel(taxon),
      color: paletteColor(i),
    })),
    mode: "stack",
    xLabel: "New species count",
    totalsKey: "total",
    yAxisWidth: 320,
  };
}
