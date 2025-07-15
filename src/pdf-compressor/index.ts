#! /usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";
import { compress } from "compress-pdf";

const start = performance.now();

const Resolutions = [
  "screen",
  "ebook",
  "printer",
  "prepress",
  "default",
] as const;

const argSchema = z.object({
  _: z.string().array().length(1),
  o: z.string(),
  r: z.enum(Resolutions).default("ebook"),
  i: z.coerce.number().max(100).min(1).default(100),
});

const { success, data } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse(),
);

if (!success) {
  throw new Error(
    "Usage: pdf-compressor -o <output-filepath> -i <img-compress> -r <resolution> <input-filepath>",
  );
}

const outputPath = data.o.endsWith(".pdf") ? data.o : `${data.o}.pdf`;

const file = Buffer.from(await Bun.file(data._[0]!).arrayBuffer());

const output = await compress(file, {
  imageQuality: data.i,
  resolution: data.r,
});

await Bun.write(outputPath, output);

console.log(
  `Pdf successfully merged in ${outputPath} in ${Math.floor(performance.now() - start)}ms.`,
);
