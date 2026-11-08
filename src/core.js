/**
 * Pure Sudoku logic shared by the browser view.
 *
 * The generator starts from a complete, randomly permuted grid and removes
 * clues one at a time while a counting solver still finds exactly one
 * solution.  The result is therefore guaranteed to be solvable and have a
 * unique answer.  Puzzles are generated to 27 clues; if a generated board is
 * solvable using naked singles only, another attempt is made so the result is
 * not trivially easy.
 */

export const SIZE = 9;
export const CELLS = 81;
export const DEFAULT_CLUES = 27;
export const STORAGE_KEY = 'dsh-sudoku-waiting-v2';
export const LEGACY_STORAGE_KEYS = ['dsh-sudoku-waiting-v1'];

const ALL_DIGITS = 0x1ff;

/** Digits 1..9 as one-bit masks. */
const DIGIT_BITS = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];

function bitFor(value) {
  return DIGIT_BITS[value] || 0;
}

function valueForBit(bit) {
  return 32 - Math.clz32(bit);
}

function countBits(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count += 1;
  }
  return count;
}

function rowOf(index) {
  return Math.floor(index / 9);
}

function colOf(index) {
  return index % 9;
}

function boxOf(index) {
  return Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);
}

function shuffled(values, rng) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function makeMasks(board) {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < CELLS; i += 1) {
    const value = board[i];
    if (!value) continue;
    const bit = bitFor(value);
    rows[rowOf(i)] |= bit;
    cols[colOf(i)] |= bit;
    boxes[boxOf(i)] |= bit;
  }
  return { rows, cols, boxes };
}

/**
 * Count solutions up to `limit` using a bit-mask MRV backtracker.
 * Returns 0 for an invalid or contradictory board.
 */
export function countSolutions(board, limit = 2) {
  if (!Array.isArray(board) || board.length !== CELLS) return 0;
  const cells = new Array(CELLS);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  let empty = 0;
  for (let i = 0; i < CELLS; i += 1) {
    const value = Number(board[i]) | 0;
    if (value < 0 || value > 9) return 0;
    cells[i] = value;
    if (!value) {
      empty += 1;
      continue;
    }
    const bit = bitFor(value);
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0;
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }
  if (empty === 0) return 1;

  let solutions = 0;

  function search() {
    if (solutions >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i += 1) {
      if (cells[i]) continue;
      const r = rowOf(i);
      const c = colOf(i);
      const b = boxOf(i);
      const mask = ALL_DIGITS & ~(rows[r] | cols[c] | boxes[b]);
      if (!mask) return;
      const n = countBits(mask);
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      solutions += 1;
      return;
    }
    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      mask -= bit;
      cells[best] = valueForBit(bit);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      search();
      cells[best] = 0;
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
      if (solutions >= limit) return;
    }
  }

  search();
  return solutions;
}

/** True when the puzzle is a valid complete grid. */
export function isValidSolution(board) {
  if (!Array.isArray(board) || board.length !== CELLS) return false;
  const used = new Set();
  for (const value of board) {
    if (!Number.isInteger(value) || value < 1 || value > 9) return false;
    used.add(value);
  }
  if (used.size !== 9) return false;
  return countSolutions(board, 1) === 1;
}

/** Produce one random complete Sudoku grid. */
export function generateSolution(rng = Math.random) {
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const bandOrder = shuffled([0, 1, 2], rng);
  const stackOrder = shuffled([0, 1, 2], rng);
  const innerRows = bandOrder.map(() => shuffled([0, 1, 2], rng));
  const innerCols = stackOrder.map(() => shuffled([0, 1, 2], rng));

  const rowOrder = [];
  for (const band of bandOrder) {
    for (const offset of innerRows[band]) rowOrder.push(band * 3 + offset);
  }
  const colOrder = [];
  for (const stack of stackOrder) {
    for (const offset of innerCols[stack]) colOrder.push(stack * 3 + offset);
  }

  const board = new Array(CELLS).fill(0);
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const pattern = (r * 3 + Math.floor(r / 3) + c) % 9;
      board[rowOrder[r] * 9 + colOrder[c]] = digits[pattern];
    }
  }
  return board;
}

/**
 * True when naked singles alone finish the puzzle.  Used only as a difficulty
 * filter so a generated game is not trivially easy.
 */
export function isNakedSinglesSolvable(board) {
  const cells = board.slice();
  const masks = makeMasks(cells);
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < CELLS; i += 1) {
      if (cells[i]) continue;
      const mask = ALL_DIGITS & ~(
        masks.rows[rowOf(i)] | masks.cols[colOf(i)] | masks.boxes[boxOf(i)]
      );
      if (!mask) return false;
      if (countBits(mask) === 1) {
        const value = valueForBit(mask);
        const bit = bitFor(value);
        cells[i] = value;
        masks.rows[rowOf(i)] |= bit;
        masks.cols[colOf(i)] |= bit;
        masks.boxes[boxOf(i)] |= bit;
        progress = true;
      }
    }
  }
  return cells.every(Boolean);
}

/**
 * Remove clues from a full grid while preserving a unique solution.
 * Returns `{ puzzle, solution, clues }`; `clues` can exceed the target when no
 * further clue can be removed safely.
 */
