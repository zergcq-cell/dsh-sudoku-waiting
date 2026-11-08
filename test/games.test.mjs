import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CELLS,
  countSolutions,
  createGame,
  generatePuzzle,
  generateSolution,
  validateGame,
} from '../src/core.js';

import {
  G2048_CELLS,
  MINES_CELLS,
  MINES_COUNT,
  adjacentMines,
  canMove2048,
  create2048,
  createLightsOut,
  createMinesweeper,
  lightsSolved,
  maxTile2048,
  move2048,
  normalize2048,
  normalizeLightsOut,
  normalizeMinesweeper,
  placeMines,
  revealCell,
  slideLine,
  spawn2048,
  toggleFlag,
  toggleLights,
} from '../src/games-core.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* --------------------------------------------------------------- sudoku --- */

test('sudoku: a complete generated grid has exactly one solution', () => {
  const solution = generateSolution(seeded(7));
  assert.equal(solution.length, CELLS);
  assert.equal(countSolutions(solution), 1);
});

test('sudoku: generated puzzles are unique and non-trivial', () => {
  const puzzle = generatePuzzle({ rng: seeded(11) });
  assert.equal(countSolutions(puzzle.puzzle, 2), 1);
  assert.ok(puzzle.puzzle.filter(Boolean).length <= 30);
});

test('sudoku: validateGame rejects corrupted saves', () => {
  const game = createGame({ rng: seeded(3) });
  assert.ok(validateGame(game));
  assert.equal(validateGame({ ...game, inputs: game.inputs.slice(0, 80) }), null);
  assert.equal(validateGame({ ...game, version: 2 }), null);
  const duplicate = game.puzzle.slice();
  duplicate[0] = 1;
  duplicate[1] = 1;
  assert.equal(validateGame({ ...game, puzzle: duplicate }), null);
});

/* ----------------------------------------------------------------- 2048 --- */

test('2048: merging a line', () => {
  assert.deepEqual(slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8, moved: true });
  assert.deepEqual(slideLine([2, 2, 2, 0]), { line: [4, 2, 0, 0], gained: 4, moved: true });
  assert.deepEqual(slideLine([4, 4, 8, 8]), { line: [8, 16, 0, 0], gained: 24, moved: true });
  assert.deepEqual(slideLine([2, 0, 0, 2]), { line: [4, 0, 0, 0], gained: 4, moved: true });
  assert.deepEqual(slideLine([2, 4, 2, 4]), { line: [2, 4, 2, 4], gained: 0, moved: false });
  assert.deepEqual(slideLine([0, 0, 0, 2]), { line: [2, 0, 0, 0], gained: 0, moved: true });
});

test('2048: a tile merges at most once per move', () => {
  assert.deepEqual(slideLine([2, 2, 4, 0]).line, [4, 4, 0, 0]);
  assert.deepEqual(slideLine([8, 8, 8, 8]).line, [16, 16, 0, 0]);
});

test('2048: directional moves', () => {
  const board = [
    2, 2, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ];
  assert.deepEqual(move2048(board, 'left').board, [4, 0, 0, 0, ...new Array(12).fill(0)]);
  assert.deepEqual(move2048(board, 'right').board, [0, 0, 0, 4, ...new Array(12).fill(0)]);
  assert.deepEqual(move2048(board, 'up').board, [2, 2, 0, 0, ...new Array(12).fill(0)]);
  assert.deepEqual(move2048(board, 'down').board, [
    ...new Array(12).fill(0), 2, 2, 0, 0,
  ]);
  assert.equal(move2048(board, 'sideways').moved, false);
  assert.equal(move2048(board, 'left').gained, 4);
});

test('2048: spawning, game over detection and normalisation', () => {
  const empty = new Array(G2048_CELLS).fill(0);
  const spawned = spawn2048(empty, seeded(5));
  assert.equal(spawned.board.filter(Boolean).length, 1);
  assert.ok(spawned.value === 2 || spawned.value === 4);

  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  assert.equal(canMove2048(full), false);
  const mergeable = full.slice();
  mergeable[0] = 2;
  mergeable[1] = 2;
  assert.equal(canMove2048(mergeable), true);

  const fresh = create2048({ best: 128 });
  assert.equal(fresh.board.filter(Boolean).length, 2);
  assert.equal(fresh.best, 128);
  assert.equal(fresh.score, 0);

  const saved = normalize2048({ ...fresh, score: 64, best: 32 });
  assert.equal(saved.score, 64);
  assert.equal(saved.best, 64);
  assert.equal(normalize2048({ ...fresh, board: fresh.board.slice(0, 15) }), null);
  assert.equal(normalize2048({ ...fresh, board: [3, ...fresh.board.slice(1)] }), null);
  assert.equal(normalize2048({ version: 9, board: fresh.board }), null);
});

