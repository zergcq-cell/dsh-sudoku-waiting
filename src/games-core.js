/**
 * Pure logic for the short waiting games: 2048, Minesweeper and Lights Out.
 *
 * Nothing here touches the DOM, storage or the clock; every function that
 * needs randomness takes an `rng` so tests stay deterministic.  The browser
 * view keeps the returned state in `localStorage` and renders it, so every
 * state object is plain JSON.
 */

/* --------------------------------------------------------------- 2048 --- */

export const G2048_SIZE = 4;
export const G2048_CELLS = G2048_SIZE * G2048_SIZE;
export const G2048_VERSION = 1;
export const G2048_TARGET = 2048;

const G2048_DIRECTIONS = ['left', 'right', 'up', 'down'];

function g2048Empty() {
  return new Array(G2048_CELLS).fill(0);
}

function g2048Coordinate(direction, line, offset) {
  if (direction === 'left') return [line, offset];
  if (direction === 'right') return [line, G2048_SIZE - 1 - offset];
  if (direction === 'up') return [offset, line];
  return [G2048_SIZE - 1 - offset, line];
}

/**
 * Slide and merge one line towards its start.  A tile merges at most once per
 * move, so [2, 2, 2, 2] becomes [4, 4] and not [8].
 */
export function slideLine(line) {
  const compact = [];
  for (const value of line) if (value) compact.push(value);
  const merged = [];
  let gained = 0;
  for (let index = 0; index < compact.length; index += 1) {
    if (index + 1 < compact.length && compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      gained += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }
  while (merged.length < line.length) merged.push(0);
  let moved = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== merged[index]) moved = true;
  }
  return { line: merged, gained, moved };
}

/** Move the whole board.  Returns the next board, score gain and a moved flag. */
export function move2048(board, direction) {
  if (!Array.isArray(board) || board.length !== G2048_CELLS) {
    return { board: g2048Empty(), gained: 0, moved: false };
  }
  if (G2048_DIRECTIONS.indexOf(direction) === -1) {
    return { board: board.slice(), gained: 0, moved: false };
  }
  const next = g2048Empty();
  let gained = 0;
  let moved = false;
  for (let line = 0; line < G2048_SIZE; line += 1) {
    const values = [];
    for (let offset = 0; offset < G2048_SIZE; offset += 1) {
      const [row, col] = g2048Coordinate(direction, line, offset);
      values.push(board[row * G2048_SIZE + col]);
    }
    const slid = slideLine(values);
    if (slid.moved) moved = true;
    gained += slid.gained;
    for (let offset = 0; offset < G2048_SIZE; offset += 1) {
      const [row, col] = g2048Coordinate(direction, line, offset);
      next[row * G2048_SIZE + col] = slid.line[offset];
    }
  }
  return { board: next, gained, moved };
}

/** Put a 2 (90%) or a 4 (10%) in a random empty cell; null when full. */
export function spawn2048(board, rng = Math.random) {
  const empty = [];
  for (let index = 0; index < G2048_CELLS; index += 1) {
    if (!board[index]) empty.push(index);
  }
  if (empty.length === 0) return null;
  const pick = Math.min(empty.length - 1, Math.floor(rng() * empty.length));
  const index = empty[Math.max(0, pick)];
  const next = board.slice();
  next[index] = rng() < 0.9 ? 2 : 4;
  return { board: next, index, value: next[index] };
}

export function canMove2048(board) {
  if (!Array.isArray(board) || board.length !== G2048_CELLS) return false;
  for (let index = 0; index < G2048_CELLS; index += 1) {
    if (!board[index]) return true;
  }
  for (let row = 0; row < G2048_SIZE; row += 1) {
    for (let col = 0; col < G2048_SIZE; col += 1) {
      const value = board[row * G2048_SIZE + col];
      if (col + 1 < G2048_SIZE && board[row * G2048_SIZE + col + 1] === value) return true;
      if (row + 1 < G2048_SIZE && board[(row + 1) * G2048_SIZE + col] === value) return true;
    }
  }
  return false;
}

export function maxTile2048(board) {
  let max = 0;
  for (const value of board) if (value > max) max = value;
  return max;
}

/** A fresh board.  A previous game contributes its `best` score only. */
export function create2048(previous) {
  let board = g2048Empty();
  board = spawn2048(board).board;
  board = spawn2048(board).board;
  const bestFromPrevious = previous && Number(previous.best);
  return {
    version: G2048_VERSION,
    board,
    score: 0,
    best: Number.isFinite(bestFromPrevious) && bestFromPrevious > 0 ? Math.floor(bestFromPrevious) : 0,
    moves: 0,
    won: false,
    over: !canMove2048(board),
  };
}