export function carvePuzzle(solution, targetClues = DEFAULT_CLUES, rng = Math.random) {
  const puzzle = solution.slice();
  const order = shuffled(Array.from({ length: CELLS }, (_, index) => index), rng);
  let clues = CELLS;
  for (const index of order) {
    if (clues <= targetClues) break;
    const saved = puzzle[index];
    if (!saved) continue;
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues -= 1;
    } else {
      puzzle[index] = saved;
    }
  }
  return { puzzle, solution: solution.slice(), clues };
}

/**
 * Generate a unique, non-trivial puzzle.  A handful of attempts are allowed
 * because the singles check occasionally rejects a perfectly valid but easy
 * board.
 */
export function generatePuzzle(options = {}) {
  const rng = options.rng || Math.random;
  const targetClues = options.targetClues || DEFAULT_CLUES;
  const attempts = options.attempts || 5;
  let best = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const solution = generateSolution(rng);
    const carved = carvePuzzle(solution, targetClues, rng);
    if (!best || carved.clues < best.clues) best = carved;
    if (carved.clues <= targetClues && !isNakedSinglesSolvable(carved.puzzle)) {
      return carved;
    }
  }

  if (best) return best;
  // The generator above is effectively exhaustive for its inputs, but keep a
  // deterministic escape hatch so a caller can never receive `undefined`.
  const solution = generateSolution(rng);
  return carvePuzzle(solution, 81, rng);
}

/** Count how many of the 81 positions hold a value. */
export function filledCount(values) {
  let count = 0;
  for (const value of values) if (value) count += 1;
  return count;
}

/** Return the set of indexes that share a digit with another cell in a unit. */
export function computeConflicts(values) {
  const conflicts = new Set();
  const units = [];
  for (let r = 0; r < 9; r += 1) {
    const unit = [];
    for (let c = 0; c < 9; c += 1) unit.push(r * 9 + c);
    units.push(unit);
  }
  for (let c = 0; c < 9; c += 1) {
    const unit = [];
    for (let r = 0; r < 9; r += 1) unit.push(r * 9 + c);
    units.push(unit);
  }
  for (let br = 0; br < 3; br += 1) {
    for (let bc = 0; bc < 3; bc += 1) {
      const unit = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          unit.push((br * 3 + r) * 9 + (bc * 3 + c));
        }
      }
      units.push(unit);
    }
  }

  for (const unit of units) {
    const byDigit = new Map();
    for (const index of unit) {
      const value = values[index];
      if (!value) continue;
      let list = byDigit.get(value);
      if (!list) {
        list = [];
        byDigit.set(value, list);
      }
      list.push(index);
    }
    for (const list of byDigit.values()) {
      if (list.length > 1) for (const index of list) conflicts.add(index);
    }
  }
  return conflicts;
}

/** Build the current 81-cell value grid from givens and user input. */
export function currentValues(puzzle, inputs) {
  const values = new Array(CELLS);
  for (let i = 0; i < CELLS; i += 1) {
    values[i] = puzzle[i] || inputs[i] || 0;
  }
  return values;
}

/** True when every cell is filled and the grid is a valid solved Sudoku. */
export function isComplete(values) {
  return values.every(Boolean) && computeConflicts(values).size === 0;
}

/** Normalize exclusions to sorted unique digits in 1..9. */
export function normalizeExclusions(raw) {
  if (!Array.isArray(raw) || raw.length !== CELLS) return null;
  const result = [];
  for (const list of raw) {
    if (!Array.isArray(list)) return null;
    const next = [];
    for (const value of list) {
      if (!Number.isInteger(value) || value < 1 || value > 9) return null;
      if (!next.includes(value)) next.push(value);
    }
    next.sort((a, b) => a - b);
    result.push(next);
  }
  return result;
}

/** Validate a saved game before resuming it. */
export function validateGame(raw) {
  if (!raw || raw.version !== 1) return null;
  if (!Array.isArray(raw.puzzle) || raw.puzzle.length !== CELLS) return null;
  if (!Array.isArray(raw.solution) || raw.solution.length !== CELLS) return null;
  if (!Array.isArray(raw.inputs) || raw.inputs.length !== CELLS) return null;
  if (!isValidSolution(raw.solution)) return null;

  const puzzle = [];
  const inputs = [];
  for (let i = 0; i < CELLS; i += 1) {
    const given = Number(raw.puzzle[i]) | 0;
    const answer = Number(raw.solution[i]) | 0;
    if (given < 0 || given > 9) return null;
    if (given && given !== answer) return null;
    puzzle.push(given);

    const input = Number(raw.inputs[i]) | 0;
    if (input < 0 || input > 9) return null;
    inputs.push(given ? 0 : input);
  }

  const exclusions = normalizeExclusions(raw.exclusions);
  if (!exclusions) return null;
  if (countSolutions(puzzle, 2) !== 1) return null;

  return {
    version: 1,
    puzzle,
    solution: raw.solution.slice(),
    inputs,
    exclusions,
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

/** Create a fresh playable game object. */
export function createGame(options = {}) {
  const generated = generatePuzzle(options);
  return {
    version: 1,
    puzzle: generated.puzzle,
    solution: generated.solution,
    inputs: new Array(CELLS).fill(0),
    exclusions: Array.from({ length: CELLS }, () => []),
    createdAt: Date.now(),
  };
}
