import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * StylePresetManager - Manages music style presets for consistent batch generation
 */
export class StylePresetManager {
  constructor(configPath = path.join(__dirname, '../../config/style-presets.json')) {
    this.configPath = configPath;
    this.presets = [];
  }

  async load() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const data = await fs.readJSON(this.configPath);
        this.presets = data.presets || [];
      } else {
        // Initialize with default presets
        this.presets = this.getDefaultPresets();
        await this.save();
      }
    } catch (error) {
      console.error('Error loading style presets:', error);
      this.presets = this.getDefaultPresets();
    }
    return this.presets;
  }

  async save() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJSON(this.configPath, {
        presets: this.presets,
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      }, { spaces: 2 });
    } catch (error) {
      console.error('Error saving style presets:', error);
      throw error;
    }
  }

  getDefaultPresets() {
    return [
      // 🎧 Lo-fi Hip Hop / Chillhop
      {
        id: 'lofi-01',
        name: 'Lo-fi Hip Hop / Chillhop - Jazzy Study Vibes',
        style: 'lo-fi chillhop with jazzy chords, dusty vinyl textures, mellow beats, warm tape hiss, perfect for late-night studying',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-02',
        name: 'Lo-fi Hip Hop / Chillhop - Nostalgic Soul',
        style: 'nostalgic lo-fi beat with soulful samples, laid-back groove, Rhodes piano, and ambient background crackle',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-03',
        name: 'Lo-fi Hip Hop / Chillhop - Boom Bap Chill',
        style: 'chillhop instrumental with boom bap drums, soft synth pads, jazzy textures, and analog saturation',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-04',
        name: 'Lo-fi Hip Hop / Chillhop - Mellow Piano',
        style: 'mellow lo-fi beat with piano loops, vinyl hiss, deep bass, and relaxed swing',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-05',
        name: 'Lo-fi Hip Hop / Chillhop - Sleepy Guitar',
        style: 'laid-back lo-fi with ambient layers, sleepy drums, soft vinyl pop, and jazzy guitar',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-06',
        name: 'Lo-fi Hip Hop / Chillhop - Dreamy Instrumental',
        style: 'instrumental lo-fi with dreamy melodies, mellow beat textures, and vinyl ambiance',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-07',
        name: 'Lo-fi Hip Hop / Chillhop - Moody Jazz',
        style: 'moody chillhop with off-kilter rhythm, jazzy samples, and cozy analog feel',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-08',
        name: 'Lo-fi Hip Hop / Chillhop - Saxophone Soul',
        style: 'jazzy lo-fi beat with brushed snares, soft saxophone textures, and warm low end',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-09',
        name: 'Lo-fi Hip Hop / Chillhop - Vintage Keys',
        style: 'lo-fi instrumental with vintage keys, soulful loop chops, and laid-back vibe',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'lofi-10',
        name: 'Lo-fi Hip Hop / Chillhop - Rainy Day',
        style: 'relaxing lo-fi beat with rainy ambiance, cozy piano, and old tape hiss',
        category: 'Lo-fi Hip Hop / Chillhop',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },

      // 🎹 Emotional / Cinematic Piano
      {
        id: 'piano-01',
        name: 'Emotional / Cinematic Piano - Intimate Solo',
        style: 'solo emotional piano with intimate reverb and cinematic dynamics, perfect for storytelling',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-02',
        name: 'Emotional / Cinematic Piano - Dramatic Score',
        style: 'dramatic piano score with soft strings, echoing reverb, and melancholic chords',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-03',
        name: 'Emotional / Cinematic Piano - Ambient Felt',
        style: 'ambient piano instrumental with felt textures, slow tempo, and emotional weight',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-04',
        name: 'Emotional / Cinematic Piano - Atmospheric',
        style: 'cinematic piano with atmospheric swells, subtle background pads, and emotional tone',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-05',
        name: 'Emotional / Cinematic Piano - Heartfelt Build',
        style: 'heartfelt piano with cinematic build, minor key progression, and orchestral undertones',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-06',
        name: 'Emotional / Cinematic Piano - Slow Ambient',
        style: 'slow piano with ambient drones, long reverb tails, and expressive melody',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-07',
        name: 'Emotional / Cinematic Piano - Intimate Felt',
        style: 'intimate felt piano recording with natural room tone and slow melancholy',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-08',
        name: 'Emotional / Cinematic Piano - Soft Textures',
        style: 'soft ambient piano with evolving textures, reverb-rich dynamics, and emotional space',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-09',
        name: 'Emotional / Cinematic Piano - Minimalist',
        style: 'minimalist emotional piano with rich harmonics and haunting undertones',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'piano-10',
        name: 'Emotional / Cinematic Piano - String Overlays',
        style: 'cinematic piano instrumental with gentle string overlays, piano flourishes, and sad tonality',
        category: 'Emotional / Cinematic Piano',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },

      // 🧨 Trap / Phonk Beats
      {
        id: 'trap-01',
        name: 'Trap / Phonk Beats - Dark 808s',
        style: 'dark trap instrumental with hard 808s, eerie synth melodies, and atmospheric space',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-02',
        name: 'Trap / Phonk Beats - Memphis Phonk',
        style: 'phonk beat with distorted Memphis vocal chops, gritty bass, and cowbell stabs',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-03',
        name: 'Trap / Phonk Beats - Aggressive Trap',
        style: 'aggressive trap with punchy drums, ambient textures, and spooky sound design',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-04',
        name: 'Trap / Phonk Beats - Eerie Minimal',
        style: 'eerie trap beat with sparse percussion, deep subs, and reversed melodies',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-05',
        name: 'Trap / Phonk Beats - Underground Phonk',
        style: 'underground phonk with lo-fi textures, chopped vocals, and menacing synths',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-06',
        name: 'Trap / Phonk Beats - Moody Cinematic',
        style: 'moody trap with cinematic pads, heavy low-end, and trippy delays',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-07',
        name: 'Trap / Phonk Beats - Hard Trap',
        style: 'hard trap instrumental with stuttered hi-hats, dark leads, and booming bass',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-08',
        name: 'Trap / Phonk Beats - Night Drive',
        style: 'fast-paced phonk with crunchy drums, night-drive vibe, and retro menace',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-09',
        name: 'Trap / Phonk Beats - Dark Minimal',
        style: 'trap beat with minimal melody, dark tension, and distorted ambience',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'trap-10',
        name: 'Trap / Phonk Beats - Spacey Trap',
        style: 'spacey trap instrumental with long reverb tails, gliding 808s, and off-grid rhythm',
        category: 'Trap / Phonk Beats',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },

      // 🌌 Ambient / Atmospheric / Drone
      {
        id: 'ambient-01',
        name: 'Ambient / Atmospheric / Drone - Deep Drone',
        style: 'deep ambient drone with long-evolving textures, soft pads, and minimal progression',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-02',
        name: 'Ambient / Atmospheric / Drone - Cinematic Swells',
        style: 'cinematic ambient with gentle synth swells, slow motion, and airy atmosphere',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-03',
        name: 'Ambient / Atmospheric / Drone - Dark Soundscape',
        style: 'dark ambient soundscape with rumbling low end, sparse textures, and haunting resonance',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-04',
        name: 'Ambient / Atmospheric / Drone - Peaceful Pads',
        style: 'peaceful ambient pad layers with soft harmonic movement and no rhythm',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-05',
        name: 'Ambient / Atmospheric / Drone - Evolving Textures',
        style: 'evolving ambient textures with shimmering highs, deep mids, and slow fade-ins',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-06',
        name: 'Ambient / Atmospheric / Drone - Dreamy Float',
        style: 'dreamy ambient instrumental with floating tones, wide stereo field, and minimal elements',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-07',
        name: 'Ambient / Atmospheric / Drone - Space Ambient',
        style: 'space ambient with sci-fi tones, subtle modulation, and slow atmospheric build',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-08',
        name: 'Ambient / Atmospheric / Drone - Meditative',
        style: 'meditative ambient with bell-like tones, natural field recordings, and evolving pads',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-09',
        name: 'Ambient / Atmospheric / Drone - Organ Drone',
        style: 'ambient drone with organ-like synths, stretched textures, and immersive reverb',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'ambient-10',
        name: 'Ambient / Atmospheric / Drone - Nature Landscape',
        style: 'ambient landscape with nature-inspired textures, minimal melody, and soft sonic flow',
        category: 'Ambient / Atmospheric / Drone',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },

      // 🎸 Guitar Instrumentals
      {
        id: 'guitar-01',
        name: 'Guitar Instrumentals - Fingerstyle Acoustic',
        style: 'fingerstyle acoustic guitar instrumental with soft harmonics, storytelling melody, and warm tone',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-02',
        name: 'Guitar Instrumentals - Ambient Electric',
        style: 'ambient electric guitar with lush reverb, layered delays, and dreamy progression',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-03',
        name: 'Guitar Instrumentals - Nylon String',
        style: 'cozy nylon-string guitar solo with natural ambiance and heartfelt phrasing',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-04',
        name: 'Guitar Instrumentals - Chill Acoustic',
        style: 'chill acoustic guitar instrumental with light percussion and relaxed folk vibe',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-05',
        name: 'Guitar Instrumentals - Emotional Ambient',
        style: 'emotional ambient guitar with shimmering harmonics, slow pacing, and cinematic vibe',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-06',
        name: 'Guitar Instrumentals - Fingerpicked Pads',
        style: 'relaxing fingerpicked guitar melody with ambient pads and slow echo trails',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-07',
        name: 'Guitar Instrumentals - Reverb Electric',
        style: 'reverb-heavy electric guitar instrumental with clean tones and emotional texture',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-08',
        name: 'Guitar Instrumentals - Layered Acoustic',
        style: 'layered acoustic guitar textures with ambient swells and subtle background synths',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-09',
        name: 'Guitar Instrumentals - Melodic Fingerstyle',
        style: 'melodic fingerstyle guitar with rhythmic tapping, open tuning, and cinematic storytelling',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      },
      {
        id: 'guitar-10',
        name: 'Guitar Instrumentals - Ambient Slide',
        style: 'ambient slide guitar with ethereal tone, soft noise floor, and reverb-soaked phrasing',
        category: 'Guitar Instrumentals',
        favorite: false,
        usageCount: 0,
        createdAt: new Date().toISOString()
      }
    ];
  }

  // Create new preset
  async createPreset(name, style, category = 'Custom') {
    const preset = {
      id: crypto.randomBytes(8).toString('hex'),
      name,
      style,
      category,
      favorite: false,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };

    this.presets.push(preset);
    await this.save();
    return preset;
  }

  // Update existing preset
  async updatePreset(id, updates) {
    const index = this.presets.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Preset not found: ${id}`);
    }

    this.presets[index] = {
      ...this.presets[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.save();
    return this.presets[index];
  }

  // Delete preset
  async deletePreset(id) {
    const index = this.presets.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Preset not found: ${id}`);
    }

    this.presets.splice(index, 1);
    await this.save();
    return true;
  }

  // Get preset by ID
  getPreset(id) {
    return this.presets.find(p => p.id === id);
  }

  // Get all presets
  getAllPresets() {
    return this.presets.sort((a, b) => {
      // Sort by: favorite first, then usage count, then name
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return a.name.localeCompare(b.name);
    });
  }

  // Increment usage count
  async incrementUsage(id) {
    const preset = this.getPreset(id);
    if (preset) {
      preset.usageCount = (preset.usageCount || 0) + 1;
      preset.lastUsed = new Date().toISOString();
      await this.save();
    }
  }

  // Toggle favorite
  async toggleFavorite(id) {
    const preset = this.getPreset(id);
    if (preset) {
      preset.favorite = !preset.favorite;
      await this.save();
      return preset.favorite;
    }
    return false;
  }

  // Export presets
  async exportPresets(presetIds = null) {
    const presetsToExport = presetIds
      ? this.presets.filter(p => presetIds.includes(p.id))
      : this.presets;

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      presets: presetsToExport
    };
  }

  // Import presets
  async importPresets(data, merge = true) {
    if (!data || !data.presets) {
      throw new Error('Invalid import data');
    }

    if (merge) {
      // Merge with existing presets (avoid duplicates by name)
      const existingNames = new Set(this.presets.map(p => p.name));
      const newPresets = data.presets.filter(p => !existingNames.has(p.name));

      // Regenerate IDs for imported presets
      newPresets.forEach(p => {
        p.id = crypto.randomBytes(8).toString('hex');
        p.importedAt = new Date().toISOString();
      });

      this.presets.push(...newPresets);
    } else {
      // Replace all presets
      this.presets = data.presets;
    }

    await this.save();
    return this.presets.length;
  }
}

// Create singleton instance
const stylePresetManager = new StylePresetManager();

// Initialize on module load
await stylePresetManager.load();

export default stylePresetManager;
