export const LABELED_DATES: Record<string, string> = {
  "2025-09-29": "Isabela Island",
  "2025-10-01": "Santa Cruz Island",
  "2025-10-25": "Bair Island",
  "2025-11-27": "Cullinan Park",
  "2025-11-08": "Shoreline Park",
  "2025-11-22": "Cullinan Park",
  "2026-02-14": "Bedwell Bayfront + Emily Renzel",
  "2026-02-28": "OP Marina + Oracle Pond",
  "2026-03-07": "Point Lobos",
  "2026-03-08": "Bedwell Bayfront + Oracle Pond",
  "2026-03-27": "Coyote Point + Oracle Pond",
  "2026-03-29": "Nob Hill Pond",
  "2026-04-05": "Coyote Point + Red Morton",
  "2026-04-17": "Shinjuku Gyoen + Meiji Jingu",
  "2026-04-18": "Kasai Rinkai + Imperial Garden",
  "2026-04-20": "Hakone",
  "2026-05-09": "Ocean Beach + GGP",
  "2026-05-10": "Point Reyes",
  "2026-05-30": "Coyote Hills",
};

export function formatDate(date: string): string {
  const label = LABELED_DATES[date];
  return label ? `${date} (${label})` : date;
}
