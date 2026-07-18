import { refreshBestOf, refreshObservations } from "./refresh";

const OBSERVATIONS_INTERVAL_MS = 60 * 60 * 1000; // every 60 minutes
const BEST_OF_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

let started = false;

export async function startScheduler(): Promise<void> {
  // Idempotent — guards against double-start (e.g. dev-mode module
  // re-evaluation).
  if (started) return;
  started = true;

  void refreshObservations()
    .then(() => console.log("Initial observations refresh done"))
    .then(refreshBestOf)
    .then(() => console.log("Initial best-of refresh done"))
    .catch((err) => console.error("Initial refresh failed", err));

  setInterval(
    () =>
      void refreshObservations()
        .then(() => console.log("Observations refresh done"))
        .catch((err) => console.error("Observations refresh failed", err)),
    OBSERVATIONS_INTERVAL_MS,
  );
  setInterval(
    () =>
      void refreshBestOf()
        .then(() => console.log("Best-of refresh done"))
        .catch((err) => console.error("Best-of refresh failed", err)),
    BEST_OF_INTERVAL_MS,
  );
}
