import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import settings from './config/settings.js';
import { SunoBot } from './automation/suno-bot.js';
import credentialManager from './config/credentials.js';
import { publishSong, getPublishedSongs, getPublishedSong } from './workflows/publish-song.js';
import stylePresetManager from './config/style-presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Global bot instance
let currentBot = null;
let isProcessing = false;
let isPublishing = false;

// Initialize settings on startup
await settings.load();

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎵 Suno Automation Server Started`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n📍 Server URL: http://localhost:${PORT}`);
  console.log(`📁 Download Path: ${settings.get('downloadPath')}`);
  console.log(`🔐 Auth Method: ${settings.get('authMethod')}`);
  console.log(`\n✅ Ready to create songs!\n`);
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`🔌 WebSocket client connected (${clients.size} active)`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 WebSocket client disconnected (${clients.size} active)`);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    clients.delete(ws);
  });
});

function broadcastStatus(status) {
  const message = JSON.stringify(status);
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// API Routes

// Get current settings
app.get('/api/settings', async (req, res) => {
  try {
    const config = settings.getAll();
    // Don't send password to client
    const safeConfig = {
      ...config,
      credentials: {
        email: config.credentials.email,
        password: config.credentials.password ? '********' : ''
      }
    };
    res.json(safeConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const { authMethod, credentials, downloadPath } = req.body;

    if (authMethod) {
      await settings.set('authMethod', authMethod);
    }

    if (credentials) {
      if (credentials.email) {
        await settings.set('credentials.email', credentials.email);
      }
      if (credentials.password && credentials.password !== '********') {
        await settings.set('credentials.password', credentials.password);
      }
    }

    if (downloadPath) {
      // Ensure the directory exists
      await fs.ensureDir(downloadPath);
      await settings.set('downloadPath', downloadPath);
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test authentication
app.post('/api/test-auth', async (req, res) => {
  if (isProcessing) {
    return res.status(409).json({ error: 'Another process is running' });
  }

  try {
    isProcessing = true;
    broadcastStatus({ status: 'testing_auth', message: 'Testing authentication...' });

    const bot = new SunoBot();
    bot.setStatusCallback(broadcastStatus);

    await bot.initialize();
    await bot.login();

    await bot.close();

    isProcessing = false;
    broadcastStatus({ status: 'auth_test_success', message: 'Authentication successful!' });

    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    isProcessing = false;
    broadcastStatus({ status: 'auth_test_failed', message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Create song
app.post('/api/create-song', async (req, res) => {
  if (isProcessing) {
    return res.status(409).json({ error: 'Another song is being processed' });
  }

  const { title, lyrics, style, numberOfRounds } = req.body;

  if (!style) {
    return res.status(400).json({ error: 'Style is required' });
  }

  const rounds = parseInt(numberOfRounds) || 2;
  if (rounds < 1 || rounds > 50) {
    return res.status(400).json({ error: 'Number of rounds must be between 1 and 50' });
  }

  try {
    isProcessing = true;

    // Start the process asynchronously
    (async () => {
      const bot = new SunoBot();
      currentBot = bot;

      bot.setStatusCallback(broadcastStatus);

      try {
        const result = await bot.automateFullProcess({
          title: title || 'Untitled Song',
          lyrics,
          style,
          numberOfRounds: rounds
        });

        broadcastStatus({
          status: 'complete',
          message: 'Song created and downloaded successfully!',
          result
        });
      } catch (error) {
        broadcastStatus({
          status: 'error',
          message: error.message,
          error: error.stack
        });

        // Keep browser open on error for debugging
        console.log('\n⚠️  ERROR OCCURRED - Browser will stay open for 30 seconds for debugging');
        console.log('Check downloads/debug/ folder for screenshots\n');
        await new Promise(resolve => setTimeout(resolve, 30000));
      } finally {
        await bot.close();
        currentBot = null;
        isProcessing = false;
      }
    })();

    // Respond immediately
    res.json({
      success: true,
      message: 'Song creation started. Check status via WebSocket.'
    });

  } catch (error) {
    isProcessing = false;
    res.status(500).json({ error: error.message });
  }
});

// Get processing status
app.get('/api/status', (req, res) => {
  res.json({
    isProcessing,
    hasActiveBot: currentBot !== null
  });
});

// Stop current process
app.post('/api/stop', async (req, res) => {
  try {
    if (currentBot) {
      await currentBot.close();
      currentBot = null;
    }
    isProcessing = false;

    broadcastStatus({
      status: 'stopped',
      message: 'Process stopped by user'
    });

    res.json({ success: true, message: 'Process stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List downloaded songs
app.get('/api/downloads', async (req, res) => {
  try {
    const downloadPath = settings.get('downloadPath');
    await fs.ensureDir(downloadPath);

    const files = await fs.readdir(downloadPath);
    const mp3Files = files.filter(f => f.endsWith('.mp3'));

    const songs = await Promise.all(
      mp3Files.map(async (filename) => {
        const filepath = path.join(downloadPath, filename);
        const stats = await fs.stat(filepath);

        return {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );

    // Sort by modification time (newest first)
    songs.sort((a, b) => b.modified - a.modified);

    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download a specific song
app.get('/api/download/:filename', async (req, res) => {
  try {
    const downloadPath = settings.get('downloadPath');
    const filepath = path.join(downloadPath, req.params.filename);

    // Security check: make sure the file is in the download directory
    const resolvedPath = path.resolve(filepath);
    const resolvedDownloadPath = path.resolve(downloadPath);

    if (!resolvedPath.startsWith(resolvedDownloadPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!await fs.pathExists(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Credential Management API Endpoints

// Save Google credentials
app.post('/api/credentials/save', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    await credentialManager.saveCredentials(email, password);

    res.json({
      success: true,
      message: 'Credentials saved securely'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load Google credentials
app.get('/api/credentials/load', async (req, res) => {
  try {
    const credentials = await credentialManager.loadCredentials();

    if (!credentials) {
      return res.json({
        hasCredentials: false,
        email: null
      });
    }

    // Return email but mask password
    res.json({
      hasCredentials: true,
      email: credentials.email,
      savedAt: credentials.savedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear saved credentials
app.delete('/api/credentials/clear', async (req, res) => {
  try {
    await credentialManager.clearCredentials();
    res.json({
      success: true,
      message: 'Credentials cleared'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// YouTube Publishing Endpoints
// ========================================

// Publish a song to YouTube
app.post('/api/publish-song', async (req, res) => {
  if (isPublishing) {
    return res.status(409).json({ error: 'A publish operation is already in progress' });
  }

  const { audioPath, title, lyrics, style, imagePath, privacy } = req.body;

  if (!audioPath) {
    return res.status(400).json({ error: 'audioPath is required' });
  }

  try {
    isPublishing = true;

    // Start the publish process asynchronously
    (async () => {
      try {
        const downloadPath = settings.get('downloadPath');

        const result = await publishSong({
          audioPath,
          title: title || 'Untitled Song',
          lyrics: lyrics || '',
          style: style || 'Music',
          imagePath: imagePath || null
        }, {
          downloadPath,
          privacy: privacy || 'public',
          onProgress: (progress) => {
            broadcastStatus({
              status: progress.status,
              message: progress.message,
              percent: progress.percent,
              phase: 'publishing'
            });
          }
        });

        broadcastStatus({
          status: 'publish_complete',
          message: 'Song published successfully to YouTube!',
          result: {
            videoId: result.videoId,
            youtubeUrl: result.youtubeUrl,
            title: result.metadata.title
          },
          percent: 100
        });

      } catch (error) {
        console.error('Publish error:', error);
        broadcastStatus({
          status: 'publish_error',
          message: error.message,
          error: error.stack,
          percent: 0
        });
      } finally {
        isPublishing = false;
      }
    })();

    // Respond immediately
    res.json({
      success: true,
      message: 'Publishing started. Check status via WebSocket.'
    });

  } catch (error) {
    isPublishing = false;
    res.status(500).json({ error: error.message });
  }
});

// Get list of published videos
app.get('/api/published', async (req, res) => {
  try {
    const downloadPath = settings.get('downloadPath');
    const publishedSongs = await getPublishedSongs(downloadPath);

    res.json({
      success: true,
      count: publishedSongs.length,
      songs: publishedSongs
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get details of a specific published video
app.get('/api/published/:videoId', async (req, res) => {
  try {
    const downloadPath = settings.get('downloadPath');
    const song = await getPublishedSong(req.params.videoId, downloadPath);

    if (!song) {
      return res.status(404).json({ error: 'Published song not found' });
    }

    res.json(song);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get publishing status
app.get('/api/publish-status', (req, res) => {
  res.json({
    isPublishing,
    isProcessing,
    canPublish: !isPublishing && !isProcessing
  });
});

// ========================================
// Style Preset Management Endpoints
// ========================================

// Get all style presets
app.get('/api/style-presets', async (req, res) => {
  try {
    const presets = stylePresetManager.getAllPresets();
    res.json({ success: true, presets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new style preset
app.post('/api/style-presets', async (req, res) => {
  try {
    const { name, style, category } = req.body;

    if (!name || !style) {
      return res.status(400).json({ error: 'Name and style are required' });
    }

    const preset = await stylePresetManager.createPreset(name, style, category);
    res.json({ success: true, preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update style preset
app.put('/api/style-presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const preset = await stylePresetManager.updatePreset(id, updates);
    res.json({ success: true, preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete style preset
app.delete('/api/style-presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await stylePresetManager.deletePreset(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle favorite
app.post('/api/style-presets/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const isFavorite = await stylePresetManager.toggleFavorite(id);
    res.json({ success: true, favorite: isFavorite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Increment usage
app.post('/api/style-presets/:id/use', async (req, res) => {
  try {
    const { id } = req.params;
    await stylePresetManager.incrementUsage(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export presets
app.get('/api/style-presets/export', async (req, res) => {
  try {
    const data = await stylePresetManager.exportPresets();
    res.setHeader('Content-Disposition', 'attachment; filename=style-presets.json');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import presets
app.post('/api/style-presets/import', async (req, res) => {
  try {
    const { data, merge } = req.body;
    const count = await stylePresetManager.importPresets(data, merge !== false);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch generation with locked style
app.post('/api/batch-create', async (req, res) => {
  if (isProcessing) {
    return res.status(409).json({ error: 'Another process is running' });
  }

  try {
    const { stylePresetId, numberOfSongs, lyrics, randomStylePresets } = req.body;

    if (!stylePresetId || !numberOfSongs) {
      return res.status(400).json({ error: 'Style preset and number of songs required' });
    }

    const preset = stylePresetManager.getPreset(stylePresetId);
    if (!preset) {
      return res.status(404).json({ error: 'Style preset not found' });
    }

    const songsCount = parseInt(numberOfSongs);
    if (songsCount < 1 || songsCount > 50) {
      return res.status(400).json({ error: 'Number of songs must be between 1 and 50' });
    }

    // Get all presets in the same category for random selection
    let categoryPresets = [preset];
    if (randomStylePresets) {
      const allPresets = stylePresetManager.getAllPresets();
      categoryPresets = allPresets.filter(p => p.category === preset.category);
      console.log(`Random mode: Found ${categoryPresets.length} presets in category "${preset.category}"`);
    }

    // Increment usage for the selected preset
    await stylePresetManager.incrementUsage(stylePresetId);

    // Start batch process asynchronously
    isProcessing = true;

    (async () => {
      let successCount = 0;
      let failCount = 0;
      let bot = null;

      try {
        // Create bot once and reuse for all songs
        bot = new SunoBot();
        currentBot = bot;
        bot.setStatusCallback(broadcastStatus);

        // Initialize browser once
        await bot.initialize();
        await bot.login();

        for (let i = 0; i < songsCount; i++) {
          try {
            // Select random preset from category if enabled
            let currentPreset = preset;
            if (randomStylePresets && categoryPresets.length > 1) {
              const randomIndex = Math.floor(Math.random() * categoryPresets.length);
              currentPreset = categoryPresets[randomIndex];
              // Increment usage for randomly selected preset
              if (currentPreset.id !== stylePresetId) {
                await stylePresetManager.incrementUsage(currentPreset.id);
              }
              console.log(`Song ${i + 1}: Using random preset "${currentPreset.name}"`);
            }

            broadcastStatus({
              status: 'batch_progress',
              message: `Creating song ${i + 1} of ${songsCount} with style: ${currentPreset.name}`,
              current: i + 1,
              total: songsCount,
              styleName: currentPreset.name,
              randomMode: randomStylePresets
            });

            const songTitle = `${currentPreset.name} - Song ${i + 1}`;

            // Create song (without login, browser already open)
            await bot.createSong({
              title: songTitle,
              lyrics: lyrics || '',
              style: currentPreset.style
            });

            // Wait for completion
            await bot.waitForCompletion(songTitle);

            // Download both versions
            await bot.downloadBothSongs(songTitle);

            successCount++;

            // Small delay between songs to avoid rate limits
            if (i < songsCount - 1) {
              broadcastStatus({
                status: 'batch_waiting',
                message: `Waiting 10 seconds before next song...`,
                current: i + 1,
                total: songsCount
              });
              await new Promise(resolve => setTimeout(resolve, 10000));
            }

          } catch (error) {
            console.error(`Error creating song ${i + 1}:`, error);
            failCount++;
            broadcastStatus({
              status: 'batch_song_error',
              message: `Failed to create song ${i + 1}: ${error.message}`,
              current: i + 1,
              total: songsCount
            });
            // Continue with next song even if one fails
          }
        }

      } catch (error) {
        console.error('Batch process error:', error);
        broadcastStatus({
          status: 'batch_error',
          message: `Batch process failed: ${error.message}`
        });
      } finally {
        // Always close the browser when done
        if (bot) {
          await bot.close();
          currentBot = null;
        }

        isProcessing = false;

        broadcastStatus({
          status: 'batch_complete',
          message: `Batch complete: ${successCount} songs created, ${failCount} failed`,
          total: songsCount,
          success: successCount,
          failed: failCount
        });
      }
    })();

    // Respond immediately
    res.json({
      success: true,
      message: `Batch generation started: ${songsCount} songs with style "${preset.name}"`
    });

  } catch (error) {
    isProcessing = false;
    res.status(500).json({ error: error.message });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  if (currentBot) {
    await currentBot.close();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, closing server...');
  if (currentBot) {
    await currentBot.close();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
