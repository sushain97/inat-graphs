"use client";

import { Accordion, Text } from "@mantine/core";
import type { NeedsIdBestDay } from "@/lib/charts/needsIdBestDays";

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
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
