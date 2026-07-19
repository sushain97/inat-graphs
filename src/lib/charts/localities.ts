import { countBy, groupBy, sortBy, sum } from "lodash-es";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { taxonLabel } from "./taxonLabels";
import {
  observationsUrl,
  taxonObservationsUrl,
  type ChartTaxon,
} from "./taxonLinks";
import type { BarChartFigure } from "./types";
import { paletteColor } from "@/components/charts/palette";

function countryFlag(displayName: string): string {
  const code = displayName.split(",").pop()?.trim() ?? "";
  if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
    return [...code]
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join("");
  }
  return "";
}

/** locality -> iconicTaxon -> species first observed there for that taxon */
function taxaByLocalityAndTaxon(
  observations: readonly Observation[],
  localityOf: (obs: Observation) => string,
  placeIdOf: (obs: Observation) => number,
): Map<string, Map<string, ChartTaxon[]>> {
  return new Map(
    Object.entries(groupBy(observations, localityOf)).map(
      ([locality, obsList]) => [
        locality,
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
                  { placeId: placeIdOf(obs) },
                ),
              })),
            ],
          ),
        ),
      ],
    ),
  );
}

export function buildLocalitiesFigure(
  summary: ObservationSummary,
  placeNames: ReadonlyMap<number, string>,
): BarChartFigure {
  const eligible = summary.firstResearchObservations.filter(
    (obs) => obs.place_ids.length > 1,
  );
  const localityOf = (obs: Observation) =>
    placeNames.get(obs.place_ids[1]) ?? String(obs.place_ids[1]);
  const placeIdOf = (obs: Observation) => obs.place_ids[1];

  const byLocalityTaxon = Object.entries(groupBy(eligible, localityOf)).map(
    ([locality, obsList]) =>
      [locality, countBy(obsList, "taxon.iconic_taxon_name")] as const,
  );
  const taxonCounts = countBy(eligible, "taxon.iconic_taxon_name");

  const bestLocalities = sortBy(byLocalityTaxon, ([, counts]) =>
    sum(Object.values(counts)),
  ).slice(-10);
  const taxons = sortBy(Object.keys(taxonCounts), (t) => -taxonCounts[t]);

  const taxaByLocality = taxaByLocalityAndTaxon(
    eligible,
    localityOf,
    placeIdOf,
  );
  const placeIdByLocality = new Map(
    eligible.map((obs) => [localityOf(obs), placeIdOf(obs)]),
  );

  return {
    data: bestLocalities.map(([locality, counts]) => {
      const flag = countryFlag(locality);
      return {
        category: flag ? `${flag} ${locality}` : locality,
        ...Object.fromEntries(taxons.map((t) => [t, counts[t] ?? 0])),
        total: sum(Object.values(counts)),
        meta: Object.fromEntries(
          taxons.map((t) => [t, taxaByLocality.get(locality)?.get(t) ?? []]),
        ),
        labelUrl: observationsUrl({
          qualityGrade: "research",
          placeId: placeIdByLocality.get(locality),
        }),
      };
    }),
    series: taxons.map((taxon, i) => ({
      key: taxon,
      name: taxonLabel(taxon),
      color: paletteColor(i),
    })),
    mode: "stack",
    xLabel: "New species count",
    totalsKey: "total",
    yAxisWidth: 180,
  };
}
