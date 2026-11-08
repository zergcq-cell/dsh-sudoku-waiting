window.__ModuleLoader__.load({
  id: "dsh-sudoku-waiting",
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;

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

    const SIZE = 9;
    const CELLS = 81;
    const DEFAULT_CLUES = 27;
    const STORAGE_KEY = 'dsh-sudoku-waiting-v2';
    const LEGACY_STORAGE_KEYS = ['dsh-sudoku-waiting-v1'];

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
    function countSolutions(board, limit = 2) {
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
    function isValidSolution(board) {
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
    function generateSolution(rng = Math.random) {
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
    function isNakedSinglesSolvable(board) {
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
    function carvePuzzle(solution, targetClues = DEFAULT_CLUES, rng = Math.random) {
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
    function generatePuzzle(options = {}) {
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
    function filledCount(values) {
      let count = 0;
      for (const value of values) if (value) count += 1;
      return count;
    }

    /** Return the set of indexes that share a digit with another cell in a unit. */
    function computeConflicts(values) {
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
    function currentValues(puzzle, inputs) {
      const values = new Array(CELLS);
      for (let i = 0; i < CELLS; i += 1) {
        values[i] = puzzle[i] || inputs[i] || 0;
      }
      return values;
    }

    /** True when every cell is filled and the grid is a valid solved Sudoku. */
    function isComplete(values) {
      return values.every(Boolean) && computeConflicts(values).size === 0;
    }

    /** Normalize exclusions to sorted unique digits in 1..9. */
    function normalizeExclusions(raw) {
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
    function validateGame(raw) {
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
    function createGame(options = {}) {
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

    /**
     * Pure logic for the short waiting games: 2048, Minesweeper and Lights Out.
     *
     * Nothing here touches the DOM, storage or the clock; every function that
     * needs randomness takes an `rng` so tests stay deterministic.  The browser
     * view keeps the returned state in `localStorage` and renders it, so every
     * state object is plain JSON.
     */

    /* --------------------------------------------------------------- 2048 --- */

    const G2048_SIZE = 4;
    const G2048_CELLS = G2048_SIZE * G2048_SIZE;
    const G2048_VERSION = 1;
    const G2048_TARGET = 2048;

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
    function slideLine(line) {
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
    function move2048(board, direction) {
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
    function spawn2048(board, rng = Math.random) {
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

    function canMove2048(board) {
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

    function maxTile2048(board) {
      let max = 0;
      for (const value of board) if (value > max) max = value;
      return max;
    }

    /** A fresh board.  A previous game contributes its `best` score only. */
    function create2048(previous) {
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

    function normalize2048(raw) {
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

    const MINES_SIZE = 9;
    const MINES_CELLS = MINES_SIZE * MINES_SIZE;
    const MINES_COUNT = 10;
    const MINES_VERSION = 1;

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

    function createMinesweeper() {
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

    function mineNeighbors(index) {
      return MINE_NEIGHBORS[index] || [];
    }

    function adjacentMines(mines, index) {
      let count = 0;
      for (const neighbor of mineNeighbors(index)) if (mines[neighbor]) count += 1;
      return count;
    }

    /**
     * Lay the mines after the first click, keeping the clicked cell and its eight
     * neighbours clear so the first click always opens an area.
     */
    function placeMines(state, safeIndex, rng = Math.random) {
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
    function revealCell(state, index, rng = Math.random) {
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

    function toggleFlag(state, index) {
      if (!state || state.lost || state.won) return state;
      if (!Number.isInteger(index) || index < 0 || index >= MINES_CELLS) return state;
      if (state.revealed[index]) return state;
      const flags = state.flags.slice();
      flags[index] = !flags[index];
      return { ...state, flags };
    }

    function flaggedCount(state) {
      return state ? state.flags.filter(Boolean).length : 0;
    }

    function revealedCount(state) {
      return state ? state.revealed.filter(Boolean).length : 0;
    }

    function minesweeperCleared(state) {
      return Boolean(state && state.started && !state.lost && revealedCount(state) === MINES_CELLS - MINES_COUNT);
    }

    function booleanGrid(value) {
      return Array.isArray(value) && value.length === MINES_CELLS && value.every((cell) => typeof cell === 'boolean');
    }

    function normalizeMinesweeper(raw) {
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

    const LIGHTS_SIZE = 5;
    const LIGHTS_CELLS = LIGHTS_SIZE * LIGHTS_SIZE;
    const LIGHTS_VERSION = 1;

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
    function toggleLights(cells, index) {
      const next = cells.slice();
      for (const neighbor of LIGHT_NEIGHBORS[index] || []) next[neighbor] = !next[neighbor];
      return next;
    }

    function lightsSolved(cells) {
      return Array.isArray(cells) && cells.length === LIGHTS_CELLS && cells.every((cell) => !cell);
    }

    function litCount(cells) {
      return cells ? cells.filter(Boolean).length : 0;
    }

    /**
     * Scramble from the solved board, so every puzzle is reachable and therefore
     * always solvable.  The scramble is never empty.
     */
    function createLightsOut(rng = Math.random) {
      let cells = lightsEmpty();
      const steps = 7 + Math.floor(rng() * 7);
      for (let step = 0; step < steps; step += 1) {
        const index = Math.min(LIGHTS_CELLS - 1, Math.floor(rng() * LIGHTS_CELLS));
        cells = toggleLights(cells, index);
      }
      if (lightsSolved(cells)) cells = toggleLights(cells, 0);
      return { version: LIGHTS_VERSION, cells, moves: 0 };
    }

    function normalizeLightsOut(raw) {
      if (!raw || raw.version !== LIGHTS_VERSION) return null;
      if (!Array.isArray(raw.cells) || raw.cells.length !== LIGHTS_CELLS) return null;
      if (!raw.cells.every((cell) => typeof cell === 'boolean')) return null;
      const moves = Number(raw.moves);
      if (!Number.isFinite(moves) || moves < 0 || moves > 1e6) return null;
      return { version: LIGHTS_VERSION, cells: raw.cells.slice(), moves: Math.floor(moves) };
    }

    /**
     * The shared waiting-game card: header, game switcher, loading/error states,
     * persistence and the collapsed "continue" affordance.
     *
     * A game is a plain object (see GAME_DEFS in client-factory.js) so adding one
     * never touches the conversation-node plumbing:
     *
     *   { id, titleKey, hintKey, helpKey, css, heavy?, legacyKeys?,
     *     create(previous), load(raw), hasProgress(state),
     *     progress(state, t), status(state, t) | null, Component }
     */

    const SHELL_CSS = `
    .dsh-games-inline {
      width: 100%;
      margin: 8px auto 2px;
      display: flex;
      justify-content: center;
    }
    .dsh-games-card {
      position: relative;
      box-sizing: border-box;
      width: min(100%, 336px);
      padding: 10px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 14px;
      background: var(--dsw-alias-bg-layer-1);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      color: var(--dsw-alias-label-primary);
      font-family: inherit;
      overflow: visible;
    }
    .dsh-games-header {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 8px;
    }
    .dsh-games-title-button {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .dsh-games-title-button:hover .dsh-games-title {
      color: var(--dsw-alias-brand-primary);
    }
    .dsh-games-title-button:focus-visible {
      outline: 2px solid var(--dsw-alias-brand-primary);
      outline-offset: 2px;
    }
    .dsh-games-title {
      font-size: 12px;
      font-weight: 650;
      line-height: 1.2;
      color: var(--dsw-alias-label-primary);
      white-space: nowrap;
    }
    .dsh-games-chevron {
      font-size: 8px;
      line-height: 1;
      color: var(--dsw-alias-label-secondary);
    }
    .dsh-games-dot {
      width: 6px;
      height: 6px;
      flex: none;
      border-radius: 50%;
      background: var(--dsw-alias-brand-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
      animation: dsh-games-pulse 1.4s ease-in-out infinite;
    }
    .dsh-games-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 5px;
      flex: none;
    }
    .dsh-games-button {
      box-sizing: border-box;
      height: 24px;
      padding: 0 7px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 7px;
      background: transparent;
      color: var(--dsw-alias-label-secondary);
      font: inherit;
      font-size: 10.5px;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
    }
    .dsh-games-button:hover:not(:disabled) {
      background: var(--dsw-alias-bg-layer-2);
      color: var(--dsw-alias-label-primary);
    }
    .dsh-games-button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .dsh-games-button.is-confirm {
      border-color: var(--dsw-alias-state-warn-primary);
      color: var(--dsw-alias-state-warn-primary);
    }
    .dsh-games-icon-button {
      width: 24px;
      padding: 0;
      font-size: 16px;
      line-height: 20px;
    }
    .dsh-games-menu {
      position: absolute;
      z-index: 60;
      top: 36px;
      left: 8px;
      min-width: 172px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border: 1px solid var(--dsw-alias-border-l2);
      border-radius: 10px;
      background: var(--dsw-alias-bg-overlay);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
    }
    .dsh-games-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 11.5px;
      line-height: 1.2;
      text-align: left;
      cursor: pointer;
    }
    .dsh-games-menu-item:hover {
      background: var(--dsw-alias-bg-layer-2);
    }
    .dsh-games-menu-item[aria-checked="true"] {
      color: var(--dsw-alias-brand-primary);
    }
    .dsh-games-menu-hint {
      margin-left: auto;
      color: var(--dsw-alias-label-secondary);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }
    .dsh-games-menu-check {
      width: 10px;
      flex: none;
      color: var(--dsw-alias-brand-primary);
      font-size: 10px;
      line-height: 1;
      text-align: center;
    }
    .dsh-games-body {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
    }
    .dsh-games-loading {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 9px;
      padding: 16px;
      color: var(--dsw-alias-label-secondary);
      font-size: 11.5px;
      text-align: center;
    }
    .dsh-games-spinner {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--dsw-alias-border-l2);
      border-top-color: var(--dsw-alias-brand-primary);
      animation: dsh-games-spin 0.9s linear infinite;
    }
    .dsh-games-retry {
      margin-top: 2px;
    }
    .dsh-games-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      min-height: 13px;
      font-size: 10px;
      line-height: 1.3;
      color: var(--dsw-alias-label-secondary);
    }
    .dsh-games-help {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dsh-games-status {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .dsh-games-status[data-tone="success"] {
      color: var(--dsw-alias-state-success-primary);
    }
    .dsh-games-status[data-tone="error"] {
      color: var(--dsw-alias-state-error-primary);
    }
    .dsh-games-status[data-tone="warn"] {
      color: var(--dsw-alias-state-warn-primary);
    }
    .dsh-games-progress {
      flex: none;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .dsh-games-resume-wrap {
      width: 100%;
      display: flex;
      justify-content: center;
      margin: 6px 0 2px;
    }
    .dsh-games-resume {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 999px;
      background: var(--dsw-alias-bg-layer-1);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: 11.5px;
      cursor: pointer;
    }
    .dsh-games-resume:hover {
      background: var(--dsw-alias-bg-layer-2);
    }
    .dsh-games-resume-icon {
      display: grid;
      grid-template-columns: repeat(3, 4px);
      grid-template-rows: repeat(3, 4px);
      gap: 1px;
    }
    .dsh-games-resume-icon > span {
      width: 4px;
      height: 4px;
      border-radius: 1px;
      background: var(--dsw-alias-brand-primary);
      opacity: 0.28;
    }
    .dsh-games-resume-icon > span:nth-child(2n) {
      opacity: 0.82;
    }
    @keyframes dsh-games-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes dsh-games-pulse {
      0%, 100% { opacity: 0.45; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .dsh-games-dot,
      .dsh-games-spinner {
        animation: none;
      }
    }
    `;

    const GAMES_STORAGE_PREFIX = 'dsh-games:';
    const GAMES_STORAGE_SUFFIX = '-v1';
    const GAMES_LAST_KEY = 'dsh-games:last';

    function storageRead(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function storageWrite(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        // A failed write must not break the game.
      }
    }

    function gameStorageKey(def) {
      return GAMES_STORAGE_PREFIX + def.id + GAMES_STORAGE_SUFFIX;
    }

    function readLastGameId(defs) {
      const stored = storageRead(GAMES_LAST_KEY);
      return defs.some((def) => def.id === stored) ? stored : defs[0].id;
    }

    /** Read the namespaced game, then its pre-multi-game keys; null when absent. */
    function readGameState(def) {
      const keys = [gameStorageKey(def)].concat(def.legacyKeys || []);
      for (const key of keys) {
        const raw = storageRead(key);
        if (!raw) continue;
        try {
          const state = def.load(JSON.parse(raw));
          if (state) return state;
        } catch (error) {
          // Corrupt entries are ignored; a fresh game is created instead.
        }
      }
      return null;
    }

    function writeGameState(def, state) {
      storageWrite(gameStorageKey(def), JSON.stringify(state));
    }

    function createWaitingGames(defs) {
      const styles = [SHELL_CSS]
        .concat(defs.map((def) => def.css || ''))
        .join('\n');

      return function WaitingGamesNode(props) {
        const { useSession, useSessionStatus, sessionId } = props;
        const translate = typeof props.t === 'function' ? props.t : (key) => key;
        const t = (key, params) => translate(key, params);

        const running = useSession((snapshot) => snapshot.running === true);
        const pendingInteraction = useSessionStatus((snapshot) => {
          if (!sessionId) return false;
          return snapshot.get(sessionId)?.pendingInteraction !== undefined;
        });
        const active = running && !pendingInteraction;

        const [open, setOpen] = useState(active);
        const [activeId, setActiveId] = useState(() => readLastGameId(defs));
        const [states, setStates] = useState({});
        const [loading, setLoading] = useState(false);
        const [failed, setFailed] = useState(false);
        const [menuOpen, setMenuOpen] = useState(false);
        const [confirmNew, setConfirmNew] = useState(false);
        const [retryTick, setRetryTick] = useState(0);

        const bodyRef = useRef(null);
        const menuRef = useRef(null);
        const menuButtonRef = useRef(null);
        const escapeRef = useRef(null);
        const confirmTimer = useRef(null);
        const creatingRef = useRef(false);
        const aliveRef = useRef(true);
        const wasActive = useRef(false);

        const def = defs.find((item) => item.id === activeId) || defs[0];
        const state = states[def.id] || null;

        useEffect(() => {
          aliveRef.current = true;
          return () => {
            aliveRef.current = false;
          };
        }, []);

        useEffect(() => {
          if (active && !wasActive.current) setOpen(true);
          if (!active) {
            setOpen(false);
            setMenuOpen(false);
            setConfirmNew(false);
          }
          wasActive.current = active;
        }, [active]);

        useEffect(() => {
          storageWrite(GAMES_LAST_KEY, activeId);
        }, [activeId]);

        useEffect(() => {
          if (!state) return;
          writeGameState(def, state);
        }, [def, state]);

        // Load the active game, or create it.  Sudoku generation is heavy enough
        // to yield one frame first; the other games are created synchronously.
        useEffect(() => {
          if (!active || !open || state || failed) return undefined;
          if (creatingRef.current) return undefined;
          const current = def;

          const stored = readGameState(current);
          if (stored) {
            setStates((previous) =>
              previous[current.id] ? previous : { ...previous, [current.id]: stored },
            );
            return undefined;
          }

          if (!current.heavy) {
            try {
              const next = current.create(null);
              setStates((previous) =>
                previous[current.id] ? previous : { ...previous, [current.id]: next },
              );
            } catch (error) {
              setFailed(true);
            }
            return undefined;
          }

          creatingRef.current = true;
          setLoading(true);
          let disposed = false;
          const timer = setTimeout(() => {
            creatingRef.current = false;
            if (disposed || !aliveRef.current) return;
            try {
              const next = current.create(null);
              setStates((previous) =>
                previous[current.id] ? previous : { ...previous, [current.id]: next },
              );
              setFailed(false);
            } catch (error) {
              setFailed(true);
            } finally {
              if (!disposed) setLoading(false);
            }
          }, 20);
          return () => {
            disposed = true;
            creatingRef.current = false;
            clearTimeout(timer);
          };
        }, [active, open, def, state, failed, retryTick]);

        useEffect(() => {
          return () => {
            clearTimeout(confirmTimer.current);
          };
        }, []);

        useEffect(() => {
          if (!menuOpen) return undefined;
          function onPointerDown(event) {
            if (menuRef.current && menuRef.current.contains(event.target)) return;
            if (menuButtonRef.current && menuButtonRef.current.contains(event.target)) return;
            setMenuOpen(false);
          }
          document.addEventListener('pointerdown', onPointerDown, true);
          return () => document.removeEventListener('pointerdown', onPointerDown, true);
        }, [menuOpen]);

        useEffect(() => {
          if (!open) return undefined;
          function onKeyDown(event) {
            if (event.key !== 'Escape') return;
            if (menuOpen) {
              setMenuOpen(false);
              return;
            }
            if (escapeRef.current && escapeRef.current() === true) return;
            setOpen(false);
            setConfirmNew(false);
          }
          document.addEventListener('keydown', onKeyDown);
          return () => document.removeEventListener('keydown', onKeyDown);
        }, [open, menuOpen]);

        function updateState(next) {
          if (!next) return;
          setStates((previous) => ({ ...previous, [def.id]: next }));
          // Persist immediately: the node can unmount the moment the turn ends.
          writeGameState(def, next);
        }

        function hideCard() {
          clearTimeout(confirmTimer.current);
          setConfirmNew(false);
          setMenuOpen(false);
          setOpen(false);
        }

        function resetGame() {
          clearTimeout(confirmTimer.current);
          setConfirmNew(false);
          setFailed(false);
          const current = def;
          if (current.heavy) {
            setStates((previous) => {
              if (!previous[current.id]) return previous;
              const next = { ...previous };
              delete next[current.id];
              return next;
            });
            setRetryTick((value) => value + 1);
            return;
          }
          try {
            const next = current.create(state);
            setStates((previous) => ({ ...previous, [current.id]: next }));
          } catch (error) {
            setFailed(true);
          }
        }

        function requestNewGame() {
          if (!state) {
            setFailed(false);
            setRetryTick((value) => value + 1);
            return;
          }
          if (confirmNew) {
            resetGame();
            return;
          }
          if (!def.hasProgress || !def.hasProgress(state)) {
            resetGame();
            return;
          }
          setConfirmNew(true);
          clearTimeout(confirmTimer.current);
          confirmTimer.current = setTimeout(() => setConfirmNew(false), 2800);
        }

        function selectGame(id) {
          setMenuOpen(false);
          if (id === activeId) return;
          setConfirmNew(false);
          setFailed(false);
          setLoading(false);
          setActiveId(id);
        }

        if (!active) return null;

        const style = h('style', { key: 'dsh-games-style' }, styles);
        const status = state && def.status ? def.status(state, t) : null;

        if (!open) {
          return h(
            React.Fragment,
            null,
            style,
            h(
              'div',
              { className: 'dsh-games-resume-wrap' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-games-resume',
                  onClick: () => setOpen(true),
                  title: t('open'),
                  'aria-label': t('open'),
                },
                h(
                  'span',
                  { className: 'dsh-games-resume-icon', 'aria-hidden': 'true' },
                  Array.from({ length: 9 }, (_, index) => h('span', { key: index })),
                ),
                t('continue'),
              ),
            ),
          );
        }

        let content = null;
        if (state) {
          content = h(def.Component, {
            key: def.id,
            state,
            onChange: updateState,
            t,
            bodyRef,
            escapeRef,
          });
        } else if (failed) {
          content = h(
            'div',
            { className: 'dsh-games-loading', role: 'alert' },
            h('span', null, t('error')),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-games-button dsh-games-retry',
                onClick: () => {
                  setFailed(false);
                  setRetryTick((value) => value + 1);
                },
              },
              t('retry'),
            ),
          );
        } else {
          content = h(
            'div',
            { className: 'dsh-games-loading', role: 'status' },
            h('span', { className: 'dsh-games-spinner', 'aria-hidden': 'true' }),
            h('span', null, t('loading')),
          );
        }

        return h(
          React.Fragment,
          null,
          style,
          h(
            'div',
            { className: 'dsh-games-inline' },
            h(
              'section',
              {
                className: 'dsh-games-card',
                role: 'region',
                'aria-label': t('title'),
                'data-dsh-games-card': 'true',
              },
              h(
                'div',
                { className: 'dsh-games-header' },
                h(
                  'button',
                  {
                    ref: menuButtonRef,
                    type: 'button',
                    className: 'dsh-games-title-button',
                    onClick: () => setMenuOpen((value) => !value),
                    title: t('switchGame'),
                    'aria-haspopup': 'menu',
                    'aria-expanded': menuOpen ? 'true' : 'false',
                  },
                  h('span', { className: 'dsh-games-title' }, t('title')),
                  h('span', { className: 'dsh-games-chevron', 'aria-hidden': 'true' }, '▾'),
                ),
                h('span', { className: 'dsh-games-dot', 'aria-hidden': 'true' }),
                h(
                  'div',
                  { className: 'dsh-games-actions' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: `dsh-games-button${confirmNew ? ' is-confirm' : ''}`,
                      onClick: requestNewGame,
                      disabled: loading && !state,
                      title: confirmNew ? t('confirmNewTitle') : t('newGameTitle'),
                    },
                    confirmNew ? t('confirmNew') : t('newGame'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-games-button dsh-games-icon-button',
                      onClick: hideCard,
                      title: t('close'),
                      'aria-label': t('close'),
                    },
                    '×',
                  ),
                ),
              ),
              menuOpen
                ? h(
                    'div',
                    { ref: menuRef, className: 'dsh-games-menu', role: 'menu', 'aria-label': t('switchGame') },
                    defs.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          type: 'button',
                          role: 'menuitemradio',
                          'aria-checked': item.id === activeId ? 'true' : 'false',
                          className: 'dsh-games-menu-item',
                          onClick: () => selectGame(item.id),
                        },
                        h('span', null, t(item.titleKey)),
                        h('span', { className: 'dsh-games-menu-hint' }, t(item.hintKey)),
                        item.id === activeId
                          ? h('span', { className: 'dsh-games-menu-check', 'aria-hidden': 'true' }, '✓')
                          : null,
                      ),
                    ),
                  )
                : null,
              h('div', { className: 'dsh-games-body', ref: bodyRef }, content),
              h(
                'div',
                { className: 'dsh-games-footer' },
                state
                  ? status
                    ? h(
                        'span',
                        { className: 'dsh-games-status', 'data-tone': status.tone, role: 'status' },
                        status.text,
                      )
                    : h('span', { className: 'dsh-games-help' }, t(def.helpKey))
                  : null,
                state ? h('span', { className: 'dsh-games-progress' }, def.progress(state, t)) : null,
              ),
            ),
          ),
        );
      };
    }

    /**
     * Sudoku view: a 9x9 board with a floating digit pad.  All puzzle logic lives
     * in core.js; this file only renders one state and reports edits upwards.
     */

    const SUDOKU_CSS = `
    .dsh-sudoku-grid {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      width: 100%;
      height: 100%;
      aspect-ratio: 1;
      border: 2px solid var(--dsw-alias-border-l2);
      border-radius: 9px;
      overflow: hidden;
      background: var(--dsw-alias-bg-layer-1);
    }
    .dsh-sudoku-cell {
      position: relative;
      box-sizing: border-box;
      min-width: 0;
      min-height: 0;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-right: 1px solid var(--dsw-alias-border-l1);
      border-bottom: 1px solid var(--dsw-alias-border-l1);
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .dsh-sudoku-cell[data-c="2"],
    .dsh-sudoku-cell[data-c="5"] {
      border-right: 2px solid var(--dsw-alias-border-l2);
    }
    .dsh-sudoku-cell[data-r="2"],
    .dsh-sudoku-cell[data-r="5"] {
      border-bottom: 2px solid var(--dsw-alias-border-l2);
    }
    .dsh-sudoku-cell[data-c="8"] {
      border-right: 0;
    }
    .dsh-sudoku-cell[data-r="8"] {
      border-bottom: 0;
    }
    .dsh-sudoku-cell[data-kind="given"] {
      cursor: default;
      background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
    }
    .dsh-sudoku-cell[data-kind="given"]:disabled {
      opacity: 1;
    }
    .dsh-sudoku-cell[data-selected="true"] {
      z-index: 1;
      background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent);
      box-shadow: inset 0 0 0 2px var(--dsw-alias-brand-primary);
    }
    .dsh-sudoku-cell[data-kind="user"][data-conflict="true"] {
      background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
    }
    .dsh-sudoku-cell:focus-visible {
      outline: 2px solid var(--dsw-alias-brand-primary);
      outline-offset: -2px;
    }
    .dsh-sudoku-value {
      font-size: clamp(14px, 3.2vw, 19px);
      font-weight: 650;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .dsh-sudoku-cell[data-kind="given"] .dsh-sudoku-value {
      color: var(--dsw-alias-label-primary);
      font-weight: 720;
    }
    .dsh-sudoku-cell[data-kind="user"][data-conflict="false"] .dsh-sudoku-value {
      color: var(--dsw-alias-state-success-primary);
    }
    .dsh-sudoku-cell[data-kind="user"][data-conflict="true"] .dsh-sudoku-value {
      color: var(--dsw-alias-state-error-primary);
    }
    .dsh-sudoku-mini {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      width: 100%;
      height: 100%;
      padding: 1px;
      box-sizing: border-box;
      pointer-events: none;
    }
    .dsh-sudoku-mini > span {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      font-size: clamp(5.5px, 1.3vw, 8px);
      line-height: 1;
      color: var(--dsw-alias-label-secondary);
      font-variant-numeric: tabular-nums;
    }
    .dsh-sudoku-mini > span[data-excluded="true"] {
      color: var(--dsw-alias-state-error-primary);
    }
    .dsh-sudoku-mini > span[data-excluded="true"]::after {
      content: "";
      position: absolute;
      left: 16%;
      right: 16%;
      top: 50%;
      border-top: 1.5px solid currentColor;
      transform: rotate(-45deg);
      transform-origin: center;
    }
    .dsh-sudoku-pad {
      position: absolute;
      box-sizing: border-box;
      width: clamp(126px, 32vw, 150px);
      aspect-ratio: 1;
      padding: 5px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 3px;
      border: 1px solid var(--dsw-alias-border-l2);
      border-radius: 12px;
      background: var(--dsw-alias-bg-overlay);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
      transform: translate(-50%, -50%);
      z-index: 40;
    }
    .dsh-sudoku-pad-key {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 7px;
      background: var(--dsw-alias-bg-layer-2);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: clamp(13px, 2.8vw, 17px);
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      font-variant-numeric: tabular-nums;
      -webkit-tap-highlight-color: transparent;
    }
    .dsh-sudoku-pad-key:hover {
      background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-2));
    }
    .dsh-sudoku-pad-key:focus-visible {
      outline: 2px solid var(--dsw-alias-brand-primary);
      outline-offset: 1px;
    }
    .dsh-sudoku-pad-key[data-current="true"][data-tone="success"] {
      color: var(--dsw-alias-state-success-primary);
      box-shadow: inset 0 0 0 2px var(--dsw-alias-state-success-primary);
    }
    .dsh-sudoku-pad-key[data-current="true"][data-tone="error"] {
      color: var(--dsw-alias-state-error-primary);
      box-shadow: inset 0 0 0 2px var(--dsw-alias-state-error-primary);
    }
    .dsh-sudoku-pad-key[data-excluded="true"] {
      color: var(--dsw-alias-state-error-primary);
    }
    .dsh-sudoku-pad-key[data-excluded="true"]::after {
      content: "";
      position: absolute;
      left: 18%;
      right: 18%;
      top: 50%;
      border-top: 2px solid currentColor;
      transform: rotate(-45deg);
      transform-origin: center;
    }
    `;

    function sudokuValues(state) {
      return currentValues(state.puzzle, state.inputs);
    }

    function sudokuSolved(state) {
      if (!state) return false;
      const values = sudokuValues(state);
      if (!values.every(Boolean)) return false;
      if (computeConflicts(values).size > 0) return false;
      return values.every((value, index) => value === state.solution[index]);
    }

    function sudokuStatus(state, t) {
      if (!state) return null;
      if (sudokuSolved(state)) return { text: t('sudokuSolved'), tone: 'success' };
      const values = sudokuValues(state);
      if (values.every(Boolean) && computeConflicts(values).size > 0) {
        return { text: t('sudokuFull'), tone: 'error' };
      }
      return null;
    }

    function sudokuProgress(state, t) {
      const entered = state.inputs.filter(Boolean).length;
      const total = CELLS - state.puzzle.filter(Boolean).length;
      return t('sudokuProgress', { filled: entered, left: total - entered });
    }

    function sudokuHasProgress(state) {
      if (sudokuSolved(state)) return false;
      return state.inputs.some(Boolean) || state.exclusions.some((list) => list.length > 0);
    }

    function MiniCandidates({ excluded }) {
      return h(
        'span',
        { className: 'dsh-sudoku-mini', 'aria-hidden': 'true' },
        Array.from({ length: 9 }, (_, index) => {
          const digit = index + 1;
          return h(
            'span',
            {
              key: digit,
              'data-excluded': excluded.indexOf(digit) === -1 ? 'false' : 'true',
            },
            String(digit),
          );
        }),
      );
    }

    function SudokuView({ state, onChange, t, bodyRef, escapeRef }) {
      const [selected, setSelected] = useState(null);
      const [padPos, setPadPos] = useState(null);
      const padRef = useRef(null);

      const values = useMemo(() => sudokuValues(state), [state]);
      const conflicts = useMemo(() => computeConflicts(values), [values]);
      const solved = useMemo(() => sudokuSolved(state), [state]);

      useEffect(() => {
        setSelected(null);
        setPadPos(null);
      }, [state.puzzle]);

      useEffect(() => {
        if (!solved) return;
        setSelected(null);
        setPadPos(null);
      }, [solved]);

      useEffect(() => {
        escapeRef.current = function clearSudokuSelection() {
          if (selected === null) return false;
          setSelected(null);
          setPadPos(null);
          return true;
        };
        return () => {
          escapeRef.current = null;
        };
      }, [selected, escapeRef]);

      useEffect(() => {
        if (selected === null) return undefined;
        function onPointerDown(event) {
          // The pad is the only surface that keeps a selection alive.  Clicking
          // anywhere else, including the card around it or the chat, closes it.
          if (padRef.current && padRef.current.contains(event.target)) return;
          setSelected(null);
          setPadPos(null);
        }
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
      }, [selected]);

      useEffect(() => {
        if (selected === null) return undefined;
        function onResize() {
          setSelected(null);
          setPadPos(null);
        }
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, [selected]);

      function openCell(index, event) {
        if (solved || state.puzzle[index]) return;
        const panel = bodyRef.current;
        if (!panel) return;
        const cellRect = event.currentTarget.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        let x = cellRect.left + cellRect.width / 2 - panelRect.left;
        let y = cellRect.top + cellRect.height / 2 - panelRect.top;
        const padHalf = Math.min(75, Math.max(63, window.innerWidth * 0.16));
        const margin = 6;
        const absX = panelRect.left + x;
        const absY = panelRect.top + y;
        if (absX - padHalf < margin) x += margin - (absX - padHalf);
        else if (absX + padHalf > window.innerWidth - margin) {
          x -= absX + padHalf - (window.innerWidth - margin);
        }
        if (absY - padHalf < margin) y += margin - (absY - padHalf);
        else if (absY + padHalf > window.innerHeight - margin) {
          y -= absY + padHalf - (window.innerHeight - margin);
        }
        setSelected(index);
        setPadPos({ x, y });
      }

      function enterDigit(digit) {
        if (selected === null || solved || state.puzzle[selected]) return;
        const inputs = state.inputs.slice();
        const next = inputs[selected] === digit ? 0 : digit;
        inputs[selected] = next;
        let exclusions = state.exclusions;
        if (next !== 0 && exclusions[selected].indexOf(digit) !== -1) {
          exclusions = exclusions.map((list, index) =>
            index === selected ? list.filter((value) => value !== digit) : list,
          );
        }
        onChange({ ...state, inputs, exclusions });
      }

      function toggleExclusion(digit) {
        if (selected === null || solved || state.puzzle[selected]) return;
        const exclusions = state.exclusions.map((list, index) => {
          if (index !== selected) return list;
          return list.indexOf(digit) === -1
            ? list.concat(digit).sort((a, b) => a - b)
            : list.filter((value) => value !== digit);
        });
        const inputs = state.inputs.slice();
        inputs[selected] = 0;
        onChange({ ...state, inputs, exclusions });
      }

      function selectedCellLabel(index) {
        const value = values[index];
        const row = Math.floor(index / 9) + 1;
        const col = (index % 9) + 1;
        const kind = state.puzzle[index]
          ? t('given')
          : value
            ? t('entered')
            : t('empty');
        const conflict = conflicts.has(index) ? `, ${t('conflict')}` : '';
        return `${t('cell')} ${row}-${col}, ${kind}${value ? ` ${value}` : ''}${conflict}`;
      }

      const board = h(
        'div',
        {
          className: 'dsh-sudoku-grid',
          role: 'group',
          'aria-label': t('sudokuBoard'),
        },
        state.puzzle.map((given, index) => {
          const value = values[index];
          const isGiven = given !== 0;
          const isUser = !isGiven && value !== 0;
          const conflict = conflicts.has(index);
          const isSelected = selected === index;
          return h(
            'button',
            {
              key: index,
              type: 'button',
              className: 'dsh-sudoku-cell',
              'data-r': Math.floor(index / 9),
              'data-c': index % 9,
              'data-kind': isGiven ? 'given' : isUser ? 'user' : 'empty',
              'data-conflict': conflict ? 'true' : 'false',
              'data-selected': isSelected ? 'true' : 'false',
              'aria-label': selectedCellLabel(index),
              'aria-pressed': isSelected ? 'true' : 'false',
              disabled: isGiven || solved,
              onClick: isGiven || solved ? undefined : (event) => openCell(index, event),
            },
            isGiven || isUser
              ? h('span', { className: 'dsh-sudoku-value' }, String(value))
              : isSelected
                ? null
                : h(MiniCandidates, { excluded: state.exclusions[index] }),
          );
        }),
      );

      if (selected === null || !padPos || solved) return board;

      const pad = h(
        'div',
        {
          ref: padRef,
          className: 'dsh-sudoku-pad',
          style: { left: padPos.x, top: padPos.y },
          role: 'group',
          'aria-label': t('pad'),
          title: t('padHint'),
          onContextMenu: (event) => event.preventDefault(),
        },
        Array.from({ length: 9 }, (_, index) => {
          const digit = index + 1;
          const current = state.inputs[selected] === digit;
          const excluded = state.exclusions[selected].indexOf(digit) !== -1;
          return h(
            'button',
            {
              key: digit,
              type: 'button',
              className: 'dsh-sudoku-pad-key',
              'data-current': current ? 'true' : 'false',
              'data-tone': current ? (conflicts.has(selected) ? 'error' : 'success') : 'none',
              'data-excluded': excluded ? 'true' : 'false',
              'aria-label': `${t('input')} ${digit}${excluded ? `, ${t('excluded')}` : ''}`,
              onClick: () => enterDigit(digit),
              onContextMenu: (event) => {
                event.preventDefault();
                toggleExclusion(digit);
              },
            },
            String(digit),
          );
        }),
      );

      return h(React.Fragment, null, board, pad);
    }

    /**
     * 2048 view.  The board is a plain 4x4 array; the view turns swipes and arrow
     * keys into one move and reports the next state upwards.
     */

    const G2048_CSS = `
    .dsh-g2048 {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 5px;
      padding: 5px;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 10px;
      background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      outline: none;
    }
    .dsh-g2048:focus-visible {
      box-shadow: 0 0 0 2px var(--dsw-alias-brand-primary);
    }
    .dsh-g2048[data-over="true"] {
      opacity: 0.86;
    }
    .dsh-g2048-tile {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--dsw-alias-label-primary);
      font-size: clamp(12px, 3.4vw, 19px);
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .dsh-g2048-tile[data-empty="true"] {
      background: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
    }
    .dsh-g2048-tile[data-long="true"] {
      font-size: clamp(10px, 2.7vw, 15px);
    }
    `;

    function g2048TileStyle(value) {
      if (!value) return undefined;
      const strength = Math.min(1, Math.log2(value) / 12);
      const percent = Math.round(10 + strength * 52);
      return {
        background: `color-mix(in srgb, var(--dsw-alias-brand-primary) ${percent}%, var(--dsw-alias-bg-layer-2))`,
      };
    }

    function g2048Status(state, t) {
      if (state.over) return { text: t('g2048Over'), tone: 'error' };
      if (state.won) return { text: t('g2048Won'), tone: 'success' };
      return null;
    }

    function g2048Progress(state, t) {
      return t('g2048Progress', { score: state.score, max: maxTile2048(state.board) });
    }

    function g2048HasProgress(state) {
      return state.moves > 0 && !state.over;
    }

    const G2048_KEY_DIRECTIONS = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
      W: 'up',
      A: 'left',
      S: 'down',
      D: 'right',
    };

    function G2048View({ state, onChange, t }) {
      const boardRef = useRef(null);
      const startRef = useRef(null);
      const board = state.board;

      function apply(direction) {
        if (state.over) return;
        const result = move2048(board, direction);
        if (!result.moved) return;
        const spawned = spawn2048(result.board);
        const nextBoard = spawned ? spawned.board : result.board;
        const score = state.score + result.gained;
        onChange({
          ...state,
          board: nextBoard,
          score,
          best: Math.max(state.best || 0, score),
          moves: state.moves + 1,
          won: state.won || maxTile2048(nextBoard) >= G2048_TARGET,
          over: !canMove2048(nextBoard),
        });
      }

      function onKeyDown(event) {
        const direction = G2048_KEY_DIRECTIONS[event.key];
        if (!direction) return;
        event.preventDefault();
        apply(direction);
      }

      function onPointerDown(event) {
        if (typeof event.button === 'number' && event.button !== 0) return;
        startRef.current = { x: event.clientX, y: event.clientY };
        if (boardRef.current) boardRef.current.focus({ preventScroll: true });
      }

      function onPointerUp(event) {
        const start = startRef.current;
        startRef.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 22 && absY < 22) return;
        if (absX > absY) apply(dx > 0 ? 'right' : 'left');
        else apply(dy > 0 ? 'down' : 'up');
      }

      function onPointerCancel() {
        startRef.current = null;
      }

      return h(
        'div',
        {
          ref: boardRef,
          className: 'dsh-g2048',
          'data-over': state.over ? 'true' : 'false',
          role: 'group',
          'aria-label': t('g2048Board'),
          tabIndex: 0,
          onKeyDown,
          onPointerDown,
          onPointerUp,
          onPointerCancel,
        },
        board.map((value, index) =>
          h(
            'div',
            {
              key: index,
              className: 'dsh-g2048-tile',
              'data-empty': value ? 'false' : 'true',
              'data-long': value >= 1000 ? 'true' : 'false',
              style: g2048TileStyle(value),
            },
            value ? String(value) : '',
          ),
        ),
      );
    }

    /**
     * Minesweeper view: left click opens, right click (or a long press) flags.
     * First click is always safe because the board is laid out on demand.
     */

    const MINES_CSS = `
    .dsh-mines {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      grid-template-rows: repeat(9, minmax(0, 1fr));
      gap: 2px;
      padding: 2px;
    }
    .dsh-mines-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: var(--dsw-alias-bg-layer-2);
      color: var(--dsw-alias-label-primary);
      font: inherit;
      font-size: clamp(9px, 2.4vw, 14px);
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    .dsh-mines-cell:disabled {
      opacity: 1;
      cursor: default;
    }
    .dsh-mines-cell[data-state="revealed"] {
      background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
      cursor: default;
    }
    .dsh-mines-cell[data-state="flag"] {
      color: var(--dsw-alias-state-warn-primary);
    }
    .dsh-mines-cell[data-state="mine"] {
      color: var(--dsw-alias-state-error-primary);
      background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);
    }
    .dsh-mines-cell[data-state="boom"] {
      color: var(--dsw-alias-state-error-primary);
      background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 26%, transparent);
      box-shadow: inset 0 0 0 1px var(--dsw-alias-state-error-primary);
    }
    .dsh-mines-cell[data-n="1"] { color: var(--dsw-alias-brand-primary); }
    .dsh-mines-cell[data-n="2"] { color: var(--dsw-alias-state-success-primary); }
    .dsh-mines-cell[data-n="3"] { color: var(--dsw-alias-state-warn-primary); }
    .dsh-mines-cell[data-n="4"] { color: var(--dsw-alias-state-error-primary); }
    .dsh-mines-cell[data-n="5"],
    .dsh-mines-cell[data-n="6"],
    .dsh-mines-cell[data-n="7"],
    .dsh-mines-cell[data-n="8"] {
      color: var(--dsw-alias-label-primary);
    }
    .dsh-mines-cell:focus-visible {
      outline: 2px solid var(--dsw-alias-brand-primary);
      outline-offset: -2px;
    }
    `;

    function minesweeperStatus(state, t) {
      if (state.won) return { text: t('minesWon'), tone: 'success' };
      if (state.lost) return { text: t('minesLost'), tone: 'error' };
      return null;
    }

    function minesweeperProgress(state, t) {
      return t('minesProgress', {
        revealed: revealedCount(state),
        total: MINES_CELLS - MINES_COUNT,
        flags: flaggedCount(state),
        mines: MINES_COUNT,
      });
    }

    function minesweeperHasProgress(state) {
      return state.started && !state.won && !state.lost;
    }

    function MinesweeperView({ state, onChange, t }) {
      const pressRef = useRef(null);

      useEffect(() => {
        return () => {
          if (pressRef.current) clearTimeout(pressRef.current.timer);
        };
      }, []);

      function cancelPress() {
        if (!pressRef.current) return;
        clearTimeout(pressRef.current.timer);
        pressRef.current = null;
      }

      function reveal(index) {
        if (state.lost || state.won || state.revealed[index] || state.flags[index]) return;
        onChange(revealCell(state, index));
      }

      function flag(index) {
        if (state.lost || state.won || state.revealed[index]) return;
        onChange(toggleFlag(state, index));
      }

      function onPointerDown(index, event) {
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (state.lost || state.won || state.revealed[index]) return;
        cancelPress();
        pressRef.current = {
          index,
          x: event.clientX,
          y: event.clientY,
          timer: setTimeout(() => {
            pressRef.current = null;
            flag(index);
          }, 380),
        };
      }

      function onPointerUp(index, event) {
        const press = pressRef.current;
        if (!press) return;
        cancelPress();
        if (press.index !== index) return;
        if (Math.abs(event.clientX - press.x) > 10 || Math.abs(event.clientY - press.y) > 10) return;
        reveal(index);
      }

      function onPointerMove(event) {
        const press = pressRef.current;
        if (!press) return;
        if (Math.abs(event.clientX - press.x) > 10 || Math.abs(event.clientY - press.y) > 10) {
          cancelPress();
        }
      }

      function cellLabel(index) {
        const row = Math.floor(index / MINES_SIZE) + 1;
        const col = (index % MINES_SIZE) + 1;
        const opened = state.revealed[index];
        const flagged = state.flags[index];
        const adjacent = opened ? adjacentMines(state.mines, index) : 0;
        let description;
        if (opened) description = adjacent ? t('minesCount', { count: adjacent }) : t('minesOpened');
        else if (flagged) description = t('minesFlagged');
        else description = t('minesHidden');
        return `${t('minesCell', { row, col })}, ${description}`;
      }

      return h(
        'div',
        {
          className: 'dsh-mines',
          role: 'group',
          'aria-label': t('minesBoard'),
          onPointerMove,
          onContextMenu: (event) => event.preventDefault(),
        },
        Array.from({ length: MINES_CELLS }, (_, index) => {
          const opened = state.revealed[index];
          const flagged = state.flags[index];
          const adjacent = opened ? adjacentMines(state.mines, index) : 0;
          const mineVisible = state.lost && state.mines[index];
          const hit = state.lost && state.hit === index;
          let cellState = 'hidden';
          if (hit) cellState = 'boom';
          else if (mineVisible) cellState = 'mine';
          else if (opened) cellState = 'revealed';
          else if (flagged) cellState = 'flag';

          let content = '';
          if (mineVisible) content = '✹';
          else if (opened) content = adjacent ? String(adjacent) : '';
          else if (flagged) content = '⚑';

          return h(
            'button',
            {
              key: index,
              type: 'button',
              className: 'dsh-mines-cell',
              'data-state': cellState,
              'data-n': opened ? adjacent : 0,
              'aria-label': cellLabel(index),
              disabled: state.won || state.lost,
              onPointerDown: (event) => onPointerDown(index, event),
              onPointerUp: (event) => onPointerUp(index, event),
              onPointerLeave: cancelPress,
              onClick: (event) => {
                // Keyboard activation produces a click with detail 0.
                if (event.detail === 0) reveal(index);
              },
              onContextMenu: (event) => {
                event.preventDefault();
                flag(index);
              },
            },
            content,
          );
        }),
      );
    }

    /**
     * Lights Out view: clicking a cell flips it and its four neighbours; the goal
     * is to turn every light off.
     */

    const LIGHTS_CSS = `
    .dsh-lights {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      grid-template-rows: repeat(5, minmax(0, 1fr));
      gap: 7px;
      padding: 6px;
    }
    .dsh-lights-cell {
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 1px solid var(--dsw-alias-border-l1);
      border-radius: 10px;
      background: var(--dsw-alias-bg-layer-2);
      color: transparent;
      font: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .dsh-lights-cell:hover {
      border-color: var(--dsw-alias-border-l2);
    }
    .dsh-lights-cell[data-on="true"] {
      border-color: var(--dsw-alias-brand-primary);
      background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, var(--dsw-alias-bg-layer-2));
      box-shadow: inset 0 0 14px color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
    }
    .dsh-lights-cell:focus-visible {
      outline: 2px solid var(--dsw-alias-brand-primary);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .dsh-lights-cell {
        transition: none;
      }
    }
    `;

    function lightsOutStatus(state, t) {
      if (lightsSolved(state.cells)) return { text: t('lightsWon'), tone: 'success' };
      return null;
    }

    function lightsOutProgress(state, t) {
      return t('lightsProgress', { moves: state.moves });
    }

    function lightsOutHasProgress(state) {
      return state.moves > 0 && !lightsSolved(state.cells);
    }

    function LightsOutView({ state, onChange, t }) {
      const solved = lightsSolved(state.cells);

      function press(index) {
        if (solved) return;
        onChange({ ...state, cells: toggleLights(state.cells, index), moves: state.moves + 1 });
      }

      return h(
        'div',
        { className: 'dsh-lights', role: 'group', 'aria-label': t('lightsBoard') },
        state.cells.map((on, index) =>
          h(
            'button',
            {
              key: index,
              type: 'button',
              className: 'dsh-lights-cell',
              'data-on': on ? 'true' : 'false',
              'aria-pressed': on ? 'true' : 'false',
              'aria-label': t('lightsCell', {
                row: Math.floor(index / LIGHTS_SIZE) + 1,
                col: (index % LIGHTS_SIZE) + 1,
                state: on ? t('lightsOn') : t('lightsOff'),
              }),
              onClick: () => press(index),
            },
          ),
        ),
      );
    }

    /**
     * Client half of the bundle: locale dictionaries, the game registry, and the
     * conversation node that puts one resumable game card into the running turn.
     */

    const NS = 'waiting-games';
    const NODE_KIND = 'waiting-games';
    const { useState, useEffect, useMemo, useRef } = React;

    const ZH = {
      title: '等待时小游戏',
      switchGame: '切换游戏',
      newGame: '新开一局',
      confirmNew: '确认新开？',
      close: '收起游戏',
      open: '打开小游戏',
      continue: '继续游戏',
      loading: '正在准备题目…',
      error: '加载失败，请重试。',
      retry: '重试',
      newGameTitle: '开始一局新的游戏',
      confirmNewTitle: '当前进度会被替换',

      gameSudoku: '数独',
      gameSudokuHint: '9×9',
      game2048: '2048',
      game2048Hint: '4×4',
      gameMines: '扫雷',
      gameMinesHint: '9×9 · 10 雷',
      gameLights: '关灯',
      gameLightsHint: '5×5',

      helpSudoku: '左键填入 · 右键排除',
      help2048: '滑动或方向键移动',
      helpMines: '左键翻开 · 右键/长按插旗',
      helpLights: '点击翻转十字',

      sudokuBoard: '数独棋盘',
      sudokuSolved: '解开了，恭喜完成！',
      sudokuFull: '已填满，但还有冲突',
      sudokuProgress: '已填 {filled} · 剩 {left}',
      cell: '格子',
      given: '题目数字',
      entered: '已输入',
      empty: '空格',
      conflict: '冲突',
      pad: '数字选择板',
      padHint: '左键填入，右键排除；再次右键取消排除',
      input: '填入',
      excluded: '已排除',

      g2048Board: '2048 棋盘',
      g2048Won: '达成 2048！',
      g2048Over: '无路可走，再来一局？',
      g2048Progress: '分数 {score} · 最大 {max}',

      minesBoard: '扫雷棋盘',
      minesCell: '第 {row} 行第 {col} 列',
      minesHidden: '未翻开',
      minesFlagged: '已插旗',
      minesOpened: '已翻开',
      minesCount: '周围 {count} 个雷',
      minesWon: '清场成功！',
      minesLost: '踩雷了，再来一局？',
      minesProgress: '已开 {revealed}/{total} · 旗 {flags}/{mines}',

      lightsBoard: '关灯棋盘',
      lightsCell: '第 {row} 行第 {col} 列，{state}',
      lightsOn: '亮',
      lightsOff: '灭',
      lightsWon: '全部熄灭！',
      lightsProgress: '步数 {moves}',
    };

    const EN = {
      title: 'Games while waiting',
      switchGame: 'Switch game',
      newGame: 'New game',
      confirmNew: 'Confirm new',
      close: 'Hide game',
      open: 'Open games',
      continue: 'Continue game',
      loading: 'Preparing a game…',
      error: 'Could not load a game. Please retry.',
      retry: 'Retry',
      newGameTitle: 'Start a new game',
      confirmNewTitle: 'Current progress will be replaced',

      gameSudoku: 'Sudoku',
      gameSudokuHint: '9×9',
      game2048: '2048',
      game2048Hint: '4×4',
      gameMines: 'Minesweeper',
      gameMinesHint: '9×9 · 10 mines',
      gameLights: 'Lights Out',
      gameLightsHint: '5×5',

      helpSudoku: 'Left-click enter · right-click exclude',
      help2048: 'Swipe or use the arrow keys',
      helpMines: 'Left-click open · right-click or hold to flag',
      helpLights: 'Click to flip a cross',

      sudokuBoard: 'Sudoku board',
      sudokuSolved: 'Solved! Well done.',
      sudokuFull: 'Full, but there are conflicts',
      sudokuProgress: '{filled} filled · {left} left',
      cell: 'Cell',
      given: 'given',
      entered: 'entered',
      empty: 'empty',
      conflict: 'conflict',
      pad: 'Digit pad',
      padHint: 'Left-click to enter, right-click to exclude; right-click again to undo',
      input: 'Enter',
      excluded: 'excluded',

      g2048Board: '2048 board',
      g2048Won: 'You reached 2048!',
      g2048Over: 'No moves left — try again?',
      g2048Progress: 'Score {score} · best tile {max}',

      minesBoard: 'Minesweeper board',
      minesCell: 'Row {row}, column {col}',
      minesHidden: 'hidden',
      minesFlagged: 'flagged',
      minesOpened: 'open',
      minesCount: '{count} mines around',
      minesWon: 'Board cleared!',
      minesLost: 'Boom — try again?',
      minesProgress: '{revealed}/{total} open · {flags}/{mines} flags',

      lightsBoard: 'Lights Out board',
      lightsCell: 'Row {row}, column {col}, {state}',
      lightsOn: 'on',
      lightsOff: 'off',
      lightsWon: 'All lights out!',
      lightsProgress: '{moves} moves',
    };

    const GAME_DEFS = [
      {
        id: 'sudoku',
        titleKey: 'gameSudoku',
        hintKey: 'gameSudokuHint',
        helpKey: 'helpSudoku',
        css: SUDOKU_CSS,
        heavy: true,
        legacyKeys: [STORAGE_KEY, ...LEGACY_STORAGE_KEYS],
        create: () => createGame(),
        load: validateGame,
        hasProgress: sudokuHasProgress,
        progress: sudokuProgress,
        status: sudokuStatus,
        Component: SudokuView,
      },
      {
        id: '2048',
        titleKey: 'game2048',
        hintKey: 'game2048Hint',
        helpKey: 'help2048',
        css: G2048_CSS,
        create: (previous) => create2048(previous),
        load: normalize2048,
        hasProgress: g2048HasProgress,
        progress: g2048Progress,
        status: g2048Status,
        Component: G2048View,
      },
      {
        id: 'mines',
        titleKey: 'gameMines',
        hintKey: 'gameMinesHint',
        helpKey: 'helpMines',
        css: MINES_CSS,
        create: () => createMinesweeper(),
        load: normalizeMinesweeper,
        hasProgress: minesweeperHasProgress,
        progress: minesweeperProgress,
        status: minesweeperStatus,
        Component: MinesweeperView,
      },
      {
        id: 'lights',
        titleKey: 'gameLights',
        hintKey: 'gameLightsHint',
        helpKey: 'helpLights',
        css: LIGHTS_CSS,
        create: () => createLightsOut(),
        load: normalizeLightsOut,
        hasProgress: lightsOutHasProgress,
        progress: lightsOutProgress,
        status: lightsOutStatus,
        Component: LightsOutView,
      },
    ];

    const WaitingGamesNode = createWaitingGames(GAME_DEFS);

    function matchGamesEvent(event) {
      if (event.type === 'turn/start') {
        return { id: String(event.data.turn), role: 'start' };
      }
      if (event.type === 'turn/end') {
        return { id: String(event.data.turn), role: 'update' };
      }
      if (event.type === 'assistant/live-chunk') return null;
      const turn = event.data && event.data.turn;
      return typeof turn === 'number'
        ? { id: String(turn), role: 'update' }
        : null;
    }

    const GAMES_DEFINITION = {
      kind: NODE_KIND,
      target: 'chat',
      match: {
        'turn/start': matchGamesEvent,
        'turn/end': matchGamesEvent,
        'step/start': matchGamesEvent,
        'step/end': matchGamesEvent,
        'tool/call': matchGamesEvent,
        'tool/result': matchGamesEvent,
        'assistant/message': matchGamesEvent,
        'assistant/attempt': matchGamesEvent,
        'llm/retry': matchGamesEvent,
        'llm/retry-started': matchGamesEvent,
      },
      start: (_context, match) => {
        if (match.event.type !== 'turn/start') {
          throw new Error('waiting-games start requires turn/start');
        }
        return {
          turn: match.event.data.turn,
          lastSeq: match.event.seq,
          closed: false,
        };
      },
      update: (context, match) => {
        if (match.event.type === 'turn/end') {
          return { ...context.state, lastSeq: match.event.seq, closed: true };
        }
        return { ...context.state, lastSeq: match.event.seq };
      },
      publication: () => 'immediate',
      buildViewNode: (context) => {
        const state = context.state;
        if (state === undefined || state.closed) return null;
        const startLocation = context.start && context.start.location;
        const lastMatch =
          context.matches.length > 0
            ? context.matches[context.matches.length - 1]
            : undefined;
        const location = startLocation || (lastMatch && lastMatch.location) || {
          kind: 'unresolved',
        };
        return {
          key: context.key,
          kind: NODE_KIND,
          id: context.id,
          target: 'chat',
          anchorSeq: state.lastSeq + 0.2,
          location,
          groupTree: 'turn',
          visibility: 'visible',
          data: { turn: state.turn },
        };
      },
    };

    return {
      inject: ['slots', 'locale', 'uiConversation'],
      apply(ctx) {
        ctx.effect(
          () =>
            ctx.locale.register(NS, {
              zh: ZH,
              en: EN,
            }),
          'waiting-games: dictionaries',
        );
        ctx.effect(
          () => ctx.uiConversation.events.register(GAMES_DEFINITION),
          'waiting-games: conversation node',
        );
        ctx.slots.inject('conversation.chat.node', () =>
          ctx.slots.register(
            {
              name: 'conversation.chat.node',
              key: NODE_KIND,
              locale: NS,
            },
            WaitingGamesNode,
          ),
        );
      },
    };
  },
});
