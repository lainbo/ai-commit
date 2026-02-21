<a name="readme-top"></a>

<div align="center">

<img height="120" src="https://github.com/lainbo/ai-commit/blob/main/images/logo.png?raw=true">

<h1>Nota AI Commit</h1>

使用 OpenAI / Azure OpenAI / DeepSeek / Gemini API 审查 Git 变更，生成符合 Conventional Commits 规范的提交消息，简化提交流程，并保持提交规范一致。

[English](./README.md) · **简体中文** · [插件市场][vscode-marketplace-link] · [报告问题][github-issues-link] · [请求功能][github-issues-link]

<!-- SHIELD GROUP -->

</div>

## ✨ 特性

- 🤯 支持使用 ChatGPT / Azure API / DeepSeek / Gemini API 基于 git diffs 生成提交信息。
- 🗺️ 支持多语言提交信息。
- 😜 支持添加 Gitmoji。
- 🛠️ 支持自定义系统提示词。
- 📝 支持 Conventional Commits 规范。

---

**本项目 Fork 自 [sitoi/ai-commit](https://github.com/sitoi/ai-commit)，并新增以下功能：**

- ✅ 即使没有暂存变更也允许生成提交信息（默认：优先使用暂存区 diff；若为空则回退到未暂存 diff）
- ✅ 新增配置 `ai-commit.DIFF_SOURCE` 用于控制生成时使用哪些改动（`auto` / `staged` / `unstaged` / `staged+unstaged`）
- ✅ 新增配置 `ai-commit.SCM_INPUT_BEHAVIOR` 用于控制是否将源代码管理输入框内容作为 AI 上下文发送（`context` / `ignore`）
- ✅ 新增配置 `ai-commit.REFERENCE_GIT_LOG`，可把最近的 `git log --oneline` 提交历史作为模型参考上下文
- ✅ 支持 Gemini 自定义 Endpoint URL

## 📦 安装

1. 在 VSCode 中搜索 "Nota AI Commit" 并点击 "Install" 按钮。
2. 从 [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo) 直接安装。

> **Note**\
> 请确保 Node.js 版本 >= 16

### ⚙️ 配置

在 VSCode 设置中，找到 "ai-commit" 配置项，并按需配置：

| 配置               |  类型  |         默认         | 必填 |                                                       说明                                                        |
| :----------------- | :----: | :------------------: | :--: | :--------------------------------------------------------------------------------------------------------------- |
| DIFF_SOURCE        | string |         auto         |  否  |       使用哪些改动：`auto`（优先暂存）、`staged`、`unstaged`、`staged+unstaged`（会增加分隔符）。       |
| SCM_INPUT_BEHAVIOR | string |       context        |  否  | 生成时如何处理输入框：`ignore`（始终忽略），`context`（作为额外上下文/约束发送，例如 Bug ID）。 |
| REFERENCE_GIT_LOG  |  bool  |        false         |  否  |       是否把最近的 `git log --oneline` 提交历史作为额外上下文提供给模型参考（默认关闭）。       |
| GIT_LOG_COUNT      | number |          20          |  否  |                         提供给模型参考的最近提交条数（1-50）。                         |
| GIT_LOG_AUTHOR_SCOPE | string |        all         |  否  |            提交历史包含哪些作者：`all` 或 `self`（`self` 使用 `git config user.name` 过滤）。            |
| AI_PROVIDER        | string |        openai        |  是  |                                      选择 AI Provider：`openai` 或 `gemini`。                                      |
| OPENAI_API_KEY     | string |         None         |  是  |        当 `AI Provider` 设为 `OpenAI` 时必填。[OpenAI token](https://platform.openai.com/account/api-keys)         |
| OPENAI_BASE_URL    | string |         None         |  否  |                 如使用 Azure：`https://{resource}.openai.azure.com/openai/deployments/{model}`                  |
| OPENAI_MODEL       | string |      gpt-5-mini      |  是  |        OpenAI 模型；你可以运行 `Show Available OpenAI Models` 命令从列表中选择一个模型。        |
| AZURE_API_VERSION  | string |         None         |  否  |                                                  AZURE_API_VERSION                                                  |
| OPENAI_TEMPERATURE | number |         0.7          |  否  |                控制输出随机性。范围：0-2。值越低越集中，值越高越有创造性。                |
| GEMINI_API_KEY     | string |         None         |  是  |        当 `AI Provider` 设为 `Gemini` 时必填。[Gemini API key](https://makersuite.google.com/app/apikey)        |
| GEMINI_BASE_URL    | string |         None         |  否  |           Gemini Base URL（可选）。如使用第三方供应商 Endpoint 则填写；否则留空。           |
| GEMINI_MODEL       | string | gemini-2.0-flash-001 |  是  |                                 Gemini 模型。当前模型选择仅限于配置项。                                 |
| GEMINI_TEMPERATURE | number |         0.7          |  否  |         控制输出随机性。Gemini 范围：0-2。值越低越集中，值越高越有创造性。         |
| AI_COMMIT_LANGUAGE | string |          en          |  是  |                                                  支持 19 种语言                                                  |
| SYSTEM_PROMPT      | string |         None         |  否  |                                                  自定义系统提示词                                                  |

---

## 📝 License

This project is [MIT](./LICENSE) licensed.

<!-- LINK GROUP -->

[github-issues-link]: https://github.com/lainbo/ai-commit/issues
[vscode-marketplace-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
