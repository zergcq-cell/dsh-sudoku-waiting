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
