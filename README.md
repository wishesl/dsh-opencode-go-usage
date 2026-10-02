# dsh-opencode-go-usage

[English](README.en.md) | 中文

[![npm](https://img.shields.io/npm/v/dsh-ocgo-usage)](https://www.npmjs.com/package/dsh-ocgo-usage)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

![Footer demo](assets/custom-footer.png)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) **bundle**，在 Web 界面的输入框上方 dock（与内置 token 统计同位置）显示 [OpenCode Go](https://opencode.ai/docs/go/) 订阅用量。

它是 [pi-ocgo-usage](https://github.com/v587d/pi-ocgo-usage)（Pi 插件）的 Web 对应物：三个用量窗口（5h 滚动 / 每周 / 每月）的百分比与重置倒计时，按阈值变色，让你在窗口耗尽、请求被限流之前就发现。

```
OpenCode Go: 5h 0% (1h 23m) · wk 65% (2d 20h) · mo 83% (6d 21h) · upd 20:15
```

## 特性

- **三个窗口** —— 5h 滚动 / 每周 / 每月 的百分比 + 重置倒计时
- **颜色阈值** —— 正常 → 黄色警告（≥80%）→ 红色错误（≥90% 或已限流）
- **数据新鲜度** —— `upd HH:MM` 显示最近一次成功抓取时间
- **轻量轮询** —— 轮询只负责「取数字」：每 10s 一次（切回标签页立即刷新）；host 端 300s 缓存（TTL 可配）+ 60s 失败冷却，不会频繁打扰 opencode.ai。**显示与否不受这个周期影响**，见下一条
- **三档展示方式（设置页可选）** —— `常驻展示用量`（默认：只要解析到 key 就显示，与当前模型无关）/ `使用 opencode-go 才展示`（仅当前模型走 opencode-go provider 时显示）/ `不展示用量`（输入框不显示，设置页仍可查看）。哪里都没有 key 时任何档位都不显示，不在输入框常驻一个报错 chip
- **切换即时生效** —— 模式变更是本 bundle 内的直接通知；模型切换则由插件直接订阅模型选择器渲染用的那个 store（`modelDirectories` → `ModelDirectory.store`），**同步内存读取 + 变更通知**，都不必等下一次轮询。`provider` 档在探测不可用时 **fail-open**（照常显示），避免因探测失败而静默消失
- **点击展开** —— 详情面板显示每个窗口的重置倒计时，左下角 `Set` 可编辑 API key，右侧 `refresh upd HH:MM` 手动刷新
- **内置凭据编辑器** —— 无需碰终端：`Set` / 设置页直接填 API key（输入框以 `••••` + 末尾 4 位显示，点击外部 / Esc / 保存确认写入）
- **设置导航自带图标** —— 设置面板左侧「OpenCode Go」那一行显示与输入框 chip 同一个 OCGo 标记（单色、随主题着色），不再是官方兜底的通用齿轮
- **优雅降级** —— 配置缺失显示 `<err:noconfig>`，HTTP 失败显示 `<err:httpXXX>`；出错时点击 chip 直接进入 Set 面板
- **API key 只在 host 侧** —— 浏览器只访问同源 `/api/ocgo-usage` JSON 端点，key 永不进入页面

> **取数方式：`GET {baseUrl}/usage` + `Authorization: Bearer <API key>`**（默认 base `https://opencode.ai/zen/go/v1`），与 dsh-opencode-go 读的是同一个端点。**不需要浏览器 cookie**；key 优先取本插件自己的环境变量 / 配置文件，否则回落到 DSH 凭据库，因此已经配好 OpenCode Go 模型 provider 的机器通常零配置即可用。

## 环境要求

- DeepSeek Harness `0.1.0-rc.6` 或更新（web profile）
- `PATH` 上有 pnpm（`dsh plugin` 需要）

## 安装

这是一个标准的 dsh **bundle**：`package.json` 声明了 `dsh.bundle`，通过 `dsh plugin --profile web add <spec>` 安装（pnpm 转发器），自动加入 profile 的 `dsh.profile.bundles`。仓库内置预构建的 `lib/` 产物，**安装无需任何构建步骤或构建权限**——遵循官方 [publish 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。

### 从 GitHub 安装（推荐）

```sh
dsh plugin --profile web add github:v587d/dsh-opencode-go-usage
```

因为 `lib/` 已提交到仓库，pnpm 直接安装构建好的包，不会要求构建脚本授权。

### 从 npm 安装（发布后）

```sh
dsh plugin --profile web add dsh-ocgo-usage
```

> **关于包名：** 仓库名为 `dsh-opencode-go-usage`，但 npm 上同名包已被他人抢先占用（一个功能类似的第三方插件），因此 npm 发布名定为 `dsh-ocgo-usage`。GitHub 安装（推荐）不受影响：`dsh plugin --profile web add github:v587d/dsh-opencode-go-usage`。

### 从 tarball 安装

```sh
pnpm pack            # 在本仓库内 → dsh-ocgo-usage-0.1.0.tgz
dsh plugin --profile web add ./dsh-ocgo-usage-0.1.0.tgz
```

### 本地开发安装

```sh
git clone https://github.com/v587d/dsh-opencode-go-usage.git
cd dsh-opencode-go-usage
pnpm install
pnpm run build
dsh plugin --profile web add link:$(pwd)
```

**重启 `dsh web` 并刷新页面**，chip 出现在输入框上方的 dock。不启动即可验证插件层已组合：

```sh
dsh --profile web --dump-config   # 应显示 "# == dsh-ocgo-usage" 层
```

## 配置

### 方式一：什么都不做（推荐）

只要这台机器已经配好 OpenCode Go 的模型 provider（`llm-pi-ai` 的 `opencode-go`，或 [dsh-opencode-go](https://github.com/Duskriver/dsh-opencode-go)），API key 就已经在 DSH 凭据库里了。插件通过 credentials 服务按引用名 `OPENCODE_GO_API_KEY`、`OPENCODE_API_KEY` 依次解析，命中即用 —— 不需要任何额外配置。

### 方式二：界面内编辑

「设置 → OpenCode Go 用量」页，或点击 chip 展开 → 左下角 `Set`。已设置的值以 `••••` + 末尾 4 位显示，聚焦即可输入新值；`清除` 会删掉本地覆盖，回退到凭据库。

### 方式三：环境变量

```sh
export OPENCODE_GO_API_KEY="sk-..."
```

### 方式四：配置文件

写入 `$DSH_HOME/ocgo-usage.json`（默认 `~/.dsh/ocgo-usage.json`）：

```jsonc
{
  "apiKey": "sk-..."
}
```

```sh
chmod 600 ~/.dsh/ocgo-usage.json
```

优先级：本插件环境变量 > 配置文件 > DSH 凭据库 > 无（显示 `<err:noconfig>`）。

### 可选覆盖项

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | API 基础地址（`/usage` 挂在其后） |
| `OPENCODE_GO_CACHE_TTL` | `300` | host 缓存秒数，范围 60–3600 |
| `OPENCODE_GO_TIMEOUT_MS` | `10000` | HTTP 超时 |
| `OPENCODE_GO_USAGE_VISIBILITY` | `always` | 展示档位：`always` / `provider` / `never`（未知值回落 `always`） |

展示档位也可以直接在「设置 → OpenCode Go 用量」里点选，写入 `$DSH_HOME/ocgo-usage.json`：

```jsonc
{
  "visibility": "provider"
}
```

组合层配置（`~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
- id: ocgo-usage
  config:
    enabled: false    # 总开关，默认 true
```

> **key 无效：** key 被吊销或填错时端点返回 401/403，chip 显示 `<err:http401>` 而非过期数字。在「设置 → OpenCode Go 用量」里重新填入即可，无需重启。

## 使用

点击 chip 展开详情面板：每个窗口显示完整名称、百分比与重置倒计时；右下角 `refresh upd HH:MM` 手动刷新并显示数据时间。

![Usage detail](assets/usage-detail.png)

## 工作原理

- **Host 半**（`src/index.ts`、`src/service.ts`、`src/api.ts`、`src/routes.ts`）—— 按引用名从 DSH 凭据库解析 API key，带 `Authorization: Bearer` 请求 `GET {baseUrl}/usage`，把 `{usage:{rolling,weekly,monthly}}` 校验成 `{percent, resetsAt, status}`，缓存结果，通过同源 JSON 端点 `/api/ocgo-usage`（+ `/api/ocgo-usage/refresh`、`/api/ocgo-usage/config`）提供数据。
- **浏览器半**（`src/client/`）—— 向 `conversation.input.right` slot 注册 chip，每 10s 轮询 host 端点取数，按严重级别着色渲染三个窗口；显示与否 = host 下发的模式 + **本会话实时的模型选择**（直接读模型选择器渲染用的 `modelDirectories` store 并订阅其变更，所以切模型即时反映，不等轮询）。另注册「设置 → OpenCode Go 用量」页，并认领设置导航里自己那一行的图标（官方无图标位，见 Changelog v2.2.2）。

浏览器永远看不到 API key；解析与请求全部在 host 侧完成。

## 安全

- API key 是账号凭据，等同于密码。插件**绝不**记录它、不把它放进错误信息、不发送给浏览器。
- 本地覆盖只写入 `$DSH_HOME/ocgo-usage.json`（chmod 600）；浏览器始终只看到 `••••` + 末尾 4 位的掩码视图。
- 通过凭据库供 key 时不落地任何副本，本插件只持有本次请求解析出的值。

## 开发

```sh
pnpm install
pnpm run build     # tsc -b && tsdown → lib/
pnpm run typecheck # tsc -b --pretty false
pnpm test          # vitest run（解析器 / 配置 / 服务）
```

构建配置（`shared/tsdown.client.ts`）改编自 [dsh-balance-meter](https://github.com/Ghost011118/dsh-balance-meter)（BSD-3-Clause），后者是官方 DSH `packages/client/tsdown.client.ts` 的副本——它产出 web shell 模块表所需的 `window.__ModuleLoader__.load({id, factory})` 闭包工厂产物。

## License

MIT —— 见 [LICENSE](./LICENSE)。

## Changelog

### v2.2.2 - 设置导航显示 OCGo 标记

设置面板左侧导航里「OpenCode Go」那一行现在显示与输入框 chip 同一个 OCGo 标记，不再是官方兜底的通用齿轮。

- 官方**没有**图标位：`settings.section` 的注册项只有 `id` / `order` / `label`，导航图标由设置外壳按 section id 硬编码（`account` / `models` / `agent-presets` / `plugins` / `archived-sessions`），其余一律齿轮。所以本插件按行文本认领自己那一行（`data-ocgo-nav-icon` + 注入一段自有 CSS 隐藏官方 `<svg>`、用 mask 画自己的图形）——与 `dshmarket` 同款做法
- 单色 `currentColor` 着色，深浅主题自动跟随；16px 槽位与官方图标一致，行高与标签位置不变
- 只在「文本等于本插件的 section label」**且**该行带直接子 `<svg>`（官方图标位）时才认领；命中为 0 时官方齿轮照旧，不报错。插件卸载/禁用后标记与样式一并摘除，DOM 复原
- 标记图形与 chip 共用同一份路径数据（`src/client/ocgo-mark.ts`）；官方哪天给 `settings.section` 加上 `icon` 字段，删掉 `src/client/settings-nav-icon.ts` 及其调用即可

### v2.1.0 - 改用 API key 直接读用量

**不再需要浏览器 cookie。** 用量改从 `GET {baseUrl}/usage` 读取（`Authorization: Bearer <API key>`），与 [dsh-opencode-go](https://github.com/Duskriver/dsh-opencode-go) 用的是同一个端点：

- API key 按引用名 `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` 从 DSH 凭据库解析 —— 已配好 OpenCode Go 模型 provider 的机器零配置即可用
- 窗口数据变成结构化的 `{status, percent, resetsAt}`；重置倒计时由绝对时间戳推算，不再依赖页面语言，也不需要再解析本地化的 "Resets in / 重置于" 文案
- 移除 cookie、workspace id 相关的配置、解析与测试；新增「设置 → OpenCode Go 用量」独立设置页
- 可见性改为按**凭据状态**判断（有 key 就显示），不再读会话的实时模型选择 —— 旧的 provider 门禁在 DSH 0.2.0 上会因 `session.models` RPC 形状变化而永远判定为「不是 opencode-go」，导致 chip 无论如何都不显示

### v2.2.1 - 模式与模型切换即时生效

之前切换展示方式或切换模型，chip 都要等下一次轮询（最长 10s）才变。现在两者都即时：

- **模型切换**：判断改用**模型选择器自己渲染用的那个 store**（`@deepseek-ai/dsh-client-ui-model-selection` 的 `modelDirectories` → `ModelDirectory.store`）。同步内存读取 + 订阅变更，所以点下新模型就反映；host 侧那个 `agentDefaultModel.currentSelection()` 探测已移除。
- **模式切换**：设置页与本 chip 同在一个 client bundle，写完后直接通知 chip 重读，零额外请求。
- 该服务按引用名结构化访问（`ctx.get(...)`），**不新增依赖** —— 引入那个包会重排 DSH 客户端包并打散 SlotMap 合并（见 v2.2.0 那条的同类问题）。
- 探测不可用时依旧 **fail-open**：`provider` 档照常显示。
- 轮询回归它唯一的职责：取数字。
- **设置页切换模式不再等一次网关往返**：写配置此前无条件清掉用量缓存，于是紧接的那次读取会重新打 opencode.ai —— 实测同一台机器上「命中缓存 3ms vs 写完后 501ms」。现在只有**凭据**变更才清缓存：模式只是本地配置，`decorate()` 每次读取都会贴上最新的模式，缓存命中也不例外。（实测：可见性写入后 0ms，凭据写入后 446ms。）

### v2.2.0 - 展示方式三档可选

设置页新增「输入框展示」三档，随时切换：

- **常驻展示用量**（默认）—— 只要解析到 key 就显示，与当前模型无关
- **使用 opencode-go 才展示** —— 仅当前模型走 opencode-go provider 时显示
- **不展示用量** —— 输入框不显示，设置页仍可查看

判断从浏览器搬到 host：可见性由 host 按模式与当前模型选择算出（`agentDefaultModel.currentSelection()`），随每次轮询以 `showChip` 下发。浏览器不再做 provider 探测 —— DSH 0.2.0 的客户端既没有 `connection` 服务、`sessions` 也没有 `models()`，那条探测只会回答「未知」，从而把 chip 永久隐藏。`provider` 档在探针不可用时 fail-open（照常显示）。

**升级后需要重启 `dsh web` / 桌面版**（host 半边是模块级改动），页面刷新即可看到新数据。

### v2.0.0 - 中英双语支持

**🎉 重大更新：现在支持中文界面了！**

- **🌏 国际化 (i18n) 支持**：自动识别 DeepSeek Harness 的中文/英文界面语言
  - 新增中文标签解析：`滚动用量`、`每周用量`、`每月用量`
  - 新增中文时间单位支持：秒、分钟、小时、天、周、月、年
  - 智能匹配中英文重置提示：`Resets in` / `重置于`
- **🎨 深色模式优化**：调整 Logo 在深色主题下的对比度，视觉更舒适
- **🧪 完整测试覆盖**：新增中文场景单元测试，确保解析准确性

特别感谢 [@waknow](https://github.com/waknow) 贡献了核心的中文本地化功能！🙏

> 💡 **版本选择建议**：
> - 喜欢纯英文界面？继续使用 [v1.1.0](https://github.com/v587d/dsh-opencode-go-usage/releases/tag/v1.1.0)
> - 需要中英双语支持？升级到 v2.0.0+

---
