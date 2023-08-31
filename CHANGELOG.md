## 1.0.0

This will be the first version released on NPM. It's now published as a standaline CLI tool that can be installed with `npm install -g`.

**BREAKING**

- Renamed the package/repository name from 'markdown-gpt-translator' to 'chatgpt-md-translator'.
- This tool no longer reads config data from environment variables (except for `HTTPS_PROXY`). Settings must be written in the config file.
- Changed a config key name from `GPT_TRANSLATOR_BASE_DIR` to `BASE_DIR`.

**NEW**

- Changed command-line parser to let you write options like `-m3` or `--model=3` instead of `-m 3` (old style will work, too).
- Added support for indented code blocks (#7).

## 0.3.0 (2023-05-21)

- Added the temperature option.
- Added the API call interval option.
- Added HTTPS Proxy support (via `HTTPS_PROXY` in `.env`)
