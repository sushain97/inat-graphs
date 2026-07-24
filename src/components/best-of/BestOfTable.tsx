"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";
import { Stack, TextInput } from "@mantine/core";
import type { BestOfRow } from "@/lib/immich/best-of";
import {
  BEST_OF_CLASSES,
  type BestOfClass,
} from "@/lib/immich/best-of-classes";
import { PhotoDialog } from "./PhotoDialog";

const SPECIES_PARAM = "species";

const CLASS_LABELS: Partial<Record<BestOfClass, string>> = {
  Male: "Male (♂)",
  Female: "Female (♀)",
  Immature: "Immature (⚲)",
};

export interface BestOfTableProps {
  rows: BestOfRow[];
  photos: Record<string, Partial<Record<BestOfClass, string[]>>>;
  immichBaseUrl: string;
}

export function BestOfTable({ rows, photos, immichBaseUrl }: BestOfTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<BestOfRow>>({
    columnAccessor: "total",
    direction: "desc",
  });

  const selectedName = searchParams.get(SPECIES_PARAM);
  const selected = selectedName
    ? (rows.find((r) => r.name === selectedName) ?? null)
    : null;

  const setSelected = useCallback(
    (row: BestOfRow | null) => {
      const params = new URLSearchParams(searchParams);
      if (row) {
        params.set(SPECIES_PARAM, row.name);
      } else {
        params.delete(SPECIES_PARAM);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            r.commonName.toLowerCase().includes(query),
        )
      : rows;

    const sorted = [...matches].sort((a, b) => {
      const { columnAccessor, direction } = sortStatus;
      const factor = direction === "asc" ? 1 : -1;
      if (columnAccessor === "name")
        return factor * a.name.localeCompare(b.name);
      if (columnAccessor === "commonName") {
        return factor * a.commonName.localeCompare(b.commonName);
      }
      if (columnAccessor === "total") return factor * (a.total - b.total);
      const klass = columnAccessor as BestOfClass;
      return factor * ((a.counts[klass] ?? 0) - (b.counts[klass] ?? 0));
    });
    return sorted;
  }, [rows, search, sortStatus]);

  return (
    <Stack gap="sm">
      <TextInput
        placeholder="Search species…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <DataTable<BestOfRow>
        idAccessor="name"
        records={filtered}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
        onRowClick={({ record }) => {
          if (record.total > 0) setSelected(record);
        }}
        rowStyle={(record) =>
          record.total === 0 ? { cursor: "default" } : undefined
        }
        highlightOnHover
        minHeight={300}
        columns={[
          { accessor: "name", title: "Scientific Name", sortable: true },
          { accessor: "commonName", title: "Common Name", sortable: true },
          ...BEST_OF_CLASSES.map((klass) => ({
            accessor: klass,
            title: CLASS_LABELS[klass] ?? klass,
            textAlign: "right" as const,
            sortable: true,
            render: (row: BestOfRow) => row.counts[klass] ?? "",
          })),
          {
            accessor: "total",
            title: "Σ",
            textAlign: "right" as const,
            sortable: true,
          },
        ]}
      />
      {selected && (
        <PhotoDialog
          opened
          onClose={() => setSelected(null)}
          name={selected.name}
          commonName={selected.commonName}
          immichBaseUrl={immichBaseUrl}
          speciesPhotos={photos[selected.name] ?? {}}
        />
      )}
    </Stack>
  );
}
