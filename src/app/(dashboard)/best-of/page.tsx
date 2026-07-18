import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Stack,
  Text,
} from "@mantine/core";
import Config from "@/lib/config";
import { readBestOfSnapshot } from "@/lib/snapshot";
import { buildBestOfRows } from "@/lib/immich/best-of";
import { BestOfTable } from "@/components/best-of/BestOfTable";

// Reads the on-disk snapshot the background scheduler keeps refreshing —
// must never be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function BestOfPage() {
  const bestOf = await readBestOfSnapshot();
  if (!bestOf) {
    return <Text c="dimmed">Loading best-of album…</Text>;
  }

  return (
    <Stack gap="md">
      {bestOf.warnings.length > 0 && (
        <Accordion variant="separated">
          <AccordionItem value="warnings">
            <AccordionControl>
              Warnings ({bestOf.warnings.length})
            </AccordionControl>
            <AccordionPanel>
              <ul>
                {bestOf.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}
      <BestOfTable
        rows={buildBestOfRows(bestOf)}
        photos={bestOf.photos}
        immichBaseUrl={Config.immichBaseUrl}
      />
    </Stack>
  );
}
