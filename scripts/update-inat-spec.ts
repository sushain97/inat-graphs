#!/usr/bin/env -S npx tsx

import { writeFile } from "node:fs/promises";
import path from "node:path";

const SPEC_URL = "https://api.inaturalist.org/v1/swagger.json";
const OUTPUT_PATH = path.join(
  import.meta.dirname,
  "..",
  "data",
  "inat-swagger.json",
);

async function main() {
  const response = await fetch(SPEC_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${SPEC_URL}: ${response.status} ${response.statusText}`,
    );
  }
  const spec = await response.json();
  await writeFile(OUTPUT_PATH, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
