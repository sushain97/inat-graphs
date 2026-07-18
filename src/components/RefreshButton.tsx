"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mantine/core";

export function RefreshButton() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setIsRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Button
      variant="light"
      loading={isRefreshing || isPending}
      onClick={handleClick}
    >
      ↺ Refresh
    </Button>
  );
}
