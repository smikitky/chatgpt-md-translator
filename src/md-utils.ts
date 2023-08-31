import * as crypto from 'node:crypto';

type CodeBlocks = Record<string, string>;

interface ReplaceResult {
  output: string;
  codeBlocks: CodeBlocks;
}

/**
 * Replace code blocks with placeholders.
 * @param mdContent - Markdown content.
 * @returns Markdown content with code blocks replaced with placeholders.
 */
export const replaceCodeBlocks = (
  mdContent: string,
  minLines = 5
): ReplaceResult => {
  const codeBlockRegex = /(\s*)```.*\n\1([\s\S]*?)\n\1```/g;
  const codeBlocks: CodeBlocks = {};
  const output = mdContent.replace(codeBlockRegex, (match, indent, content) => {
    const lines = match.split('\n');
    if (lines.length >= minLines) {
      const id = crypto.randomBytes(8).toString('hex');
      codeBlocks[id] = content;
      return `${lines[0]}\n${indent}(((((${id})))))\n${indent}\`\`\``;
    } else return match;
  });
  return { output, codeBlocks };
};

/**
 * Restore code blocks from placeholders.
 * @param mdContent - Markdown content with code blocks replaced.
 * @param codeBlocks - Code blocks to restore.
 * @returns - Markdown content with code blocks restored.
 */
export const restoreCodeBlocks = (
  mdContent: string,
  codeBlocks: CodeBlocks
): string => {
  const placeholderRegex = /\(\(\(\(\(([a-z0-9]+)\)\)\)\)\)/g;
  return mdContent.replace(placeholderRegex, (match, id) => {
    return codeBlocks[id] ?? match;
  });
};

/**
 * Split a string into multiple strings at blank lines.
 * @param input The string to split.
 * @param fragmentLength The soft maximum length of each fragment.
 * If the string is longer than this, it will be split at the nearest blank line.
 * If this is 0, the input will be split in half.
 */
export const splitStringAtBlankLines = (
  input: string,
  fragmentLength: number = 2048
): string[] | null => {
  const lines = input.split('\n');
  let inCodeBlock = false;
  let currentFragment: string[] = [];
  let fragments: string[] = [];
  let nearstToHalfDiff: number = Infinity;
  let nearstToHalfIndex: number = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) inCodeBlock = !inCodeBlock;

    if (!inCodeBlock && lines[i].trim() === '') {
      const currentLength = currentFragment.join('\n').length;

      if (fragmentLength > 0) {
        if (currentLength + lines[i].length > fragmentLength) {
          fragments.push(currentFragment.join('\n'));
          currentFragment = [];
        }
      } else {
        const halfLength = Math.floor(lines.length / 2);
        if (Math.abs(halfLength - i) < nearstToHalfDiff) {
          nearstToHalfDiff = Math.abs(halfLength - i);
          nearstToHalfIndex = i;
        }
      }
    }
    currentFragment.push(lines[i]);
  }

  if (fragmentLength === 0) {
    if (nearstToHalfIndex <= 0) return null; // no split point found
    fragments.push(lines.slice(0, nearstToHalfIndex).join('\n'));
    fragments.push(lines.slice(nearstToHalfIndex).join('\n'));
    return fragments;
  } else {
    fragments.push(currentFragment.join('\n'));
    return fragments;
  }
};