function isBlankOrPowerOfTwo(value, limit) {
  if (value === 0) return true;
  if (!Number.isInteger(value) || value < 2 || value > limit) return false;
  return (value & (value - 1)) === 0;
}

export function normalize2048(raw) {
  if (!raw || raw.version !== G2048_VERSION) return null;
  if (!Array.isArray(raw.board) || raw.board.length !== G2048_CELLS) return null;
  const board = [];
  for (const value of raw.board) {
    const cell = Number(value);
    if (!isBlankOrPowerOfTwo(cell, 131072)) return null;
    board.push(cell);
  }
  const score = Number(raw.score);
  const best = Number(raw.best);
  const moves = Number(raw.moves);
  if (!Number.isFinite(score) || score < 0 || score > 1e9) return null;
  if (!Number.isFinite(moves) || moves < 0 || moves > 1e7) return null;
  const bestValue = Number.isFinite(best) && best > 0 ? Math.floor(best) : 0;
  return {
    version: G2048_VERSION,
    board,
    score: Math.floor(score),
    best: Math.max(bestValue, Math.floor(score)),
    moves: Math.floor(moves),
    won: Boolean(raw.won) || maxTile2048(board) >= G2048_TARGET,
    over: !canMove2048(board),
  };
}

/* --------------------------------------------------------- Minesweeper --- */

export const MINES_SIZE = 9;
export const MINES_CELLS = MINES_SIZE * MINES_SIZE;
export const MINES_COUNT = 10;
export const MINES_VERSION = 1;

const MINE_NEIGHBORS = (() => {
  const table = [];
  for (let index = 0; index < MINES_CELLS; index += 1) {
    const row = Math.floor(index / MINES_SIZE);
    const col = index % MINES_SIZE;
    const around = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= MINES_SIZE) continue;
        if (nextCol < 0 || nextCol >= MINES_SIZE) continue;
        around.push(nextRow * MINES_SIZE + nextCol);
      }
    }
    table.push(around);
  }
  return table;
})();

function minesEmpty(value) {
  return new Array(MINES_CELLS).fill(value);
}

export function createMinesweeper() {
  return {
    version: MINES_VERSION,
    mines: minesEmpty(false),
    revealed: minesEmpty(false),
    flags: minesEmpty(false),
    started: false,
    lost: false,
    won: false,
    hit: null,
  };
}

export function mineNeighbors(index) {
  return MINE_NEIGHBORS[index] || [];
}

export function adjacentMines(mines, index) {
  let count = 0;
  for (const neighbor of mineNeighbors(index)) if (mines[neighbor]) count += 1;
  return count;
}

/**
 * Lay the mines after the first click, keeping the clicked cell and its eight
 * neighbours clear so the first click always opens an area.
 */
export function placeMines(state, safeIndex, rng = Math.random) {
  const safe = new Set([safeIndex, ...mineNeighbors(safeIndex)]);
  const candidates = [];
  for (let index = 0; index < MINES_CELLS; index += 1) {
    if (!safe.has(index)) candidates.push(index);
  }
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const value = candidates[index];
    candidates[index] = candidates[swap];
    candidates[swap] = value;
  }
  const mines = minesEmpty(false);
  for (let index = 0; index < MINES_COUNT; index += 1) mines[candidates[index]] = true;
  return { ...state, mines, started: true };
}

/** Open one cell (placing mines first when needed) and flood-fill zero areas. */
export function revealCell(state, index, rng = Math.random) {
  if (!state || state.lost || state.won) return state;
  if (!Number.isInteger(index) || index < 0 || index >= MINES_CELLS) return state;
  if (state.flags[index] || state.revealed[index]) return state;

  let next = state.started ? state : placeMines(state, index, rng);

  if (next.mines[index]) {
    return { ...next, lost: true, hit: index };
  }

  const revealed = next.revealed.slice();
  const stack = [index];
  while (stack.length > 0) {
    const current = stack.pop();
    if (revealed[current] || next.mines[current] || next.flags[current]) continue;
    revealed[current] = true;
    if (adjacentMines(next.mines, current) !== 0) continue;
    for (const neighbor of mineNeighbors(current)) {
      if (!revealed[neighbor] && !next.flags[neighbor]) stack.push(neighbor);
    }
  }

  const opened = revealed.filter(Boolean).length;
  return {
    ...next,
    revealed,
    won: opened === MINES_CELLS - MINES_COUNT,
  };
}

