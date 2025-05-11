import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { FileSystemStatus, FileInfo } from '../types';

const execAsync = promisify(exec);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

export async function getFileSystemStatus(): Promise<FileSystemStatus> {
  try {
    const videoDir = process.env.CV_VIDEO_DIR || '/app/videos';
    const imageDir = process.env.CV_KEYFRAME_IMG_DIR || '/app/images';
    const dbDir = process.env.CV_DB_DIR || '/app/db';

    const getDirStats = async (dir: string) => {
      const { stdout } = await execAsync(`df -B1 ${dir}`);
      const lines = stdout.split('\n')[1].split(/\s+/);
      return {
        total: parseInt(lines[1]),
        used: parseInt(lines[2]),
        available: parseInt(lines[3])
      };
    };

    return {
      videoDir: await getDirStats(videoDir),
      imageDir: await getDirStats(imageDir),
      dbDir: await getDirStats(dbDir)
    };
  } catch (error) {
    console.error('Error getting filesystem status:', error);
    throw error;
  }
}

export async function listFiles(directory: string): Promise<FileInfo[]> {
  try {
    const files = await readdirAsync(directory);
    const fileInfos = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directory, file);
        const stats = await statAsync(filePath);
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          path: filePath
        };
      })
    );
    return fileInfos;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
} 