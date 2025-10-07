import fs from 'fs-extra';
import path from 'path';

export class DownloadManager {
  constructor(page, config) {
    this.page = page;
    this.config = config;
  }

  async waitForSongCompletion(songTitle, maxWaitTime = null) {
    const maxWait = maxWaitTime || this.config.suno.maxWaitTime;
    const pollInterval = this.config.suno.pollInterval;
    const startTime = Date.now();

    console.log(`Waiting for song "${songTitle}" to complete...`);
    console.log(`Max wait time: ${maxWait / 1000} seconds`);

    while (Date.now() - startTime < maxWait) {
      try {
        // Check if page/context is still open
        if (this.page.isClosed()) {
          throw new Error('Browser page was closed unexpectedly');
        }

        // Check for CAPTCHA
        const hasCaptcha = await this.checkForCaptcha();
        if (hasCaptcha) {
          console.log('\n' + '='.repeat(60));
          console.log('⚠️  CAPTCHA DETECTED');
          console.log('='.repeat(60));
          console.log('Please solve the CAPTCHA in the browser window');
          console.log('The automation will continue automatically after you solve it');
          console.log('='.repeat(60) + '\n');

          // Wait for user to solve CAPTCHA
          await this.waitForCaptchaSolution();
        }

        // Check if song is complete
        const isComplete = await this.checkSongStatus(songTitle);

        if (isComplete) {
          console.log('Song generation completed!');
          return true;
        }

        // Wait before polling again
        console.log(`Checking again in ${pollInterval / 1000} seconds...`);
        await this.safeWaitForTimeout(pollInterval);

      } catch (error) {
        console.warn('Error checking song status:', error.message);

        // If page is closed, we can't continue
        if (error.message.includes('closed') || error.message.includes('Target')) {
          throw error;
        }

        // Otherwise, try to wait and continue
        try {
          await this.safeWaitForTimeout(pollInterval);
        } catch (waitError) {
          throw new Error('Browser connection lost');
        }
      }
    }

    throw new Error(`Song generation timed out after ${maxWait / 1000} seconds`);
  }

