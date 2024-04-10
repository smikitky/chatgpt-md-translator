## 1.7.0 (2024-04-10)

- GPT-4 Turbo has entered general availability, so the model shorthand `4` now points to `gpt-4-turbo` instead of `gpt-4`. `gpt-4-turbo` is faster, smarter, and more cost-effective; there is almost no practical reason to choose `gpt-4` now.

## 1.6.0 (2024-04-04)

- You can now specify more than one file to translate multiple source files sequentially (#20).
- Added `OVERWRITE_POLICY` (`-w`/`--overwrite-policy`) option, which allows you to specify what happens if the output file already exists (#20).
- When one of the API calls causes a critical error, the other API calls are now aborted as well.
- Fixed an error where the translation status was still reported in a non-TTY environment.
- Fixed an issue that occurred when the status text was longer than the terminal width.

## 1.5.1 (2024-04-03)

- Fixed error handling when chekcing if the output file is writable.
- Hid a deprecated and undocumented CLI option from `--help`.

## 1.5.0 (2024-04-03)

- Added `OUTPUT_FILE_PATH` option, which can flexibly transform the input file path into the output file path.
- Deprecated `OUT_SUFFIX` option in favor of `OUTPUT_FILE_PATH`.
- Enhanced error reporting to be friendlier when a file system error occurs.

## 1.4.0 (2024-03-30)

- Checks the permission of the output file/directory before actually calling the API (#17).
- Fixed: `out` CLI option is now relative to BASE_DIR rather than the target file, following starndard convention of other CLI tools (#16).

## 1.3.2 (2024-03-14)

- Fixed a typo in config name `API_ENDOPOINT` => `API_ENDPOINT` (#15)

## 1.3.1 (2024-02-21)

- Fixed help message.

## 1.3.0 (2024-02-21)

- Fixed a bug where some config values could not be set to zero.
- Added `-q`/`--quiet` CLI option.
- The tool now suppresses progress output by default when not in TTY.

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
