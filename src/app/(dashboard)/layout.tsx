import { Container, Group, Stack, Title } from "@mantine/core";
import { RefreshButton } from "@/components/RefreshButton";
import { TabNav } from "@/components/TabNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>🦜 Birding</Title>
          <RefreshButton />
        </Group>
        <TabNav />
        {children}
      </Stack>
    </Container>
  );
}
