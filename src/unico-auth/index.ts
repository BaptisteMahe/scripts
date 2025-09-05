#! /usr/bin/env bun

import { homedir } from "os";
import * as readline from "node:readline";

const auth = await Bun.file(`${homedir()}/.unico/unitech/auth.json`)
  .text()
  .then((value) => JSON.parse(value));

const authorizedClientsResponse = await fetch(
  "http://localhost:3000/auth/enabled-clients",
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

const tokenResponse = await fetch("http://localhost:3000/auth/token", {
  method: "POST",
  body: JSON.stringify({ ...auth, idClient: client.id }),
  headers: { "Content-Type": "application/json" },
});

const { accessToken } = (await tokenResponse.json()) as { accessToken: string };
await Bun.file(`${homedir()}/.unico/unitech/token`).write(accessToken);

console.log(`Token for client ${client.name} saved to ~/.unico/unitech/token`);

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
