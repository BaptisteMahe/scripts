# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Tooling

This repository uses **Bun** as its runtime and package manager. Always use Bun instead of Node.js, npm, or other tools:

- Run scripts: `bun <file>` or `bun run <script-name>`
- Install dependencies: `bun install`
- Build executables: `bun build --compile --target=<target> <file> --outfile <output>`
- Run tests: `bun test`

Bun automatically loads `.env` files, so dotenv is not needed.

### Bun-Specific APIs

When available, prefer Bun's native APIs:
- File I/O: `Bun.file()`, `Bun.write()` instead of `fs.readFile`/`fs.writeFile`
- Shell commands: ``Bun.$`command` `` instead of execa
- Server: `Bun.serve()` instead of express
- Database: `bun:sqlite`, `Bun.sql` (Postgres), `Bun.redis` instead of third-party clients

## Project Structure

This is a collection of CLI utility scripts organized in `src/`, each serving a specific purpose:

### CLI Tools (Executable Scripts)

The following scripts are exposed as CLI commands via `package.json` bin entries:

- **pdf-merger** (`src/pdf-merger/index.ts`): Merges multiple PDF files into one
  - Usage: `bun src/pdf-merger/index.ts -o <output> <input1> <input2> ...`

- **pdf-compressor** (`src/pdf-compressor/index.ts`): Compresses PDF files
  - Usage: `bun src/pdf-compressor/index.ts ...`

- **geojson-converter** (`src/geojson/unico-segment-to-geojson.ts`): Converts Unico segments to GeoJSON

- **ofg-to-geojson** (`src/ofg-to-geojson/index.ts`): Converts OFG (Sygic format) guide points to GeoJSON
  - Handles Sygic's coordinate system (divides by 100,000)
  - Creates both Point features and a LineString feature

- **uauth** (`src/unitech-auth/index.ts`): Authentication CLI for Unitech API
  - Supports `--local`, `--dev`, `--pre-prod`, `--prod` flags
  - Reads credentials from `~/.unico/unitech/auth.json`
  - Saves access tokens to `~/.unico/unitech/token`

- **ucall** (`src/unitech-call/index.ts`): Makes authenticated HTTP calls to Unitech API
  - Usage: `bun src/unitech-call/index.ts [--env] <endpoint> [METHOD] [body]`
  - Reads token from `~/.unico/unitech/token`

### Development Scripts

- **migrate-to-nest** (`src/migrate-to-nest/index.ts`): AST-based migration tool using ts-morph
  - Analyzes Express router structure and extracts controller endpoints
  - Works with TypeScript ASTs to parse Express patterns and infer types

### Shared Utilities

- **pbcopy** (`src/shared/pbcopy.ts`): macOS clipboard utility using `spawn("pbcopy")`

## Development Commands

```bash
# Install dependencies
bun install

# Run any script
bun <path-to-script>

# Run named scripts from package.json
bun run migrate-to-nest

# Build a Windows executable (example)
bun run pdf-merger:build:windows
```

## Code Patterns

### CLI Script Structure

Most CLI scripts follow this pattern:

1. Shebang: `#! /usr/bin/env bun`
2. Argument parsing with `yargs` and `zod` validation
3. Business logic using Bun APIs
4. Performance tracking with `performance.now()`

Example:
```typescript
const argSchema = z.object({
  _: z.string().array(),
  o: z.string(),
});

const { success, data, error } = await argSchema.safeParseAsync(
  yargs(hideBin(process.argv)).parse()
);

if (!success) {
  console.error(error);
  throw new Error("Usage message");
}
```

### Environment-Based API URLs

Scripts that call external APIs (uauth, ucall) use environment flags to select base URLs:
- `--local`: `http://localhost:3000`
- `--dev`: `https://api.dev.unicofrance.com`
- `--pre-prod`: `https://api.pre-prod.unicofrance.com`
- `--prod`: `https://api.prod.unicofrance.com`

Default is `--local`.

## TypeScript Configuration

- Target: ESNext with modern features
- Module: Preserve (Bundler mode)
- Strict mode enabled with additional strict flags
- `noUncheckedIndexedAccess`, `noImplicitOverride` enabled
- `allowImportingTsExtensions` for TypeScript imports

## Dependencies

Key dependencies:
- **yargs**: CLI argument parsing
- **zod**: Runtime type validation and schema parsing
- **ts-morph**: TypeScript AST manipulation (for code migration tools)
- **pdf-merger-js**: PDF manipulation
- **fast-csv**: CSV processing
- **lodash**: Utility functions