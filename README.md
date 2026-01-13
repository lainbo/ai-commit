<a name="readme-top"></a>

<div align="center">

<img height="120" src="https://github.com/lainbo/ai-commit/blob/main/images/logo.png?raw=true">

<h1>Nota AI Commit</h1>

Use OpenAI / Azure OpenAI / DeepSeek / Gemini API to review Git changes, generate conventional commit messages that meet the conventions, simplify the commit process, and keep the commit conventions consistent.

**English** · [简体中文](./README.zh_CN.md) · [Marketplace][vscode-marketplace-link] · [Report Bug][github-issues-link] · [Request Feature][github-issues-link]

<!-- SHIELD GROUP -->

</div>

## ✨ Features

- 🤯 Support generating commit messages based on git diffs using ChatGPT / Azure API / DeepSeek / Gemini API.
- 🗺️ Support multi-language commit messages.
- 😜 Support adding Gitmoji.
- 🛠️ Support custom system prompt.
- 📝 Support Conventional Commits specification.

---

**This project is forked from [sitoi/ai-commit](https://github.com/sitoi/ai-commit) with the following enhancements:**

- ✅ Allow generating commit messages even when there are no staged changes (default behavior: prefer staged diff, fallback to unstaged diff)
- ✅ Add `ai-commit.DIFF_SOURCE` setting to control which git changes are used (`auto` / `staged` / `unstaged` / `staged+unstaged`)
- ✅ Add `ai-commit.SCM_INPUT_BEHAVIOR` setting to control whether to send the SCM input box content as AI context (`context` / `ignore`)
- ✅ Add `ai-commit.REFERENCE_GIT_LOG` setting to provide recent `git log --oneline` history as model context
- ✅ Supports Custom Endpoint URLs for Gemini

## 📦 Installation

1. Search for "Nota AI Commit" in VSCode and click the "Install" button.
2. Install it directly from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo).

> **Note**\
> Make sure your node version >= 16

### ⚙️ Configuration

In the VSCode settings, locate the "ai-commit" configuration options and configure them as needed:

| Configuration      |  Type  |       Default        | Required |                                                       Notes                                                        |
| :----------------- | :----: | :------------------: | :------: | :----------------------------------------------------------------------------------------------------------------: |
| DIFF_SOURCE        | string |         auto         |    No    |      Which changes to use: `auto` (prefer staged), `staged`, `unstaged`, `staged+unstaged` (adds separators).      |
| SCM_INPUT_BEHAVIOR | string |       context        |    No    | How to treat SCM input box content: `ignore` (always ignore), `context` (send as additional context/requirements). |
| REFERENCE_GIT_LOG  |  bool  |        false         |    No    |        Include recent `git log --oneline` history as additional context for the model (disabled by default).        |
| GIT_LOG_COUNT      | number |          20          |    No    |                           How many recent commits to include (1-50).                           |
| GIT_LOG_AUTHOR_SCOPE | string |         all        |    No    |                      Which authors to include: `all` or `self` (uses `git config user.name`).                      |
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

[github-issues-link]: https://github.com/lainbo/ai-commit/issues
[vscode-marketplace-link]: https://marketplace.visualstudio.com/items?itemName=lainbo.nota-ai-commit-lainbo
