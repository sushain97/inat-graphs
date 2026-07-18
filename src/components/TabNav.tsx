"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs } from "@mantine/core";

const TABS = [
  { value: "/inat", label: "iNat" },
  { value: "/best-of", label: "Best of Birding" },
];

export function TabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = TABS.find((t) => t.value === pathname)?.value ?? TABS[0].value;

  return (
    <Tabs value={active} onChange={(value) => value && router.push(value)}>
      <Tabs.List>
        {TABS.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
