import fs from 'node:fs';
import path from 'node:path';

/**
 * The Client bundle is a single plain-JS module body, so the files below are
 * concatenated in dependency order inside one factory scope.  Every file is
 * an ES module in the repository; only the top-level `export` keyword is
 * stripped here.
 */
export const SOURCE_FILES = [
  'src/core.js',
  'src/games-core.js',
  'src/shell.js',
  'src/sudoku-view.js',
  'src/g2048-view.js',
  'src/minesweeper-view.js',
  'src/lightsout-view.js',
  'src/client-factory.js',
];

export function readBundleSource(root) {
  const parts = SOURCE_FILES.map((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const stripped = source.replace(/^export\s+/gm, '');
    if (/^export\s+/m.test(stripped)) {
      throw new Error(`${file} still contains an export after stripping`);
    }
    return stripped;
  });
  return parts.join('\n');
}

export function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => (line ? pad + line : ''))
    .join('\n');
}

export function renderClient(pkgName, source) {
  return `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkgName)},
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;

${indent(source, 4)}
  },
});
`;
}
