<a name="readme-top"></a>

<div align="center">

<img height="120" src="https://github.com/lainbo/ai-commit/blob/main/images/logo.png?raw=true">

<h1>Nota AI Commit</h1>

Use OpenAI / Azure OpenAI / DeepSeek / Gemini API to review Git changes, generate conventional commit messages that meet the conventions, simplify the commit process, and keep the commit conventions consistent.

**English** · [简体中文](./README.zh_CN.md) · [Marketplace][vscode-marketplace-link] · [Report Bug][github-issues-link] · [Request Feature][github-issues-link]

<!-- SHIELD GROUP -->

</div>

## 🍴 Fork Notice

This repository is a fork of `sitoi/ai-commit`:

- Upstream: https://github.com/sitoi/ai-commit
- GitHub: https://github.com/lainbo/ai-commit
- Marketplace: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
- Purpose: personal tweaks and republishing under my own VS Code publisher
- Changes in this fork:
  - Allow generating commit messages even when there are no staged changes (default behavior: prefer staged diff, fallback to unstaged diff)
  - Add `ai-commit.DIFF_SOURCE` setting to control which git changes are used (`auto` / `staged` / `unstaged` / `staged+unstaged`)
  - Supports Custom Endpoint URLs for Gemini

## ✨ Features

- 🤯 Support generating commit messages based on git diffs using ChatGPT / Azure API / DeepSeek / Gemini API.
- 🗺️ Support multi-language commit messages.
- 😜 Support adding Gitmoji.
- 🛠️ Support custom system prompt.
- 📝 Support Conventional Commits specification.

## 📦 Installation

1. Search for "Nota AI Commit" in VSCode and click the "Install" button.
2. Install it directly from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo).

> **Note**\
> Make sure your node version >= 16

## 🤯 Usage

1. Ensure that you have installed and enabled the "Nota AI Commit" extension.
2. In VSCode settings, locate the "ai-commit" configuration options and configure them as needed (grouped as: General / OpenAI / Gemini).
3. Make changes in your project (staged or unstaged).
4. (Optional) If you want to provide additional context for the commit message, type it in the Source Control panel's message input box before clicking the Nota AI Commit button.
5. Next to the commit message input box in the "Source Control" panel, click the "Nota AI Commit" icon button. After clicking, the extension will generate a commit message (considering any additional context if provided) and populate it in the input box.
6. Review the generated commit message, and if you are satisfied, proceed to commit your changes.

> **Note**\
> If the code exceeds the maximum token length, consider adding it to the staging area in batches.

### ⚙️ Configuration

> **Note** Version >= 0.0.5 Don't need to configure `EMOJI_ENABLED` and `FULL_GITMOJI_SPEC`, Default Prompt is [prompt/with_gitmoji.md](https://github.com/lainbo/ai-commit/blob/main/prompt/with_gitmoji.md), If don't need to use `Gitmoji`. Please set `SYSTEM_PROMPT` to your custom prompt, please refer to [prompt/without_gitmoji.md](https://github.com/lainbo/ai-commit/blob/main/prompt/without_gitmoji.md).

In the VSCode settings, locate the "ai-commit" configuration options and configure them as needed:

| Configuration      |  Type  |       Default        | Required |                                                       Notes                                                        |
| :----------------- | :----: | :------------------: | :------: | :----------------------------------------------------------------------------------------------------------------: |
| DIFF_SOURCE        | string |         auto         |    No    |      Which changes to use: `auto` (prefer staged), `staged`, `unstaged`, `staged+unstaged` (adds separators).      |
| AI_PROVIDER        | string |        openai        |   Yes    |                                     Select AI Provider: `openai` or `gemini`.                                      |
| OPENAI_API_KEY     | string |         None         |   Yes    |    Required when `AI Provider` is set to `OpenAI`. [OpenAI token](https://platform.openai.com/account/api-keys)    |
| OPENAI_BASE_URL    | string |         None         |    No    |                If using Azure, use: https://{resource}.openai.azure.com/openai/deployments/{model}                 |
| OPENAI_MODEL       | string |        gpt-4o        |   Yes    |      OpenAI MODEL, you can select a model from the list by running the `Show Available OpenAI Models` command      |
| AZURE_API_VERSION  | string |         None         |    No    |                                                 AZURE_API_VERSION                                                  |
| OPENAI_TEMPERATURE | number |         0.7          |    No    |      Controls randomness in the output. Range: 0-2. Lower values: more focused, Higher values: more creative       |
| GEMINI_API_KEY     | string |         None         |   Yes    |     Required when `AI Provider` is set to `Gemini`. [Gemini API key](https://makersuite.google.com/app/apikey)     |
| GEMINI_BASE_URL    | string |         None         |    No    |         Gemini Base URL (optional). Use a third-party provider endpoint if needed; otherwise leave empty.          |
| GEMINI_MODEL       | string | gemini-2.0-flash-001 |   Yes    |                       Gemini MODEL. Currently, model selection is limited to configuration.                        |
| GEMINI_TEMPERATURE | number |         0.7          |    No    | Controls randomness in the output. Range: 0-2 for Gemini. Lower values: more focused, Higher values: more creative |
| AI_COMMIT_LANGUAGE | string |          en          |   Yes    |                                               Supports 19 languages                                                |
| SYSTEM_PROMPT      | string |         None         |    No    |                                                Custom system prompt                                                |

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
[total-installs-shield]: https://img.shields.io/vscode-marketplace/d/lainbo.nota-ai-commit-lainbo.svg?&color=greeen&labelColor=black&style=flat-square
[avarage-rating-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
[avarage-rating-shield]: https://img.shields.io/vscode-marketplace/r/lainbo.nota-ai-commit-lainbo.svg?&color=green&labelColor=black&style=flat-square
