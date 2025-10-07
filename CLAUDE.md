# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a complete automation system for Suno.com that:
1. Automates song creation using Playwright browser automation
2. Provides a modern web interface for user interaction
3. Monitors song generation progress and downloads MP3 files
4. Uses WebSocket for real-time status updates

## Essential Commands

### Development
- `npm start` - Start the server (production mode)
- `npm run dev` - Start with auto-reload on file changes (uses `--watch`)
- `npm test` - Run test song creation directly
- `npm install` - Install dependencies
- `npx playwright install chromium` - Install Playwright browser

### Server
The server runs on port 3000 by default (configurable via `.env` or `PORT` env var).
Access the web interface at `http://localhost:3000`

## Critical Knowledge

### Google OAuth Authentication
- Uses **persistent browser context** (`auth-persistent.js`) to avoid Google's bot detection
- Browser window **must be visible** (headless=false) for Google OAuth
- Session saved to `playwright/.auth/chrome-profile/` - only login once
- If Google blocks with "browser not secure", delete profile folder and retry
- **Anti-detection measures** include: hidden webdriver property, realistic user agent, persistent cookies
- **Two authentication implementations:**
  - `auth.js` - Standard storage state approach
  - `auth-persistent.js` - Persistent Chrome profile (recommended for Google OAuth)

### CAPTCHA & Rate Limiting
- **New accounts**: Create 1 song/hour, build trust for 1-2 weeks with manual usage first
- **Established accounts**: 1 song per 15-30 minutes
- **Never exceed**: 5 songs/day on free tier
- If CAPTCHA appears: automation pauses, solve manually in browser window, continues automatically
- If getting 404 errors: wait 30-60 minutes, create songs manually to rebuild trust
- Keep `playwright/.auth/chrome-profile/` folder intact between runs for session persistence

### Song Creation Flow States
The automation progresses through these states (tracked via WebSocket):
1. `loading_config` (5%) → `initializing_browser` (10%)
2. `authenticating` (20%) → `authenticated` (30%)
3. `creating_song` (40%) → `song_created` (50%)
4. `waiting_for_completion` (60%) → `song_completed` (80%)
5. `downloading` (90%) → `download_complete` (95%) → `complete` (100%)

### Selector Strategy (Resilience to UI changes)
All automation uses **fallback selector arrays** to handle Suno.com UI updates:
```javascript
const selectors = ['specific-selector', 'fallback-selector', 'generic-selector'];
for (const selector of selectors) {
  const element = page.locator(selector).first();
  if (await element.isVisible()) { /* use this */ break; }
}
```
When Suno.com updates: test workflow → inspect DevTools → update selector arrays → test again

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
│                     (User Interface)                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ HTTP/WebSocket
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                    Express Server                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints + WebSocket Server               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Controls
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                     SunoBot                                 │
│  ┌────────────┬──────────────┬────────────────────────┐   │
│  │   Auth     │     Song     │      Download          │   │
│  │  Manager   │   Creator    │      Manager           │   │
│  └────────────┴──────────────┴────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Playwright
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                   Chromium Browser                          │
│                     (Automated)                             │
│              Interacts with Suno.com                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Playwright over Puppeteer**:
   - Better API and documentation
   - Built-in support for multiple browsers
   - Better handling of modern web apps

2. **WebSocket for Status Updates**:
   - Real-time progress updates without polling
   - Efficient communication between server and client
   - Better UX with instant feedback

3. **Singleton Settings Manager**:
   - Centralized configuration management
   - Automatic persistence to JSON file
   - Easy to extend with new settings

4. **Modular Automation**:
   - Separated concerns (auth, creation, download)
   - Easy to test individual components
   - Maintainable and extensible

5. **YouTube-Inspired UI**:
   - Familiar design patterns
   - Dark theme reduces eye strain
   - Professional appearance

## Code Structure

### Backend (`src/`)

#### `server.js`
- Express server setup
- WebSocket server for real-time updates
- API endpoint definitions
- Request handling and validation
- Global state management

Key functions:
- `broadcastStatus()`: Send status updates to all connected clients
- Error handling middleware
- Graceful shutdown handlers

#### `automation/suno-bot.js`
- Main orchestrator for the automation process
- Coordinates auth, creation, and download
- Status callback system for progress updates
- Full automation workflow: `automateFullProcess()`

