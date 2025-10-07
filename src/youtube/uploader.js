import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * YouTubeUploader class for uploading videos to YouTube
 * Handles OAuth2 authentication and video uploads via YouTube Data API v3
 */
export class YouTubeUploader {
  constructor(options = {}) {
    this.credentialsPath = options.credentialsPath || path.join(__dirname, '../../youtube-credentials.json');
    this.tokenPath = options.tokenPath || path.join(__dirname, '../../youtube-token.json');
    this.scopes = ['https://www.googleapis.com/auth/youtube.upload'];
    this.auth = null;
    this.youtube = null;
  }

  /**
   * Initialize YouTube API client with OAuth2 authentication
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Check if credentials file exists
      if (!await fs.pathExists(this.credentialsPath)) {
        throw new Error(
          `YouTube API credentials not found at ${this.credentialsPath}\n\n` +
          'To set up YouTube API:\n' +
          '1. Go to https://console.cloud.google.com/\n' +
          '2. Create a new project or select existing one\n' +
          '3. Enable YouTube Data API v3\n' +
          '4. Create OAuth 2.0 credentials (Desktop app)\n' +
          '5. Download credentials and save as youtube-credentials.json'
        );
      }

      // Try to load existing token
      if (await fs.pathExists(this.tokenPath)) {
        const token = await fs.readJSON(this.tokenPath);
        const credentials = await fs.readJSON(this.credentialsPath);

        const oauth2Client = new google.auth.OAuth2(
          credentials.installed.client_id,
          credentials.installed.client_secret,
          credentials.installed.redirect_uris[0]
        );

        oauth2Client.setCredentials(token);

        // Check if token is expired and refresh if needed
        if (token.expiry_date && token.expiry_date < Date.now()) {
          console.log('Token expired, refreshing...');
          const newToken = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(newToken.credentials);
          await fs.writeJSON(this.tokenPath, newToken.credentials);
        }

        this.auth = oauth2Client;
      } else {
        // Perform OAuth flow
        console.log('No saved token found. Starting OAuth flow...');
        this.auth = await authenticate({
          scopes: this.scopes,
          keyfilePath: this.credentialsPath,
        });

        // Save the token for future use
        await fs.writeJSON(this.tokenPath, this.auth.credentials);
        console.log('Authentication successful! Token saved.');
      }

      // Initialize YouTube API client
      this.youtube = google.youtube({
        version: 'v3',
        auth: this.auth
      });

    } catch (error) {
      throw new Error(`Failed to initialize YouTube uploader: ${error.message}`);
    }
  }

  /**
   * Upload a video to YouTube
   * @param {string} videoPath - Path to video file
   * @param {Object} metadata - Video metadata
   * @param {string} metadata.title - Video title (max 100 chars)
   * @param {string} metadata.description - Video description (max 5000 chars)
   * @param {Array<string>} metadata.tags - Video tags (max 500 chars total)
   * @param {string} metadata.privacy - Privacy status ('public', 'private', 'unlisted')
   * @param {number} metadata.categoryId - YouTube category ID (default: 10 for Music)
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<Object>} Upload result with videoId and URL
   */
  async upload(videoPath, metadata, options = {}) {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Call initialize() first.');
    }

