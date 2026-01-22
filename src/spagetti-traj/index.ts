#! /usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import type { FeatureCollection, LineString, Position } from "geojson";

const argSchema = z.object({
  _: z.array(z.string()).length(1),
  o: z.string().optional(),
});

const { success, data, error } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse(),
);

if (!success) {
  console.error(error);
  throw new Error(
    "Usage: spagetti-traj <input-geojson-path> -o output-path (optional, defaults to stdout)",
  );
}

const [inputFilePath] = data._;
if (!inputFilePath)
  throw new Error(
    "Usage: spagetti-traj <input-geojson-path> -o output-path (optional, defaults to stdout)",
  );

const outputFilePath = data?.o;

const traj: FeatureCollection<LineString> =
  await Bun.file(inputFilePath).json();

/**
 * TODO: The function below should help render a spagetti trajectory into a proper one.
 * The points are a geojson LineString coordinates array.
 * It should count the number of time we go though the same point and interpolate (move to the left) the points accordingly.
 */
function processTrajBySinglePoint(points: Position[]): Position[] {
  const offsetStep = 0.00001;
  const counts = new Map<string, number>();

  return points.map((point, index) => {
    const [lng = 0, lat = 0, ...rest] = point;
    const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);

    const prev = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const dx = (next[0] as number) - (prev[0] as number);
    const dy = (next[1] as number) - (prev[1] as number);
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      return point;
    }

    const offset = offsetStep * count;
    const offsetX = (-dy / length) * offset;
    const offsetY = (dx / length) * offset;

    return [lng + offsetX, lat + offsetY, ...rest];
  });
}

/**
 * TODO: The function below should help render a spagetti trajectory into a proper one.
 * The points are a geojson LineString coordinates array.
 * This function should split the trajectory by pair of points (duplicating all points except the first one & last one).
 * Then every pair of points should be offsetted accordingly to the number of times we go through the same pair of points.
 */
function processTrajByPairOfPoints(points: Position[]): Position[][] {
  const offsetStep = 0.00001;
  const counts = new Map<string, number>();

  return points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1]!;
    const [startLng = 0, startLat = 0, ...startRest] = point;
    const [endLng = 0, endLat = 0, ...endRest] = nextPoint;
    const key = `${startLng.toFixed(6)}:${startLat.toFixed(6)}->${endLng.toFixed(6)}:${endLat.toFixed(6)}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);

    const dx = endLng - startLng;
    const dy = endLat - startLat;
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      return [point, nextPoint];
    }

    const offset = offsetStep * count;
    const offsetX = (-dy / length) * offset;
    const offsetY = (dx / length) * offset;

    return [
      [startLng + offsetX, startLat + offsetY, ...startRest],
      [endLng + offsetX, endLat + offsetY, ...endRest],
    ];
  });
}

const output: FeatureCollection<LineString> = {
  ...traj,
  features: [
    {
      ...traj.features[0]!,
      properties: {
        stroke: "#00FF00",
      },
      geometry: {
        type: "LineString",
        coordinates: processTrajBySinglePoint(
          traj.features[0]!.geometry.coordinates,
        ),
      },
    },
    ...processTrajByPairOfPoints(traj.features[0]!.geometry.coordinates).map(
      (points) => ({
        ...traj.features[0]!,
        properties: {
          stroke: "#FF0000",
        },
        geometry: {
          type: "LineString" as const,
          coordinates: points,
        },
      }),
    ),
  ],
};

if (outputFilePath) {
  await Bun.write(outputFilePath, JSON.stringify(output));
  console.log(`✏️  Output written to ${outputFilePath}`);
} else {
  console.log(JSON.stringify(output));
}
