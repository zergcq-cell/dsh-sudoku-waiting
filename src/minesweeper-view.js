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
