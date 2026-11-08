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
