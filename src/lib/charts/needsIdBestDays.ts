import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import type { ChartTaxon } from "./taxonLinks";

export interface NeedsIdBestDaySpecies extends ChartTaxon {
  starred: boolean;
}

export interface NeedsIdBestDay {
  day: string;
  label: string;
  species: NeedsIdBestDaySpecies[];
}

export function needsIdBestDaysRows(
  summary: ObservationSummary,
  bestDaysNeedsId: Map<string, ChartTaxon[]>,
): NeedsIdBestDay[] {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 60);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const needsIdSpecies = new Set(
    summary.needsIdTaxons.map((t) => speciesName(t.name)),
  );

  return [...bestDaysNeedsId.entries()]
    .filter(([day, species]) => day >= minDateStr && species.length > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, species]) => {
      const sorted = [...species].sort((a, b) =>
        (a.preferred_common_name || a.name || "").localeCompare(
          b.preferred_common_name || b.name || "",
        ),
      );
      return {
        day,
        label: `${formatDate(day)} — ${species.length} species`,
        species: sorted.map((s) => ({
          ...s,
          starred: needsIdSpecies.has(speciesName(s.name ?? "")),
        })),
      };
    });
}
