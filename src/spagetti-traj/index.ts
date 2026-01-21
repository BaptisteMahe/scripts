#! /usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import type { FeatureCollection, LineString, Position } from "geojson";

const argSchema = z.object({
  _: z.array(z.string()).length(1),
});

const { success, data, error } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse(),
);

if (!success) {
  console.error(error);
  throw new Error("Usage: spagetti-traj <input-geojson-path>");
}

const traj: FeatureCollection<LineString> = await Bun.file(data._[0]!).json();

/**
 * TODO: The function below should help render a spagetti trajectory into a proper one.
 * The points are a geojson LineString coordinates array.
 * It should count the number of time we go though the same point and interpolate (move to the left) the points accordingly.
 */
function processTraj1(points: Position[]): Position[] {
  const offsetStep = 0.00002;
  const counts = new Map<string, number>();

  return points.map((point, index) => {
    const [lng = 0, lat = 0, ...rest] = point;
    const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);

    if (count === 1) {
      return point;
    }

    const prev = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const dx = (next[0] as number) - (prev[0] as number);
    const dy = (next[1] as number) - (prev[1] as number);
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      return point;
    }

    const offset = offsetStep * (count - 1);
    const offsetX = (-dy / length) * offset;
    const offsetY = (dx / length) * offset;

    return [lng + offsetX, lat + offsetY, ...rest];
  });
}

const traj1 = {
  ...traj,
  features: [
    {
      ...traj.features[0],
      geometry: {
        ...traj.features[0]!.geometry,
        coordinates: processTraj1(traj.features[0]!.geometry.coordinates),
      },
    },
  ],
};

console.log(JSON.stringify(traj1, null, 2));
