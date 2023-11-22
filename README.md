# ChatGPT Markdown Translator

This tool translates a Markdown file into another (natural) language by using OpenAI's ChatGPT API. Its main purpose is to help people translate docs sites for open-source libraries.

As an example, this is React Tutorial translated into Japanese with this tool: [チュートリアル：三目並べ](https://ja-react-8aa88t4yk-fbopensource.vercel.app/learn/tutorial-tic-tac-toe)

As compared to other translation services, ChatGPT is well suited for translating technical documents for several reasons:

- As a large language model, it has a good technical understanding of Markdown and many open-source projects. It tries to preserve the Markdown structure when instructed to do so.
- You can pass any natural language instruction, such as "Use friendly language", "Translate A as B if X and C if Y".

This tool itself is free, but you will be charged according to [OpenAI's pricing page](https://openai.com/pricing). **Even if you're a ChatGPT Plus subscriber, access to the API is not free.**

## Usage

1. Make sure you have a recent version of Node.js installed.
2. Run `npm install --global chatgpt-md-translator`.
3. Go to [OpenAI's developer section](https://platform.openai.com/overview), sign up, register _your own_ credit card, and generate an API key.
4. Create a **config** file in the dotenv format. Use [this template](https://github.com/smikitky/chatgpt-md-translator/blob/main/env-example) and save it to one of the following locations ($CWD refers to the directory where this tool will be invoked).

   - `$CWD/.chatgpt-md-translator`
   - `$CWD/.env`
   - `$HOME/.config/chatgpt-md-translator/config`
   - `$HOME/.chatgpt-md-translator`

   At least, you need to specify your API key as `OPENAI_API_KEY`.

5. Create a **prompt** file. You can copy this [`prompt-example.md`](https://raw.githubusercontent.com/smikitky/markdown-gpt-translator/main/prompt-example.md) to one of the following locations and edit its contents. At least, you need to specify the language name. The contents of this file will be included in each API call, so you can write instructions to ChatGPT in a natural language.

   - `$CWD/prompt.md`
   - `$CWD/.prompt.md`
   - `$HOME/.config/chatgpt-md-translator/prompt.md`
   - `$HOME/.chatgpt-md-translator-prompt.md`

6. Run `chatgpt-md-translator [file-to-translate.md]`. By default, the Markdown file will be overwritten, so make sure it is in a VCS.

**TIP:** If you want to store the config and prompt files in a git-managed directory, you'll probably want to ignore them using `$GITDIR/info/exclude` instead of `.gitignore`.

## Configuration

In addition to `OPENAI_API_TOKEN`, you can set several values in the config file. Only important ones are described below. See the `.env-example` for the full list.

### Model (`MODEL_NAME`)

Set this to one of the models accepted by the OpenAI API. Usually it's one of these:

- `gpt-4` (`4`)
- `gpt-4-32k` (`4large`)
- `gpt-4-1106-preview`: See the notes below
- `gpt-3.5-turbo` (`3`)
- `gpt-3.5-turbo-16k` (`3large`)

Shortcuts (in brackets) are available. This is the setting that has the greatest impact on translation accuracy (and price!). If you try to access a model to which you don't have access yet, you will get an error saying that model 'XYZ' does not exist.

Although GPT-4 is much smarter, it is slower and &gt;10 times more expensive than GPT-3. Try using the GPT-3 model first, especially while you are experimenting with this tool. It's recommended to set the usage limit to a reasonable amount (e.g., $10) on the OpenAI's account management page.

### Fragment Size (`FRAGMENT_TOKEN_SIZE`)

Since ChatGPT cannot handle long texts, this program works by splitting a given Markdown file into multiple parts (fragments), passing them to the API along with the prompt in parallel, and combining the translated results. This option determines the (soft) maximum length of each fragment. The default is 2048 (in string `.length`). The optimal value depends on several factors:

- **Model**: Each model has a defined upper limit on the number of _tokens_. Read [OpenAI's explanation about tokens](https://platform.openai.com/docs/introduction/tokens).
- **Target language**: Some languages are tokenized less effectively than others, which can limit the size of each fragment.
- **Prompt file size**: The prompt will be sent as input along with the Markdown file to translate. The longer the instruction is, the shorter each fragment has to be.
- **Desired processing time**: Splitting into smaller sizes allows for parallel processing and faster completion.

Setting a value that is too large can result in longer processing time, and in worse cases, the transfer of the translated text may stop midway. If this happens, the program will automatically split the fragment in half and try again recursively. Try to avoid this as it can waste both your time and money.

On the other hand, splitting the text into too small fragments can result in a loss of term consistency or accuracy in the translation, since there is less context available for each translation process.

> [!TIP]
> The `gpt-4-1106-preview` model, released in November 2023, supports a massive context window, effectively allowing for unlimited prompt file size. However, since the size of the output is limited to 4,096 tokens, the size of the input text is limited accordingly. Splitting a long article remains a useful approach.

### Temperature (`TEMPERATURE`)

This controls the randomness of the output. See the [official API docs](https://platform.openai.com/docs/api-reference/completions/create#completions/create-temperature). The default is `0.1`, which is intentionally much lower than the original ChatGPT API default (`1.0`). Since this tool works by splitting a file, too much randomness can lead to inconsistent translations. Experience suggests that a high value also increases the risk of breaking markups or ignoring your instructions.

### API Call Interval (`API_CALL_INTERVAL`)

The tool will not call the API more frequently than this value (in seconds) to avoid [these rate limits](https://platform.openai.com/docs/guides/rate-limits/what-are-the-rate-limits-for-our-api). The default is 0, which means the API tries to translate all fragments simultaneously. This is especially useful when you're translating a huge file or when you're still a free trial user.

### Code Block Preservation (`CODE_BLOCK_PRESERVATION_LINES`)

Code blocks usually don't need to be translated, so code blocks that are longer than the number of lines specified by this option will be replaced with a dummy string before being sent to the API, saving you time and money. They will be restored after translation.

Short code blocks (up to 5 lines by default) are sent as-is to give the API a better context for translation. If you want to replace all code blocks, specify `0`. If you don't want this feature (for example, if you want to translate comments in code examples), you can specify a large value like `1000`. But code blocks will never be split into fragments, so be mindful of the token limit!

### Output File Name

By default, the input file will be overwritten with the translated content. If you prefer to save the new content under a different name, you can do so in two ways:

- You can explicitly specify the output file name in command line, like `-o translated.md` or `--out=translated.md`.
- Alternatively, you can specify `OUT_SUFFIX` in the config file. The original extention will be removed, and this suffix will be added. For example, if you specify `"-es.md"` and the input file name is `"index.md"`, the translated file will be saved as `"index-es.md"`.

## CLI Options

These can be used to override the settings in the config file.

Example: `markdown-gpt-translator -m 4 -f 1000 learn/thinking-in-react.md`

- `-m MODEL`, `--model=MODEL`: Sets the language model.
- `-f NUM`, `--fragment-size=NUM`: Sets the fragment size (in string length).
- `-t NUM`, `--temperature=NUM`: Sets the "temperature", or the randomness of the output.
- `-i NUM`, `--interval=NUM`: Sets the API call interval.
- `-o NAME`, `--out=NAME`: Explicitly sets the output file name. If set, the `OUT_SUFFIX` setting will be ignored.
- `--out-suffix=NAME`: Output file suffix. See above.

## Limitations

- This tool does not perform serious Markdown parsing for fragment splitting. The algorithm may fail on an atypical source file that has no or very few blank lines.
- The tool has not been tested with Markdown files outside of React Docs (react.dev), although I expect most potential problems can be solved by tweaking `instruction.md`.
- The combination of this tool and GPT-4 should do 80% of the translation job, but be sure to review the result at your own responsibility. It sometimes ignores your instruction or outputs invalid Markdown, most of which are easily detectable and fixable with tools like VS Code's diff editor.
