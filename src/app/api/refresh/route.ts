import { refreshAll } from "@/server/refresh";

export async function POST() {
  await refreshAll();
  return new Response(null, { status: 204 });
}
