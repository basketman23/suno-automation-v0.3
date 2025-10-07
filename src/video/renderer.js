import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';

/**
 * VideoRenderer class for creating videos from audio files using FFmpeg
 * Uses GPU acceleration on macOS (Radeon Pro 570 via h264_videotoolbox)
 */
export class VideoRenderer {
  constructor(options = {}) {
    this.defaultOptions = {
      resolution: '1920x1080',
      fps: 1, // Static image - 1 fps is sufficient
      videoBitrate: '2000k',
      audioBitrate: '192k',
      format: 'mp4',
      preset: 'medium', // Not used with hardware encoding but kept for fallback
      ...options
    };
  }

  /**
   * Create a solid color background image if no custom image is provided
   * @param {string} outputPath - Where to save the generated image
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {string} color - Background color (hex)
   * @returns {Promise<string>} Path to created image
   */
  async createDefaultBackground(outputPath, width = 1920, height = 1080, color = '#1a1a1a') {
    await fs.ensureDir(path.dirname(outputPath));

    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r, g, b }
      }
    })
    .png()
    .toFile(outputPath);

    return outputPath;
  }

  /**
   * Add text overlay to an image
   * @param {string} imagePath - Source image path
   * @param {string} outputPath - Output image path
   * @param {string} title - Title text to overlay
   * @returns {Promise<string>} Path to output image
   */
  async addTextOverlay(imagePath, outputPath, title) {
    // For now, just copy the image
    // Text overlay with sharp requires SVG generation which we'll skip for simplicity
    // Users can customize the background image manually
    await fs.copy(imagePath, outputPath);
    return outputPath;
  }

  /**
   * Render video from audio file with static image background
   * @param {string} audioPath - Path to source audio file (MP3)
   * @param {string} outputPath - Path where video will be saved
   * @param {Object} options - Rendering options
   * @param {string} options.imagePath - Path to background image (optional)
   * @param {string} options.title - Song title for overlay (optional)
   * @param {string} options.resolution - Video resolution (default: 1920x1080)
   * @param {number} options.fps - Frames per second (default: 1)
   * @param {Function} options.onProgress - Progress callback (percent)
   * @returns {Promise<string>} Path to rendered video
   */
  async renderVideo(audioPath, outputPath, options = {}) {
    const renderOptions = { ...this.defaultOptions, ...options };

    // Validate input
    if (!await fs.pathExists(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    // Get audio duration first
    const duration = await this.getAudioDuration(audioPath);

    // Create or use provided image
    let imagePath = renderOptions.imagePath;
    if (!imagePath) {
      const tempImagePath = path.join(path.dirname(outputPath), 'temp-bg.png');
      const [width, height] = renderOptions.resolution.split('x').map(Number);
      imagePath = await this.createDefaultBackground(tempImagePath, width, height);
    } else if (!await fs.pathExists(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Input: static image (loop it for the duration)
      command.input(imagePath)
        .inputOptions([
          '-loop 1', // Loop the image
          `-t ${duration}` // For the duration of the audio
        ]);

      // Input: audio file
      command.input(audioPath);

      // Check platform and use appropriate encoder
      const isMacOS = process.platform === 'darwin';

      if (isMacOS) {
        // Use VideoToolbox hardware acceleration on macOS
        command.videoCodec('h264_videotoolbox')
          .outputOptions([
            '-b:v', renderOptions.videoBitrate,
            '-profile:v', 'high',
            '-pix_fmt', 'yuv420p' // Ensure compatibility
          ]);
      } else {
        // Fallback to software encoding
        command.videoCodec('libx264')
          .outputOptions([
            '-preset', renderOptions.preset,
            '-b:v', renderOptions.videoBitrate,
            '-pix_fmt', 'yuv420p'
          ]);
      }

      // Audio codec and bitrate
      command.audioCodec('aac')
        .audioBitrate(renderOptions.audioBitrate);

      // Video settings
      command.size(renderOptions.resolution)
        .fps(renderOptions.fps)
        .format(renderOptions.format);

      // Shorter encoding for static images
      command.outputOptions([
        '-shortest', // End when shortest stream ends (audio)
        '-map', '0:v:0', // Map video from first input
        '-map', '1:a:0'  // Map audio from second input
      ]);

      // Progress tracking
      command.on('progress', (progress) => {
        if (renderOptions.onProgress && progress.percent) {
          renderOptions.onProgress(Math.round(progress.percent));
        }
      });

      // Error handling
      command.on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`Video rendering failed: ${err.message}`));
      });

      // Success
      command.on('end', async () => {
        // Clean up temporary background if created
        if (!renderOptions.imagePath) {
          try {
            await fs.remove(imagePath);
          } catch (err) {
            console.warn('Could not remove temporary background:', err.message);
          }
        }
        resolve(outputPath);
      });

      // Output
      command.save(outputPath);
    });
  }

  /**
   * Get duration of audio file in seconds
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<number>} Duration in seconds
   */
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to probe audio file: ${err.message}`));
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  /**
   * Validate FFmpeg installation
   * @returns {Promise<boolean>} True if FFmpeg is available
   */
  async checkFFmpegInstalled() {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        resolve(!err && formats);
      });
    });
  }
}

export default VideoRenderer;
