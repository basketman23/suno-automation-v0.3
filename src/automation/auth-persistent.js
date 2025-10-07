import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '../../playwright/.auth/chrome-profile');

/**
 * AuthManagerPersistent - Uses a persistent Chrome profile to avoid Google detection
 *
 * This approach launches Chrome with a persistent user profile, similar to using
 * your regular Chrome browser. This makes Google much more likely to accept the login
 * since it looks like a real browser session.
 */
export class AuthManagerPersistent {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.page = null;
    this.statusCallback = null;
    this.loginSteps = [];
  }

  /**
   * Set status callback for real-time progress updates
   */
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  async initialize() {
    console.log('Initializing browser with persistent context...');

    // Ensure user data directory exists
    await fs.ensureDir(USER_DATA_DIR);

    // Launch persistent context - this is the key to avoiding detection
    this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false, // MUST be false for Google OAuth to work
      slowMo: this.config.playwright?.slowMo || 100,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-service-autorun',
        '--password-store=basic'
      ],
      // Additional anti-detection measures
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Get or create a page
    const pages = this.context.pages();
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.context.newPage();
    }

    // Enhanced stealth mode - Override detection mechanisms
    await this.page.addInitScript(() => {
      // Remove webdriver property
      delete navigator.__proto__.webdriver;
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock Chrome properties
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };

      // Mock plugins with realistic data
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Override WebGL vendor/renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, [parameter]);
      };

      // Add realistic platform info
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel'
      });

      // Mock connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        })
      });
    });

    // Set longer timeouts
    this.page.setDefaultTimeout(this.config.playwright?.timeout || 60000);

    console.log('✅ Persistent browser context initialized');
    console.log('📁 Profile location:', USER_DATA_DIR);
  }

  /**
   * Log a step with detailed information
   */
  logStep(stepNumber, message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    const log = {
      step: stepNumber,
      message,
      status,
      timestamp
    };

    this.loginSteps.push(log);

    const statusEmoji = {
      'INFO': 'ℹ️',
      'SUCCESS': '✅',
      'WARNING': '⚠️',
      'ERROR': '❌',
      'WAITING': '⏳'
    };

    console.log(`[Step ${stepNumber}] ${statusEmoji[status] || ''} ${message}`);

    // Send to frontend via callback
    if (this.statusCallback) {
      this.statusCallback({
        type: 'login_step',
        step: stepNumber,
        message,
        status,
        timestamp
      });
    }

    return log;
  }

  /**
   * Fill email field with multiple selector attempts
   */
  async fillEmail(email) {
    const selectors = [
      'input[type="email"]',
      'input[name="identifier"]',
      'input[id="identifierId"]',
      '#Email',
      'input[autocomplete="username"]',
      'input[aria-label*="email" i]',
      'input[placeholder*="email" i]'
    ];

    for (const selector of selectors) {
      try {
        const input = this.page.locator(selector).first();
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click();
          await this.page.waitForTimeout(500);
          await input.fill(email);
          await this.page.waitForTimeout(500);
          return { success: true, selector };
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error('Could not find email input field');
  }

  /**
   * Fill password field with multiple selector attempts
   */
  async fillPassword(password) {
    const selectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[name="Passwd"]',
      '#password',
      '#Passwd',
      'input[autocomplete="current-password"]',
      'input[aria-label*="password" i]',
      'input[placeholder*="password" i]'
    ];

    for (const selector of selectors) {
      try {
        const input = this.page.locator(selector).first();
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click();
          await this.page.waitForTimeout(500);
          await input.fill(password);
          await this.page.waitForTimeout(500);
          return { success: true, selector };
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error('Could not find password input field');
  }

  /**
   * Click Next/Continue button with multiple selector attempts
   */
  async clickNextButton() {
    const selectors = [
      'button:has-text("Next")',
      'button:has-text("next")',
      '#identifierNext',
      '#passwordNext',
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("Sign in")',
      '.VfPpkd-LgbsSe', // Google's material button class
      '[jsname="LgbsSe"]'
    ];

    for (const selector of selectors) {
      try {
        const button = this.page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 }) && await button.isEnabled({ timeout: 1000 })) {
          await button.click();
          await this.page.waitForTimeout(1500);
          return { success: true, selector };
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error('Could not find Next/Continue button');
  }

  /**
   * Check if 2FA is required
   */
  async check2FARequired() {
    await this.page.waitForTimeout(2000);

    const twoFAIndicators = [
      'text=2-Step Verification',
      'text=Verify it\'s you',
      'text=Get a verification code',
      'text=Enter the code',
      'input[name="totpPin"]',
      '#totpPin',
      '[aria-label*="verification code" i]',
      'text=Use your phone to sign in',
      'text=Confirm your recovery email'
    ];

    for (const selector of twoFAIndicators) {
      try {
        if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  /**
   * Check for automation detection warning
   */
  async checkAutomationDetected() {
    const detectionPhrases = [
      'text=automated test software',
      'text=Chrome is being controlled',
      'text=Suspicious activity',
      'text=Unusual activity'
    ];

    for (const phrase of detectionPhrases) {
      try {
        if (await this.page.locator(phrase).isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  async checkIfLoggedIn() {
    try {
      console.log('Checking if already logged in...');
      await this.page.goto(`${this.config.suno.baseUrl}/create`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for page to load
      await this.page.waitForTimeout(3000);

      // Check if we're on the create page (logged in) or redirected to login
      const currentUrl = this.page.url();
      console.log('Current URL:', currentUrl);

      // Look for signs of being logged in
      const isLoggedIn = currentUrl.includes('/create') ||
                        await this.page.locator('text=Lyrics').isVisible().catch(() => false) ||
                        await this.page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

      if (isLoggedIn) {
        console.log('✅ Already logged in!');
      } else {
        console.log('❌ Not logged in');
      }

      return isLoggedIn;
    } catch (error) {
      console.error('Error checking login status:', error.message);
      return false;
    }
  }

  async loginWithGoogle(email = null, password = null) {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 Starting Automated Google OAuth login...');
    console.log('='.repeat(60));

    this.loginSteps = []; // Reset steps

    try {
      // Step 1: Navigate to Suno.com
      this.logStep(1, 'Navigating to Suno.com', 'INFO');
      await this.page.goto(this.config.suno.baseUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);
      this.logStep(1, 'Successfully loaded Suno.com', 'SUCCESS');

      // Step 2: Find and click Sign In button
      this.logStep(2, 'Looking for Sign In button', 'INFO');
      const signInSelectors = [
        'text=Sign In',
        'text=Sign in',
        'text=Log In',
        'text=Login',
        'button:has-text("Sign")',
        'a:has-text("Sign")'
      ];

      let signInButton = null;
      for (const selector of signInSelectors) {
        signInButton = this.page.locator(selector).first();
        if (await signInButton.isVisible().catch(() => false)) {
          this.logStep(2, `Found Sign In button (${selector})`, 'SUCCESS');
          break;
        }
      }

      if (signInButton && await signInButton.isVisible().catch(() => false)) {
        this.logStep(2, 'Clicking Sign In button', 'INFO');
        await signInButton.click();
        await this.page.waitForTimeout(2000);
        this.logStep(2, 'Sign In button clicked', 'SUCCESS');
      } else {
        this.logStep(2, 'Sign In button not found - may already be on login page', 'WARNING');
      }

      // Step 3: Find and click Google OAuth button
      this.logStep(3, 'Looking for Google login button', 'INFO');
      const googleSelectors = [
        'text=Continue with Google',
        'text=Sign in with Google',
        'button:has-text("Google")',
        '[aria-label*="Google"]',
        '.google-button',
        '#google-signin-button'
      ];

      let googleButton = null;
      for (const selector of googleSelectors) {
        googleButton = this.page.locator(selector).first();
        if (await googleButton.isVisible().catch(() => false)) {
          this.logStep(3, `Found Google button (${selector})`, 'SUCCESS');
          break;
        }
      }

      if (!googleButton || !await googleButton.isVisible().catch(() => false)) {
        throw new Error('Could not find Google login button on the page');
      }

      this.logStep(3, 'Clicking Google login button', 'INFO');
      await googleButton.click();
      await this.page.waitForTimeout(3000);
      this.logStep(3, 'Google OAuth popup opened', 'SUCCESS');

      // Check if credentials are provided for automation
      if (email && password) {
        this.logStep(4, 'Credentials provided - starting automated login', 'INFO');

        // Step 4: Fill email
        this.logStep(4, 'Filling in email address', 'INFO');
        try {
          const emailResult = await this.fillEmail(email);
          this.logStep(4, `Email filled successfully (${emailResult.selector})`, 'SUCCESS');
        } catch (error) {
          this.logStep(4, `Failed to fill email: ${error.message}`, 'ERROR');
          throw error;
        }

        // Step 5: Click Next after email
        this.logStep(5, 'Clicking Next button after email', 'INFO');
        try {
          const nextResult = await this.clickNextButton();
          this.logStep(5, `Next button clicked (${nextResult.selector})`, 'SUCCESS');
          await this.page.waitForTimeout(2000);
        } catch (error) {
          this.logStep(5, `Failed to click Next: ${error.message}`, 'ERROR');
          throw error;
        }

        // Check for automation detection
        this.logStep(6, 'Checking for automation detection', 'INFO');
        const isDetected = await this.checkAutomationDetected();
        if (isDetected) {
          this.logStep(6, 'Automation detected by Google - switching to manual mode', 'WARNING');
          return await this.waitForManualLogin();
        }
        this.logStep(6, 'No automation detection - proceeding', 'SUCCESS');

        // Step 7: Fill password
        this.logStep(7, 'Filling in password', 'INFO');
        try {
          const passwordResult = await this.fillPassword(password);
          this.logStep(7, `Password filled successfully (${passwordResult.selector})`, 'SUCCESS');
        } catch (error) {
          this.logStep(7, `Failed to fill password: ${error.message}`, 'ERROR');
          throw error;
        }

        // Step 8: Click Next/Sign In after password
        this.logStep(8, 'Clicking Sign In button', 'INFO');
        try {
          const signInResult = await this.clickNextButton();
          this.logStep(8, `Sign In button clicked (${signInResult.selector})`, 'SUCCESS');
          await this.page.waitForTimeout(3000);
        } catch (error) {
          this.logStep(8, `Failed to click Sign In: ${error.message}`, 'ERROR');
          throw error;
        }

        // Step 9: Check for 2FA
        this.logStep(9, 'Checking for 2FA requirement', 'INFO');
        const needs2FA = await this.check2FARequired();

        if (needs2FA) {
          this.logStep(9, '2FA required - user must complete manually', 'WARNING');
          return await this.waitForManualLogin();
        }
        this.logStep(9, 'No 2FA required - login proceeding', 'SUCCESS');

        // Step 10: Wait for redirect back to Suno
        this.logStep(10, 'Waiting for redirect to Suno.com', 'WAITING');
        try {
          await this.page.waitForURL(/suno\.com/, { timeout: 30000 });
          this.logStep(10, 'Successfully redirected to Suno.com', 'SUCCESS');
        } catch (error) {
          this.logStep(10, 'Redirect timeout - checking if login succeeded', 'WARNING');
          // Check if we're already on Suno
          const currentUrl = this.page.url();
          if (currentUrl.includes('suno.com')) {
            this.logStep(10, 'Already on Suno.com - login may have succeeded', 'SUCCESS');
          } else {
            throw new Error('Failed to redirect to Suno.com after login');
          }
        }

        // Final wait for page to load
        await this.page.waitForTimeout(3000);

        this.logStep(11, 'Automated Google login completed successfully!', 'SUCCESS');
        console.log('✅ Google OAuth automated login completed!');
        console.log('📝 Session saved for future use');

        return { success: true, automated: true, steps: this.loginSteps };

      } else {
        // No credentials - manual login required
        this.logStep(4, 'No credentials provided - manual login required', 'WARNING');
        return await this.waitForManualLogin();
      }

    } catch (error) {
      this.logStep('ERROR', `Google login failed: ${error.message}`, 'ERROR');
      console.error('❌ Google login error:', error.message);
      return { success: false, error: error.message, steps: this.loginSteps };
    }
  }

  /**
   * Wait for user to complete manual login (for 2FA or when automation fails)
   */
  async waitForManualLogin() {
    console.log('\n' + '='.repeat(60));
    console.log('👤 MANUAL ACTION REQUIRED');
    console.log('='.repeat(60));
    console.log('Please complete the Google login in the browser window:');
    console.log('1. Complete any verification steps (2FA, etc.)');
    console.log('2. Accept any permissions Suno.com requests');
    console.log('\n⏳ Waiting for you to complete login (timeout: 5 minutes)...');
    console.log('='.repeat(60) + '\n');

    try {
      // Wait for navigation back to Suno (indicates successful login)
      await this.page.waitForURL(/suno\.com/, { timeout: 300000 });

      console.log('✅ Returned to Suno.com after manual completion');
      await this.page.waitForTimeout(3000);

      this.logStep('MANUAL', 'Manual login completed successfully', 'SUCCESS');

      return { success: true, automated: false, needsManual2FA: true, steps: this.loginSteps };
    } catch (error) {
      this.logStep('ERROR', 'Manual login timeout', 'ERROR');
      throw new Error('Manual login timeout - user did not complete login');
    }
  }

  async loginWithPassword(email, password) {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 Starting email/password login...');
    console.log('='.repeat(60));

    try {
      // Navigate to Suno.com
      console.log('📍 Navigating to Suno.com...');
      await this.page.goto(this.config.suno.baseUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);

      // Click sign in
      const signInButton = this.page.locator('text=Sign In, text=Sign in, text=Log In').first();
      if (await signInButton.isVisible().catch(() => false)) {
        console.log('🖱️  Clicking sign in button...');
        await signInButton.click();
        await this.page.waitForTimeout(2000);
      }

      // Look for email/password login option
      const emailLoginSelectors = [
        'text=Continue with Email',
        'text=Sign in with Email',
        'text=Email',
        'button:has-text("Email")'
      ];

      let emailButton = null;
      for (const selector of emailLoginSelectors) {
        emailButton = this.page.locator(selector).first();
        if (await emailButton.isVisible().catch(() => false)) {
          console.log(`✅ Found email login with selector: ${selector}`);
          break;
        }
      }

      if (emailButton && await emailButton.isVisible().catch(() => false)) {
        console.log('🖱️  Clicking email login option...');
        await emailButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Fill in email
      console.log('📧 Filling in email...');
      const emailInput = this.page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill(email);
      await this.page.waitForTimeout(500);

      // Fill in password
      console.log('🔑 Filling in password...');
      const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();
      await passwordInput.fill(password);
      await this.page.waitForTimeout(500);

      // Click submit
      console.log('🖱️  Clicking submit button...');
      const submitButton = this.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
      await submitButton.click();

      // Wait for navigation
      console.log('⏳ Waiting for login to complete...');
      await this.page.waitForURL(/suno\.com/, { timeout: 30000 });
      await this.page.waitForTimeout(5000);

      console.log('✅ Email/password login completed successfully!');

      return true;
    } catch (error) {
      console.error('❌ Password login error:', error.message);
      throw error;
    }
  }

  async login() {
    const isLoggedIn = await this.checkIfLoggedIn();

    if (isLoggedIn) {
      console.log('✅ Already logged in - skipping authentication!');
      return true;
    }

    console.log('🔓 Not logged in, proceeding with authentication...');

    if (this.config.authMethod === 'google') {
      // Try to load credentials from credential manager
      let email = null;
      let password = null;

      try {
        // Import credential manager dynamically
        const { default: credentialManager } = await import('../config/credentials.js');
        const credentials = await credentialManager.loadCredentials();

        if (credentials) {
          email = credentials.email;
          password = credentials.password;
          console.log('📧 Loaded credentials from secure storage');
        } else {
          console.log('ℹ️  No saved credentials found - manual login required');
        }
      } catch (error) {
        console.log('⚠️  Could not load credentials:', error.message);
      }

      return await this.loginWithGoogle(email, password);
    } else if (this.config.authMethod === 'password') {
      const { email, password } = this.config.credentials;
      if (!email || !password) {
        throw new Error('Email and password are required for password authentication');
      }
      return await this.loginWithPassword(email, password);
    } else {
      throw new Error(`Unknown auth method: ${this.config.authMethod}`);
    }
  }

  async close() {
    // Don't close the context - keep it persistent for future runs
    console.log('💾 Saving browser state for future use...');
    if (this.context) {
      await this.context.close();
    }
  }

  getPage() {
    return this.page;
  }

  getContext() {
    return this.context;
  }

  getBrowser() {
    // Persistent context doesn't have a separate browser object
    return this.context;
  }
}
