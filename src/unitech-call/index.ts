#! /usr/bin/env bun

import { z } from "zod";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { homedir } from "os";

const argSchema = z
  .union([
    z.object({ local: z.boolean() }),
    z.object({ dev: z.boolean() }),
    z.object({ "pre-prod": z.boolean() }),
    z.object({ prod: z.boolean() }),
  ])
  .catch({ local: true })
  .and(
    z.object({
      _: z.tuple([
        z.string().startsWith("/"),
        z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
        z.string().optional(),
      ]),
    }),
  );

const inputs = argSchema.parse(yargs(hideBin(process.argv)).parse());

let url: string;
if ("dev" in inputs) url = "https://api.dev.unicofrance.com";
else if ("pre-prod" in inputs) url = "https://api.pre-prod.unicofrance.com";
else if ("prod" in inputs) url = "https://api.prod.unicofrance.com";
else url = "http://localhost:3000";

const token = await Bun.file(`${homedir()}/.unico/unitech/token`).text();

const {
  _: [endpoint, method, body],
} = inputs;

const response = await fetch(`${url}${endpoint}`, {
  method: method ?? "GET",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  ...(body ? { body } : {}),
});

console.log(await response.text());
