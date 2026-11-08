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
