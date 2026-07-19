"use client";

import { Accordion, Anchor, Text } from "@mantine/core";
import type { NeedsIdBestDay } from "@/lib/charts/needsIdBestDays";
import { taxonPageUrl } from "@/lib/charts/taxonLinks";

export function NeedsIdBestDaysList({ rows }: { rows: NeedsIdBestDay[] }) {
  if (rows.length === 0) {
    return (
      <Text c="dimmed">
        No Needs ID species on best days in the last 60 days.
      </Text>
    );
  }

  return (
    <Accordion variant="separated">
      {rows.map((row) => (
        <Accordion.Item key={row.day} value={row.day}>
          <Accordion.Control>{row.label}</Accordion.Control>
          <Accordion.Panel>
            <ul>
              {row.species.map((s) => (
                <li key={s.name}>
                  <Anchor
                    href={s.observationsUrl ?? taxonPageUrl(s)}
                    target="_blank"
                    underline="never"
                  >
                    {s.preferred_common_name || s.name}
                  </Anchor>
                  {s.starred ? " ⭐" : ""}
                </li>
              ))}
            </ul>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
