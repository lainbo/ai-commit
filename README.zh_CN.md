<a name="readme-top"></a>

<div align="center">

<img height="120" src="https://github.com/lainbo/ai-commit/blob/main/images/logo.png?raw=true">

<h1>Nota AI Commit</h1>

使用 OpenAI / Azure OpenAI / DeepSeek / Gemini API 审查 Git 变更，生成符合 Conventional Commits 规范的提交消息，简化提交流程，并保持提交规范一致。

[English](./README.md) · **简体中文** · [插件市场][vscode-marketplace-link] · [报告问题][github-issues-link] · [请求功能][github-issues-link]

<!-- SHIELD GROUP -->

</div>

## 🍴 Fork 说明

本仓库 Fork 自 `sitoi/ai-commit`：

- 上游仓库：https://github.com/sitoi/ai-commit
- GitHub：https://github.com/lainbo/ai-commit
- 插件市场：https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
- Fork 目的：基于个人使用习惯做小调整
- 本 Fork 的主要改动：
  - 即使没有暂存变更也允许生成提交信息（默认：优先使用暂存区 diff；若为空则回退到未暂存 diff）
  - 新增配置 `ai-commit.DIFF_SOURCE` 用于控制生成时使用哪些改动（`auto` / `staged` / `unstaged` / `staged+unstaged`）
  - 支持 Gemini 自定义 Endpoint URL

## ✨ 特性

- 🤯 支持使用 ChatGPT / Azure API / DeepSeek / Gemini API 基于 git diffs 生成提交信息。
- 🗺️ 支持多语言提交信息。
- 😜 支持添加 Gitmoji。
- 🛠️ 支持自定义系统提示词。
- 📝 支持 Conventional Commits 规范。

## 📦 安装

1. 在 VSCode 中搜索 "Nota AI Commit" 并点击 "Install" 按钮。
2. 从 [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo) 直接安装。

> **Note**\
> 请确保 Node.js 版本 >= 16

## 🤯 使用

1. 确保您已经安装并启用了 `Nota AI Commit` 扩展。
2. 在 VSCode 设置中，找到 "ai-commit" 配置项，并按需配置（已分组：插件设置 / OpenAI 设置 / Gemini 设置）。
3. 在项目中进行更改（暂存或未暂存）。
4. （可选）如果你想为提交信息提供额外上下文，请在点击 Nota AI Commit 按钮前，在源代码管理面板的消息输入框中输入这些上下文。
5. 在 "Source Control" 面板的提交消息输入框旁，点击 "Nota AI Commit" 图标按钮。点击后，扩展会生成提交信息（会考虑你输入的额外上下文）并填充到输入框中。
6. 检查生成的提交信息，如满意即可提交改动。

> **Note**\
> 如果超过最大 token 长度请分批将代码添加到暂存区。

### ⚙️ 配置

> **Note** 版本 >= 0.0.5 时不需要配置 `EMOJI_ENABLED` 和 `FULL_GITMOJI_SPEC`；默认提示词为 [prompt/with_gitmoji.md](https://github.com/lainbo/ai-commit/blob/main/prompt/with_gitmoji.md)。如不需要使用 `Gitmoji`，请将 `SYSTEM_PROMPT` 设置为你的自定义提示词，可参考 [prompt/without_gitmoji.md](https://github.com/lainbo/ai-commit/blob/main/prompt/without_gitmoji.md)。

在 VSCode 设置中，找到 "ai-commit" 配置项，并按需配置：

| 配置               |  类型  |         默认         | 必填 |                                                       说明                                                        |
| :----------------- | :----: | :------------------: | :--: | :---------------------------------------------------------------------------------------------------------------: |
| DIFF_SOURCE        | string |         auto         |  否  |       使用哪些改动：`auto`（优先暂存）、`staged`、`unstaged`、`staged+unstaged`（会增加分隔符）。       |
| AI_PROVIDER        | string |        openai        |  是  |                                      选择 AI Provider：`openai` 或 `gemini`。                                      |
| OPENAI_API_KEY     | string |         None         |  是  |        当 `AI Provider` 设为 `OpenAI` 时必填。[OpenAI token](https://platform.openai.com/account/api-keys)         |
| OPENAI_BASE_URL    | string |         None         |  否  |                 如使用 Azure：`https://{resource}.openai.azure.com/openai/deployments/{model}`                  |
| OPENAI_MODEL       | string |        gpt-4o        |  是  |        OpenAI 模型；你可以运行 `Show Available OpenAI Models` 命令从列表中选择一个模型。        |
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

[github-codespace-link]: https://codespaces.new/lainbo/ai-commit
[github-codespace-shield]: https://github.com/lainbo/ai-commit/blob/main/images/codespaces.png?raw=true
[github-contributors-link]: https://github.com/lainbo/ai-commit/graphs/contributors
[github-contributors-shield]: https://img.shields.io/github/contributors/lainbo/ai-commit?color=c4f042&labelColor=black&style=flat-square
[github-forks-link]: https://github.com/lainbo/ai-commit/network/members
[github-forks-shield]: https://img.shields.io/github/forks/lainbo/ai-commit?color=8ae8ff&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/lainbo/ai-commit/issues
[github-issues-shield]: https://img.shields.io/github/issues/lainbo/ai-commit?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/lainbo/ai-commit/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/github/license/lainbo/ai-commit?color=white&labelColor=black&style=flat-square
[github-stars-link]: https://github.com/lainbo/ai-commit/network/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/lainbo/ai-commit?color=ffcb47&labelColor=black&style=flat-square
[pr-welcome-link]: https://github.com/lainbo/ai-commit/pulls
[pr-welcome-shield]: https://img.shields.io/badge/🤯_pr_welcome-%E2%86%92-ffcb47?labelColor=black&style=for-the-badge
[github-contrib-link]: https://github.com/lainbo/ai-commit/graphs/contributors
[github-contrib-shield]: https://contrib.rocks/image?repo=lainbo%2Fai-commit
[vscode-marketplace-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
[vscode-marketplace-shield]: https://img.shields.io/vscode-marketplace/v/lainbo.nota-ai-commit-lainbo.svg?label=vscode%20marketplace&color=blue&labelColor=black&style=flat-square
[total-installs-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
[total-installs-shield]: https://img.shields.io/vscode-marketplace/d/lainbo.nota-ai-commit-lainbo.svg?&labelColor=black&style=flat-square
[avarage-rating-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
[avarage-rating-shield]: https://img.shields.io/vscode-marketplace/r/lainbo.nota-ai-commit-lainbo.svg?color=green&labelColor=black&style=flat-square
