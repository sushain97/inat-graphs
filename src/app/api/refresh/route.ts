import { refreshAll } from "@/server/refresh";

let refreshInFlight = false;

export async function POST() {
  if (refreshInFlight) {
    return new Response(null, { status: 429 });
  }

  refreshInFlight = true;
  try {
    await refreshAll();
    return new Response(null, { status: 204 });
  } finally {
    refreshInFlight = false;
  }
}
