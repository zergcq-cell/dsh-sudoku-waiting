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
