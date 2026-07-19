import { groupBy, orderBy, uniqBy } from "lodash-es";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import {
  observationsUrl,
  taxonObservationsUrl,
  type ChartTaxon,
} from "./taxonLinks";
import type { BarChartFigure } from "./types";

/** date -> speciesName -> commonName */
export type SpeciesByDay = Map<string, Map<string, string>>;

function dedupeTaxa(
  observations: readonly Observation[],
  qualityGrade: "research" | "needs_id",
  day: string,
): ChartTaxon[] {
  return uniqBy(observations, (obs) => speciesName(obs.taxon.name)).map(
    (obs) => ({
      id: obs.taxon.id,
      name: speciesName(obs.taxon.name),
      preferred_common_name: obs.taxon.preferred_common_name,
      observationsUrl: taxonObservationsUrl(obs.taxon.id, qualityGrade, {
        on: day,
      }),
    }),
  );
}

function taxaMapByDay(
  observations: readonly Observation[],
  qualityGrade: "research" | "needs_id",
): Map<string, ChartTaxon[]> {
  return new Map(
    Object.entries(groupBy(observations, "observed_on")).map(
      ([day, obsList]) => [day, dedupeTaxa(obsList, qualityGrade, day)],
    ),
  );
}

function toSpeciesByDay(taxaByDay: Map<string, ChartTaxon[]>): SpeciesByDay {
  return new Map(
    [...taxaByDay].map(([day, taxa]) => [
      day,
      new Map(taxa.map((t) => [t.name!, t.preferred_common_name ?? ""])),
    ]),
  );
}

export function buildTopDaysFigure(summary: ObservationSummary): {
  figure: BarChartFigure;
  bestDaysNeedsId: Map<string, ChartTaxon[]>;
} {
  const researchGradeTaxaByDay = taxaMapByDay(
    summary.researchGradeObservations,
    "research",
  );
  const researchGradeByDay = toSpeciesByDay(researchGradeTaxaByDay);

  const eligibleNeedsId = summary.needsIdObservations.filter(
    (obs) =>
      !researchGradeByDay
        .get(obs.observed_on)
        ?.has(speciesName(obs.taxon.name)),
  );
  const needsIdTaxaByDay = taxaMapByDay(eligibleNeedsId, "needs_id");
  const needsIdByDay = toSpeciesByDay(needsIdTaxaByDay);

  const allDays = new Set([
    ...researchGradeByDay.keys(),
    ...needsIdByDay.keys(),
  ]);
  const bestDays = orderBy(
    [...allDays].map((day) => {
      const rg = researchGradeByDay.get(day)?.size ?? 0;
      const needsId = needsIdByDay.get(day)?.size ?? 0;
      return { day, rg, needsId, total: rg + needsId };
    }),
    ["total", "rg"],
  ).slice(-10);

  const figure: BarChartFigure = {
    data: bestDays.map((d) => ({
      category: formatDate(d.day),
      needsId: d.needsId,
      researchGrade: d.rg,
      meta: {
        needsId: needsIdTaxaByDay.get(d.day) ?? [],
        researchGrade: researchGradeTaxaByDay.get(d.day) ?? [],
      },
      labelUrl: observationsUrl({ on: d.day }),
    })),
    series: [
      { key: "researchGrade", name: "Research Grade", color: "mediumseagreen" },
      { key: "needsId", name: "Needs ID", color: "gold" },
    ],
    mode: "group",
    xLabel: "Species count",
    yAxisWidth: 340,
  };

  const bestDaysNeedsId: Map<string, ChartTaxon[]> = new Map(
    bestDays.map(({ day }) => [day, needsIdTaxaByDay.get(day) ?? []]),
  );

  return { figure, bestDaysNeedsId };
}