  /**
   * Safe wait that checks if page is still open
   */
  async safeWaitForTimeout(timeout) {
    try {
      if (this.page.isClosed()) {
        throw new Error('⚠️  Browser was closed. Please keep the browser window open during song generation!');
      }
      await this.page.waitForTimeout(timeout);
    } catch (error) {
      if (error.message.includes('closed') || error.message.includes('Target')) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ BROWSER CLOSED UNEXPECTEDLY');
        console.log('='.repeat(60));
        console.log('The browser window was closed while waiting for song completion.');
        console.log('');
        console.log('⚠️  IMPORTANT: Do NOT close the browser window manually!');
        console.log('');
        console.log('The automation needs the browser to stay open for:');
        console.log('1. Creating the song (30 seconds)');
        console.log('2. Waiting for generation (2-3 minutes)');
        console.log('3. Downloading the MP3 (30 seconds)');
        console.log('');
        console.log('💡 TIP: Minimize the window instead of closing it.');
        console.log('='.repeat(60) + '\n');
        throw new Error('Browser closed - Please keep browser open during entire process');
      }
      throw error;
    }
  }

  /**
   * Check for CAPTCHA on the page
   */
  async checkForCaptcha() {
    try {
      const captchaIndicators = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="captcha"]',
        '.g-recaptcha',
        '#captcha',
        'text=verify you are human',
        'text=I\'m not a robot',
        '[data-callback*="captcha"]'
      ];

      for (const indicator of captchaIndicators) {
        try {
          const element = this.page.locator(indicator).first();
          if (await element.isVisible({ timeout: 2000 })) {
            return true;
          }
        } catch (e) {
          continue;
        }
      }

      // Check for 404 or error pages
      const url = this.page.url();
      if (url.includes('404') || url.includes('error')) {
        console.log('⚠️  Error page detected:', url);
        return true; // Treat as CAPTCHA-like issue
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for user to solve CAPTCHA
   */
  async waitForCaptchaSolution(maxWait = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await this.safeWaitForTimeout(5000);

      const stillHasCaptcha = await this.checkForCaptcha();
      if (!stillHasCaptcha) {
        console.log('✅ CAPTCHA solved! Continuing automation...');
        return true;
      }

      // Check if we're back on Suno
      const url = this.page.url();
      if (url.includes('suno.com') && !url.includes('404') && !url.includes('error')) {
        console.log('✅ Back on Suno.com - assuming CAPTCHA solved');
        return true;
      }
    }

    throw new Error('CAPTCHA solution timeout - user did not solve CAPTCHA within 5 minutes');
  }

  async checkSongStatus(songTitle) {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🔍 CHECK SONG STATUS - Step 1: Navigation to /me');
      console.log('='.repeat(60));

      const currentUrl = this.page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Navigate to /me page to see songs with Edit and Publish buttons
      if (!currentUrl.includes('/me')) {
        console.log('🌐 Navigating to /me page...');
        await this.page.goto(`${this.config.suno.baseUrl}/me`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log('✅ Navigated to /me');
      } else {
        console.log('✅ Already on /me page');
      }

      console.log('⏳ Waiting 3 seconds for page to load...');
      await this.page.waitForTimeout(3000);

      console.log('\n' + '='.repeat(60));
      console.log('🔍 CHECK SONG STATUS - Step 2: Finding Song Containers');
      console.log('='.repeat(60));
      console.log('📋 Looking for song cards on /me page...');

      // Take diagnostic screenshot
      await this.takeDebugScreenshot('me-page-status-check');

      // Get all song containers on /me page
      // Each song row contains: thumbnail image, title, Edit/Publish buttons, and three-dot menu
      let allSongs = [];
      const containerSelectors = [
        // Look for rows that have both an image and Edit button (completed songs)
        'div:has(img):has(button:has-text("Edit"))',
        // Alternative: rows with image and duration time
        'div:has(img):has-text(/\\d+:\\d+/)',
        // Fallback: any div with Edit and Publish buttons together
        'div:has(button:has-text("Edit")):has(button:has-text("Publish"))',
        'article',  // Generic article elements
        '[data-testid="song-card"]',
        'a[href^="/song/"]',  // Song links
      ];

      for (const selector of containerSelectors) {
        console.log(`🔎 Trying selector: ${selector}`);
        allSongs = await this.page.locator(selector).all();
        if (allSongs.length > 0) {
          console.log(`✅ Found ${allSongs.length} song containers using selector: ${selector}`);
          break;
        } else {
          console.log(`   No containers found with this selector`);
        }
      }

      if (allSongs.length === 0) {
        console.log('\n❌ No song containers found with any selector!');
        console.log('🔧 Running diagnostics...');

        // Debug: Try to find any elements that might be songs
        const debugSelectors = [
          { selector: 'button:has-text("Edit")', description: 'Edit buttons' },
          { selector: 'button:has-text("Publish")', description: 'Publish buttons' },
          { selector: 'a[href*="song"]', description: 'Links containing "song"' },
          { selector: 'article', description: 'Article elements' },
          { selector: 'img[src*="image"]', description: 'Images' },
        ];

        for (const { selector, description } of debugSelectors) {
          const count = await this.page.locator(selector).count();
          console.log(`   ${description}: ${count} found`);
        }

        console.log('❌ No songs found - returning false');
        return false;
      }

      console.log('\n' + '='.repeat(60));
      console.log('🔍 CHECK SONG STATUS - Step 3: Finding First COMPLETED Song');
      console.log('='.repeat(60));

      // Find the first song that is NOT generating
      let mostRecentSong = null;
      let songIndex = -1;

      const loadingIndicators = [
        'svg[class*="animate"]',  // Animated spinner SVG
        'svg[class*="spin"]',
        '[aria-busy="true"]',
        '.loading',
        '.spinner',
      ];

      console.log(`📊 Checking ${allSongs.length} songs to find first completed one...`);

      for (let i = 0; i < Math.min(allSongs.length, 10); i++) {
        const song = allSongs[i];
        const songText = await song.textContent().catch(() => '');
        console.log(`\n🔍 Checking song ${i}: "${songText.substring(0, 80)}..."`);

        // Check if this song is still generating
        let isGenerating = false;
        for (const indicator of loadingIndicators) {
          const hasLoading = await song.locator(indicator).isVisible().catch(() => false);
          if (hasLoading) {
            console.log(`   ⏳ Still generating (found: ${indicator})`);
            isGenerating = true;
            break;
          }
        }

        if (!isGenerating) {
          // Check if it has completion indicators
          const hasEdit = await song.locator('button:has-text("Edit")').isVisible().catch(() => false);
          const hasPublish = await song.locator('button:has-text("Publish")').isVisible().catch(() => false);
          const hasDuration = /\d+:\d+/.test(songText);

          console.log(`   ✅ Not generating - Edit:${hasEdit} Publish:${hasPublish} Duration:${hasDuration}`);

          if (hasEdit || hasPublish || hasDuration) {
            mostRecentSong = song;
            songIndex = i;
            console.log(`\n🎉 Found completed song at index ${i}!`);
            break;
          } else {
            console.log(`   ⚠️  No completion indicators found`);
          }
        }
      }

      if (!mostRecentSong) {
        console.log('\n❌ No completed songs found - all are still generating');
        return false;
      }

      const songText = await mostRecentSong.textContent().catch(() => '');
      console.log(`\n📄 Using song at index ${songIndex}: "${songText.substring(0, 150)}..."`);
      console.log('✅ Song is complete - has Edit/Publish buttons');

      // Check for completion indicators
      const completionIndicators = [
        // Check for Edit button (visible when complete)
        { type: 'edit-button', selector: 'button:has-text("Edit")' },
        // Check for Publish button (visible when complete)
        { type: 'publish-button', selector: 'button:has-text("Publish")' },
        // Check for duration pattern (e.g., "1:19", "0:45")
        { type: 'duration', pattern: /\d+:\d+/ },
        // Check for play button
        { type: 'play-button', selector: 'button[aria-label*="play" i]' },
        { type: 'play-button2', selector: 'button:has-text("Play")' },
      ];

      // Check each indicator
      console.log('🔍 Checking completion indicators:');
      for (const indicator of completionIndicators) {
        if (indicator.pattern) {
          // Pattern matching (e.g., duration)
          console.log(`   Checking for ${indicator.type} pattern...`);
          if (indicator.pattern.test(songText)) {
            const match = songText.match(indicator.pattern)[0];
            console.log(`   ✅ Found ${indicator.type}: ${match}`);
            console.log('\n🎉 SONG IS COMPLETE!');
            console.log('='.repeat(60) + '\n');
            return true;
          } else {
            console.log(`   ❌ ${indicator.type} pattern not found`);
          }
        } else if (indicator.selector) {
          // Element visibility check
          console.log(`   Checking for ${indicator.type}...`);
          const element = mostRecentSong.locator(indicator.selector).first();
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`   ✅ Found ${indicator.type}`);
            console.log('\n🎉 SONG IS COMPLETE!');
            console.log('='.repeat(60) + '\n');
            return true;
          } else {
            console.log(`   ❌ ${indicator.type} not visible`);
          }
        }
      }

      // Debug: List all buttons in the song container
      console.log('\n🔧 DEBUG: Listing all buttons in song container...');
      const allButtons = await mostRecentSong.locator('button').all();
      console.log(`📊 Total buttons found: ${allButtons.length}`);
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        const text = await allButtons[i].textContent().catch(() => '');
        const ariaLabel = await allButtons[i].getAttribute('aria-label').catch(() => '');
        const isVisible = await allButtons[i].isVisible().catch(() => false);
        console.log(`   Button ${i}: Text="${text.trim()}" | aria-label="${ariaLabel}" | Visible=${isVisible}`);
      }

      // If no loading and no clear completion indicators, log details and assume still processing
      console.log('\n⚠️  Song status unclear!');
      console.log('📄 Full song text (first 300 chars):');
      console.log('─'.repeat(60));
      console.log(songText.substring(0, 300));
      console.log('─'.repeat(60));
      console.log('❌ Assuming still processing...');
      console.log('='.repeat(60) + '\n');
      return false;

    } catch (error) {
      console.warn('Error checking song status:', error.message);
      return false;
    }
  }

  async findSongInLibrary(songTitle) {
    console.log(`Looking for most recent song on /me page...`);

    try {
      const currentUrl = this.page.url();
      console.log(`Current URL: ${currentUrl}`);

      // Navigate to /me page if not already there
      if (!currentUrl.includes('/me')) {
        console.log('Navigating to /me...');
        await this.page.goto(`${this.config.suno.baseUrl}/me`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        console.log('✅ Navigated to /me');
      }

      await this.page.waitForTimeout(3000);

      // Get all song containers on /me page
      // Each song row contains: thumbnail image, title, Edit/Publish buttons, and three-dot menu
      let allSongs = [];
      const containerSelectors = [
        // Look for rows that have both an image and Edit button (completed songs)
        'div:has(img):has(button:has-text("Edit"))',
        // Alternative: rows with image and duration time
        'div:has(img):has-text(/\\d+:\\d+/)',
        // Fallback: any div with Edit and Publish buttons together
        'div:has(button:has-text("Edit")):has(button:has-text("Publish"))',
        'article',  // Generic article elements
        '[data-testid="song-card"]',
        'a[href^="/song/"]',  // Song links
      ];

      for (const selector of containerSelectors) {
        allSongs = await this.page.locator(selector).all();
        if (allSongs.length > 0) {
          console.log(`Found ${allSongs.length} songs using selector: ${selector}`);
          break;
        }
      }

      if (allSongs.length === 0) {
        // Debug output
        console.log('No songs found. Debugging...');
        const editCount = await this.page.locator('button:has-text("Edit")').count();
        const linkCount = await this.page.locator('a[href*="song"]').count();
        console.log(`Found ${editCount} Edit buttons`);
        console.log(`Found ${linkCount} links containing "song"`);

        await this.takeDebugScreenshot('find-song-no-results');
        throw new Error('No songs found on /me page');
      }

      // Return the first (most recent) song
      const mostRecentSong = allSongs[0];
      const songText = await mostRecentSong.textContent().catch(() => '');
      console.log(`Found most recent song. Preview: "${songText.substring(0, 80)}..."`);

      return mostRecentSong;

    } catch (error) {
      console.error('Error finding song on /me page:', error.message);
      throw error;
    }
  }

  async downloadBothSongs(songTitle) {
    console.log('\n' + '='.repeat(60));
    console.log('💾 DOWNLOAD BOTH SONGS - Starting Process');
    console.log('='.repeat(60));
    console.log(`📝 Song title: ${songTitle}`);
    console.log('ℹ️  Suno creates 2 versions - downloading both...\n');

    const downloads = [];

    try {
      // Download first song (version 1) - from first song container
      console.log('📥 Downloading Version 1 (from first song container)...');
      const download1 = await this.downloadSingleSong(songTitle, 1, 0);
      downloads.push(download1);

      console.log('\n⏳ Waiting 3 seconds before downloading version 2...');
      await this.page.waitForTimeout(3000);

      // Download second song (version 2) - from second song container
      console.log('📥 Downloading Version 2 (from second song container)...');
      const download2 = await this.downloadSingleSong(songTitle, 2, 1);
      downloads.push(download2);

      console.log('\n' + '='.repeat(60));
      console.log('🎉 BOTH SONGS DOWNLOADED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log(`📁 Version 1: ${download1.filename}`);
      console.log(`📁 Version 2: ${download2.filename}`);
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        downloads: downloads,
        count: downloads.length
      };

    } catch (error) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ DOWNLOAD FAILED');
      console.log('='.repeat(60));
      console.error(`Error: ${error.message}`);
      console.log('='.repeat(60) + '\n');
      throw error;
    }
  }

  async downloadSingleSong(songTitle, version = 1, songIndex = 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`💾 Downloading Version ${version}`);
    console.log(`📍 Song Container Index: ${songIndex}`);
    console.log('─'.repeat(60));

    try {
      console.log(`\n📍 Step 1: Finding song container ${songIndex} in workspace...`);
      // Find songs on /me page
      await this.page.goto(`${this.config.suno.baseUrl}/me`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await this.page.waitForTimeout(3000);

      // Use more specific selector: look for song rows with unique data-clip-id
      console.log('🔍 Finding all song containers...');
      const allSongsRaw = await this.page.locator('[data-testid="song-row"][data-clip-id]').all();
      console.log(`📊 Total song elements in DOM: ${allSongsRaw.length}`);

      // Filter to only visible songs (prevents timeout on hidden/off-screen elements)
      const allSongs = [];
      for (const song of allSongsRaw) {
        const isVisible = await song.isVisible().catch(() => false);
        if (isVisible) {
          allSongs.push(song);
        }
      }
      console.log(`✅ Visible song containers: ${allSongs.length}`);

      // Debug: Log the clip IDs to verify we have different songs
      for (let i = 0; i < Math.min(allSongs.length, 3); i++) {
        const clipId = await allSongs[i].getAttribute('data-clip-id').catch(() => 'no-id');
        const imgSrc = await allSongs[i].locator('img').first().getAttribute('src').catch(() => 'no-img');
        console.log(`   Song ${i}: clip-id="${clipId}" | img="${imgSrc?.substring(0, 60)}..."`);
      }

      if (allSongs.length <= songIndex) {
        throw new Error(`Song at index ${songIndex} not found (only ${allSongs.length} songs found)`);
      }

      const songContainer = allSongs[songIndex];
      console.log(`✅ Song container found at index ${songIndex}`);

      // Verify container is visible before attempting scroll
      const isContainerVisible = await songContainer.isVisible().catch(() => false);
      console.log(`🔍 Container visibility check: ${isContainerVisible}`);

      if (!isContainerVisible) {
        console.log('⚠️  Container not visible, attempting to make it visible...');
        // Reset scroll position to top of page
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);

        // Re-check visibility
        const recheckVisible = await songContainer.isVisible().catch(() => false);
        if (!recheckVisible) {
          throw new Error(`Song container at index ${songIndex} is still not visible after scroll reset`);
        }
        console.log('✅ Container is now visible');
      }

      // CRITICAL FIX: Scroll into view and hover to make buttons visible
      console.log('\n📍 Making buttons visible...');
      console.log('🔄 Scrolling song container into view...');
      await songContainer.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(500);
      console.log('✅ Scrolled into view');

      console.log('🔄 Hovering over song container to reveal buttons...');
      await songContainer.hover();
      await this.page.waitForTimeout(500);
      console.log('✅ Hover applied - buttons should now be visible');

      // Skip screenshot to avoid page refresh during download process
      // console.log(`\n📸 Taking screenshot before download (v${version})...`);
      // await this.takeDebugScreenshot(`before-download-v${version}`);

      // Look for three-dot menu button (more options)
      // Prioritize the selectors we found in debug output
      console.log('\n📍 Step 2: Looking for menu button (three dots)...');
      const menuButtonSelectors = [
        'button[aria-label="More Options"]',  // Found in debug output
        'button[aria-label="More Actions"]',  // Found in debug output
        'button[aria-label*="more" i]',       // Case-insensitive "more"
        'button[aria-label*="options" i]',    // Case-insensitive "options"
        'button:has-text("⋮")',               // Vertical ellipsis (most likely based on screenshot)
        'button[aria-label*="menu" i]',
        'button:has-text("⋯")',               // Horizontal ellipsis
        'button:has-text("...")',
        'button:has-text("•••")',
        '[data-testid="song-menu"]',
        'button.more-options',
        'button[class*="menu"]',
        // Look for button that comes after Edit/Publish buttons (rightmost button)
        'button:right-of(button:has-text("Publish"))',
        'svg[class*="dots"] >> xpath=..',     // Find button containing dots SVG
        'svg[class*="ellipsis"] >> xpath=..'  // Find button containing ellipsis SVG
      ];

      let menuButton = null;
      for (const selector of menuButtonSelectors) {
        console.log(`🔎 Trying selector: ${selector}`);
        const buttons = await songContainer.locator(selector).all();
        console.log(`   Found ${buttons.length} buttons`);
        for (const btn of buttons) {
          const isVisible = await btn.isVisible().catch(() => false);
          if (isVisible) {
            menuButton = btn;
            console.log(`✅ Found visible menu button with selector: ${selector}`);
            break;
          }
        }
        if (menuButton) break;
      }

      // If still not found, try waiting explicitly for "More" button to become visible
      if (!menuButton) {
        console.log('⚠️  Buttons found in DOM but not visible yet, waiting for visibility...');
        await this.page.waitForTimeout(1000);

        // Try to wait for any "More" button to become visible
        const moreButtonLocator = songContainer.locator('button[aria-label*="More"]').first();
        try {
          await moreButtonLocator.waitFor({ state: 'visible', timeout: 5000 });
          if (await moreButtonLocator.isVisible()) {
            menuButton = moreButtonLocator;
            console.log('✅ Found menu button after explicit wait');
          }
        } catch (waitError) {
          console.log(`⚠️  Wait for visibility failed: ${waitError.message}`);
        }
      }

      if (!menuButton) {
        console.log('\n❌ Could not find three-dot menu button!');
        console.log('🔧 Debugging: Listing all buttons in song container...');
        const allButtons = await songContainer.locator('button').all();
        console.log(`📊 Total buttons found: ${allButtons.length}`);
        for (let i = 0; i < allButtons.length; i++) {
          const text = await allButtons[i].textContent().catch(() => '');
          const ariaLabel = await allButtons[i].getAttribute('aria-label').catch(() => '');
          const isVisible = await allButtons[i].isVisible().catch(() => false);
          console.log(`   Button ${i}: Text="${text}" | aria-label="${ariaLabel}" | Visible=${isVisible}`);
        }
        await this.takeDebugScreenshot('menu-button-not-found');
        throw new Error('Could not find song menu button');
      }

      // Click the menu button
      console.log('\n📍 Step 3: Clicking menu button...');
      await menuButton.click({ timeout: 8000 });
      console.log('✅ Menu button clicked');

      // Wait for Radix menu portal to be fully open (data-state="open")
      console.log('⏳ Waiting for menu portal to open...');
      const rootMenu = this.page.locator('[data-radix-menu-content][data-state="open"]').last();
      await rootMenu.waitFor({ state: 'visible', timeout: 8000 });
      console.log('✅ Menu portal opened');

      // Set up download path and directory
      console.log('\n📍 Step 4: Preparing download...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `${songTitle || 'suno-song'}-v${version}-${timestamp}.mp3`;
      const downloadPath = path.join(this.config.downloadPath, filename);
      console.log(`📁 Download path: ${downloadPath}`);

      await fs.ensureDir(this.config.downloadPath);
      console.log('✅ Directory ready');

      // ROBUST KEYBOARD NAVIGATION APPROACH (avoids hover/detachment issues)
      console.log('\n📍 Step 5: Using keyboard navigation to open Download submenu...');

      // Find the Download menu item (sub-trigger)
      const downloadTrigger = this.page
        .locator('[data-testid="download-sub-trigger"]')
        .or(rootMenu.getByRole('menuitem', { name: /^Download$/i }))
        .first();

      // Focus it (don't hover - keyboard is more stable)
      console.log('⌨️  Focusing Download menu item...');
      await downloadTrigger.focus();
      console.log('✅ Download item focused');

      // Open submenu with Enter key (activates the Download trigger)
      console.log('⌨️  Pressing Enter to open submenu...');
      await this.page.keyboard.press('Enter');
      console.log('✅ Enter pressed');

      // Wait for submenu portal to be open and stable
      console.log('⏳ Waiting for submenu portal...');
      const subMenu = this.page.locator('[data-radix-menu-content][data-state="open"]').last();
      await subMenu.waitFor({ state: 'visible', timeout: 8000 });
      console.log('✅ Submenu portal opened');

      // Small wait for animations to finish
      await this.page.waitForTimeout(150);

      // DUAL APPROACH: Try Enter (first item = MP3), then explicit click as fallback
      console.log('\n📍 Step 6: Attempting to activate MP3 Audio...');

      let download = null;

      // Attempt A: Press Enter immediately (first item in submenu should be MP3 Audio)
      console.log('🔄 Attempt 1: Pressing Enter to activate first item (MP3 Audio)...');
      try {
        [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 5000 }),
          this.page.keyboard.press('Enter')
        ]);
        console.log('✅ Download triggered via Enter key!');
      } catch (error) {
        console.log('⚠️  Enter key didn\'t trigger download, trying explicit click...');

        // Attempt B: Explicitly click "MP3 Audio" with tolerant selector
        console.log('🔄 Attempt 2: Finding and clicking MP3 Audio explicitly...');
        try {
          const mp3Item = subMenu.locator(
            '[role="menuitem"]:has-text("MP3 Audio"), ' +
            'button[aria-label*="mp3" i], ' +
            'button:has-text("MP3 Audio"), ' +
            '[data-radix-collection-item]:has-text("MP3 Audio")'
          ).first();

          await mp3Item.waitFor({ state: 'visible', timeout: 4000 });
          console.log('✅ Found MP3 Audio item');

          [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 15000 }),
            mp3Item.click()
          ]);
          console.log('✅ Download triggered via explicit click!');
        } catch (error2) {
          console.log('❌ Both attempts failed');
          throw new Error(`Failed to download: ${error2.message}`);
        }
      }

      if (!download) {
        throw new Error('MP3 menu item not found or no download started');
      }

      // Save the download
      console.log('💾 Saving file...');
      await download.saveAs(downloadPath);
      console.log('✅ File saved to disk');

      // Verify the file exists and has content
      console.log('🔍 Verifying downloaded file...');
      const stats = await fs.stat(downloadPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

      if (stats.size === 0) {
        console.log('❌ Downloaded file is empty!');
        throw new Error('Downloaded file is empty');
      }

      console.log(`✅ File verification passed`);
      console.log(`📊 File size: ${fileSizeMB} MB`);
      console.log(`📁 Saved to: ${downloadPath}`);

      console.log('\n' + '='.repeat(60));
      console.log('🎉 DOWNLOAD COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        path: downloadPath,
        size: stats.size,
        filename
      };

    } catch (error) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ DOWNLOAD FAILED');
      console.log('='.repeat(60));
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      // Skip error screenshot to avoid page refresh
      // console.log('📸 Taking error screenshot...');
      // await this.takeDebugScreenshot('download-error');
      console.log('='.repeat(60) + '\n');
      throw error;
    }
  }

  /**
   * Take screenshot for debugging
   */
  async takeDebugScreenshot(name) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `debug-${name}-${timestamp}.png`;
      const debugDir = path.join(this.config.downloadPath, 'debug');

      await fs.ensureDir(debugDir);

      const filepath = path.join(debugDir, filename);
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 Screenshot saved: ${filepath}`);
    } catch (error) {
      console.warn('Could not take screenshot:', error.message);
    }
  }

  async downloadFromUrl(downloadUrl, filename) {
    console.log('Downloading from direct URL:', downloadUrl);

    try {
      const downloadPath = path.join(this.config.downloadPath, filename);
      await fs.ensureDir(this.config.downloadPath);

      // Navigate to the URL to trigger download
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

      await this.page.goto(downloadUrl, { timeout: 60000 });

      const download = await downloadPromise;
      await download.saveAs(downloadPath);

      const stats = await fs.stat(downloadPath);

      console.log(`Download completed! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      return {
        success: true,
        path: downloadPath,
        size: stats.size,
        filename
      };

    } catch (error) {
      console.error('URL download failed:', error.message);
      throw error;
    }
  }
}