#### `automation/auth.js` & `automation/auth-persistent.js`
- Authentication management with two implementations
- **auth-persistent.js** (recommended): Uses persistent Chrome profile for better Google OAuth compatibility
- **auth.js**: Standard storage state approach
- Google OAuth flow automation
- Email/password login automation
- Session persistence
- Login state detection

Key methods (auth-persistent.js):
- `initialize()`: Launch persistent browser context with Chrome profile
- `ensureLoggedIn()`: Check login state and authenticate if needed
- `loginWithGoogle()`: Handle Google OAuth with persistent session
- `close()`: Cleanup browser resources

Key methods (auth.js):
- `initialize()`: Set up browser and context
- `checkIfLoggedIn()`: Verify authentication state
- `loginWithGoogle()`: Handle Google OAuth flow
- `loginWithPassword()`: Handle credential-based login
- `saveAuthState()`: Persist authentication for future sessions

#### `automation/song-creator.js`
- Song creation workflow
- DOM selector strategies (multiple fallbacks)
- Form filling and submission
- Custom mode activation

Key methods:
- `navigateToCreate()`: Go to Suno.com create page
- `selectCustomMode()`: Enable custom song creation
- `fillLyrics()`: Input song lyrics
- `fillStyles()`: Input music style
- `clickCreate()`: Submit song creation

#### `automation/download-manager.js`
- Song completion monitoring
- Download handling (both versions per round)
- File system operations
- Debug screenshot capability for troubleshooting

Key methods:
- `waitForSongCompletion()`: Poll until song is ready
- `checkSongStatus()`: Verify song generation status
- `findSongInLibrary()`: Locate song in Suno's library
- `downloadSong()`: Download both MP3 versions (v1 and v2)
- Recent fix: Correctly downloads both versions without duplicates

#### `config/settings.js`
- Configuration management
- JSON file persistence
- Default settings
- Getter/setter methods

### Frontend (`public/`)

#### `index.html`
- Semantic HTML structure
- Accessible form controls
- Settings panel
- Song creation form
- Status dashboard
- Downloads list

#### `css/styles.css`
- YouTube-inspired color palette
- Dark theme implementation
- Responsive design
- Component-based styling
- CSS custom properties for theming

Color Palette:
- Primary: `#FF0000` (YouTube red)
- Backgrounds: `#0f0f0f`, `#181818`, `#212121`
- Text: `#ffffff`, `#aaaaaa`, `#717171`
- Accent: `#065FD4` (YouTube blue)

#### `js/app.js`
- WebSocket client
- Event handlers
- Status update processing
- Form submission
- Download management

Key functions:
- `connectWebSocket()`: Establish WebSocket connection
- `handleStatusUpdate()`: Process status messages
- `updateProgress()`: Update progress bar
- `createSong()`: Submit song creation request
- `loadDownloads()`: Fetch and display downloads

## Suno.com Integration

### DOM Selectors Strategy

The code uses a **fallback selector strategy** to handle UI changes:

```javascript
const selectors = [
  'specific-selector',
  'less-specific-selector',
  'generic-selector'
];

for (const selector of selectors) {
  const element = page.locator(selector).first();
  if (await element.isVisible()) {
    // Use this element
    break;
  }
}
```

This makes the automation more resilient to minor UI changes.

### Key Pages and Elements

1. **Login Page**:
   - Sign In button
   - Google OAuth button
   - Email/Password inputs

2. **Create Page** (`/create`):
   - Audio/Persona/Inpo tabs
   - Custom mode toggle
   - Lyrics textarea
   - Style input
   - Advanced Options (collapsible)
   - Create button

3. **My Workspace** (sidebar):
   - Recent songs list
   - Song status indicators
   - Play buttons

4. **Library Page** (`/library`):
   - Songs list
   - Three-dot menu per song
   - Download option in menu

### Status Detection

Songs have different states:
- **Generating**: Loading indicator present
- **Complete**: Play button visible, duration shown
- **Failed**: Error message

The download manager polls the library page and checks for these indicators.

## Authentication Flow

### Google OAuth
1. Navigate to Suno.com
2. Click "Sign In"
3. Click "Continue with Google"
4. Wait for Google OAuth popup/redirect
5. User completes authentication manually
6. Wait for redirect back to Suno
7. Save storage state

### Email & Password
1. Navigate to Suno.com
2. Click "Sign In"
3. Click "Continue with Email"
4. Fill email and password
5. Click submit
6. Wait for redirect
7. Save storage state

### Session Persistence

Playwright's `storageState` feature saves:
- Cookies
- Local storage
- Session storage
- IndexedDB

