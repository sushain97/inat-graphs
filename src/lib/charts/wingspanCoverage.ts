import { countBy, groupBy, keyBy, sortBy, sumBy } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { getWingspanBirdsBySet, type WingspanBird } from "@/lib/wingspan";
import { taxonObservationsUrl, type ChartTaxon } from "./taxonLinks";
import type { BarChartFigure } from "./types";

type Category = "Research Grade" | "Needs ID" | "Missing";
const CATEGORIES: Category[] = ["Research Grade", "Needs ID", "Missing"];
const CATEGORY_KEYS: Record<Category, string> = {
  "Research Grade": "researchGrade",
  "Needs ID": "needsId",
  Missing: "missing",
};
const CATEGORY_COLORS: Record<Category, string> = {
  "Research Grade": "mediumseagreen",
  "Needs ID": "gold",
  Missing: "lightgray",
};

export function buildWingspanCoverageFigure(summary: ObservationSummary): {
  figure: BarChartFigure;
  totalResearchGrade: number;
  totalBirds: number;
} {
  const birdsBySet = getWingspanBirdsBySet();

  const taxonByName = keyBy(
    [...summary.needsIdTaxons, ...summary.researchGradeTaxons],
    "name",
  );

  const rgSpecies = new Set(summary.researchGradeTaxons.map((t) => t.name));
  const needsIdSpecies = new Set(summary.needsIdTaxons.map((t) => t.name));

  function category(bird: WingspanBird): Category {
    const name = bird["Scientific name"];
    if (rgSpecies.has(name)) return "Research Grade";
    if (needsIdSpecies.has(name)) return "Needs ID";
    return "Missing";
  }

  function birdTaxon(bird: WingspanBird, cat: Category): ChartTaxon {
    const name = bird["Scientific name"];
    const taxon = taxonByName[name];
    const qualityGrade =
      cat === "Research Grade"
        ? "research"
        : cat === "Needs ID"
          ? "needs_id"
          : undefined;
    return {
      id: taxon?.id,
      name,
      preferred_common_name: taxon?.preferred_common_name,
      observationsUrl: qualityGrade
        ? taxonObservationsUrl(taxon?.id, qualityGrade)
        : undefined,
    };
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

  const figure: BarChartFigure = {
    data: countsBySet.map(([set, c]) => {
      const birds = birdsBySet[set];
      const byCategory = groupBy(birds, category);
      return {
        category: set,
        researchGrade: c["Research Grade"] ?? 0,
        needsId: c["Needs ID"] ?? 0,
        missing: c.Missing ?? 0,
        total: c.Total,
        meta: Object.fromEntries(
          CATEGORIES.map((cat) => [
            CATEGORY_KEYS[cat],
            (byCategory[cat] ?? []).map((bird) => birdTaxon(bird, cat)),
          ]),
        ),
      };
    }),
    series: CATEGORIES.map((cat) => ({
      key: CATEGORY_KEYS[cat],
      name: cat,
      color: CATEGORY_COLORS[cat],
    })),
    mode: "stack",
    xLabel: "Bird count",
    totalsKey: "total",
  };

  return { figure, totalResearchGrade, totalBirds };
}
