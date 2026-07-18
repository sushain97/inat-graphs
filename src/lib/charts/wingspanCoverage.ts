import { countBy, sortBy, sumBy } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { getWingspanBirdsBySet, type WingspanBird } from "@/lib/wingspan";
import { PLOTLY_LEGEND, type PlotlyFigure } from "./types";

type Category = "Research Grade" | "Needs ID" | "Missing";
const CATEGORIES: Category[] = ["Research Grade", "Needs ID", "Missing"];
const CATEGORY_COLORS: Record<Category, string> = {
  "Research Grade": "mediumseagreen",
  "Needs ID": "gold",
  Missing: "lightgray",
};

export function buildWingspanCoverageFigure(summary: ObservationSummary): {
  figure: PlotlyFigure;
  totalResearchGrade: number;
  totalBirds: number;
} {
  const birdsBySet = getWingspanBirdsBySet();

  const rgSpecies = new Set(
    summary.researchGradeTaxons.map((t) => t.name).filter(Boolean),
  );
  const needsIdSpecies = new Set(
    summary.needsIdTaxons.map((t) => t.name).filter(Boolean),
  );

  function category(bird: WingspanBird): Category {
    const name = bird["Scientific name"];
    if (rgSpecies.has(name)) return "Research Grade";
    if (needsIdSpecies.has(name)) return "Needs ID";
    return "Missing";
  }

  const countsBySet = sortBy(
    Object.entries(birdsBySet).map(([set, birds]) => {
      const counts: Partial<Record<Category, number>> = countBy(
        birds,
        category,
      );
      return [set, { ...counts, Total: birds.length }] as const;
    }),
    ([, c]) => c["Research Grade"] ?? 0,
  );

  const totalResearchGrade = sumBy(
    countsBySet,
    ([, c]) => c["Research Grade"] ?? 0,
  );
  const totalBirds = sumBy(countsBySet, ([, c]) => c.Total);
  const labels = countsBySet.map(([set]) => set);
  const setTotals = countsBySet.map(([, c]) => c.Total);

  const figure: PlotlyFigure = {
    data: [
      ...CATEGORIES.map((cat) => ({
        type: "bar" as const,
        name: cat,
        y: labels,
        x: countsBySet.map(([, c]) => c[cat] ?? 0),
        orientation: "h" as const,
        hovertemplate: "%{x}<extra></extra>",
        marker: { color: CATEGORY_COLORS[cat] },
      })),
      {
        type: "scatter",
        y: labels,
        x: setTotals,
        mode: "text",
        text: setTotals.map((t) => ` ${t}`),
        textposition: "middle right",
        showlegend: false,
        hoverinfo: "skip",
      },
    ],
    layout: {
      barmode: "stack",
      xaxis: { title: { text: "Bird count" } },
      yaxis: { tickfont: { size: 14 } },
      margin: { t: 0 },
      legend: PLOTLY_LEGEND,
    },
  };

  return { figure, totalResearchGrade, totalBirds };
}
