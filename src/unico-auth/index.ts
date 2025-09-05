#! /usr/bin/env bun

import { homedir } from "os";
import * as readline from "node:readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

const argSchema = z
  .union([
    z.object({ local: z.boolean() }),
    z.object({ dev: z.boolean() }),
    z.object({ "pre-prod": z.boolean() }),
    z.object({ prod: z.boolean() }),
  ])
  .catch({ local: true });

const inputs = argSchema.parse(yargs(hideBin(process.argv)).parse());

let endpoint: string;
if ("dev" in inputs) endpoint = "https://api.dev.unicofrance.com";
else if ("pre-prod" in inputs)
  endpoint = "https://api.pre-prod.unicofrance.com";
else if ("prod" in inputs) endpoint = "https://api.prod.unicofrance.com";
else endpoint = "http://localhost:3000";

const auth = await Bun.file(`${homedir()}/.unico/unitech/auth.json`)
  .text()
  .then((value) => JSON.parse(value));

const authorizedClientsResponse = await fetch(
  `${endpoint}/auth/enabled-clients`,
  {
    method: "POST",
    body: JSON.stringify(auth),
    headers: { "Content-Type": "application/json" },
  },
);

const clients = (await authorizedClientsResponse.json()) as {
  id: string;
  name: string;
}[];

const choice = await chooseOption(clients.map(({ name }) => name.trim()));
const client = clients[choice];
if (!client)
  throw new Error(
    `Invalid choice (choice should be a number between 0 and ${clients.length - 1})`,
  );

const tokenResponse = await fetch(`${endpoint}/auth/token`, {
  method: "POST",
  body: JSON.stringify({ ...auth, idClient: client.id }),
  headers: { "Content-Type": "application/json" },
});

const { accessToken } = (await tokenResponse.json()) as { accessToken: string };
await Bun.file(`${homedir()}/.unico/unitech/token`).write(accessToken);

console.log(`Token for ${client.name} saved to ~/.unico/unitech/token`);

async function chooseOption(options: string[]) {
  const line = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<number>((resolve) => {
    line.question(
      options.map((option, index) => `[${index}] \t ${option}`).join("\n") +
        "\nChoose an option: ",
      (response) => {
        line.close();
        resolve(Number(response));
      },
    );
  });
}
