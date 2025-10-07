import { AuthManager } from './auth.js';
import { AuthManagerPersistent } from './auth-persistent.js';
import { SongCreator } from './song-creator.js';
import { DownloadManager } from './download-manager.js';
import { sanitizeFilename, createLogger } from './utils.js';
import settings from '../config/settings.js';

const logger = createLogger('SunoBot');

export class SunoBot {
  constructor(usePersistent = true) {
    this.config = null;
    this.authManager = null;
    this.songCreator = null;
    this.downloadManager = null;
    this.page = null;
    this.statusCallback = null;
    this.usePersistent = usePersistent;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  updateStatus(status, data = {}) {
    logger.info(`Status: ${status}`, data);
    if (this.statusCallback) {
      this.statusCallback({ status, ...data });
    }
  }

  async initialize() {
    try {
      this.updateStatus('loading_config');
      this.config = await settings.load();
      logger.info('Configuration loaded');

      this.updateStatus('initializing_browser');

      // Use persistent context for better Google OAuth compatibility
      if (this.usePersistent) {
        logger.info('Using persistent browser context (recommended for Google OAuth)');
        this.authManager = new AuthManagerPersistent(this.config);
      } else {
        logger.info('Using standard browser context');
        this.authManager = new AuthManager(this.config);
      }

      await this.authManager.initialize();

      // Pass status callback to auth manager for login step updates
      if (this.authManager.setStatusCallback) {
        this.authManager.setStatusCallback(this.statusCallback);
      }

      this.page = this.authManager.getPage();
      this.songCreator = new SongCreator(this.page, this.config);
      this.downloadManager = new DownloadManager(this.page, this.config);

      logger.info('SunoBot initialized successfully');
      return true;
    } catch (error) {
      logger.error('Initialization failed:', error);
      throw error;
    }
  }

  async login() {
    try {
      this.updateStatus('authenticating');
      await this.authManager.login();
      this.updateStatus('authenticated');
      logger.info('Authentication successful');
      return true;
    } catch (error) {
      this.updateStatus('auth_failed', { error: error.message });
      logger.error('Authentication failed:', error);
      throw error;
    }
  }

  async createSong({ title, lyrics, style }) {
    try {
      // Sanitize title for filename
      const sanitizedTitle = sanitizeFilename(title || 'Untitled_Song');

      this.updateStatus('creating_song', {
        title: sanitizedTitle,
        style
      });

      const result = await this.songCreator.createSong({
        title,
        lyrics,
        style
      });

      this.updateStatus('song_created', {
        title: sanitizedTitle,
        timestamp: result.timestamp
      });

      return {
        ...result,
        sanitizedTitle
      };
    } catch (error) {
      this.updateStatus('creation_failed', { error: error.message });
      logger.error('Song creation failed:', error);
      throw error;
    }
  }

  async waitForCompletion(songTitle, maxWaitTime = null) {
    try {
      this.updateStatus('waiting_for_completion', { title: songTitle });

      // Simple wait - just wait for the configured time
      const waitTime = maxWaitTime || this.config.suno.maxWaitTime;
      await this.page.waitForTimeout(waitTime);

      this.updateStatus('song_completed', { title: songTitle });
      return true;
    } catch (error) {
      this.updateStatus('completion_timeout', { error: error.message });
      logger.error('Waiting for completion failed:', error);
      throw error;
    }
  }

  async downloadBothSongs(songTitle) {
    try {
      this.updateStatus('downloading', { title: songTitle });

      const result = await this.downloadManager.downloadBothSongs(songTitle);

      this.updateStatus('download_complete', {
        title: songTitle,
        count: result.count,
        downloads: result.downloads
      });

      return result;
    } catch (error) {
      this.updateStatus('download_failed', { error: error.message });
      logger.error('Download failed:', error);
      throw error;
    }
  }

  async downloadSong(songTitle) {
    try {
      this.updateStatus('downloading', { title: songTitle });

      const result = await this.downloadManager.downloadSingleSong(songTitle, 1, 0);

      this.updateStatus('download_complete', {
        title: songTitle,
        path: result.path,
        size: result.size
      });

      return result;
    } catch (error) {
      this.updateStatus('download_failed', { error: error.message });
      logger.error('Download failed:', error);
      throw error;
    }
  }

  async automateFullProcess({ title, lyrics, style, numberOfRounds = 2 }) {
    try {
      logger.info('Starting full automation process...');

      // Initialize if not already done
      if (!this.authManager) {
        await this.initialize();
      }

      const waitMinutes = this.config.suno.maxWaitMinutes || 3;
      const totalSongs = numberOfRounds * 2; // Each round creates 2 songs

      console.log('\n' + '='.repeat(60));
      console.log('🎵 SUNO AUTOMATION STARTED');
      console.log('='.repeat(60));
      console.log('⚠️  IMPORTANT: Keep the browser window OPEN!');
      console.log('');
      console.log(`Total Rounds: ${numberOfRounds} (${totalSongs} songs total)`);
      console.log(`Estimated time: ${(waitMinutes + 1) * numberOfRounds} minutes`);
      console.log('  Per round:');
      console.log('  1. Create song - 30 sec');
      console.log(`  2. Wait for generation - ${waitMinutes} min`);
      console.log('  3. Download 2 MP3s - 30 sec');
      console.log('');
      console.log('💡 You can MINIMIZE the window but do NOT close it!');
      console.log('='.repeat(60) + '\n');

      // Login once at the beginning
      await this.login();

      const allDownloads = [];
      let totalDownloadCount = 0;

      // Loop through rounds
      for (let round = 1; round <= numberOfRounds; round++) {
        console.log('\n' + '='.repeat(60));
        console.log(`🎵 ROUND ${round}/${numberOfRounds}`);
        console.log('='.repeat(60) + '\n');

        this.updateStatus('creating_song', {
          message: `Creating song (Round ${round}/${numberOfRounds})`,
          round,
          totalRounds: numberOfRounds
        });

        // Create song
        const createResult = await this.createSong({ title, lyrics, style });

        // Wait X minutes before checking for completion (configurable by user)
        const songTitle = createResult.sanitizedTitle;
        const waitMs = waitMinutes * 60 * 1000;

        console.log('\n' + '='.repeat(60));
        console.log(`⏳ Round ${round}/${numberOfRounds}: Waiting ${waitMinutes} minute(s) for Suno to generate...`);
        console.log('='.repeat(60));
        console.log(`Song will be ready around: ${new Date(Date.now() + waitMs).toLocaleTimeString()}`);
        console.log('💡 You can minimize the browser but keep it open!');
        console.log('='.repeat(60) + '\n');

        this.updateStatus('waiting_for_generation', {
          title: songTitle,
          waitMinutes: waitMinutes,
          estimatedReadyTime: new Date(Date.now() + waitMs).toLocaleTimeString(),
          round,
          totalRounds: numberOfRounds
        });

        await this.page.waitForTimeout(waitMs);

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Round ${round}/${numberOfRounds}: Wait time completed! Starting download...`);
        console.log('='.repeat(60) + '\n');

        // Download both versions (Suno creates 2 songs per generation)
        const downloadResult = await this.downloadBothSongs(songTitle);

        totalDownloadCount += downloadResult.count;
        allDownloads.push(...downloadResult.downloads);

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Round ${round}/${numberOfRounds}: Downloaded ${downloadResult.count} songs`);
        console.log(`📊 Progress: ${totalDownloadCount}/${totalSongs} total songs downloaded`);
        console.log('='.repeat(60) + '\n');

        this.updateStatus('round_complete', {
          round,
          totalRounds: numberOfRounds,
          roundDownloads: downloadResult.count,
          totalDownloads: totalDownloadCount,
          targetTotal: totalSongs
        });
      }

      console.log('\n' + '='.repeat(60));
      console.log('🎉 ALL ROUNDS COMPLETED!');
      console.log('='.repeat(60));
      console.log(`Total songs downloaded: ${totalDownloadCount}`);
      console.log('='.repeat(60) + '\n');

      this.updateStatus('complete', {
        title,
        totalRounds: numberOfRounds,
        count: totalDownloadCount,
        downloads: allDownloads
      });

      logger.info('Full automation process completed successfully!');

      return {
        success: true,
        title,
        totalRounds: numberOfRounds,
        count: totalDownloadCount,
        downloads: allDownloads
      };

    } catch (error) {
      this.updateStatus('failed', { error: error.message });
      logger.error('Automation process failed:', error);
      throw error;
    }
  }

  async close() {
    if (this.authManager) {
      await this.authManager.close();
    }
    logger.info('SunoBot closed');
  }

  getPage() {
    return this.page;
  }
}

// Example usage and testing
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bot = new SunoBot();

  bot.setStatusCallback((status) => {
    console.log('Status Update:', JSON.stringify(status, null, 2));
  });

  bot.automateFullProcess({
    title: 'Test Song',
    lyrics: 'This is a test song\nWith some test lyrics\nLa la la',
    style: 'Pop, upbeat'
  })
    .then(result => {
      console.log('Success!', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

// For ES modules
import { fileURLToPath } from 'url';
