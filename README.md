# Suno Automation v0.3 🎵

Professional Suno.com automation with style management, batch generation, and browser reuse optimization.

## ✨ Key Features

### 🎨 Style Management System
- **50 Professional Presets** across 5 genres
- Save/Load/Edit/Delete custom styles
- Favorite presets for quick access
- Import/Export collections
- Usage tracking

### 🔄 Smart Batch Generation  
- **45% faster** with browser reuse
- **80% less memory** usage
- Random style variation within category
- Create 1-50 songs per batch
- Auto error recovery

### 🎵 Core Automation
- Automated Suno.com song creation
- Google OAuth & Email/Password auth
- Persistent browser sessions
- Dual MP3 downloads per song
- Real-time WebSocket updates

### 🎨 Modern UI
- YouTube-inspired dark theme
- Settings modal (gear icon)
- Full-height Activity Log
- Responsive mobile/desktop

## 🚀 Quick Start

```bash
./install.sh
./start.sh
```

Opens `http://localhost:3000`

## 📖 Usage

### Create Songs
1. Select style preset
2. Set number of songs (1-50)
3. ☑️ Random presets for variety
4. Add lyrics (optional)
5. Click "Create Songs"

### Style Presets
- **50 built-in presets:**
  - Lo-fi Hip Hop (10)
  - Emotional Piano (10)
  - Trap/Phonk (10)
  - Ambient/Drone (10)
  - Guitar Instrumentals (10)

### Manage Styles
- Click "Style Manager"
- Create/Edit/Delete presets
- Mark favorites (⭐)
- Export/Import collections

## ⚡ Performance

**Batch Generation (5 songs):**
- Before: 42.5 min (new browser each)
- **After: 23.3 min** (browser reuse)
- **45% faster, 80% less memory**

## 🏗️ Architecture

```
v0.3/
├── src/
│   ├── server.js              # Express + WebSocket
│   ├── automation/            # Playwright automation
│   ├── config/                # Settings & presets
│   └── workflows/             # Publishing (future)
├── public/
│   ├── index.html             # UI
│   ├── css/styles.css         # Dark theme
│   └── js/app.js              # Frontend logic
├── .env.example               # Config template
└── start.sh                   # Launcher
```

## 📝 What's New in v0.3

✅ **Browser reuse** - One browser for entire batch
✅ **WebSocket improvements** - Clean connection logging  
✅ **Port auto-detection** - Kills existing servers
✅ **Robust cleanup** - Finally blocks guarantee browser closure
✅ **Clean structure** - Removed test files

## 🔧 Configuration

### Via Settings Modal (⚙️)
- Authentication method
- Download folder (browse)
- Wait time (minutes)

### Via `.env`
```bash
PORT=3000
DOWNLOAD_PATH=./downloads
```

## 📊 API Endpoints

### Style Presets
- `GET /api/style-presets` - List all
- `POST /api/style-presets` - Create
- `PUT /api/style-presets/:id` - Update
- `DELETE /api/style-presets/:id` - Delete
- `POST /api/style-presets/:id/favorite` - Toggle fav
- `GET /api/style-presets/export` - Export JSON
- `POST /api/style-presets/import` - Import JSON

### Song Creation
- `POST /api/create-song` - Single song
- `POST /api/batch-create` - Batch with random

## 🐛 Troubleshooting

### Port in use
```bash
pkill -f "node.*server.js"
# Or use ./start.sh (auto-detects)
```

### Auth fails
```bash
rm -rf playwright/.auth/chrome-profile/
# Re-enter credentials in Settings
```

### Browser won't stay open
- Set `headless: false` in config
- Keep window visible (not minimized)

## 🔒 Security

- ✅ Never commit `.env`
- ✅ Never commit credentials files  
- ✅ Protect `playwright/.auth/` folder
- ✅ Use `.gitignore`

## 📄 License

MIT - Educational purposes. Respect Suno.com ToS.

## 🙏 Credits

Built with Playwright, Express, WebSocket, Tailwind CSS

---

**Version:** 0.3.0  
**Updated:** 2025-10-07  
**Built with ❤️ for music creators**
