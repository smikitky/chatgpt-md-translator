import * as fs from 'node:fs/promises';

// We use this to output a bit frindlier error

const readTextFile = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e: any) {
    if (e.code === 'ENOENT') {
      throw new Error('File not found: ' + filePath);
    } else {
      throw e;
    }
  }
};

export default readTextFile;
