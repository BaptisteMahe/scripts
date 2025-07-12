#! /usr/bin/env bun

import PDFMerger from "pdf-merger-js";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {z} from "zod";
import {writeFile} from "fs/promises";

const argSchema = z.object({
    _: z.string().array(),
    o: z.string(),
})

const argv = argSchema.parse(
    yargs(hideBin(process.argv)).parse()
)

const merger = new PDFMerger();

for (const file of argv._) {
    try {
        await merger.add(file);
    } catch (e) {
        console.error("Error merging file: ", file)
        console.error(e)
    }
}

await writeFile(
    argv.o,
    new Uint8Array(await merger.saveAsBuffer())
);

console.log("Pdf successfully merged: ", argv.o)