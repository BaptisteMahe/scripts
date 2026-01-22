#! /usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { lineOffset, lineString } from "@turf/turf";
import type { FeatureCollection, LineString, Position } from "geojson";
import { pbcopy } from "../shared/pbcopy.ts";
import * as d3 from "d3";

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

pbcopy(JSON.stringify(traj.features[0]!.geometry));

/**
 * The function below should help render a spagetti trajectory into a proper one.
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
 * The function below should help render a spagetti trajectory into a proper one.
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

/**
 * The function below should help render a spagetti trajectory into a proper one.
 * The points are a geojson LineString coordinates array.
 * This function should split the trajectory by pair of points (duplicating all points except the first one & last one).
 * Then every pair of points should be offsetted accordingly to the number of times we go through the same pair of points.
 * Then the pair of points should be rejoined using average of duplicated point.
 */
function processTrajByPairOfPointsWithAverage(points: Position[]): Position[] {
  const offsetStep = 0.00001;
  const counts = new Map<string, number>();

  const segments: Array<[Position, Position]> = points
    .slice(0, -1)
    .map((point, index) => {
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

  return points.map((_, index) => {
    if (index === 0) {
      return segments[0]?.[0] ?? points[0]!;
    }

    if (index === points.length - 1) {
      return segments.at(-1)?.[1] ?? points[points.length - 1]!;
    }

    const left = segments[index - 1]?.[1] ?? points[index]!;
    const right = segments[index]?.[0] ?? points[index]!;
    return averagePosition(left, right);
  });
}

/**
 * The function below should help render a spagetti trajectory into a proper one.
 * The points are a geojson LineString coordinates array.
 * The function should then be cut by portions that overlap each other.
 * Then it should use turf.lineOffset to move each segment
 * Then merge everything back together.
 */
function processTrajBySegmentWithTurf(points: Position[]): Position[] {
  const offsetStep = 0.00001;

  const positionKey = (point: Position): string => {
    const [lng = 0, lat = 0] = point;
    return `${lng.toFixed(6)}:${lat.toFixed(6)}`;
  };

  const edgeKey = (start: Position, end: Position): string => {
    return `${positionKey(start)}->${positionKey(end)}`;
  };

  const edgeCounts = new Map<string, number>();
  points.slice(0, -1).forEach((point, index) => {
    const nextPoint = points[index + 1]!;
    const key = edgeKey(point, nextPoint);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  });

  const runByStart = new Map<
    number,
    {
      startIndex: number;
      endIndex: number;
      key: string;
      coords: Position[];
    }
  >();

  let cursor = 0;
  while (cursor < points.length - 1) {
    const currentKey = edgeKey(points[cursor]!, points[cursor + 1]!);
    if ((edgeCounts.get(currentKey) ?? 0) <= 1) {
      cursor += 1;
      continue;
    }

    const startIndex = cursor;
    while (cursor < points.length - 1) {
      const key = edgeKey(points[cursor]!, points[cursor + 1]!);
      if ((edgeCounts.get(key) ?? 0) <= 1) {
        break;
      }
      cursor += 1;
    }

    const endIndex = cursor;
    const coords = points.slice(startIndex, endIndex + 1);
    const runKey = coords.map(positionKey).join("|");
    runByStart.set(startIndex, { startIndex, endIndex, key: runKey, coords });
  }

  const runCounts = new Map<string, number>();
  const output: Position[] = [];
  let index = 0;

  const isSamePosition = (left: Position, right: Position): boolean => {
    return positionKey(left) === positionKey(right);
  };

  while (index < points.length) {
    const run = runByStart.get(index);
    if (!run) {
      const point = points[index]!;
      if (
        output.length === 0 ||
        !isSamePosition(output[output.length - 1]!, point)
      ) {
        output.push(point);
      }
      index += 1;
      continue;
    }

    const count = (runCounts.get(run.key) ?? 0) + 1;
    runCounts.set(run.key, count);
    const offset = offsetStep * count;

    const offsetLine = lineOffset(
      lineString(run.coords.map(([lng = 0, lat = 0]) => [lng, lat])),
      offset,
      { units: "degrees" },
    );

    const offsetCoords =
      offsetLine.geometry.type === "LineString"
        ? offsetLine.geometry.coordinates
        : run.coords.map(([lng = 0, lat = 0]) => [lng, lat]);

    const mergedCoords = offsetCoords.map((coord, coordIndex) => {
      const source = run.coords[Math.min(coordIndex, run.coords.length - 1)]!;
      const [, , ...rest] = source;
      const [lng = source[0]!, lat = source[1]!] = coord;
      return [lng, lat, ...rest] as Position;
    });

    if (output.length > 0 && mergedCoords.length > 0) {
      const last = output[output.length - 1]!;
      if (isSamePosition(last, mergedCoords[0]!)) {
        mergedCoords.shift();
      }
    }

    output.push(...mergedCoords);
    index = run.endIndex + 1;
  }

  return output;
}

function averagePosition(left: Position, right: Position): Position {
  return [(left[0]! + right[0]!) / 2, (left[1]! + right[1]!) / 2];
}

function processTrajByMagneticRepulsionWithD3Force(
  geoJsonLineString: LineString,
  options: { iterations?: number; radius?: number } = {},
) {
  const coordinates = geoJsonLineString.coordinates;

  // Configuration
  const width = 1000; // Virtual canvas size for physics
  const height = 1000;
  const iterations = options.iterations || 300; // How long to run physics
  const separationRadius = options.radius || 15; // Minimum distance between points (in pixels)

  // A. Setup a temporary projection to convert Lat/Lon to x/y
  // We fit the data to a 1000x1000 box so the physics forces make sense
  const projection = d3
    .geoMercator()
    .fitSize([width, height], { type: "LineString", coordinates: coordinates });

  // B. Create Nodes (Add slight jitter to handle exact overlaps)
  const nodes = coordinates.map((coord, i) => {
    const [x, y] = projection(coord as [number, number]) ?? [0, 0];
    return {
      id: i,
      // Add tiny random noise so points on top of each other can "slide" off
      x: x + (Math.random() - 0.5),
      y: y + (Math.random() - 0.5),
      originalX: x,
      originalY: y,
      lat: coord[1],
      lng: coord[0],
    };
  });

  // C. Create Links (Connect point i to i+1)
  const links = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    links.push({ source: i, target: i + 1 });
  }

  // D. Configure the Simulation
  const simulation = d3
    .forceSimulation(nodes)
    // 1. Link Force: Keeps the sequential chain together
    .force("link", d3.forceLink(links).strength(1).distance(5))

    // 2. Collide Force: The "Repulsion" - keeps nodes apart
    .force(
      "collide",
      d3.forceCollide().radius(separationRadius).strength(0.0001),
    )

    // 3. Position Force: Pulls nodes back toward their original geographic location
    //    (Weak enough to allow movement, strong enough to keep general shape)
    .force(
      "x",
      d3.forceX<(typeof nodes)[number]>((d) => d.originalX).strength(0.5),
    )
    .force(
      "y",
      d3.forceY<(typeof nodes)[number]>((d) => d.originalY).strength(0.5),
    )

    .stop(); // Don't animate, we will run it manually

  // E. Run the simulation synchronously (Headless)
  simulation.tick(iterations);

  // F. Unproject: Convert calculated x/y back to Lat/Lon
  const newCoordinates = nodes.map((node) =>
    projection.invert?.([node.x, node.y]),
  );

  return {
    type: "LineString",
    coordinates: newCoordinates,
  };
}

const output: FeatureCollection<LineString> = {
  ...traj,
  features: [
    {
      ...traj.features[0]!,
      properties: {
        name: "single-point-offset",
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
          name: "pair-of-points-offset",
          stroke: "#0000FF",
        },
        geometry: {
          type: "LineString" as const,
          coordinates: points,
        },
      }),
    ),
    {
      ...traj.features[0]!,
      properties: {
        name: "pair-of-points-offset-with-averages",
        stroke: "#FF0000",
      },
      geometry: {
        type: "LineString",
        coordinates: processTrajByPairOfPointsWithAverage(
          traj.features[0]!.geometry.coordinates,
        ),
      },
    },
    {
      ...traj.features[0]!,
      properties: {
        name: "segment-offset-with-turf",
        stroke: "#FFA500",
      },
      geometry: {
        type: "LineString",
        coordinates: processTrajBySegmentWithTurf(
          traj.features[0]!.geometry.coordinates,
        ),
      },
    },
  ],
};

if (outputFilePath) {
  await Bun.write(outputFilePath, JSON.stringify(output));
  console.log(`✏️  Output written to ${outputFilePath}`);
} else {
  console.log(JSON.stringify(output));
}
