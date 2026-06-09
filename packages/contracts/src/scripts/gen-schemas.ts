// gen:schemas — write the emitted JSON Schemas to dist/schemas/*.json.
// Run AFTER `tsc` build (the package.json script chains build → this).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSON_SCHEMA_TARGETS, toJsonSchema } from '../schemas.js';

const here = dirname(fileURLToPath(import.meta.url)); // dist/scripts
const outDir = join(here, '..', 'schemas'); // dist/schemas
mkdirSync(outDir, { recursive: true });

for (const name of Object.keys(JSON_SCHEMA_TARGETS)) {
  const schema = toJsonSchema(name as keyof typeof JSON_SCHEMA_TARGETS);
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, JSON.stringify(schema, null, 2) + '\n');
   
  console.log(`wrote ${file}`);
}
