import envPaths from "env-paths";

const paths = envPaths("inat-graphs", { suffix: "" });

const config = {
  inatUserId: "sushain",
  immichBaseUrl: "https://photos.skc.name",
  immichApiKey: process.env.IMMICH_API_KEY!,
  bestOfBirdingAlbumId: "c172ef8b-6f76-4abe-9ed5-cdd3292cc404",
  cacheDir: paths.cache,
};

export default config;