    // Validate video file
    if (!await fs.pathExists(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const fileSize = (await fs.stat(videoPath)).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    console.log(`Uploading video: ${path.basename(videoPath)} (${fileSizeMB} MB)`);

    // Prepare metadata
    const {
      title = 'Untitled Video',
      description = '',
      tags = [],
      privacy = 'public',
      categoryId = 10 // Music category
    } = metadata;

    // Validate metadata
    if (title.length > 100) {
      throw new Error('Title must be 100 characters or less');
    }
    if (description.length > 5000) {
      throw new Error('Description must be 5000 characters or less');
    }

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title,
            description: description,
            tags: tags,
            categoryId: String(categoryId),
            defaultLanguage: 'en',
            defaultAudioLanguage: 'en'
          },
          status: {
            privacyStatus: privacy,
            selfDeclaredMadeForKids: false,
            embeddable: true,
            publicStatsViewable: true
          }
        },
        media: {
          body: fs.createReadStream(videoPath)
        }
      }, {
        // Progress tracking
        onUploadProgress: (evt) => {
          const progress = Math.round((evt.bytesRead / fileSize) * 100);
          if (options.onProgress) {
            options.onProgress(progress);
          }
          console.log(`Upload progress: ${progress}%`);
        }
      });

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`✅ Video uploaded successfully!`);
      console.log(`Video ID: ${videoId}`);
      console.log(`URL: ${videoUrl}`);

      return {
        videoId,
        url: videoUrl,
        title,
        privacy,
        uploadedAt: new Date().toISOString()
      };

    } catch (error) {
      // Handle quota errors
      if (error.code === 403 && error.message.includes('quota')) {
        throw new Error(
          'YouTube API quota exceeded. Daily upload quota is limited.\n' +
          'Wait 24 hours or request quota increase at https://console.cloud.google.com/'
        );
      }

      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Update video metadata
   * @param {string} videoId - YouTube video ID
   * @param {Object} metadata - Updated metadata
   * @returns {Promise<Object>} Update result
   */
  async updateMetadata(videoId, metadata) {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Call initialize() first.');
    }

    const {
      title,
      description,
      tags,
      categoryId = 10
    } = metadata;

    try {
      const response = await this.youtube.videos.update({
        part: ['snippet'],
        requestBody: {
          id: videoId,
          snippet: {
            title,
            description,
            tags,
            categoryId: String(categoryId)
          }
        }
      });

      return {
        videoId,
        updated: true,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to update video metadata: ${error.message}`);
    }
  }

  /**
   * Get video details
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Video details
   */
  async getVideoDetails(videoId) {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Call initialize() first.');
    }

    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'status', 'statistics', 'contentDetails'],
        id: [videoId]
      });

      if (response.data.items.length === 0) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const video = response.data.items[0];

      return {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        publishedAt: video.snippet.publishedAt,
        privacy: video.status.privacyStatus,
        views: video.statistics?.viewCount || 0,
        likes: video.statistics?.likeCount || 0,
        comments: video.statistics?.commentCount || 0,
        duration: video.contentDetails.duration,
        url: `https://www.youtube.com/watch?v=${video.id}`
      };

    } catch (error) {
      throw new Error(`Failed to get video details: ${error.message}`);
    }
  }

  /**
   * List uploaded videos from the authenticated channel
   * @param {number} maxResults - Maximum number of results (default: 10)
   * @returns {Promise<Array<Object>>} List of videos
   */
  async listMyVideos(maxResults = 10) {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Call initialize() first.');
    }

    try {
      // Get the channel ID first
      const channelResponse = await this.youtube.channels.list({
        part: ['snippet', 'contentDetails'],
        mine: true
      });

      if (channelResponse.data.items.length === 0) {
        throw new Error('No channel found for authenticated user');
      }

      const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

      // Get videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults
      });

      return playlistResponse.data.items.map(item => ({
        videoId: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails.default.url,
        url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`
      }));

    } catch (error) {
      throw new Error(`Failed to list videos: ${error.message}`);
    }
  }

  /**
   * Delete a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteVideo(videoId) {
    if (!this.youtube) {
      throw new Error('YouTube uploader not initialized. Call initialize() first.');
    }

    try {
      await this.youtube.videos.delete({
        id: videoId
      });

      return {
        videoId,
        deleted: true,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  /**
   * Get current quota usage information
   * @returns {Object} Quota information
   */
  getQuotaInfo() {
    return {
      dailyLimit: 10000, // Default quota units per day
      uploadCost: 1600, // Quota units per upload
      maxUploadsPerDay: Math.floor(10000 / 1600),
      note: 'Actual quota may vary. Check Google Cloud Console for your project\'s quota.'
    };
  }

  /**
   * Clear saved authentication token
   * @returns {Promise<void>}
   */
  async clearAuth() {
    if (await fs.pathExists(this.tokenPath)) {
      await fs.remove(this.tokenPath);
      console.log('Authentication token cleared');
    }
    this.auth = null;
    this.youtube = null;
  }
}

export default YouTubeUploader;
