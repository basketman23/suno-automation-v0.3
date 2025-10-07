import path from 'path';
import fs from 'fs-extra';
import { VideoRenderer } from '../video/renderer.js';
import { SEOGenerator } from '../seo/generator.js';
import { YouTubeUploader } from '../youtube/uploader.js';

/**
 * Main workflow for publishing a song to YouTube
 * Orchestrates: video rendering → SEO generation → YouTube upload → record keeping
 */

/**
 * Publish a song to YouTube
 * @param {Object} songData - Song data
 * @param {string} songData.audioPath - Path to MP3 file
 * @param {string} songData.title - Song title
 * @param {string} songData.lyrics - Song lyrics (optional)
 * @param {string} songData.style - Music style/genre
 * @param {string} songData.imagePath - Custom background image (optional)
 * @param {Object} options - Additional options
 * @param {string} options.downloadPath - Base download path (default: ./downloads)
 * @param {string} options.privacy - YouTube privacy ('public', 'private', 'unlisted')
 * @param {Function} options.onProgress - Progress callback (status, percent)
 * @returns {Promise<Object>} Result with videoId, URL, and metadata
 */
export async function publishSong(songData, options = {}) {
  const {
    audioPath,
    title = 'Untitled Song',
    lyrics = '',
    style = 'Music',
    imagePath = null
  } = songData;

  const {
    downloadPath = './downloads',
    privacy = 'public',
    onProgress = null
  } = options;

  // Validate input
  if (!audioPath || !await fs.pathExists(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Setup paths
  const publishedDir = path.join(downloadPath, 'published');
  const videosDir = path.join(publishedDir, 'videos');
  await fs.ensureDir(publishedDir);
  await fs.ensureDir(videosDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const videoPath = path.join(videosDir, `${sanitizedTitle}_${timestamp}.mp4`);

  let result = {
    success: false,
    audioPath,
    title,
    style,
    timestamp: new Date().toISOString()
  };

  try {
    // Step 1: Render Video (0-30%)
    updateProgress(onProgress, 'rendering_video', 5, 'Initializing video renderer...');

    const renderer = new VideoRenderer();

    // Check FFmpeg installation
    const hasFFmpeg = await renderer.checkFFmpegInstalled();
    if (!hasFFmpeg) {
      throw new Error(
        'FFmpeg not found. Please install FFmpeg:\n' +
        'macOS: brew install ffmpeg\n' +
        'Linux: sudo apt-get install ffmpeg\n' +
        'Windows: Download from https://ffmpeg.org/'
      );
    }

    updateProgress(onProgress, 'rendering_video', 10, 'Rendering video from audio...');

    await renderer.renderVideo(audioPath, videoPath, {
      imagePath,
      title,
      onProgress: (percent) => {
        // Map 0-100% render progress to 10-30% overall
        const overallPercent = 10 + Math.round(percent * 0.2);
        updateProgress(onProgress, 'rendering_video', overallPercent, `Rendering video: ${percent}%`);
      }
    });

    result.videoPath = videoPath;
    updateProgress(onProgress, 'rendering_complete', 30, 'Video rendered successfully');

    // Step 2: Generate SEO Metadata (30-50%)
    updateProgress(onProgress, 'generating_seo', 35, 'Initializing SEO generator...');

    const seoGenerator = new SEOGenerator();

    updateProgress(onProgress, 'generating_seo', 40, 'Generating SEO-optimized metadata...');

    const metadata = await seoGenerator.generateMetadata({
      title,
      lyrics,
      style
    });

    result.metadata = metadata;
    updateProgress(onProgress, 'seo_complete', 50, 'SEO metadata generated');

    // Step 3: Upload to YouTube (50-90%)
    updateProgress(onProgress, 'initializing_youtube', 55, 'Initializing YouTube uploader...');

    const uploader = new YouTubeUploader();
    await uploader.initialize();

    updateProgress(onProgress, 'uploading_youtube', 60, 'Uploading video to YouTube...');

    const uploadResult = await uploader.upload(videoPath, {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      privacy,
      categoryId: 10 // Music
    }, {
      onProgress: (percent) => {
        // Map 0-100% upload progress to 60-90% overall
        const overallPercent = 60 + Math.round(percent * 0.3);
        updateProgress(onProgress, 'uploading_youtube', overallPercent, `Uploading: ${percent}%`);
      }
    });

    result.videoId = uploadResult.videoId;
    result.youtubeUrl = uploadResult.url;
    result.uploadedAt = uploadResult.uploadedAt;
    result.privacy = uploadResult.privacy;

    updateProgress(onProgress, 'upload_complete', 90, 'Video uploaded to YouTube');

    // Step 4: Save Record (90-100%)
    updateProgress(onProgress, 'saving_record', 95, 'Saving publish record...');

    const recordPath = path.join(publishedDir, `${uploadResult.videoId}.json`);
    await fs.writeJSON(recordPath, {
      ...result,
      success: true,
      recordCreated: new Date().toISOString()
    }, { spaces: 2 });

    result.recordPath = recordPath;
    result.success = true;

    updateProgress(onProgress, 'complete', 100, 'Song published successfully!');

    return result;

  } catch (error) {
    console.error('Publish workflow error:', error);

    // Save error record
    result.success = false;
    result.error = error.message;
    result.errorStack = error.stack;

    const errorRecordPath = path.join(publishedDir, `error_${timestamp}.json`);
    await fs.writeJSON(errorRecordPath, result, { spaces: 2 });

    updateProgress(onProgress, 'error', 0, error.message);

    throw error;
  }
}

/**
 * Helper function to update progress
 * @private
 */
function updateProgress(callback, status, percent, message) {
  if (callback && typeof callback === 'function') {
    callback({
      status,
      percent,
      message
    });
  }
  console.log(`[${percent}%] ${status}: ${message}`);
}

/**
 * Get list of published songs
 * @param {string} downloadPath - Base download path
 * @returns {Promise<Array<Object>>} List of published songs
 */
export async function getPublishedSongs(downloadPath = './downloads') {
  const publishedDir = path.join(downloadPath, 'published');

  if (!await fs.pathExists(publishedDir)) {
    return [];
  }

  const files = await fs.readdir(publishedDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('error_'));

  const songs = await Promise.all(
    jsonFiles.map(async (filename) => {
      try {
        const filePath = path.join(publishedDir, filename);
        const data = await fs.readJSON(filePath);
        return {
          ...data,
          recordFile: filename
        };
      } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return null;
      }
    })
  );

  // Filter out nulls and sort by timestamp (newest first)
  return songs
    .filter(s => s !== null)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Get details of a specific published song
 * @param {string} videoId - YouTube video ID
 * @param {string} downloadPath - Base download path
 * @returns {Promise<Object|null>} Song details or null if not found
 */
export async function getPublishedSong(videoId, downloadPath = './downloads') {
  const recordPath = path.join(downloadPath, 'published', `${videoId}.json`);

  if (!await fs.pathExists(recordPath)) {
    return null;
  }

  return await fs.readJSON(recordPath);
}

/**
 * Delete a published song record (does not delete from YouTube)
 * @param {string} videoId - YouTube video ID
 * @param {string} downloadPath - Base download path
 * @returns {Promise<boolean>} True if deleted
 */
export async function deletePublishedRecord(videoId, downloadPath = './downloads') {
  const recordPath = path.join(downloadPath, 'published', `${videoId}.json`);

  if (!await fs.pathExists(recordPath)) {
    return false;
  }

  await fs.remove(recordPath);
  return true;
}

/**
 * Batch publish multiple songs
 * @param {Array<Object>} songsData - Array of song data objects
 * @param {Object} options - Publish options
 * @returns {Promise<Array<Object>>} Results for each song
 */
export async function publishBatch(songsData, options = {}) {
  const results = [];

  for (let i = 0; i < songsData.length; i++) {
    const songData = songsData[i];

    console.log(`\n📤 Publishing song ${i + 1}/${songsData.length}: ${songData.title}`);

    try {
      const result = await publishSong(songData, options);
      results.push(result);

      // Delay between uploads to respect YouTube quotas
      if (i < songsData.length - 1) {
        console.log('⏳ Waiting 10 seconds before next upload...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

    } catch (error) {
      console.error(`❌ Failed to publish ${songData.title}:`, error.message);
      results.push({
        success: false,
        title: songData.title,
        error: error.message
      });
    }
  }

  return results;
}

export default publishSong;