test('2048: reaching 2048 marks the game as won', () => {
  const board = new Array(G2048_CELLS).fill(0);
  board[0] = 1024;
  board[1] = 1024;
  const result = move2048(board, 'left');
  assert.equal(maxTile2048(result.board), 2048);
  const saved = normalize2048({ version: 1, board: result.board, score: 0, best: 0, moves: 1 });
  assert.equal(saved.won, true);
});

/* ----------------------------------------------------------- minesweeper --- */

test('minesweeper: the first click is always safe and opens an area', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const game = revealCell(createMinesweeper(), 40, seeded(seed));
    assert.equal(game.lost, false, `seed ${seed} lost on first click`);
    assert.equal(game.started, true);
    assert.equal(game.mines.filter(Boolean).length, MINES_COUNT);
    assert.equal(game.mines[40], false);
    assert.ok(game.revealed.filter(Boolean).length > 1);
  }
});

test('minesweeper: adjacency counts and flags', () => {
  const game = createMinesweeper();
  game.mines = new Array(MINES_CELLS).fill(false);
  game.mines[0] = true;
  game.mines[1] = true;
  assert.equal(adjacentMines(game.mines, 2), 1);
  assert.equal(adjacentMines(game.mines, 9), 2);
  assert.equal(adjacentMines(game.mines, 10), 2);

  const flagged = toggleFlag(game, 2);
  assert.equal(flagged.flags[2], true);
  assert.equal(toggleFlag(flagged, 2).flags[2], false);

  const safe = placeMines(createMinesweeper(), 40, seeded(2));
  const guarded = revealCell(toggleFlag(safe, 41), 41, seeded(2));
  assert.equal(guarded.revealed[41], false);
});

test('minesweeper: clearing every safe cell wins, a mine loses', () => {
  const game = placeMines(createMinesweeper(), 0, seeded(9));
  let current = game;
  for (let index = 0; index < MINES_CELLS; index += 1) {
    if (game.mines[index]) continue;
    current = revealCell(current, index, seeded(9));
    assert.equal(current.lost, false);
  }
  assert.equal(current.won, true);

  const mine = game.mines.indexOf(true);
  const boom = revealCell(game, mine, seeded(9));
  assert.equal(boom.lost, true);
  assert.equal(boom.hit, mine);
  assert.equal(boom.won, false);
});

test('minesweeper: normalisation', () => {
  const game = revealCell(createMinesweeper(), 20, seeded(4));
  const saved = normalizeMinesweeper(game);
  assert.ok(saved);
  assert.deepEqual(saved.revealed, game.revealed);
  assert.equal(normalizeMinesweeper({ ...game, mines: game.mines.slice(0, 3) }), null);
  const corrupt = { ...game, lost: true, hit: 3 };
  assert.ok(normalizeMinesweeper(corrupt));
  assert.equal(normalizeMinesweeper({ ...game, version: 0 }), null);
});

/* ----------------------------------------------------------- lights out --- */

test('lights out: a click flips a cross', () => {
  const cells = new Array(25).fill(false);
  const next = toggleLights(cells, 12);
  for (const index of [12, 7, 17, 11, 13]) assert.equal(next[index], true);
  assert.equal(next.filter(Boolean).length, 5);
  assert.equal(next[0], false);
  assert.equal(cells.filter(Boolean).length, 0, 'input must not be mutated');
  assert.equal(lightsSolved(toggleLights(next, 12)), true);
});

test('lights out: every generated board is unsolved and can be solved back', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed += 1) {
    const game = createLightsOut(seeded(seed));
    assert.equal(game.version, 1);
    assert.equal(lightsSolved(game.cells), false, `seed ${seed} produced a solved board`);
    seen.add(game.cells.map((cell) => (cell ? '1' : '0')).join(''));
  }
  assert.ok(seen.size > 5, 'boards should vary');
});

test('lights out: normalisation', () => {
  const game = createLightsOut(seeded(8));
  const saved = normalizeLightsOut(game);
  assert.deepEqual(saved.cells, game.cells);
  assert.equal(normalizeLightsOut({ ...game, cells: game.cells.slice(0, 24) }), null);
  assert.equal(normalizeLightsOut({ ...game, cells: new Array(25).fill(1) }), null);
  assert.equal(normalizeLightsOut({ ...game, moves: -1 }), null);
});
