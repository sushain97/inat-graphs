import { groupBy, orderBy } from "lodash-es";
import type { Observation, ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

/** date -> speciesName -> commonName */
export type SpeciesByDay = Map<string, Map<string, string>>;

function toSpeciesMap(
  observations: readonly Observation[],
): Map<string, string> {
  return new Map(
    observations.map((obs) => [
      speciesName(obs.taxon!.name!),
      obs.taxon!.preferred_common_name ?? "",
    ]),
  );
}

function groupSpeciesByDay(observations: readonly Observation[]): SpeciesByDay {
  const eligible = observations.filter(
    (obs) => obs.observed_on && obs.taxon?.name,
  );
  return new Map(
    Object.entries(groupBy(eligible, "observed_on")).map(([day, obsList]) => [
      day,
      toSpeciesMap(obsList),
    ]),
  );
}

export function buildTopDaysFigure(summary: ObservationSummary): {
  figure: PlotlyFigure;
  bestDaysNeedsId: SpeciesByDay;
} {
  const researchGradeByDay = groupSpeciesByDay(
    summary.researchGradeObservations,
  );

  const eligibleNeedsId = summary.needsIdObservations.filter(
    (obs) =>
      obs.observed_on &&
      obs.taxon?.name &&
      !researchGradeByDay
        .get(obs.observed_on)
        ?.has(speciesName(obs.taxon.name)),
  );
  const needsIdByDay: SpeciesByDay = new Map(
    Object.entries(groupBy(eligibleNeedsId, "observed_on")).map(
      ([day, obsList]) => [day, toSpeciesMap(obsList)],
    ),
  );

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

  const labels = bestDays.map(({ day }) => formatDate(day));

  const figure: PlotlyFigure = {
    data: [
      {
        type: "bar",
        name: "Needs ID",
        y: labels,
        x: bestDays.map((d) => d.needsId),
        orientation: "h",
        text: bestDays.map((d) => String(d.needsId || "")),
        textposition: "outside",
        hoverinfo: "skip",
        marker: { color: "gold" },
        legendrank: 2,
      },
      {
        type: "bar",
        name: "Research Grade",
        y: labels,
        x: bestDays.map((d) => d.rg),
        orientation: "h",
        text: bestDays.map((d) => String(d.rg || "")),
        textposition: "outside",
        hoverinfo: "skip",
        marker: { color: "mediumseagreen" },
        legendrank: 1,
      },
    ],
    layout: {
      barmode: "group",
      xaxis: { title: { text: "Species count" } },
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };

  const bestDaysNeedsId: SpeciesByDay = new Map(
    bestDays.map(({ day }) => [day, needsIdByDay.get(day) ?? new Map()]),
  );

  return { figure, bestDaysNeedsId };
}
