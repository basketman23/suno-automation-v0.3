export class SongCreator {
  constructor(page, config) {
    this.page = page;
    this.config = config;
  }

  /**
   * Generate random delay between min and max milliseconds (human-like)
   */
  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Human-like mouse movement before clicking
   */
  async humanMouseMove(element) {
    try {
      const box = await element.boundingBox();
      if (box) {
        // Move to random position near the element first
        const nearbyX = box.x + this.randomDelay(-50, 50);
        const nearbyY = box.y + this.randomDelay(-50, 50);
        await this.page.mouse.move(nearbyX, nearbyY);
        await this.page.waitForTimeout(this.randomDelay(100, 300));

        // Then move to the element center with slight randomness
        const targetX = box.x + box.width / 2 + this.randomDelay(-5, 5);
        const targetY = box.y + box.height / 2 + this.randomDelay(-5, 5);
        await this.page.mouse.move(targetX, targetY);
        await this.page.waitForTimeout(this.randomDelay(50, 150));
      }
    } catch (error) {
      // Silently fail, element might not have bounding box
    }
  }

  /**
   * Type text with human-like behavior but ensure form updates
   */
  async humanType(element, text) {
    await element.click();
    await this.page.waitForTimeout(this.randomDelay(200, 500));

    // Clear existing content first
    await element.fill('');
    await this.page.waitForTimeout(100);

    // Fill with slight delay to simulate typing
    await element.fill(text, { delay: this.randomDelay(30, 80) });

    // Trigger input/change events to ensure form validation
    await element.dispatchEvent('input');
    await element.dispatchEvent('change');
    await this.page.waitForTimeout(this.randomDelay(300, 600));
  }

  /**
   * Human-like click with mouse movement
   */
  async humanClick(element) {
    await this.humanMouseMove(element);
    await element.click();
    await this.page.waitForTimeout(this.randomDelay(200, 500));
  }

  /**
   * Simulate human scrolling behavior
   */
  async humanScroll() {
    // Random small scroll to simulate reading/browsing
    const scrollAmount = this.randomDelay(100, 400);
    await this.page.mouse.wheel(0, scrollAmount);
    await this.page.waitForTimeout(this.randomDelay(300, 800));
  }

  async navigateToCreate() {
    console.log('Navigating to Create page...');
    await this.page.goto(`${this.config.suno.baseUrl}/create`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to load with random delay (simulate human page reading)
    await this.page.waitForTimeout(this.randomDelay(2000, 4000));
  }

  async selectCustomMode() {
    console.log('Selecting Custom mode...');

    try {
      // Look for "Custom" button/tab
      const customSelectors = [
        'text=Custom',
        'button:has-text("Custom")',
        '[role="tab"]:has-text("Custom")',
        '.custom-mode'
      ];

      let customButton = null;
      for (const selector of customSelectors) {
        customButton = this.page.locator(selector).first();
        if (await customButton.isVisible().catch(() => false)) {
          console.log('Found Custom button with selector:', selector);
          break;
        }
      }

      if (customButton && await customButton.isVisible().catch(() => false)) {
        await this.humanClick(customButton);
        console.log('Clicked Custom mode button');
      } else {
        console.log('Custom button not found, may already be in custom mode');
      }
    } catch (error) {
      console.warn('Error selecting custom mode:', error.message);
    }
  }

  async fillLyrics(lyrics) {
    console.log('Filling in lyrics...');

    try {
      // Look for lyrics textarea
      const lyricsSelectors = [
        'textarea[placeholder*="lyrics" i]',
        'textarea[placeholder*="Write" i]',
        'textarea[name="lyrics"]',
        '[data-testid="lyrics-input"]',
        'textarea'
      ];

      let lyricsInput = null;
      for (const selector of lyricsSelectors) {
        lyricsInput = this.page.locator(selector).first();
        if (await lyricsInput.isVisible().catch(() => false)) {
          console.log('Found lyrics input with selector:', selector);
          break;
        }
      }

      if (lyricsInput && await lyricsInput.isVisible().catch(() => false)) {
        await this.humanType(lyricsInput, lyrics);
        console.log('Lyrics filled successfully');
      } else {
        throw new Error('Could not find lyrics input field');
      }
    } catch (error) {
      console.error('Error filling lyrics:', error.message);
      throw error;
    }
  }

  async fillStyles(style) {
    console.log('Filling in music style...');

    try {
      // Wait a moment for the page to be ready
      await this.page.waitForTimeout(1000);

      // Look for the Styles textarea - it's a textarea with specific characteristics
      const styleSelectors = [
        // The exact textarea with Hip-hop placeholder
        'textarea[placeholder*="Hip-hop" i]',
        'textarea[placeholder*="R&B" i]',
        'textarea[placeholder*="upbeat" i]',
        // Textarea with maxlength 1000 (styles field characteristic)
        'textarea[maxlength="1000"]',
        // Generic textarea that's NOT for lyrics
        'textarea:not([placeholder*="lyric" i]):not([placeholder*="Write some" i])',
      ];

      let styleInput = null;
      for (const selector of styleSelectors) {
        try {
          const textareas = await this.page.locator(selector).all();

          for (const textarea of textareas) {
            if (await textarea.isVisible().catch(() => false)) {
              const placeholder = await textarea.getAttribute('placeholder').catch(() => '');
              const maxlength = await textarea.getAttribute('maxlength').catch(() => '');

              console.log('Checking textarea - Placeholder:', placeholder, '| Maxlength:', maxlength);

              // Skip lyrics field (usually has different placeholder and no maxlength limit or different one)
              if (placeholder && (placeholder.toLowerCase().includes('write some lyrics') ||
                                  placeholder.toLowerCase().includes('leave empty for instrumental'))) {
                console.log('Skipping lyrics textarea');
                continue;
              }

              // Skip if it's inside Advanced Options
              const parentText = await textarea.locator('xpath=ancestor::*[contains(., "Advanced Options")]').count().catch(() => 0);
              if (parentText > 0) {
                console.log('Skipping textarea inside Advanced Options');
                continue;
              }

              // This is the styles textarea!
              styleInput = textarea;
              console.log('✅ Found Styles textarea with selector:', selector);
              console.log('   Placeholder:', placeholder);
              console.log('   Maxlength:', maxlength);
              break;
            }
          }
          if (styleInput) break;
        } catch (e) {
          console.log('Selector failed:', selector, e.message);
          continue;
        }
      }

      if (!styleInput) {
        // Fallback: Find all textareas and identify by position/attributes
        console.log('Trying fallback approach - finding all textareas...');

        const allTextareas = await this.page.locator('textarea').all();
        console.log(`Found ${allTextareas.length} textareas on page`);

        for (let i = 0; i < allTextareas.length; i++) {
          const textarea = allTextareas[i];

          if (await textarea.isVisible().catch(() => false)) {
            const placeholder = await textarea.getAttribute('placeholder').catch(() => '');
            const maxlength = await textarea.getAttribute('maxlength').catch(() => '');

            console.log(`Textarea ${i}: Placeholder="${placeholder}" | Maxlength="${maxlength}"`);

            // The Styles textarea has maxlength="1000"
            // The Lyrics textarea typically has a different or no maxlength
            if (maxlength === '1000' && !placeholder.toLowerCase().includes('lyric')) {
              styleInput = textarea;
              console.log('✅ Found Styles textarea by maxlength attribute!');
              break;
            }
          }
        }
      }

      if (styleInput && await styleInput.isVisible().catch(() => false)) {
        await this.humanType(styleInput, style);
        console.log('Style filled successfully:', style);
      } else {
        throw new Error('Could not find style input field - Check screenshot in downloads/debug/');
      }
    } catch (error) {
      console.error('Error filling style:', error.message);
      await this.takeDebugScreenshot('style-fill-error');
      throw error;
    }
  }

  async addSongTitle(title) {
    console.log('Adding song title...');

    try {
      // Look for "Add a song title" section
      const titleSelectors = [
        'input[placeholder*="title" i]',
        'input[name="title"]',
        '[data-testid="song-title"]',
        'button:has-text("Add a song title")'
      ];

      // First check if there's a button to enable title input
      const titleButton = this.page.locator('button:has-text("Add a song title")').first();
      if (await titleButton.isVisible().catch(() => false)) {
        await this.humanClick(titleButton);
      }

      let titleInput = null;
      for (const selector of titleSelectors) {
        titleInput = this.page.locator(selector).first();
        if (await titleInput.isVisible().catch(() => false)) {
          console.log('Found title input with selector:', selector);
          break;
        }
      }

      if (titleInput && await titleInput.isVisible().catch(() => false)) {
        await this.humanType(titleInput, title);
        console.log('Title filled successfully:', title);
      } else {
        console.warn('Could not find title input field, continuing without title');
      }
    } catch (error) {
      console.warn('Error adding title:', error.message);
      // Don't throw, title is optional
    }
  }

  async clickCreate() {
    console.log('Clicking Create button...');

    try {
      // Wait for form validation to complete and Create button to enable
      console.log('⏳ Waiting for Create button to become enabled...');
      await this.page.waitForTimeout(this.randomDelay(2000, 3000));

      // Take screenshot before looking for button
      await this.takeDebugScreenshot('before-create-click');

      // Look for Create/Generate button
      const createSelectors = [
        'button:has-text("Create")',
        'button:has-text("Generate")',
        'button[type="submit"]',
        '[data-testid="create-button"]',
        '.create-button',
        '#create-button'
      ];

      let createButton = null;
      for (const selector of createSelectors) {
        createButton = this.page.locator(selector).first();
        if (await createButton.isVisible().catch(() => false)) {
          // Make sure it's not disabled
          const isDisabled = await createButton.isDisabled().catch(() => false);
          if (!isDisabled) {
            console.log('Found Create button with selector:', selector);
            break;
          } else {
            console.log(`Found Create button (${selector}) but it's DISABLED`);
          }
        }
        createButton = null;
      }

      if (createButton) {
        // Add extra delay before clicking Create (simulate reviewing the form)
        await this.page.waitForTimeout(this.randomDelay(1000, 2000));
        await this.humanClick(createButton);
        console.log('Clicked Create button');
        await this.page.waitForTimeout(this.randomDelay(3000, 5000));

        // Take screenshot after clicking
        await this.takeDebugScreenshot('after-create-click');

        // Check for CAPTCHA immediately after clicking Create
        await this.checkForPostCreateIssues();

        return true;
      } else {
        // Take screenshot of the issue
        await this.takeDebugScreenshot('create-button-not-found');

        // Log all visible buttons for debugging
        console.log('Debugging: Looking for all buttons on page...');
        const allButtons = await this.page.locator('button').all();
        console.log(`Found ${allButtons.length} total buttons on page`);

        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
          const text = await allButtons[i].textContent().catch(() => '');
          const isVisible = await allButtons[i].isVisible().catch(() => false);
          const isDisabled = await allButtons[i].isDisabled().catch(() => false);
          console.log(`Button ${i}: "${text}" | Visible: ${isVisible} | Disabled: ${isDisabled}`);
        }

        throw new Error('Could not find enabled Create button - Check screenshot in downloads/debug/');
      }
    } catch (error) {
      console.error('Error clicking create:', error.message);
      await this.takeDebugScreenshot('create-error');
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
      const debugDir = '/Volumes/BASKETMAN G-Drive/000 YouTubeSong/05 DEV/downloads/debug';

      // Ensure debug directory exists
      const fs = await import('fs-extra');
      await fs.default.ensureDir(debugDir);

      const filepath = `${debugDir}/${filename}`;
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 Screenshot saved: ${filepath}`);
    } catch (error) {
      console.warn('Could not take screenshot:', error.message);
    }
  }

  /**
   * Check for CAPTCHA or other issues after clicking Create
   */
  async checkForPostCreateIssues() {
    const url = this.page.url();

    // Check if redirected to error page
    if (url.includes('404') || url.includes('error')) {
      console.log('⚠️  Redirected to error page after create:', url);
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  RATE LIMIT OR CAPTCHA TRIGGERED');
      console.log('='.repeat(60));
      console.log('Suno has blocked the request. This happens when:');
      console.log('1. You create songs too quickly');
      console.log('2. Your account is new and untrusted');
      console.log('3. Rate limits exceeded');
      console.log('\nPlease wait 1 hour and try again.');
      console.log('For long-term fix, read CAPTCHA_GUIDE.md');
      console.log('='.repeat(60) + '\n');
      throw new Error(`Rate limited: ${url}`);
    }

    // Check for CAPTCHA
    const captchaIndicators = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="captcha"]',
      '.g-recaptcha',
      '#captcha'
    ];

    for (const indicator of captchaIndicators) {
      try {
        const element = this.page.locator(indicator).first();
        if (await element.isVisible({ timeout: 2000 })) {
          console.log('⚠️  CAPTCHA detected after creating song');

          // Import DownloadManager methods for CAPTCHA handling
          await this.waitForCaptchaSolution();

          return; // CAPTCHA solved, continue
        }
      } catch (e) {
        if (e.message.includes('CAPTCHA solved')) {
          return; // CAPTCHA was solved, continue
        }
        continue;
      }
    }
  }

  /**
   * Wait for user to solve CAPTCHA (same logic as DownloadManager)
   */
  async waitForCaptchaSolution(maxWait = 300000) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  CAPTCHA DETECTED');
    console.log('='.repeat(60));
    console.log('Please solve the CAPTCHA in the browser window');
    console.log('The automation will continue automatically after you solve it');
    console.log('\n⏳ Waiting for you to solve CAPTCHA (timeout: 5 minutes)...');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await this.page.waitForTimeout(5000);

      // Check if CAPTCHA is still present
      const stillHasCaptcha = await this.checkForCaptchaPresent();
      if (!stillHasCaptcha) {
        console.log('✅ CAPTCHA solved! Continuing automation...');
        return true;
      }

      // Check if we're back on Suno create page
      const url = this.page.url();
      if (url.includes('suno.com/create')) {
        console.log('✅ Back on Suno create page - assuming CAPTCHA solved');
        return true;
      }
    }

    throw new Error('CAPTCHA solution timeout - user did not solve CAPTCHA within 5 minutes');
  }

  /**
   * Check if CAPTCHA is currently present
   */
  async checkForCaptchaPresent() {
    const captchaIndicators = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="captcha"]',
      '.g-recaptcha',
      '#captcha'
    ];

    for (const indicator of captchaIndicators) {
      try {
        const element = this.page.locator(indicator).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async createSong({ title, lyrics, style }) {
    try {
      console.log('Starting song creation process...');
      console.log('Title:', title);
      console.log('Style:', style);
      console.log('Lyrics:', lyrics ? `${lyrics.length} characters` : 'Empty (instrumental mode)');

      // Navigate to create page
      await this.navigateToCreate();

      // Simulate human browsing - small scroll
      await this.humanScroll();

      // Select custom mode
      await this.selectCustomMode();

      // Add random delay between form fields (simulate thinking)
      await this.page.waitForTimeout(this.randomDelay(500, 1500));

      // Fill in the form - lyrics is optional
      if (lyrics && lyrics.trim()) {
        await this.fillLyrics(lyrics);
        // Pause between fields
        await this.page.waitForTimeout(this.randomDelay(800, 1500));
      } else {
        console.log('Skipping lyrics (instrumental mode)');
      }

      await this.fillStyles(style);

      if (title) {
        await this.page.waitForTimeout(this.randomDelay(500, 1200));
        await this.addSongTitle(title);
      }

      // Small scroll before clicking create
      await this.humanScroll();

      // Click create
      await this.clickCreate();

      console.log('Song creation initiated successfully!');

      return {
        success: true,
        timestamp: Date.now(),
        title: title || 'Untitled',
        style
      };
    } catch (error) {
      console.error('Song creation failed:', error.message);
      throw error;
    }
  }

  async getSongIdFromWorkspace(title, timestamp) {
    console.log('Attempting to get song ID from workspace...');

    try {
      // Navigate to workspace/library
      await this.page.goto(`${this.config.suno.baseUrl}/create`, {
        waitUntil: 'domcontentloaded'
      });

      await this.page.waitForTimeout(3000);

      // Try to find the most recent song
      // Songs typically appear on the right side of the create page in "My Workspace"
      const songElements = await this.page.locator('[data-testid*="song"], .song-item, article').all();

      if (songElements.length > 0) {
        // Get the first (most recent) song element
        const firstSong = songElements[0];

        // Try to extract song ID from various attributes
        const possibleIdAttributes = ['data-id', 'data-song-id', 'id'];

        for (const attr of possibleIdAttributes) {
          const id = await firstSong.getAttribute(attr).catch(() => null);
          if (id) {
            console.log('Found song ID:', id);
            return id;
          }
        }

        // If no ID attribute, try to get it from a child link
        const link = firstSong.locator('a').first();
        const href = await link.getAttribute('href').catch(() => null);
        if (href) {
          const match = href.match(/\/song\/([a-zA-Z0-9-]+)/);
          if (match) {
            console.log('Extracted song ID from URL:', match[1]);
            return match[1];
          }
        }
      }

      console.warn('Could not extract song ID');
      return null;
    } catch (error) {
      console.error('Error getting song ID:', error.message);
      return null;
    }
  }
}
