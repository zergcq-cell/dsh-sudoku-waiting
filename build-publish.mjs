import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE_FILES, readBundleSource, renderClient } from './scripts/bundle.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, 'publish');
if (!outDir.startsWith(root + path.sep)) {
  throw new Error(`refusing to write outside the workspace: ${outDir}`);
}

const publicName = process.argv[2] || JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
).name;
if (!/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(publicName)) {
  throw new Error(`invalid npm package name: ${publicName}`);
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'locale'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });

fs.writeFileSync(path.join(outDir, 'client.js'), renderClient(publicName, readBundleSource(root)));

const pkg = {
  name: publicName,
  version: rootPkg.version,
  description: rootPkg.description,
  type: 'module',
  license: rootPkg.license,
  author: rootPkg.author,
  repository: rootPkg.repository,
  homepage: rootPkg.homepage,
  bugs: rootPkg.bugs,
  keywords: rootPkg.keywords,
  engines: rootPkg.engines,
  publishConfig: rootPkg.publishConfig,
  exports: rootPkg.exports,
  files: rootPkg.files,
  dsh: rootPkg.dsh,
};
fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

fs.writeFileSync(
  path.join(outDir, 'cordis.patch.yml'),
  `- insert:\n    - id: sudoku-waiting\n      name: ${JSON.stringify(publicName)}\n`,
);

for (const file of ['index.js', 'icon.svg', 'README.md', 'LICENSE', 'CHANGELOG.md']) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}
for (const file of SOURCE_FILES) {
  fs.copyFileSync(path.join(root, file), path.join(outDir, file));
}
fs.copyFileSync(path.join(root, 'locale/en.json'), path.join(outDir, 'locale/en.json'));
fs.copyFileSync(path.join(root, 'locale/zh.json'), path.join(outDir, 'locale/zh.json'));

console.log(`prepared ${path.relative(root, outDir)}/ for ${publicName}@${rootPkg.version}`);
console.log('next: npm pack --dry-run');
console.log('publish: npm publish --access public');
