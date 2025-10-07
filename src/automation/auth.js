import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_STATE_FILE = path.join(__dirname, '../../playwright/.auth/state.json');
const USER_DATA_DIR = path.join(__dirname, '../../playwright/.auth/user-data');

export class AuthManager {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    console.log('Initializing browser...');

    // Launch with arguments to avoid detection
    this.browser = await chromium.launch({
      headless: this.config.playwright.headless,
      slowMo: this.config.playwright.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    // Try to load existing auth state
    const contextOptions = {
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Additional options to avoid detection
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9'
      },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications']
    };

    if (await fs.pathExists(AUTH_STATE_FILE)) {
      console.log('Loading existing authentication state...');
      try {
        contextOptions.storageState = AUTH_STATE_FILE;
      } catch (error) {
        console.warn('Could not load auth state, will need to login:', error.message);
      }
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    // Override navigator.webdriver to avoid detection
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Chrome runtime
      window.chrome = {
        runtime: {}
      };
    });

    // Set longer timeouts
    this.page.setDefaultTimeout(this.config.playwright.timeout);
  }

  async checkIfLoggedIn() {
    try {
      console.log('Checking if already logged in...');
      await this.page.goto(`${this.config.suno.baseUrl}/create`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait a bit for page to load
      await this.page.waitForTimeout(3000);

      // Check if we're on the create page (logged in) or redirected to login
      const currentUrl = this.page.url();
      console.log('Current URL:', currentUrl);

      // Look for signs of being logged in
      const isLoggedIn = currentUrl.includes('/create') ||
                         await this.page.locator('text=Lyrics').isVisible().catch(() => false) ||
                         await this.page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

      return isLoggedIn;
    } catch (error) {
      console.error('Error checking login status:', error.message);
      return false;
    }
  }

  async loginWithGoogle() {
    console.log('Starting Google OAuth login...');

    try {
      // Navigate to Suno.com
      await this.page.goto(this.config.suno.baseUrl, { waitUntil: 'domcontentloaded' });

      // Wait for page to load
      await this.page.waitForTimeout(2000);

      // Look for sign in button - try multiple selectors
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
          break;
        }
      }

      if (signInButton && await signInButton.isVisible().catch(() => false)) {
        console.log('Clicking sign in button...');
        await signInButton.click();
        await this.page.waitForTimeout(2000);
      }

      // Look for Google login button
      const googleSelectors = [
        'text=Continue with Google',
        'text=Sign in with Google',
        'button:has-text("Google")',
        '[aria-label*="Google"]'
      ];

      let googleButton = null;
      for (const selector of googleSelectors) {
        googleButton = this.page.locator(selector).first();
        if (await googleButton.isVisible().catch(() => false)) {
          console.log('Found Google button with selector:', selector);
          break;
        }
      }

      if (googleButton && await googleButton.isVisible().catch(() => false)) {
        console.log('Clicking Google login button...');
        await googleButton.click();

        // Wait for Google OAuth popup or redirect
        console.log('Waiting for Google login page...');
        console.log('Please complete the Google login in the browser...');

        // Wait for navigation back to Suno (indicates successful login)
        await this.page.waitForURL(/suno\.com/, { timeout: 120000 });

        console.log('Returned to Suno.com after Google login');

        // Wait for the page to fully load
        await this.page.waitForTimeout(5000);

        // Save authentication state
        await this.saveAuthState();

        return true;
      } else {
        throw new Error('Could not find Google login button');
      }
    } catch (error) {
      console.error('Google login error:', error.message);
      throw error;
    }
  }

  async loginWithPassword(email, password) {
    console.log('Starting password-based login...');

    try {
      // Navigate to Suno.com
      await this.page.goto(this.config.suno.baseUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);

      // Click sign in
      const signInButton = this.page.locator('text=Sign In').first();
      if (await signInButton.isVisible().catch(() => false)) {
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
          break;
        }
      }

      if (emailButton && await emailButton.isVisible().catch(() => false)) {
        await emailButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Fill in email
      const emailInput = this.page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill(email);

      // Fill in password
      const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();
      await passwordInput.fill(password);

      // Click submit
      const submitButton = this.page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
      await submitButton.click();

      // Wait for navigation
      await this.page.waitForURL(/suno\.com/, { timeout: 30000 });
      await this.page.waitForTimeout(5000);

      // Save authentication state
      await this.saveAuthState();

      return true;
    } catch (error) {
      console.error('Password login error:', error.message);
      throw error;
    }
  }

  async login() {
    const isLoggedIn = await this.checkIfLoggedIn();

    if (isLoggedIn) {
      console.log('Already logged in!');
      return true;
    }

    console.log('Not logged in, proceeding with authentication...');

    if (this.config.authMethod === 'google') {
      return await this.loginWithGoogle();
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

  async saveAuthState() {
    try {
      await fs.ensureDir(path.dirname(AUTH_STATE_FILE));
      await this.context.storageState({ path: AUTH_STATE_FILE });
      console.log('Authentication state saved successfully');
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  }

  async close() {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  getPage() {
    return this.page;
  }

  getContext() {
    return this.context;
  }

  getBrowser() {
    return this.browser;
  }
}
