import { Address4, Address6 } from "ip-address";
import type { NextRequest } from "next/server";
import { refreshAll } from "@/server/refresh";

function isPrivateIp(ip: string): boolean {
  try {
    if (ip.includes(":")) {
      const addr = new Address6(ip);
      const v4 = addr.isMapped4() ? addr.to4() : null;
      return (
        addr.isLoopback() ||
        addr.isLinkLocal() ||
        addr.isULA() ||
        (v4 !== null && v4.isPrivate())
      );
    }
    const addr = new Address4(ip);
    return addr.isPrivate() || addr.isLoopback();
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const parts = forwardedFor.split(",").map((part) => part.trim());
  return parts.at(-1) || null;
}

let refreshInFlight = false;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!ip || !isPrivateIp(ip)) {
    return new Response(null, { status: 403 });
  }

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
