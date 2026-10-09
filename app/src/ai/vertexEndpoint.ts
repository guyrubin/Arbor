/**
 * B-GA-27 (9 Oct 2026): Vertex multi-region locations (`eu`, `us`) are served
 * from `https://aiplatform.<loc>.rep.googleapis.com` with `locations/<loc>`.
 * The deprecated @google-cloud/vertexai SDK only builds the regional host
 * `<loc>-aiplatform.googleapis.com`, so a multi-region location must pass this
 * host as `apiEndpoint` (without it: 400 "Invalid hostname:
 * eu-aiplatform.googleapis.com", probed on arborprd-westeu 9 Oct). A regional
 * location (`europe-west4`) keeps the SDK default host.
 */
const VERTEX_MULTI_REGIONS: ReadonlySet<string> = new Set(["eu", "us"]);

export const isVertexMultiRegion = (location?: string): boolean =>
  VERTEX_MULTI_REGIONS.has((location || "").trim().toLowerCase());

/** The SDK `apiEndpoint` for a multi-region location; undefined for a regional one. */
export const vertexApiEndpoint = (location: string): string | undefined =>
  isVertexMultiRegion(location) ? `aiplatform.${location.trim().toLowerCase()}.rep.googleapis.com` : undefined;
