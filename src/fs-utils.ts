import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// We use this to output a bit frindlier error

export const readTextFile = async (filePath: string): Promise<string> => {
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

export const checkFileWritable = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath, fs.constants.F_OK | fs.constants.W_OK);
    // The file exists and can be overwritten
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // The file does not exist, check if directory is writable
      const dirPath = path.dirname(filePath);
      try {
        await fs.access(dirPath, fs.constants.F_OK | fs.constants.W_OK);
        // Directory exists and is writable
        return true;
      } catch (dirError) {
        // Directory is not writable or does not exist
        return false;
      }
    }
    // File exists but is not writable, or other errors
    return false;
  }
};
