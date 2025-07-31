#! /usr/bin/env bun

import { z } from "zod";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argSchema = z.object({
  _: z.string().array().length(1),
  o: z.string(),
});

const ofgSchema = z.object({
  guidePoints: z.array(
    z.object({
      color: z.string(),
      instruction: z.number(),
      lat: z.number(),
      lon: z.number(),
    }),
  ),
  name: z.string(),
  version: z.string(),
});

const SYGIC_GEO_COEF = 100_000.0;

const { success, data, error } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse(),
);

if (!success) {
  console.error(error);
  throw new Error(
    "Usage: odf-to-geojson -o <output-filepath> -i <img-compress> -r <resolution> <input-filepath>",
  );
}

const inputPath = data._[0]!;
const outputPath = data.o;

const ofg = ofgSchema.parse(JSON.parse(await Bun.file(inputPath).text()));

const geoJson = {
  type: "FeatureCollection",
  features: [
    ...ofg.guidePoints.map((it, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [it.lon / SYGIC_GEO_COEF, it.lat / SYGIC_GEO_COEF],
      },
      properties: {
        color: it.color,
        index,
        instruction: it.instruction,
      },
    })),
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: ofg.guidePoints.map((it) => [
          it.lon / SYGIC_GEO_COEF,
          it.lat / SYGIC_GEO_COEF,
        ]),
      },
      properties: {},
    },
  ],
};

await Bun.write(outputPath, JSON.stringify(geoJson, null, 2));
