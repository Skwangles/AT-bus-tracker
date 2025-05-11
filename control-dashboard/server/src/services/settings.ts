import fs from 'fs';
import path from 'path';
import { SystemSettings } from '../types';

const SETTINGS_FILE = process.env.SETTINGS_FILE || '/app/config/settings.json';

const defaultSettings: SystemSettings = {
  modelPath: '/app/models',
  outputPath: '/app/output',
  maxConcurrentJobs: 1,
  autoStart: false,
  notificationEnabled: false
};

export async function loadSettings(): Promise<SystemSettings> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = await fs.promises.readFile(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return defaultSettings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}

export async function saveSettings(settings: SystemSettings): Promise<void> {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
} 