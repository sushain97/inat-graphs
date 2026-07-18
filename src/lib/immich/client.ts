import {
  AssetMediaSize,
  getAlbumInfo,
  getAssetInfo,
  getTimeBucket,
  getTimeBuckets,
  init,
  viewAsset,
} from "@immich/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Config from "@/lib/config";

init({ baseUrl: `${Config.immichBaseUrl}/api`, apiKey: Config.immichApiKey });

const TAG_CACHE_DIR = path.join(Config.cacheDir, "immich-tags");

export interface AlbumAsset {
  id: string;
  fileCreatedAt: string;
  owner: string;
}

class ImmichClient {
  async getAlbumAssets(albumId: string): Promise<AlbumAsset[]> {
    const album = await getAlbumInfo({ id: albumId });
    const ownerById = new Map(
      album.albumUsers.map((entry) => [entry.user.id, entry.user.name]),
    );

    const buckets = await getTimeBuckets({ albumId, isTrashed: false });

    const assets: AlbumAsset[] = [];
    for (const { timeBucket } of buckets) {
      const bucket = await getTimeBucket({
        albumId,
        timeBucket,
        isTrashed: false,
      });
      for (let i = 0; i < bucket.id.length; i++) {
        assets.push({
          id: bucket.id[i],
          fileCreatedAt: bucket.fileCreatedAt[i],
          owner: ownerById.get(bucket.ownerId[i]) ?? bucket.ownerId[i],
        });
      }
    }

    return assets;
  }

  /** Tags never expire once cached, matching the old Python behavior. */
  async getAssetTags(assetId: string): Promise<string[]> {
    const cached = await this.readTagCache(assetId);
    if (cached) return cached;

    const asset = await getAssetInfo({ id: assetId });
    const tags = (asset.tags ?? []).map((tag) => tag.value);

    await this.writeTagCache(assetId, tags);
    return tags;
  }

  async getAssetThumbnail(assetId: string): Promise<Buffer> {
    const blob = await viewAsset({
      id: assetId,
      size: AssetMediaSize.Thumbnail,
    });
    return Buffer.from(await blob.arrayBuffer());
  }

  private async readTagCache(assetId: string): Promise<string[] | null> {
    try {
      const raw = await readFile(
        path.join(TAG_CACHE_DIR, `${assetId}.json`),
        "utf-8",
      );
      const tags: string[] = JSON.parse(raw);
      return tags.length > 0 ? tags : null;
    } catch {
      return null;
    }
  }

  private async writeTagCache(assetId: string, tags: string[]): Promise<void> {
    await mkdir(TAG_CACHE_DIR, { recursive: true });
    await writeFile(
      path.join(TAG_CACHE_DIR, `${assetId}.json`),
      JSON.stringify(tags),
    );
  }
}

export const immichClient = new ImmichClient();
