## 1.0.0 (in alpha)

This will be the first version released on NPM.

**BREAKING**

- This tool will **not** read config data from environment variables any more. Settings such as `HTTPS_PROXY` must be written directly in the config file.
- Changed a config key name from `GPT_TRANSLATOR_BASE_DIR` to `BASE_DIR`.

## 0.3.0 (2023-05-21)

- Added the temperature option.
- Added the API call interval option.
- Added HTTPS Proxy support (via `HTTPS_PROXY` in `.env`)
