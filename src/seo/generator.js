import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SEOGenerator class for creating YouTube metadata using GPT-4o-mini
 * Cost-effective SEO generation for music videos
 */
export class SEOGenerator {
  constructor(apiKey = null) {
    // Load API key from environment or parameter
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!this.apiKey) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable or pass it to constructor.');
    }

    this.openai = new OpenAI({
      apiKey: this.apiKey
    });

    this.model = 'gpt-4o-mini'; // Cost-effective model
  }

  /**
   * Generate SEO-optimized metadata for a music video
   * @param {Object} songData - Song information
   * @param {string} songData.title - Original song title
   * @param {string} songData.lyrics - Song lyrics (optional)
   * @param {string} songData.style - Music style/genre
   * @returns {Promise<Object>} Generated metadata
   */
  async generateMetadata(songData) {
    const { title, lyrics, style } = songData;

    // Build the prompt for GPT-4o-mini
    const prompt = this.buildPrompt(title, lyrics, style);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert YouTube SEO specialist who creates engaging, search-optimized metadata for music videos. You understand trending keywords, audience psychology, and YouTube\'s algorithm.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7, // Balance between creativity and consistency
        max_tokens: 1000, // Sufficient for title + description + tags
        response_format: { type: 'json_object' } // Ensure JSON response
      });

      const response = completion.choices[0].message.content;
      const metadata = JSON.parse(response);

      // Validate and sanitize the response
      return this.validateMetadata(metadata, songData);

    } catch (error) {
      console.error('OpenAI API error:', error);

      // Fallback to basic metadata if API fails
      return this.generateFallbackMetadata(songData);
    }
  }

  /**
   * Build the prompt for GPT-4o-mini
   * @private
   */
  buildPrompt(title, lyrics, style) {
    const lyricsPreview = lyrics
      ? lyrics.substring(0, 500) + (lyrics.length > 500 ? '...' : '')
      : 'No lyrics provided';

    return `Generate SEO-optimized YouTube metadata for this music video:

**Song Title:** ${title}
**Music Style/Genre:** ${style}
**Lyrics Preview:** ${lyricsPreview}

Create metadata that will:
1. Attract viewers searching for this genre
2. Include trending keywords naturally
3. Appeal to both algorithm and human readers
4. Comply with YouTube's best practices

Return a JSON object with these fields:

{
  "title": "An engaging title under 100 characters that includes the main genre/vibe",
  "description": "A 300-500 word description that includes: what the song is about, the mood/feeling, who would enjoy it, relevant keywords naturally integrated, calls-to-action, and relevant hashtags at the end",
  "tags": ["10", "relevant", "tags", "mixing", "broad", "and", "specific", "keywords", "for", "discovery"]
}

Important guidelines:
- Title MUST be under 100 characters
- Description should be 300-500 words with natural keyword integration
- Include 10 tags (mix of broad genre tags and specific descriptive tags)
- Use emojis sparingly in description (2-3 max)
- Make it discoverable but authentic
- Include genres, moods, and use-cases in tags`;
  }

  /**
   * Validate and sanitize the AI-generated metadata
   * @private
   */
  validateMetadata(metadata, songData) {
    // Ensure title is under 100 characters
    let title = metadata.title || songData.title;
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    // Ensure description is reasonable length (300-5000 chars for YouTube)
    let description = metadata.description || this.generateBasicDescription(songData);
    if (description.length > 5000) {
      description = description.substring(0, 4997) + '...';
    }
    if (description.length < 100) {
      description = this.generateBasicDescription(songData);
    }

    // Ensure we have 10 tags or fewer (YouTube limit is 500 characters total)
    let tags = metadata.tags || this.generateBasicTags(songData);
    if (!Array.isArray(tags)) {
      tags = this.generateBasicTags(songData);
    }

    // Limit to 10 tags and ensure total character count is reasonable
    tags = tags.slice(0, 10).map(tag => {
      // Clean and limit tag length
      tag = String(tag).trim();
      return tag.length > 30 ? tag.substring(0, 30) : tag;
    });

    return {
      title: title.trim(),
      description: description.trim(),
      tags: tags
    };
  }

  /**
   * Generate fallback metadata if AI fails
   * @private
   */
  generateFallbackMetadata(songData) {
    return {
      title: this.generateBasicTitle(songData),
      description: this.generateBasicDescription(songData),
      tags: this.generateBasicTags(songData)
    };
  }

  /**
   * Generate basic title
   * @private
   */
  generateBasicTitle(songData) {
    const { title, style } = songData;
    const baseTitle = title || 'Untitled Song';
    const styleStr = style ? ` - ${style}` : '';
    const fullTitle = `${baseTitle}${styleStr} | AI Generated Music`;

    return fullTitle.length > 100
      ? fullTitle.substring(0, 97) + '...'
      : fullTitle;
  }

  /**
   * Generate basic description
   * @private
   */
  generateBasicDescription(songData) {
    const { title, style, lyrics } = songData;

    const lyricsPreview = lyrics
      ? `\n\nLyrics Preview:\n${lyrics.substring(0, 300)}${lyrics.length > 300 ? '...' : ''}`
      : '';

    return `${title || 'Untitled Song'}

A ${style || 'unique'} track created with AI music generation.

This song features ${style || 'original music'} with a distinctive sound and vibe. Perfect for ${this.getUseCases(style)}.
${lyricsPreview}

🎵 Enjoy this AI-generated music!

#music #${(style || 'music').split(',')[0].trim().replace(/\s+/g, '')} #aimusic #generatedmusic #newmusic`;
  }

  /**
   * Generate basic tags
   * @private
   */
  generateBasicTags(songData) {
    const { style } = songData;

    const baseTags = ['music', 'ai music', 'generated music'];

    if (style) {
      const genres = style.split(',').map(g => g.trim().toLowerCase());
      baseTags.push(...genres.slice(0, 3));
    }

    baseTags.push('new music', 'original music', 'instrumental');

    return baseTags.slice(0, 10);
  }

  /**
   * Get suggested use cases based on style
   * @private
   */
  getUseCases(style) {
    if (!style) return 'listening, background music, or creative projects';

    const styleLower = style.toLowerCase();

    if (styleLower.includes('calm') || styleLower.includes('relax')) {
      return 'relaxation, meditation, studying, or background ambiance';
    }
    if (styleLower.includes('upbeat') || styleLower.includes('energetic')) {
      return 'workouts, motivation, parties, or energizing your day';
    }
    if (styleLower.includes('ambient') || styleLower.includes('atmospheric')) {
      return 'focus, creativity, sleep, or ambient background';
    }
    if (styleLower.includes('rock') || styleLower.includes('metal')) {
      return 'working out, driving, gaming, or pure listening enjoyment';
    }
    if (styleLower.includes('electronic') || styleLower.includes('edm')) {
      return 'parties, dancing, gaming, or energetic activities';
    }

    return 'listening pleasure, background music, or creative projects';
  }

  /**
   * Generate metadata for multiple songs in batch
   * @param {Array<Object>} songsData - Array of song data objects
   * @returns {Promise<Array<Object>>} Array of metadata objects
   */
  async generateBatchMetadata(songsData) {
    const results = [];

    for (const songData of songsData) {
      try {
        const metadata = await this.generateMetadata(songData);
        results.push({
          ...songData,
          metadata,
          success: true
        });

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to generate metadata for ${songData.title}:`, error);
        results.push({
          ...songData,
          metadata: this.generateFallbackMetadata(songData),
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Estimate cost for generating metadata
   * @param {number} numSongs - Number of songs
   * @returns {Object} Cost estimation
   */
  estimateCost(numSongs = 1) {
    // GPT-4o-mini pricing (as of 2024)
    const inputCostPer1M = 0.150; // USD per 1M input tokens
    const outputCostPer1M = 0.600; // USD per 1M output tokens

    // Rough estimates
    const avgInputTokens = 500; // Prompt + song data
    const avgOutputTokens = 400; // Title + description + tags

    const inputCost = (avgInputTokens / 1000000) * inputCostPer1M * numSongs;
    const outputCost = (avgOutputTokens / 1000000) * outputCostPer1M * numSongs;
    const totalCost = inputCost + outputCost;

    return {
      numSongs,
      estimatedCost: totalCost.toFixed(4),
      costPerSong: (totalCost / numSongs).toFixed(4),
      currency: 'USD'
    };
  }
}

export default SEOGenerator;
