import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../../config.json');

// Default configuration
const DEFAULT_CONFIG = {
  authMethod: 'google', // 'google' or 'password'
  credentials: {
    email: '',
    password: ''
  },
  downloadPath: path.join(__dirname, '../../downloads'),
  playwright: {
    headless: false,
    slowMo: 50,
    timeout: 60000
  },
  suno: {
    baseUrl: 'https://suno.com',
    pollInterval: 30000, // Check song status every 30 seconds
    maxWaitTime: 120000, // Max wait 2 minutes for song completion (in milliseconds)
    maxWaitMinutes: 2 // Max wait time in minutes (user-friendly setting)
  }
};

class SettingsManager {
  constructor() {
    this.config = null;
  }

  async load() {
    try {
      if (await fs.pathExists(CONFIG_FILE)) {
        const data = await fs.readJSON(CONFIG_FILE);
        this.config = { ...DEFAULT_CONFIG, ...data };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        await this.save();
      }
      return this.config;
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = { ...DEFAULT_CONFIG };
      return this.config;
    }
  }

  async save(newConfig = null) {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    try {
      await fs.ensureFile(CONFIG_FILE);
      await fs.writeJSON(CONFIG_FILE, this.config, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  get(key) {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  async set(key, value) {
    if (!this.config) {
      await this.load();
    }

    const keys = key.split('.');
    let obj = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj)) {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
    await this.save();
  }

  getAll() {
    return this.config;
  }
}

// Export singleton instance
export default new SettingsManager();