This allows the automation to stay logged in across runs.

## Status Update System

### Status Flow

```
loading_config (5%)
  ↓
initializing_browser (10%)
  ↓
authenticating (20%)
  ↓
authenticated (30%)
  ↓
creating_song (40%)
  ↓
song_created (50%)
  ↓
waiting_for_completion (60%)
  ↓
song_completed (80%)
  ↓
downloading (90%)
  ↓
download_complete (95%)
  ↓
complete (100%)
```

### Status Message Format

```javascript
{
  status: 'status_name',
  message: 'Human-readable message',
  data: { /* Optional additional data */ }
}
```

## Error Handling

### Strategy
1. **Try-catch blocks** around all async operations
2. **Status callbacks** for error reporting
3. **Graceful degradation** where possible
4. **User-friendly error messages**

### Common Errors

1. **Authentication Failed**:
   - Cause: Invalid credentials or expired session
   - Solution: Clear auth state and re-authenticate

2. **Element Not Found**:
   - Cause: Suno.com UI changed
   - Solution: Update selectors in the code

3. **Song Timeout**:
   - Cause: Generation taking too long
   - Solution: Increase `maxWaitTime` setting

4. **Download Failed**:
   - Cause: Network issue or file permissions
   - Solution: Check network and folder permissions

## Configuration System

### Settings Hierarchy
1. Default settings (in `settings.js`)
2. `config.json` file
3. Environment variables (`.env`)
4. Runtime updates via API

### Adding New Settings

1. Add default value in `settings.js`:
```javascript
const DEFAULT_CONFIG = {
  // ... existing settings
  myNewSetting: 'default_value'
};
```

2. Add UI control in `index.html`

3. Update `loadSettings()` and `saveSettings()` in `app.js`

4. Use in code: `settings.get('myNewSetting')`

## Testing Strategy

### Manual Testing
1. Run `npm start`
2. Open browser to `localhost:3000`
3. Test each feature:
   - Settings save/load
   - Authentication
   - Song creation
   - Progress monitoring
   - Download

### Automated Testing (Future)
- Unit tests for individual components
- Integration tests for API endpoints
- E2E tests for complete workflows

### Debugging Tips

1. **Browser Automation**:
   - Set `headless: false`
   - Increase `slowMo` to watch actions
   - Use `page.pause()` for breakpoints
   - Debug screenshots saved to `downloads/debug/` directory

2. **WebSocket**:
   - Check browser console for connection errors
   - Monitor Network tab for messages
   - Add logging in `handleStatusUpdate()`

3. **File System**:
   - Check folder permissions
   - Verify paths are absolute
   - Use `fs.ensureDir()` before writes

4. **Download Issues**:
   - Check `downloads/debug/` for before/after screenshots
   - Review `download-manager.js.backup` if recent changes cause issues
   - Verify both MP3 versions download correctly

## Future Enhancements

**Note:** See `AppFeature.md` for comprehensive roadmap toward full YouTube automation (audio compilation → video generation → SEO → upload → analytics).

### High Priority

1. **Batch Processing**:
   - Queue system for multiple songs
   - Parallel song creation (if Suno allows)
   - Progress tracking per song

2. **Better Error Recovery**:
   - Automatic retry on failures
   - Save progress and resume
   - Detailed error logging

3. **Advanced Song Options**:
   - Instrumental mode
   - Song length control
   - Voice model selection
   - Advanced options panel

### Medium Priority

4. **Playlist Management**:
   - Create playlists in Suno
   - Export playlists
   - Bulk operations

5. **Song Editing**:
   - Re-generate variations
   - Extend songs
   - Remix capabilities

6. **Notification System**:
   - Desktop notifications when songs complete
   - Email notifications (optional)
   - Sound alerts

### Low Priority

7. **Analytics Dashboard**:
   - Song creation statistics
   - Success rate tracking
   - Time analytics

8. **Multi-user Support**:
   - User accounts
   - Separate download folders
   - User preferences

9. **Mobile-Responsive UI**:
   - Mobile-optimized interface
   - Touch-friendly controls
   - Progressive Web App (PWA)

10. **API Rate Limiting**:
    - Respect Suno's rate limits
    - Queue management
    - Throttling

## Maintenance Guidelines

### When Suno.com Updates

1. **Test immediately**: Run a full workflow
2. **Check selectors**: Inspect elements in DevTools
3. **Update selectors**: Modify fallback arrays
4. **Test again**: Verify all features work

