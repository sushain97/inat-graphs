import { Stack, Text, Title } from "@mantine/core";
import { readObservationsSnapshot } from "@/lib/snapshot";
import { buildLifetimeSpeciesFigure } from "@/lib/charts/lifetimeSpecies";
import { buildTopDaysFigure } from "@/lib/charts/topDays";
import { buildNewSpeciesDaysFigure } from "@/lib/charts/newSpeciesDays";
import { buildLocalitiesFigure } from "@/lib/charts/localities";
import { buildMostSeenFigure } from "@/lib/charts/mostSeen";
import { buildWingspanCoverageFigure } from "@/lib/charts/wingspanCoverage";
import { newNeedsIdRows } from "@/lib/charts/newNeedsId";
import { needsIdBestDaysRows } from "@/lib/charts/needsIdBestDays";
import { BarChart } from "@/components/charts/BarChart";
import { BarChartWithSpeciesDialog } from "@/components/charts/BarChartWithSpeciesDialog";
import { NewNeedsIdTable } from "@/components/NewNeedsIdTable";
import { NeedsIdBestDaysList } from "@/components/NeedsIdBestDaysList";

// Reads the on-disk snapshot the background scheduler keeps refreshing —
// must never be statically prerendered at build time.
export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="xs">
      <Title order={4}>{title}</Title>
      {children}
    </Stack>
  );
}

export default async function InatPage() {
  const observations = await readObservationsSnapshot();

  if (!observations) {
    return <Text c="dimmed">Loading observations…</Text>;
  }

  const { summary, placeNames } = observations;

  const { figure: topDaysFigure, bestDaysNeedsId } =
    buildTopDaysFigure(summary);
  const {
    figure: wingspanFigure,
    totalResearchGrade,
    totalBirds,
  } = buildWingspanCoverageFigure(summary);

  return (
    <Stack gap="xl">
      <Section title="Lifetime species by iconic taxon">
        <BarChartWithSpeciesDialog
          figure={buildLifetimeSpeciesFigure(summary)}
        />
      </Section>

      <Section title="Top days by unique species observed">
        <BarChartWithSpeciesDialog figure={topDaysFigure} />
      </Section>

      <Section title="Top days by new research grade species">
        <BarChartWithSpeciesDialog
          figure={buildNewSpeciesDaysFigure(summary)}
        />
      </Section>

      <Section title="Top localities by new research grade species">
        <BarChartWithSpeciesDialog
          figure={buildLocalitiesFigure(summary, placeNames)}
        />
      </Section>

      <Section title="New Needs ID species (last 60 days)">
        <NewNeedsIdTable rows={newNeedsIdRows(summary)} />
      </Section>

      <Section title="Needs ID species on best days (last 60 days)">
        <NeedsIdBestDaysList
          rows={needsIdBestDaysRows(summary, bestDaysNeedsId)}
        />
      </Section>

      <Section title="Most seen research grade species (unique days)">
        <BarChart {...buildMostSeenFigure(summary)} />
      </Section>

      <Section
        title={`Wingspan set coverage (${totalResearchGrade}/${totalBirds})`}
      >
        <BarChartWithSpeciesDialog figure={wingspanFigure} />
      </Section>
    </Stack>
  );
}