export function toggleFlag(state, index) {
  if (!state || state.lost || state.won) return state;
  if (!Number.isInteger(index) || index < 0 || index >= MINES_CELLS) return state;
  if (state.revealed[index]) return state;
  const flags = state.flags.slice();
  flags[index] = !flags[index];
  return { ...state, flags };
}

export function flaggedCount(state) {
  return state ? state.flags.filter(Boolean).length : 0;
}

export function revealedCount(state) {
  return state ? state.revealed.filter(Boolean).length : 0;
}

export function minesweeperCleared(state) {
  return Boolean(state && state.started && !state.lost && revealedCount(state) === MINES_CELLS - MINES_COUNT);
}

function booleanGrid(value) {
  return Array.isArray(value) && value.length === MINES_CELLS && value.every((cell) => typeof cell === 'boolean');
}

export function normalizeMinesweeper(raw) {
  if (!raw || raw.version !== MINES_VERSION) return null;
  if (!booleanGrid(raw.mines) || !booleanGrid(raw.revealed) || !booleanGrid(raw.flags)) return null;
  const started = Boolean(raw.started);
  const mines = raw.mines.slice();
  const revealed = raw.revealed.slice();
  const flags = raw.flags.slice();
  if (started && mines.filter(Boolean).length !== MINES_COUNT) return null;
  if (!started && mines.some(Boolean)) return null;
  for (let index = 0; index < MINES_CELLS; index += 1) {
    if (revealed[index] && flags[index]) return null;
    if (revealed[index] && !started) return null;
  }
  const lost = Boolean(raw.lost) && started;
  const hit = Number.isInteger(raw.hit) && raw.hit >= 0 && raw.hit < MINES_CELLS ? raw.hit : null;
  const won = !lost && started && revealed.filter(Boolean).length === MINES_CELLS - MINES_COUNT;
  return {
    version: MINES_VERSION,
    mines,
    revealed,
    flags,
    started,
    lost,
    won,
    hit: lost ? hit : null,
  };
}

/* ---------------------------------------------------------- Lights Out --- */

export const LIGHTS_SIZE = 5;
export const LIGHTS_CELLS = LIGHTS_SIZE * LIGHTS_SIZE;
export const LIGHTS_VERSION = 1;

const LIGHT_NEIGHBORS = (() => {
  const table = [];
  for (let index = 0; index < LIGHTS_CELLS; index += 1) {
    const row = Math.floor(index / LIGHTS_SIZE);
    const col = index % LIGHTS_SIZE;
    const around = [index];
    if (row > 0) around.push((row - 1) * LIGHTS_SIZE + col);
    if (row + 1 < LIGHTS_SIZE) around.push((row + 1) * LIGHTS_SIZE + col);
    if (col > 0) around.push(row * LIGHTS_SIZE + col - 1);
    if (col + 1 < LIGHTS_SIZE) around.push(row * LIGHTS_SIZE + col + 1);
    table.push(around);
  }
  return table;
})();

function lightsEmpty() {
  return new Array(LIGHTS_CELLS).fill(false);
}

/** Flip one cell and its four orthogonal neighbours. */
export function toggleLights(cells, index) {
  const next = cells.slice();
  for (const neighbor of LIGHT_NEIGHBORS[index] || []) next[neighbor] = !next[neighbor];
  return next;
}

export function lightsSolved(cells) {
  return Array.isArray(cells) && cells.length === LIGHTS_CELLS && cells.every((cell) => !cell);
}

export function litCount(cells) {
  return cells ? cells.filter(Boolean).length : 0;
}

/**
 * Scramble from the solved board, so every puzzle is reachable and therefore
 * always solvable.  The scramble is never empty.
 */
export function createLightsOut(rng = Math.random) {
  let cells = lightsEmpty();
  const steps = 7 + Math.floor(rng() * 7);
  for (let step = 0; step < steps; step += 1) {
    const index = Math.min(LIGHTS_CELLS - 1, Math.floor(rng() * LIGHTS_CELLS));
    cells = toggleLights(cells, index);
  }
  if (lightsSolved(cells)) cells = toggleLights(cells, 0);
  return { version: LIGHTS_VERSION, cells, moves: 0 };
}

export function normalizeLightsOut(raw) {
  if (!raw || raw.version !== LIGHTS_VERSION) return null;
  if (!Array.isArray(raw.cells) || raw.cells.length !== LIGHTS_CELLS) return null;
  if (!raw.cells.every((cell) => typeof cell === 'boolean')) return null;
  const moves = Number(raw.moves);
  if (!Number.isFinite(moves) || moves < 0 || moves > 1e6) return null;
  return { version: LIGHTS_VERSION, cells: raw.cells.slice(), moves: Math.floor(moves) };
}