### Code Style

- Use ES modules (`import/export`)
- Async/await for promises
- Descriptive variable names
- Comments for complex logic
- Error handling in all async functions

### Git Workflow

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Commit with descriptive message
5. Merge to main

### Version Updates

When releasing a new version:
1. Update version in `package.json`
2. Update version in `README.md`
3. Update footer in `index.html`
4. Tag the release in git

## Security Considerations

### Current Implementation

- Credentials stored in plain text in `config.json`
- No authentication for web interface
- Server binds to localhost only

### Recommendations for Production

1. **Encrypt credentials**: Use encryption for stored passwords
2. **Add authentication**: Protect web interface with login
3. **Use HTTPS**: Enable SSL/TLS for the web server
4. **Input validation**: Sanitize all user inputs
5. **Rate limiting**: Prevent abuse of API endpoints
6. **CSRF protection**: Add CSRF tokens to forms
7. **Environment variables**: Don't commit secrets

## Performance Optimization

### Current Performance

- Song creation: 1-3 minutes (Suno.com limitation)
- Browser initialization: ~5 seconds
- Download: ~10 seconds per song

### Optimization Opportunities

1. **Reuse browser context**: Don't close browser between songs
2. **Parallel downloads**: Download multiple songs simultaneously
3. **Cache static assets**: Use browser caching for web interface
4. **Minimize polling**: Increase poll interval after initial checks
5. **Lazy load UI**: Only load downloads when section is visible

## Debugging Common Issues

### "Element not found" errors

1. Open browser with `headless: false`
2. Navigate to the problem page
3. Open DevTools (F12)
4. Find the correct selector
5. Update selector arrays in code

### Authentication not persisting

1. Delete `playwright/.auth/state.json`
2. Clear Suno.com cookies in browser
3. Try other authentication method
4. Check if Suno.com requires 2FA

### Download fails silently

1. Check console for errors
2. Verify download folder exists and is writable
3. Check if browser download dialog is blocked
4. Try downloading manually to verify song is available

## API Documentation

### REST Endpoints

#### GET `/api/settings`
Returns current configuration.

Response:
```json
{
  "authMethod": "google",
  "credentials": {
    "email": "user@example.com",
    "password": "********"
  },
  "downloadPath": "./downloads",
  "playwright": { ... },
  "suno": { ... }
}
```

#### POST `/api/settings`
Updates configuration.

Request:
```json
{
  "authMethod": "password",
  "credentials": {
    "email": "user@example.com",
    "password": "password123"
  },
  "downloadPath": "./downloads"
}
```

#### POST `/api/create-song`
Creates a new song.

Request:
```json
{
  "title": "My Song",
  "lyrics": "Verse 1...",
  "style": "Pop, upbeat"
}
```

Response:
```json
{
  "success": true,
  "message": "Song creation started"
}
```

### WebSocket Messages

All messages are JSON objects with a `status` field:

```json
{
  "status": "creating_song",
  "message": "Creating song...",
  "title": "My Song",
  "style": "Pop"
}
```

## Contributing

When contributing to this project:

1. Follow existing code style
2. Add comments for complex logic
3. Update documentation (this file)
4. Test thoroughly before committing
5. Update README.md if adding user-facing features

## Project Structure

### Version History
- **v0.1/**: Archived initial version
- **Current (root)**: Active v0.2 implementation with persistent auth and dual MP3 downloads
- **v0.2/**: Contains embedded repository (see `v0.2/CLAUDE.md` for that version's docs)

### Key Files
- `AppFeature.md`: Comprehensive roadmap for full YouTube automation pipeline
- `COMPLETE_PROJECT_SUMMARY.txt`: Project overview and status
- `install.sh`: Installation script
- `restart.sh`: Server restart script
- `start.sh`: Server startup script

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [WebSocket Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Suno.com](https://suno.com/)

## Contact and Support

This project was created as an automation tool for Suno.com. For questions about:
- **Suno.com functionality**: Visit [suno.com/help](https://suno.com/help)
- **Playwright issues**: Check [Playwright GitHub](https://github.com/microsoft/playwright)
- **This codebase**: Refer to inline comments and this documentation

---

**Last Updated**: 2025-10-05
**Version**: 0.2.1
**Recent Changes**:
- Added persistent Chrome profile authentication (`auth-persistent.js`)
- Fixed duplicate MP3 download issue (both versions download correctly)
- Added debug screenshot capability
- Improved Google OAuth reliability
