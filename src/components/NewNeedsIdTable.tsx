"use client";

import { Anchor, Group, Table, Text } from "@mantine/core";
import type { NewNeedsIdRow } from "@/lib/charts/newNeedsId";

export function NewNeedsIdTable({ rows }: { rows: NewNeedsIdRow[] }) {
  if (rows.length === 0) {
    return <Text c="dimmed">No new Needs ID species in the last 60 days.</Text>;
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Last seen</Table.Th>
          <Table.Th>All dates</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.taxon.name}>
            <Table.Td>
              <Anchor href={row.taxonUrl} target="_blank" underline="never">
                {row.label}
              </Anchor>
            </Table.Td>
            <Table.Td>
              <Anchor href={row.lastSeen.url} target="_blank" underline="never">
                {row.lastSeen.date}
              </Anchor>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                {row.allDates.map((d, i) => (
                  <span key={d.date}>
                    <Anchor href={d.url} target="_blank" underline="never">
                      {d.date}
                    </Anchor>
                    {i < row.allDates.length - 1 ? "," : ""}
                  </span>
                ))}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
