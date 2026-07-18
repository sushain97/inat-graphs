const ICONIC_TAXON_EMOJI: Record<string, string> = {
  Unknown: "❓",
  Animalia: "🐾",
  Aves: "🐦",
  Amphibia: "🐸",
  Reptilia: "🦎",
  Mammalia: "😺",
  Actinopterygii: "🐠",
  Mollusca: "🐌",
  Arachnida: "🕷️",
  Insecta: "🦋",
  Plantae: "🌿",
  Fungi: "🍄",
  Chromista: "🟢",
  Protozoa: "🦠",
};

export function taxonLabel(iconicTaxonName: string): string {
  const emoji = ICONIC_TAXON_EMOJI[iconicTaxonName];
  return emoji ? `${emoji} ${iconicTaxonName}` : iconicTaxonName;
}

export function iconicTaxonEmoji(iconicTaxonName: string | undefined): string {
  return ICONIC_TAXON_EMOJI[iconicTaxonName ?? "Unknown"] ?? "";
}
