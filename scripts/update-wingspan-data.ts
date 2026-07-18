#!/usr/bin/env -S npx tsx

import { writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCES = [
  {
    url: "https://raw.githubusercontent.com/navarog/wingsearch/master/src/assets/data/master.json",
    filename: "wingspan-master.json",
  },
  {
    url: "https://raw.githubusercontent.com/navarog/wingsearch/master/src/assets/data/hummingbirds.json",
    filename: "wingspan-hummingbirds.json",
  },
];

async function main() {
  for (const { url, filename } of SOURCES) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();
    const outputPath = path.join(import.meta.dirname, "..", "data", filename);
    await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  }
}

main();
