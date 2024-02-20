## 1.3.0 (2024-02-21)

- Fiexed a bug where some config values could not be set to zero.
- Added `-q`/`--quiet` CLI option.
- The tool no supresses progress output by default when not in TTY.

## 1.2.0 (2024-02-02)

- Added `API_ENDPOINT` config option.

## 1.1.0 (2023-09-01)

- Added `CODE_BLOCK_PRESERVATION_LINES` config option.
- Added `OUT_SUFFIX` config option.
- Added `out` CLI option.

## 1.0.2 (2023-08-31)

- Removed unnecessary dependencies.

## 1.0.1 (2023-08-31)

- Critical fix for 'bin' executables.

## 1.0.0 (2023-08-31)

This is the first version released on NPM. It's now published as a standalone CLI tool that can be installed with `npm install -g`.

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
