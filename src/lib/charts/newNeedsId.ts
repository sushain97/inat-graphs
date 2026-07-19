import { groupBy, orderBy, uniq } from "lodash-es";
import type { ObservationSummary } from "@/lib/inat/observations";
import { speciesName } from "@/lib/inat/observations";
import { iconicTaxonEmoji } from "./taxonLabels";
import {
  taxonObservationsUrl,
  taxonPageUrl,
  type ChartTaxon,
} from "./taxonLinks";

export interface NewNeedsIdDate {
  date: string;
  url: string;
}

export interface NewNeedsIdRow {
  taxon: ChartTaxon;
  label: string;
  taxonUrl: string;
  lastSeen: NewNeedsIdDate;
  allDates: NewNeedsIdDate[];
}

export function newNeedsIdRows(summary: ObservationSummary): NewNeedsIdRow[] {
  const rgNames = new Set(
    summary.researchGradeTaxons.map((t) => speciesName(t.name)),
  );
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 60);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const eligible = summary.needsIdObservations.filter(
    (obs) =>
      !rgNames.has(speciesName(obs.taxon.name)) &&
      obs.observed_on >= minDateStr,
  );
  const bySpecies = groupBy(eligible, (obs) => speciesName(obs.taxon.name));

  const rows: NewNeedsIdRow[] = Object.entries(bySpecies).map(
    ([name, obsList]) => {
      const taxon = obsList[0].taxon;
      const commonName = taxon.preferred_common_name;
      const emoji = iconicTaxonEmoji(taxon.iconic_taxon_name);
      const chartTaxon: ChartTaxon = { id: taxon.id, name };
      const dates: NewNeedsIdDate[] = orderBy(
        uniq(obsList.map((o) => o.observed_on)),
        [],
        "desc",
      ).map((date) => ({
        date,
        url:
          taxonObservationsUrl(taxon.id, "needs_id", { on: date }) ??
          taxonPageUrl(chartTaxon),
      }));
      return {
        taxon: chartTaxon,
        label: commonName
          ? `${emoji} ${commonName} (${name})`
          : `${emoji} ${name}`,
        taxonUrl: taxonPageUrl(chartTaxon),
        lastSeen: dates[0],
        allDates: dates,
      };
    },
  );

  return orderBy(rows, (r) => r.lastSeen.date, "desc");
}
