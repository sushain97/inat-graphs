import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

const CHUNK_SIZE = 30;
const PER_PAGE = 200;

export type RawObservation = components["schemas"]["Observation"];

interface PageResponse<T> {
  results?: T[];
  total_results?: number;
}

class InatClient {
  private readonly client = createClient<paths>({
    baseUrl: "https://api.inaturalist.org/v1",
  });

  readonly GET = this.client.GET.bind(this.client);

  private async fetchAllPages<T>(
    fetchPage: (page: number, perPage: number) => Promise<PageResponse<T>>,
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;

    for (;;) {
      const { results = [], total_results } = await fetchPage(page, PER_PAGE);
      all.push(...results);
      if (results.length < PER_PAGE) break;
      if (total_results !== undefined && all.length >= total_results) break;
      page += 1;
    }

    return all;
  }

  async fetchAllObservations(userId: string): Promise<RawObservation[]> {
    return this.fetchAllPages<RawObservation>((page, perPage) =>
      this.GET("/observations", {
        params: {
          query: {
            user_id: [userId],
            page: String(page),
            per_page: String(perPage),
          },
        },
      }).then(({ data, error }) => {
        if (error) throw new Error(`Failed to fetch observations page ${page}`);
        return data;
      }),
    );
  }

  /** Batch-resolve taxon ids to their preferred common name. */
  async fetchTaxonCommonNames(
    taxonIds: readonly number[],
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const uniqueIds = [...new Set(taxonIds)];

    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const { data, error } = await this.GET("/taxa/{id}", {
        params: { path: { id: chunk } },
      });
      if (error) throw new Error(`Failed to fetch taxa ${chunk.join(",")}`);

      for (const taxon of data.results ?? []) {
        if (taxon.id !== undefined && taxon.preferred_common_name) {
          result.set(taxon.id, taxon.preferred_common_name);
        }
      }
    }

    return result;
  }

  /** Batch-resolve place ids to their display name. */
  async fetchPlaceNames(
    placeIds: readonly number[],
  ): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const uniqueIds = [...new Set(placeIds)];

    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const { data, error } = await this.GET("/places/{id}", {
        params: { path: { id: chunk.map(String) } },
      });
      if (error) throw new Error(`Failed to fetch places ${chunk.join(",")}`);
      for (const place of data.results ?? []) {
        if (place.id !== undefined && place.display_name) {
          result.set(place.id, place.display_name);
        }
      }
    }

    return result;
  }
}

export const inatClient = new InatClient();
