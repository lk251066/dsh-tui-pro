# dsh-tui-pro

[English](README.md) | [简体中文](README.zh-CN.md)

这是一个由社区维护的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 全屏终端界面。对话、输入框、项目会话和智能体状态集中在同一个支持键盘与鼠标操作的工作区中。

![dsh-tui-pro 展示项目对话、工具结果、计划进度和活跃会话](packages/dsh-tui/assets/overview.png)

## 快速开始

用一条命令安装插件及其 profile 配置层：

```bash
dsh plugin --profile tui add @lk251066/dsh-tui
```

然后在需要处理的项目目录中启动：

```bash
dsh --profile tui
```

这个包同时包含 TUI 插件和 `cordis.patch.yml` profile 配置层，不需要安装单独的 bundle 包。

## 核心体验

| 区域 | 行为 |
| --- | --- |
| 对话 | 只有聊天记录区域滚动，输入框和右侧栏始终固定。用户消息、助手 Markdown、思考、工具、diff、计划和子代理使用紧凑且可区分的样式。 |
| 会话 | 固定助手独立于项目工作区。活跃项目会话按工作区分组，可以从侧边栏或 `/sessions` 打开。 |
| 输入 | Enter 在当前回合中继续发送，Tab 将消息排到下一回合，空输入时 Up 恢复最近提交，Esc 会先取回最新排队消息再取消。 |
| 模型 | 每个活跃会话独立保存模型和思考等级。状态行显示模型、上下文用量、记忆、计划模式和当前步骤的滚动输出速度。 |
| 文件与图片 | `@` 补全文件。所选模型明确支持图片输入时，`Alt+V` 可附加剪贴板图片。 |
| 审查 | 工具卡、代码高亮、词级 diff、审批和可折叠详情让实现过程保持可读，同时减少无效界面元素。 |

## 会话模型

助手是一个位于所有工作区之外的持久会话。它没有项目目录，也不计入 `Active sessions` 数量。助手可以管理活跃项目会话，并读取其中已完成的用户与助手对话，但不会获取隐藏思考或工具过程。

在某个目录启动时，会打开该目录中手动排序最靠前的活跃项目会话。如果不存在，dsh 会新建会话并加入该工作区。使用 `/new` 在当前项目新建会话，使用 `/new <路径>` 为另一个项目新建会话，使用 `/assistant` 返回固定助手。

`/quit` 关闭当前项目会话、保留历史并返回助手；`/exit` 关闭整个 TUI。完整历史始终可以通过 `/sessions` 查看。

## 常用操作

| 操作 | 指令或按键 |
| --- | --- |
| 浏览完整历史 | `/sessions` |
| 切换活跃项目会话 | `/switch`、`Alt+Left`、`Alt+Right`，或点击侧边栏会话 |
| 关闭当前项目会话 | `/quit` 或空输入时按 `Delete` |
| 浏览当前对话检查点 | 双击 Escape |
| 展开或收起工具与上下文详情 | `Ctrl+O` |
| 展开或收起已完成的思考 | `Ctrl+R` |
| 选择并复制聊天文本 | 按住鼠标左键拖动 |
| 附加剪贴板图片 | `Alt+V` |
| 控制当前会话记忆 | `/memory`、`/memory on`、`/memory off` |

在 TUI 中运行 `/help` 可以查看完整指令。模型、思考等级、skills、主题、权限、设置和审批选择器都在底部固定区域显示，不使用居中弹窗。

## 运行要求

- Node.js `^22.19.0 || >=24.0.0`
- DeepSeek Harness `@deepseek-ai/dsh@0.1.0-rc.6`
- 支持 ANSI 转义序列的终端
- 在仓库之外配置 `DEEPSEEK_API_KEY`

Windows 使用 PowerShell 读取剪贴板图片，macOS 需要 `pngpaste`，Linux 需要 `wl-paste` 或 `xclip`。

## 配置

内置 profile 默认使用以下 TUI 配置：

```yaml
- id: tui
  name: '@lk251066/dsh-tui'
  config:
    sidebarWidth: 32
    showReasoning: false
    maxToolOutputLines: 6
    maxMessageLines: 30
```

内部宽度低于 65 列时侧边栏会隐藏。建议终端高度至少为 24 行。

## 项目状态

当前公开版本是 [`1.8.0`](https://www.npmjs.com/package/@lk251066/dsh-tui/v/1.8.0)。当前源码目标为 `1.8.1`，源码、npm 打包产物、干净 profile 和真实 PTY 的验证结果记录在 [TESTING.md](TESTING.md) 中。

请勿使用旧的 GitHub `v1.0.0` 标签，它早于修复后的源码和 bundle 元数据。

## 开发文档

- [包参考](packages/dsh-tui/README.md)
- [开发环境](DEVELOPMENT.md)
- [验证说明](TESTING.md)
- [实施记录](REPAIR_PLAN.md)
- [变更记录](CHANGELOG.md)

在 Windows 上运行 `pnpm run docs:screenshot`，可以通过真实 TUI 渲染器重新生成匿名 README 截图。该命令使用隔离的内存演示数据，不读取本机 dsh profile 或 API key。

## 许可证

MIT
