#!/usr/bin/env -S npx tsx

import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import Config from "../src/lib/config";
import { getObservations, speciesName } from "../src/lib/inat/observations";

const NAME_OVERRIDES: Record<string, string> = {
  "Larus occidentalis x glaucescens": "Larus glaucescens × occidentalis",
};

function normalizeEbirdName(name: string): string {
  const stripped = name
    .replace(" (Domestic type)", "")
    .replace(" (Feral Pigeon)", "");
  return NAME_OVERRIDES[stripped] ?? stripped;
}

async function readEbirdTaxons(
  csvPath: string | undefined,
): Promise<Map<string, string>> {
  const source = csvPath ? createReadStream(csvPath) : process.stdin;
  const parser = source.pipe(parse({ columns: true }));

  const taxons = new Map<string, string>();
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    taxons.set(normalizeEbirdName(row["Scientific Name"]), row["Common Name"]);
  }
  return taxons;
}

async function main() {
  const csvPath = process.argv[2];
  const [{ summary }, ebirdTaxons] = await Promise.all([
    getObservations(Config.inatUserId),
    readEbirdTaxons(csvPath),
  ]);

  const inatTaxons = new Map(
    summary.researchGradeTaxons
      .filter((t) => t.iconic_taxon_name === "Aves" && t.name)
      .map((t) => [speciesName(t.name!), t.preferred_common_name ?? ""]),
  );
  const inatNeedsIdTaxons = new Set(
    summary.needsIdTaxons
      .filter((t) => t.name)
      .map((t) => speciesName(t.name!)),
  );

  for (const [name, commonName] of ebirdTaxons) {
    if (inatTaxons.has(name)) continue;
    const needsId = inatNeedsIdTaxons.has(name) || name === "Larus livens";
    console.log(
      `Missing in iNaturalist:${needsId ? " [NEEDS-ID]" : ""} ${commonName} (${name})`,
    );
  }
  for (const [name, commonName] of inatTaxons) {
    if (ebirdTaxons.has(name)) continue;
    console.log(`      Missing in eBird: ${commonName} (${name})`);
  }
}

main();
