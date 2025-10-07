import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CredentialManager - Secure credential storage with encryption
 *
 * This provides basic encryption for storing Google credentials locally.
 * For production use, consider using environment variables or a proper secrets management system.
 *
 * SECURITY NOTE: This is basic encryption for local development.
 * The encryption key should be stored securely (environment variable, keychain, etc.)
 */
export class CredentialManager {
  constructor() {
    this.credentialsFile = path.join(__dirname, '../../.credentials.enc');

    // Get encryption key from environment or use default (CHANGE IN PRODUCTION!)
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'suno-automation-key-change-this-in-production';

    // Ensure key is 32 bytes for AES-256
    this.key = crypto.createHash('sha256').update(this.encryptionKey).digest();
  }

  /**
   * Encrypt text using AES-256-CBC
   */
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt text using AES-256-CBC
   */
  decrypt(text) {
    try {
      const parts = text.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Save credentials to encrypted file
   */
  async saveCredentials(email, password) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const data = JSON.stringify({
        email,
        password,
        savedAt: new Date().toISOString()
      });

      const encrypted = this.encrypt(data);

      await fs.writeFile(this.credentialsFile, encrypted, 'utf8');

      console.log('Credentials saved successfully (encrypted)');
      return { success: true, message: 'Credentials saved' };
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw error;
    }
  }

  /**
   * Load credentials from encrypted file
   */
  async loadCredentials() {
    try {
      // Check if file exists
      if (!await fs.pathExists(this.credentialsFile)) {
        return null;
      }

      const encrypted = await fs.readFile(this.credentialsFile, 'utf8');
      const decrypted = this.decrypt(encrypted);
      const data = JSON.parse(decrypted);

      console.log('Credentials loaded successfully');

      return {
        email: data.email,
        password: data.password,
        savedAt: data.savedAt
      };
    } catch (error) {
      console.error('Error loading credentials:', error);
      // If decryption fails, return null (file might be corrupted)
      return null;
    }
  }

  /**
   * Clear saved credentials
   */
  async clearCredentials() {
    try {
      if (await fs.pathExists(this.credentialsFile)) {
        await fs.remove(this.credentialsFile);
        console.log('Credentials cleared');
      }
      return { success: true, message: 'Credentials cleared' };
    } catch (error) {
      console.error('Error clearing credentials:', error);
      throw error;
    }
  }

  /**
   * Check if credentials exist
   */
  async hasCredentials() {
    return await fs.pathExists(this.credentialsFile);
  }
}

// Export singleton instance
export default new CredentialManager();
