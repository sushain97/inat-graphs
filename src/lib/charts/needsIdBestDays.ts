import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { formatDate } from "@/lib/days";
import type { SpeciesByDay } from "./topDays";

export interface NeedsIdBestDay {
  day: string;
  label: string;
  species: string[];
}

export function needsIdBestDaysRows(
  summary: ObservationSummary,
  bestDaysNeedsId: SpeciesByDay,
): NeedsIdBestDay[] {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 60);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const needsIdSpecies = new Set(
    summary.needsIdTaxons
      .filter((t) => t.name)
      .map((t) => speciesName(t.name!)),
  );

  return [...bestDaysNeedsId.entries()]
    .filter(([day, species]) => day >= minDateStr && species.size > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, species]) => {
      const labels = [...species.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sname, common]) => {
          const label = common || sname;
          return needsIdSpecies.has(sname) ? `${label} ⭐` : label;
        });
      return {
        day,
        label: `${formatDate(day)} — ${species.size} species`,
        species: labels,
      };
    });
}
