# Games while waiting · 等待时小游戏

<p align="center">
  <img src="https://raw.githubusercontent.com/zergcq-cell/dsh-sudoku-waiting/main/icon.svg" width="76" height="76" alt="Games while waiting icon" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-sudoku-waiting"><img src="https://img.shields.io/npm/v/dsh-sudoku-waiting.svg" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/dsh-sudoku-waiting.svg" alt="MIT license" /></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/topic-dsh--plugin-0e7490" alt="dsh-plugin topic" /></a>
  <a href="https://github.com/zergcq-cell/dsh-sudoku-waiting/stargazers"><img src="https://img.shields.io/github/stars/zergcq-cell/dsh-sudoku-waiting?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <b>在 DeepSeek 思考/执行工具时，把一局可继续的小游戏直接放进当前回合的对话流里。</b><br />
  <sub>A community DSH plugin that puts resumable waiting games inline in the current turn — Sudoku, 2048, Minesweeper, and Lights Out.</sub>
</p>

> 这是一个社区插件，不是 DeepSeek Harness 官方插件。
> This is a community plugin, not an official DeepSeek Harness bundle.

## 为什么是它 / Why this one

- **不盖住会话**：游戏卡片在对话流的最新位置，宽度上限 336px，和思考日志一起滚动，不是浮层。
- **四款游戏，一份存档**：数独、2048、扫雷、关灯，点标题切换；每款独立保存，离开再回来还在。
- **等待才出现**：DeepSeek 开始思考/运行工具时出现，回合结束自动消失；等待你审批或回答时也会暂时隐藏。
- **纯本地**：关卡生成和判题都在浏览器完成，不联网、无遥测、没有服务端数据。
- **跟随主题**：只使用宿主主题变量，浅色/深色自动适配，并尊重 `prefers-reduced-motion`。

## 安装 / Install

### 从 npm 安装（推荐）

在 DSH 的 **Plugins / 插件** 页面输入：

```text
dsh-sudoku-waiting
```

或者用 CLI 安装到你的 profile：

```bash
dsh plugin --profile web add dsh-sudoku-waiting
```

把 `web` 换成你实际使用的 profile 名称即可。安装后默认启用，不需要配置；没有 HMR 的环境可能需要重启一次 DSH。

### 从 GitHub 源码安装

没有 npm 包可用，或想跟进 `main` 分支时：

```bash
dsh plugin --profile web add github:zergcq-cell/dsh-sudoku-waiting
```

### 从 tgz 安装

从 [Releases](https://github.com/zergcq-cell/dsh-sudoku-waiting/releases) 下载 `dsh-sudoku-waiting-<version>.tgz`，在 Plugins 页面选择该文件，或：

```bash
dsh plugin --profile web add /绝对路径/dsh-sudoku-waiting-<version>.tgz
```

### 环境要求

- DSH `0.2.2-rc.1` 或同一 `0.2.x` 系列（`package.json` 声明了 `engines.dsh: ^0.2.2-rc.1`）。
- 带 Web 客户端和 Plugin Manager 的 DSH。
- 插件内置英文/中文文案，跟随宿主语言。

## 游戏 / Games

| 游戏 | 操作 | 进度 |
| --- | --- | --- |
| 数独 | 左键填入，右键排除（再次右键取消） | 已填 / 剩余 |
| 2048 | 在棋盘上滑动，或点一下棋盘后用方向键 / WASD | 分数 / 最大方块 |
| 扫雷 | 左键翻开，右键或长按插旗；首点必安全 | 已翻开 / 旗子 |
| 关灯 | 点击翻转自己与上下左右五格 | 步数 |

- 点标题打开切换菜单，当前游戏带勾选标记。
- “新开一局”在有进度时要求二次确认；已结束或已完成的局面直接重开。
- 右上角“收起”会变成一行“继续游戏”，不会挡住会话。

## 行为 / Behaviour

- DeepSeek 开始思考/运行工具时出现，回合结束自动消失；等待你回答审批/提问时也会暂时隐藏。
- 卡片固定在对话流的最新位置，所有游戏的棋盘区高度一致，不会让日志上下跳动。
- 关卡生成与判题都在浏览器本地完成。
- 只使用宿主主题变量（`--dsw-alias-*`），浅色/深色主题自动跟随。

## 隐私 / Privacy

- 不发起任何网络请求；没有遥测、统计或远程配置。
- 不读取会话内容，只读取当前会话的 `running` 状态和审批/提问状态来决定是否显示。
- 存档只写浏览器的 `localStorage`，不会上传。
- 不需要任何权限声明，也没有安装脚本。

## 存档 / Data

- 每款游戏一份：`dsh-games:<id>-v1`（`sudoku` / `2048` / `mines` / `lights`）。
- 最后玩的游戏：`dsh-games:last`。
- 旧版数独存档 `dsh-sudoku-waiting-v2` / `v1` 会在首次读取时自动迁移到 `dsh-games:sudoku-v1`。
- 没有服务端数据；读取到损坏的存档会丢弃并新开一局。

## 兼容性 / Compatibility

- 按 DSH `0.2.2-rc.1` 的 Client API 编写，`engines.dsh` 为 `^0.2.2-rc.1`。
- 已在 macOS 的 DSH `0.2.2-rc.1` 上安装并运行；其他平台/版本尚未逐一实测。
- 如果 DSH 升级后 Client API 有变，会在这个仓库发布新版本。

## 开发 / Development

```bash
node build.mjs                  # 构建根目录的 client.js（npm 包使用）
node --test                     # 运行纯逻辑测试（node:test）
node build-publish.mjs          # 生成本地 link 用的 publish/ 目录
npm pack --dry-run              # 检查最终会发布哪些文件
```

发布目录只包含运行时文件、README、LICENSE、CHANGELOG 和 `src/` 源码；`client.js` 已经是构建产物。正式发布从仓库根目录执行：

```bash
npm version patch              # 或 minor / major
npm publish --access public
git push --follow-tags
```

打 `v*` tag 会触发 `.github/workflows/release.yml`，在 GitHub Actions 里发布 npm 包并附带 tgz。

## 结构 / Layout

```text
src/core.js              数独生成、求解与校验（唯一解）
src/games-core.js        2048 / 扫雷 / 关灯 的纯逻辑
src/shell.js             卡片外壳、切换菜单、加载/错误状态与存档
src/sudoku-view.js       数独视图与数字板
src/g2048-view.js        2048 视图
src/minesweeper-view.js  扫雷视图
src/lightsout-view.js    关灯视图
src/client-factory.js    词典、游戏注册表、对话节点定义与注册
scripts/bundle.mjs       拼接顺序与打包工具
test/games.test.mjs      纯逻辑测试
```

新增一款游戏只需要：

1. 在 `src/games-core.js`（或新文件）里写纯逻辑和 `normalize*` 校验；
2. 新增 `src/<game>-view.js`，接收 `{ state, onChange, t }` 并渲染棋盘；
3. 在 `src/client-factory.js` 的 `GAME_DEFS` 里加一项（`create` / `load` / `progress` / `status` / `Component`）；
4. 在 `scripts/bundle.mjs` 的 `SOURCE_FILES` 里登记新文件。

## 参与 / Contributing

欢迎 issue 和 PR。这个插件没有运行时依赖，改动后跑一遍：

```bash
node --test
node build.mjs
npm pack --dry-run
```

## License

MIT
