# 发布清单 / Releasing

这份清单面向仓库维护者，记录从版本号到市场收录的完整流程。

## 0. 前置条件

- npm 账号已登录：`npm whoami` 返回用户名。
- GitHub CLI 已登录且有 `repo` 权限：`gh auth status`。
- 工作区干净：`git status` 没有未提交改动。

## 1. 发布前检查

```bash
node --test                    # 15 个纯逻辑测试
node build.mjs                 # 重建 client.js
npm pack --dry-run             # 检查 tarball 内容
```

确认 `package.json` 中：

- `name` 与 `cordis.patch.yml` 的 row name 一致（`dsh-sudoku-waiting`）；
- `version` 已经更新；
- `engines.dsh` 覆盖当前 DSH 版本；
- `files` 包含 `index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、
  `icon.svg`、`README.md`、`LICENSE`、`CHANGELOG.md`、`src/*.js`。

## 2. 发布到 npm

```bash
npm version patch   # 或 minor / major；会创建 v<version> tag
npm publish --access public
git push --follow-tags
```

首次发布也可以手动改 `version` 后执行 `npm publish --access public`。

如果使用 GitHub Actions 发布，在仓库 Secrets 中配置 `NPM_TOKEN`（npm
Automation token），或配置 npm Trusted Publisher，然后推送 `v*` tag：

```bash
git tag v1.1.0
git push origin v1.1.0
```

workflow 会运行测试、构建、发布 npm，并把 tgz 附到 GitHub Release。

## 3. 发布后验证

```bash
npm view dsh-sudoku-waiting version dist.tarball
npm view dsh-sudoku-waiting engines.dsh
```

再用一个干净的 profile 实际安装一次：

```bash
dsh plugin --profile web add dsh-sudoku-waiting
```

在 Web UI 里触发一轮思考，确认卡片出现、四款游戏可切换、进度可保存。

## 4. 市场收录

发布 GitHub 仓库和 npm 包后，插件会被社区市场自动发现。为加快收录：

1. 确认仓库是公开的，并带有 `dsh-plugin` topic。
2. 仓库描述和 README 第一段写清“是什么、给谁用、怎么装”。
3. 在 [dsh-plugin.org 提交页](https://dsh-plugin.org/zh/submit) 按模板创建 Issue
   （仓库地址 + 一句话价值 + 安装命令 + 兼容信息 + 许可证）。
4. dsh.so 会自动索引带 `dsh-plugin` topic 的公开仓库；也可以在
   [dsh.so 提交页](https://www.dsh.so/zh/submit/) 用仓库地址或 npm 包名跑一次检查。
5. DSH 的 Discover 页需要用户添加插件索引源；市场收录后，用户可从对应索引安装。

> 这些市场都是第三方社区项目，与 DeepSeek AI 没有隶属关系。收录不等于安全审计或
> 兼容性背书。

## 5. 版本与回滚

- 修复问题：`npm version patch` → 重新发布；不要覆盖已发布版本。
- 发布错了：72 小时内可 `npm unpublish dsh-sudoku-waiting@<version>`；更稳妥的是
  `npm deprecate dsh-sudoku-waiting@<version> "reason"` 并发布修复版本。
- 更新 `CHANGELOG.md`，并在 GitHub Release 里写清升级注意事项。
