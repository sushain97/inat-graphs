import { groupBy, orderBy, uniq } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { iconicTaxonEmoji } from "./taxonLabels";

export interface NewNeedsIdRow {
  name: string;
  lastSeen: string;
  allDates: string;
}

export function newNeedsIdRows(summary: ObservationSummary): NewNeedsIdRow[] {
  const rgNames = new Set(
    summary.researchGradeTaxons
      .filter((t) => t.name)
      .map((t) => speciesName(t.name!)),
  );
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 60);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const eligible = summary.needsIdObservations.filter(
    (obs) =>
      obs.taxon?.name &&
      obs.observed_on &&
      !rgNames.has(speciesName(obs.taxon.name)) &&
      obs.observed_on >= minDateStr,
  );
  const bySpecies = groupBy(eligible, (obs) => speciesName(obs.taxon!.name!));

  const rows: NewNeedsIdRow[] = Object.entries(bySpecies).map(
    ([name, obsList]) => {
      const dates = orderBy(
        uniq(obsList.map((o) => o.observed_on!)),
        [],
        "desc",
      );
      const commonName = obsList[0].taxon!.preferred_common_name;
      const emoji = iconicTaxonEmoji(obsList[0].taxon!.iconic_taxon_name);
      return {
        name: commonName
          ? `${emoji} ${commonName} (${name})`
          : `${emoji} ${name}`,
        lastSeen: dates[0],
        allDates: dates.join(", "),
      };
    },
  );

  return orderBy(rows, "lastSeen", "desc");
}
