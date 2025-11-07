import { parseString } from "@fast-csv/parse";
import { groupBy } from "lodash";

const file = Bun.file(
  "src/process-geoloc-pro-payloads/geoloc-pro-payloads.csv",
);
const fileData = await parseString(await file.text()).toArray();

const output = [...fileData.entries()]
  .filter(([index, req]) => index > 0)
  .map(([_, req]) => {
    const body = Object.values(JSON.parse(req[3]));

    const groupedBody = groupBy(body, "imei");

    return {
      sizePerRequest: body.length,
      sizesPerImei: Object.values(groupedBody).map((it) => it.length),
    };
  });

// Extract all sizePerRequest values
const sizePerRequestValues = output.map((item) => item.sizePerRequest);

// Flatten all sizesPerImei values
const allSizesPerImei = output.flatMap((item) => item.sizesPerImei);

// Compute statistics for sizePerRequest
const sizePerRequestStats = {
  avg:
    sizePerRequestValues.reduce((a, b) => a + b, 0) /
    sizePerRequestValues.length,
  min: Math.min(...sizePerRequestValues),
  max: Math.max(...sizePerRequestValues),
};

// Compute statistics for sizesPerImei
const sizesPerImeiStats = {
  avg: allSizesPerImei.reduce((a, b) => a + b, 0) / allSizesPerImei.length,
  min: Math.min(...allSizesPerImei),
  max: Math.max(...allSizesPerImei),
};

console.log("sizePerRequest stats:", sizePerRequestStats);
console.log("sizesPerImei stats:", sizesPerImeiStats);
