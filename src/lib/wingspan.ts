import { groupBy } from "lodash-es";
import wingspanMasterRaw from "../../data/wingspan-master.json";
import wingspanHummingbirdsRaw from "../../data/wingspan-hummingbirds.json";

export interface WingspanBird {
  "Scientific name": string;
  Set: string;
}

const wingspanMaster = wingspanMasterRaw as WingspanBird[];
const wingspanHummingbirds = wingspanHummingbirdsRaw as WingspanBird[];

/** Bird cards grouped by expansion "Set", with hummingbirds as their own
 * pseudo-set. */
export function getWingspanBirdsBySet(): Record<string, WingspanBird[]> {
  return {
    ...groupBy(wingspanMaster, "Set"),
    hummingbird: wingspanHummingbirds,
  };
}
