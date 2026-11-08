import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBundleSource, renderClient } from './scripts/bundle.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = renderClient(pkg.name, readBundleSource(root));

fs.writeFileSync(path.join(root, 'client.js'), output);
console.log(`wrote client.js (${Buffer.byteLength(output)} bytes)`);
