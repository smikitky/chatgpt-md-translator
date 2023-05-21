# ChatGPT Markdown Translator

This tool translates a Markdown file into another (natural) language by using OpenAI's ChatGPT API. Its main purpose is to help people translate docs sites for open-source libraries.

As an example, this is React Tutorial translated into Japanese with this tool: [チュートリアル：三目並べ](https://ja-react-8aa88t4yk-fbopensource.vercel.app/learn/tutorial-tic-tac-toe) (Note that the output contained a small number of syntax and line break errors that required several minutes of fixing using VS Code's diff editor.)

As compared to other translation services, ChatGPT is well suited for translating technical documents for several reasons:

- As a large language model, it has a good technical understanding of Markdown and many open-source projects. It tries to preserve the Markdown structure when instructed to do so.
- You can pass any natural language instruction, such as "Use friendly language", "Translate A as B if X and C if Y".

This tool itself is free, but you will be charged according to [OpenAI's pricing page](https://openai.com/pricing). **Even if you're a ChatGPT Plus subscriber, access to the API is not free.**

## Usage

For now, this is an experimental project and has not been published to NPM. But this also means you can hack the script instantly!

1. Make sure you have a recent version of Node.js installed.
2. Clone this repository from GitHub, `cd` into it, and run `npm install` (or `npm ci`).
3. Go to [OpenAI's developer section](https://platform.openai.com/overview), sign up, register _your own_ credit card, and generate an API key.
4. Copy `env-example` as `.env` and configure. You need to add at least your API key.
5. Copy `prompt-example.md` as `prompt.md`, and edit its contents. At least, you need to specify the language name. The contents of this file are included in each API call, so you can write instructions to ChatGPT in a natural language.
6. Run `npx ts-node-esm index.ts [file-to-translate.md]`. The Markdown file will be overwritten, so make sure it is in a VCS.

## Configuration

In addition to `OPENAI_API_TOKEN`, you can set several values in `.env`. Only important ones are described below. See the `.env-example` for the full list.

### Model (`MODEL_NAME`)

Set it to one of `gpt-4`, `gpt-4-32k` or `gpt-3.5-turbo`. This is the setting that has the greatest impact on translation accuracy (and price!).

As of May 2023, the GPT-4 model is in a limited beta. If you are not granted access yet, you'll get an error saying the model 'gpt-4' does not exist. [Join the waitlist](https://openai.com/waitlist/gpt-4-api).

Although GPT-4 is much smarter, it is slower and &gt;10 times more expensive than GPT-3. Try using the GPT-3 model first, especially while you are experimenting with this tool. It's recommended to set the usage limit to a reasonable amount (e.g., $10) on the OpenAI's account management page.

### Fragment Size (`FRAGMENT_TOKEN_SIZE`)

Since ChatGPT cannot handle long texts, this program works by splitting a given Markdown file into multiple parts (fragments), passing them to the API along with the instruction (`prompt.md`) in parallel, and combining the translated results. It also removes code blocks before passing the contents to the API and restores them after the translation (this means nothing inside clode blocks will be translated).

The `-f` option (or `FRAGMENT_TOKEN_SIZE` env) determines the (soft) maximum length of each fragment. The default is 2048 (in string `.length`). The appropriate value depends on several factors:

- **Model**: GPT-4 can handle a larger amount of text at once.
- **Target Language**: Some languages are _tokenized_ less effectively than others, which can limit the size of each fragment. Read [OpenAI's explanation about tokens](https://platform.openai.com/docs/introduction/tokens).
- **Prompt File Size**: The prompt will be sent as input along with the Markdown source. The longer the instruction is, the shorter each fragment has to be.
- **Desired Processing Time**: Splitting into smaller sizes allows for parallel processing and faster completion.

Setting a value that is too large can result in longer processing time, and in worse cases, the transfer of the translated text may stop midway. If this happens, the program will automatically split the fragment in half and try again recursively. But you should avoid this as it can waste both your time and money.

On the other hand, splitting the text into too small fragments can result in a loss of term consistency or accuracy in the translation, since there is less context available for each translation process.

### Temperature (`TEMPERATURE`)

This controls the randomness of the output. See the [official API docs](https://platform.openai.com/docs/api-reference/completions/create#completions/create-temperature). The default is `0.1`, which is intentionally much lower than the original ChatGPT API default (`1.0`). Since this tool works by splitting a file, too much randomness can lead to inconsistent translations. Experience suggests that a high value also increases the risk of breaking the markups or ignoring the instructions.

## CLI Options

These can be used to override the settings in `.env`.

Example: `npx ts-node-esm index.ts -m 4 -f 1000 learn/thinking-in-react.md`

- `-m <model>`: Sets the language model (one of 'gpt-4', 'gpt-4-32k' or 'gpt-3.5-turbo'). Shorthands are available ('4', '4large' and '3', respectively).
- `-f <length>`: Sets the fragment size (in string length).
- `-t <temperature>`: Sets the "temperature", or the randomness of the output.
- `-i <seconds>`: Sets the API call interval. We will not call the API more frequently than this value (in seconds). The default is 0, which means the API tries to translate all fragments simultaneously. This is especially useful when you're translating a huge file, or when you're still a free trial user.

## Limitations

- This tool does not do serious Markdown parsing for fragment splitting. The algorithm may fail on an atypical source file that has large _indented_ code blocks, has no line breaks, or has no blank lines.
- The tool has not been tested with Markdown files outside of React Docs (react.dev), although I expect most potential problems can be solved by tweaking `instruction.md`.
- Contents in code blocks (\`\`\`), including comments, are not translated.
- The combination of this tool and GPT-4 should do 80% of the translation job, but be sure to review the result at your own responsibility. It sometimes ignores your instruction or outputs invalid Markdown, most of which are easily detectable and fixable with tools like VS Code's diff editor.
- The API is sometimes unstable. If you experience frequent connection errors, reduce the fragment size or try again a few hours later.
