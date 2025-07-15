#! /usr/bin/env bun

import PDFMerger from "pdf-merger-js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

const start = performance.now();

const argSchema = z.object({
  _: z.string().array(),
  o: z.string(),
});

const { success, data, error } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse(),
);

if (!success) {
  console.error(error);
  throw new Error(
    "Usage: pdf-merger -o <output-filepath> <input-filepath-1> <input-filepath-2> ... <input-filepath-n>",
  );
}

const outputPath = data.o.endsWith(".pdf") ? data.o : `${data.o}.pdf`;

const merger = new PDFMerger();

for (const [index, filePath] of data._.entries()) {
  console.log(`[${index + 1}/${data._.length}] Merging ${filePath}`);

  const fileContent = await Bun.file(filePath).bytes();

  await merger.add(fileContent);
}

await merger.save(outputPath);

console.log(
  `Pdf successfully merged in ${outputPath} in ${Math.floor(performance.now() - start)}ms.`,
);
