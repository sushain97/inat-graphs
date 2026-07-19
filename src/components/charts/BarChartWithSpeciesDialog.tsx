"use client";

import { useState } from "react";
import { Anchor, List, Modal, Text } from "@mantine/core";
import { BarChart, type ChartClick } from "@/components/charts/BarChart";
import type { BarChartFigure } from "@/lib/charts/types";
import type { ChartTaxon } from "@/lib/charts/taxonLinks";

interface DialogState {
  title: string;
  species: ChartTaxon[];
}

function taxonUrl(taxon: ChartTaxon): string {
  return (
    taxon.observationsUrl ??
    `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(taxon.name ?? "")}`
  );
}

export function BarChartWithSpeciesDialog({
  figure,
}: {
  figure: BarChartFigure;
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const handleBarClick = ({ row, seriesKey }: ChartClick) => {
    const species = (row.meta?.[seriesKey] as ChartTaxon[] | undefined) ?? [];
    if (species.length === 0) return;
    const seriesName =
      figure.series
        .find((s) => s.key === seriesKey)
        ?.name.replace(/\s*\(\d+\)$/, "") ?? "";
    setDialog({ title: `${row.category} — ${seriesName}`, species });
  };

  return (
    <>
      <BarChart {...figure} onBarClick={handleBarClick} />
      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        size="md"
        title={dialog?.title}
      >
        <List spacing="xs">
          {dialog?.species.map((s) => (
            <List.Item key={s.name}>
              <Anchor href={taxonUrl(s)} target="_blank" underline="never">
                {s.preferred_common_name ? (
                  <>
                    {s.preferred_common_name}{" "}
                    <Text span c="dimmed">
                      ({s.name})
                    </Text>
                  </>
                ) : (
                  s.name
                )}
              </Anchor>
            </List.Item>
          ))}
        </List>
      </Modal>
    </>
  );
}
