import { immichClient } from "@/lib/immich/client";
import { isKnownBestOfAsset } from "@/lib/snapshot";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  if (!(await isKnownBestOfAsset(assetId))) {
    return new Response(null, { status: 404 });
  }

  const buffer = await immichClient.getAssetThumbnail(assetId);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
