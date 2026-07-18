"use client";

import { Table, Text } from "@mantine/core";
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
          <Table.Tr key={row.name}>
            <Table.Td>{row.name}</Table.Td>
            <Table.Td>{row.lastSeen}</Table.Td>
            <Table.Td>{row.allDates}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
