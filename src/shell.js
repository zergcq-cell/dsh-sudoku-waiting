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
