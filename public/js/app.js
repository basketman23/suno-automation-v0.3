// WebSocket connection
let ws = null;
let reconnectInterval = null;

// State
const state = {
    isProcessing: false,
    currentSettings: null
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing Suno Automation App...');

    // Reset state on page load
    state.isProcessing = false;

    // Ensure create button is enabled on load
    const createBtn = document.getElementById('createBtn');
    if (createBtn) {
        createBtn.disabled = false;
    }

    // Connect WebSocket
    connectWebSocket();

    // Load settings
    loadSettings();

    // Load credentials
    loadCredentials();

    // Load published videos
    loadPublishedVideos();

    // Setup event listeners
    setupEventListeners();

    // Collapsible settings
    setupSettingsToggle();

    // Check server status
    checkServerStatus();
}

// Check if server is processing anything
async function checkServerStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        if (data.isProcessing) {
            state.isProcessing = true;
            const createBtn = document.getElementById('createBtn');
            if (createBtn) {
                createBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error checking server status:', error);
    }
}

// WebSocket Connection
function connectWebSocket() {
    // Close existing connection if any
    if (ws) {
        ws.close();
    }

    // Clear any existing reconnection interval
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        updateConnectionStatus(true);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Check if this is a login step update
            if (data.type === 'login_step') {
                addLoginStepToUI(data.step, data.message, data.status);
            } else {
                handleStatusUpdate(data);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        updateConnectionStatus(false);

        // Reconnect after 3 seconds (only if not already set)
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('🔄 Attempting to reconnect...');
                connectWebSocket();
            }, 3000);
        }
    };
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('connectionStatus');

    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// Status Updates
function handleStatusUpdate(data) {
    console.log('Status update:', data);

    const { status, message, error, waitMinutes, estimatedReadyTime } = data;

    // Update current status with additional info
    let displayMessage = message;
    if (status === 'waiting_for_generation' && waitMinutes) {
        displayMessage = `Waiting ${waitMinutes} minute(s) for song generation. Ready around ${estimatedReadyTime}`;
    }

    // Update current status
    updateCurrentStatus(status, displayMessage);

    // Add to log
    addLogEntry(status, displayMessage || error || status);

    // Update progress
    updateProgress(status);

    // Handle completion
    if (status === 'complete' || status === 'publish_complete') {
        state.isProcessing = false;
        if (status === 'publish_complete') {
            loadPublishedVideos();
        }
        showNotification(status === 'complete' ? 'Song created successfully!' : 'Published to YouTube successfully!', 'success');
        // Hide stop button, show create button
        const stopBtn = document.getElementById('stopBtn');
        const createBtn = document.getElementById('createBtn');
        stopBtn.classList.add('hidden');
        stopBtn.classList.remove('flex');
        createBtn.classList.remove('hidden');
        createBtn.classList.add('flex');
        createBtn.disabled = false;
    }

    if (status === 'error' || status === 'failed' || status === 'stopped' || status === 'publish_error') {
        state.isProcessing = false;
        if (status === 'stopped') {
            showNotification('Process stopped by user', 'info');
        } else {
            showNotification('Process failed: ' + (error || message), 'error');
        }
        // Hide stop button, show create button
        const stopBtn = document.getElementById('stopBtn');
        const createBtn = document.getElementById('createBtn');
        stopBtn.classList.add('hidden');
        stopBtn.classList.remove('flex');
        createBtn.classList.remove('hidden');
        createBtn.classList.add('flex');
        createBtn.disabled = false;
    }
}

function updateCurrentStatus(status, message) {
    const statusValue = document.getElementById('currentStatus');

    // Map status to display text
    const statusMap = {
        'loading_config': 'Loading configuration...',
        'initializing_browser': 'Initializing browser...',
        'authenticating': 'Authenticating...',
        'authenticated': 'Authenticated',
        'creating_song': 'Creating song...',
        'song_created': 'Song created',
        'waiting_for_generation': 'Waiting for Suno to generate song...',
        'waiting_for_completion': 'Waiting for song generation...',
        'song_completed': 'Song generation completed',
        'downloading': 'Downloading MP3...',
        'download_complete': 'Download complete',
        'complete': 'Complete!',
        'error': 'Error',
        'failed': 'Failed',
        'stopped': 'Stopped'
    };

    const displayStatus = statusMap[status] || message || status;
    statusValue.textContent = displayStatus;

    // Update status class
    statusValue.className = 'status-value';
    if (['creating_song', 'waiting_for_completion', 'downloading'].includes(status)) {
        statusValue.classList.add('processing');
    } else if (['complete', 'download_complete'].includes(status)) {
        statusValue.classList.add('success');
    } else if (['error', 'failed'].includes(status)) {
        statusValue.classList.add('error');
    }
}

function updateProgress(status) {
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const createBtn = document.getElementById('createBtn');
    const stopBtn = document.getElementById('stopBtn');

    const progressSteps = {
        'loading_config': { percent: 5, text: 'Loading configuration...' },
        'initializing_browser': { percent: 10, text: 'Initializing browser...' },
        'authenticating': { percent: 20, text: 'Authenticating...' },
        'authenticated': { percent: 30, text: 'Authenticated successfully' },
        'creating_song': { percent: 40, text: 'Creating song...' },
        'song_created': { percent: 50, text: 'Song creation initiated' },
        'waiting_for_generation': { percent: 60, text: 'Waiting for Suno to generate song...' },
        'waiting_for_completion': { percent: 70, text: 'Generating song (this may take a few minutes)...' },
        'song_completed': { percent: 80, text: 'Song generation completed' },
        'downloading': { percent: 90, text: 'Downloading MP3 file...' },
        'download_complete': { percent: 95, text: 'Download complete' },
        'complete': { percent: 100, text: 'Process completed successfully!' },
        // YouTube publishing steps
        'rendering_video': { percent: 40, text: 'Rendering video with waveform...' },
        'generating_seo': { percent: 50, text: 'Generating SEO-optimized title and description...' },
        'uploading_youtube': { percent: 70, text: 'Uploading to YouTube...' },
        'publish_complete': { percent: 100, text: 'Published to YouTube successfully!' },
        'publish_error': { percent: 0, text: 'Publishing failed' }
    };

    const step = progressSteps[status];

    if (step) {
        progressContainer.classList.remove('hidden');
        progressFill.style.width = `${step.percent}%`;
        progressText.textContent = step.text;

        state.isProcessing = step.percent < 100;

        if (state.isProcessing) {
            createBtn.classList.add('hidden');
            createBtn.classList.remove('flex');
            createBtn.disabled = true;
            stopBtn.classList.remove('hidden');
            stopBtn.classList.add('flex');
        } else {
            createBtn.classList.remove('hidden');
            createBtn.classList.add('flex');
            createBtn.disabled = false;
            stopBtn.classList.add('hidden');
            stopBtn.classList.remove('flex');

            // Hide progress after completion
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 5000);
        }
    }
}

function addLogEntry(status, message) {
    const logContent = document.getElementById('logContent');
    const entry = document.createElement('div');

    // Determine log type
    let logType = 'log-info';
    if (status === 'complete' || status === 'download_complete') {
        logType = 'log-success';
    } else if (status === 'error' || status === 'failed') {
        logType = 'log-error';
    } else if (status.includes('waiting')) {
        logType = 'log-warning';
    }

    entry.className = `log-entry ${logType}`;

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${message}</span>
    `;

    logContent.appendChild(entry);

    // Auto-scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;

    // Limit log entries to 100
    while (logContent.children.length > 100) {
        logContent.removeChild(logContent.firstChild);
    }
}

// Credential Management
async function loadCredentials() {
    try {
        const response = await fetch('/api/credentials/load');
        const data = await response.json();

        if (data.hasCredentials) {
            document.getElementById('googleEmail').value = data.email || '';
            showCredentialsStatus('Credentials loaded (last saved: ' + new Date(data.savedAt).toLocaleString() + ')', 'success');
        } else {
            showCredentialsStatus('No saved credentials', 'info');
        }
    } catch (error) {
        console.error('Error loading credentials:', error);
    }
}

async function saveCredentials() {
    const email = document.getElementById('googleEmail').value.trim();
    const password = document.getElementById('googlePassword').value;

    if (!email || !password) {
        showCredentialsStatus('Please enter both email and password', 'warning');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showCredentialsStatus('Please enter a valid email address', 'error');
        return;
    }

    try {
        const response = await fetch('/api/credentials/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            showCredentialsStatus('Credentials saved securely', 'success');
            // Clear password field for security
            document.getElementById('googlePassword').value = '';
            addLogEntry('success', 'Google credentials saved');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving credentials:', error);
        showCredentialsStatus('Failed to save credentials: ' + error.message, 'error');
    }
}

async function clearCredentials() {
    if (!confirm('Are you sure you want to clear saved credentials?')) {
        return;
    }

    try {
        const response = await fetch('/api/credentials/clear', {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('googleEmail').value = '';
            document.getElementById('googlePassword').value = '';
            showCredentialsStatus('Credentials cleared', 'info');
            addLogEntry('info', 'Google credentials cleared');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error clearing credentials:', error);
        showCredentialsStatus('Failed to clear credentials: ' + error.message, 'error');
    }
}

function showCredentialsStatus(message, type) {
    const statusDiv = document.getElementById('credentialsStatus');
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');

    // Set color classes based on type
    statusDiv.className = 'text-sm text-center p-3 rounded-lg';

    if (type === 'success') {
        statusDiv.classList.add('bg-green-500', 'bg-opacity-10', 'text-green-500', 'border', 'border-green-500');
    } else if (type === 'error') {
        statusDiv.classList.add('bg-red-500', 'bg-opacity-10', 'text-red-500', 'border', 'border-red-500');
    } else if (type === 'warning') {
        statusDiv.classList.add('bg-yellow-500', 'bg-opacity-10', 'text-yellow-500', 'border', 'border-yellow-500');
    } else if (type === 'info') {
        statusDiv.classList.add('bg-youtube-blue', 'bg-opacity-10', 'text-youtube-blue', 'border', 'border-youtube-blue');
    }

    // Auto-hide after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
            statusDiv.textContent = '';
        }, 5000);
    }
}

// Login Step Display
function addLoginStepToUI(step, message, status = 'INFO') {
    const container = document.getElementById('loginStepsContainer');
    const stepsDiv = document.getElementById('loginSteps');

    // Show container
    container.classList.remove('hidden');

    // Create step element
    const stepEl = document.createElement('div');
    stepEl.className = 'login-step';
    stepEl.setAttribute('data-step', step);

    // Determine status icon
    const statusIcons = {
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARNING': '⚠️',
        'INFO': 'ℹ️',
        'WAITING': '⏳'
    };

    const icon = statusIcons[status] || '•';

    stepEl.innerHTML = `
        <span class="step-number">Step ${step}</span>
        <span class="step-message">${message}</span>
        <span class="step-status">${icon}</span>
    `;

    // Check if step already exists and update it
    const existingStep = stepsDiv.querySelector(`[data-step="${step}"]`);
    if (existingStep) {
        existingStep.replaceWith(stepEl);
    } else {
        stepsDiv.appendChild(stepEl);
    }

    // Auto-scroll to bottom
    stepsDiv.scrollTop = stepsDiv.scrollHeight;

    // Auto-hide after login completes
    if (status === 'SUCCESS' && message.includes('completed')) {
        setTimeout(() => {
            container.classList.add('hidden');
            stepsDiv.innerHTML = '';
        }, 10000);
    }
}

// Settings Management
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        state.currentSettings = settings;

        // Populate form
        document.getElementById('authMethod').value = settings.authMethod || 'google';
        document.getElementById('downloadPath').value = settings.downloadPath || './downloads';
        document.getElementById('maxWaitMinutes').value = settings.suno?.maxWaitMinutes || 3;

        if (settings.credentials) {
            document.getElementById('email').value = settings.credentials.email || '';
            document.getElementById('password').value = settings.credentials.password || '';
        }

        // Show/hide password fields
        togglePasswordFields();

    } catch (error) {
        console.error('Error loading settings:', error);
        addLogEntry('error', 'Failed to load settings: ' + error.message);
    }
}

async function saveSettings() {
    const maxWaitMinutes = parseInt(document.getElementById('maxWaitMinutes').value) || 3;

    const settings = {
        authMethod: document.getElementById('authMethod').value,
        credentials: {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        },
        downloadPath: document.getElementById('downloadPath').value,
        suno: {
            maxWaitMinutes: maxWaitMinutes,
            maxWaitTime: maxWaitMinutes * 60 * 1000  // Convert to milliseconds
        }
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Settings saved successfully!', 'success');
            addLogEntry('success', 'Settings updated');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings: ' + error.message, 'error');
    }
}

async function testAuthentication() {
    if (state.isProcessing) {
        showNotification('Another process is running', 'warning');
        return;
    }

    const testBtn = document.getElementById('testAuth');
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
        const response = await fetch('/api/test-auth', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Authentication successful!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Authentication test failed:', error);
        showNotification('Authentication failed: ' + error.message, 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Authentication';
    }
}

function togglePasswordFields() {
    const authMethod = document.getElementById('authMethod').value;
    const passwordFields = document.getElementById('passwordFields');

    if (authMethod === 'password') {
        passwordFields.classList.remove('hidden');
    } else {
        passwordFields.classList.add('hidden');
    }
}

// Song Creation
async function createSong(event) {
    event.preventDefault();

    if (state.isProcessing) {
        showNotification('Another song is being processed', 'warning');
        return;
    }

    // Get form data
    const title = document.getElementById('songTitle').value.trim();
    const lyrics = document.getElementById('lyrics').value.trim();
    const musicStyleSelect = document.getElementById('musicStyle');
    const customStyle = document.getElementById('customStyle').value.trim();
    const numberOfRounds = parseInt(document.getElementById('numberOfRounds').value) || 2;

    let style = musicStyleSelect.value === 'custom' ? customStyle : musicStyleSelect.value;

    // Validation
    if (!style) {
        showNotification('Please select or enter a music style', 'warning');
        return;
    }

    if (numberOfRounds < 1 || numberOfRounds > 50) {
        showNotification('Number of rounds must be between 1 and 50', 'warning');
        return;
    }

    // Prepare request
    const songData = {
        title: title || 'Untitled Song',
        lyrics,
        style,
        numberOfRounds
    };

    try {
        state.isProcessing = true;

        const response = await fetch('/api/create-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songData)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        addLogEntry('info', `Song creation started: ${songData.title}`);
        showNotification('Song creation started! Monitor the progress below.', 'info');

    } catch (error) {
        console.error('Error creating song:', error);
        showNotification('Failed to start song creation: ' + error.message, 'error');
        state.isProcessing = false;
    }
}

async function stopProcess() {
    try {
        const response = await fetch('/api/stop', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Process stopped', 'info');
            state.isProcessing = false;

            // Reset UI
            const createBtn = document.getElementById('createBtn');
            const stopBtn = document.getElementById('stopBtn');
            const progressContainer = document.getElementById('progressContainer');
            const progressFill = document.getElementById('progressFill');

            createBtn.classList.remove('hidden');
            createBtn.classList.add('flex');
            createBtn.disabled = false;
            stopBtn.classList.add('hidden');
            stopBtn.classList.remove('flex');

            // Reset progress bar
            progressContainer.classList.add('hidden');
            progressFill.style.width = '0%';

            // Add log entry
            addLogEntry('stopped', 'Process stopped by user');
        }
    } catch (error) {
        console.error('Error stopping process:', error);
        showNotification('Error stopping process: ' + error.message, 'error');
    }
}

// Folder Picker for Download Path
function setupFolderPicker() {
    const browseFolderBtn = document.getElementById('browseFolderBtn');
    const downloadPathInput = document.getElementById('downloadPath');

    if (browseFolderBtn) {
        browseFolderBtn.addEventListener('click', async () => {
            // Create a hidden file input for folder selection
            const folderInput = document.createElement('input');
            folderInput.type = 'file';
            folderInput.webkitdirectory = true;
            folderInput.directory = true;
            folderInput.multiple = true;

            folderInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    // Get the directory path from the first file
                    const path = files[0].path || files[0].webkitRelativePath;
                    if (path) {
                        // Extract directory path (remove filename)
                        const dirPath = path.substring(0, path.lastIndexOf('/'));
                        if (dirPath) {
                            downloadPathInput.value = dirPath;
                            showNotification('Folder selected: ' + dirPath, 'success');
                        }
                    }
                }
            });

            // Trigger the file picker
            folderInput.click();
        });
    }
}

// Event Listeners
function setupEventListeners() {
    // Settings modal
    document.getElementById('settingsButton').addEventListener('click', openSettingsModal);
    document.getElementById('closeSettingsModal').addEventListener('click', closeSettingsModal);

    // Close modal on backdrop click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            closeSettingsModal();
        }
    });

    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const settingsModal = document.getElementById('settingsModal');
            if (!settingsModal.classList.contains('hidden')) {
                closeSettingsModal();
            }
        }
    });

    // Settings
    document.getElementById('authMethod').addEventListener('change', togglePasswordFields);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('testAuth').addEventListener('click', testAuthentication);

    // Credentials
    document.getElementById('saveCredentials').addEventListener('click', saveCredentials);
    document.getElementById('clearCredentials').addEventListener('click', clearCredentials);

    // Folder picker
    setupFolderPicker();

    // Published videos
    document.getElementById('refreshPublished').addEventListener('click', loadPublishedVideos);
}

// Settings Modal Functions
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
    // Restore body scroll
    document.body.style.overflow = '';
}

function setupSettingsToggle() {
    // This function is no longer needed since we removed the collapsible settings section
    // Keeping it here to avoid breaking any references
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
        return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Default: show date
    return date.toLocaleDateString();
}

function showNotification(message, type = 'info') {
    // Simple notification using browser alert for now
    // You can replace this with a custom notification component
    const typeEmoji = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌'
    };

    console.log(`${typeEmoji[type]} ${message}`);

    // You could implement a custom toast notification here
    // For now, just log to console and add to log
    addLogEntry(type, message);
}

// YouTube Publishing Functions
async function publishToYouTube(songData) {
    try {
        const publishBtn = event.target;
        const originalText = publishBtn.innerHTML;

        // Show loading state
        publishBtn.disabled = true;
        publishBtn.innerHTML = `
            <svg class="w-4 h-4 spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Publishing...
        `;

        const response = await fetch('/api/publish-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Video published to YouTube successfully!', 'success');
            loadPublishedVideos();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error publishing to YouTube:', error);
        showNotification('Failed to publish to YouTube: ' + error.message, 'error');
        publishBtn.disabled = false;
        publishBtn.innerHTML = originalText;
    }
}

async function loadPublishedVideos() {
    try {
        const response = await fetch('/api/published');
        const data = await response.json();
        const videos = data.songs || [];

        const publishedList = document.getElementById('publishedList');

        if (videos.length === 0) {
            publishedList.innerHTML = `
                <div class="text-center py-12 text-text-tertiary">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                    <p>No published videos yet. Download and publish your first song!</p>
                </div>
            `;
            return;
        }

        publishedList.innerHTML = videos.map(video => `
            <div class="bg-bg-tertiary border border-border-dark rounded-lg p-4 hover:bg-bg-hover transition-colors">
                <div class="flex items-start gap-4">
                    <div class="flex-shrink-0">
                        <div class="w-24 h-16 bg-youtube-red rounded flex items-center justify-center">
                            <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-medium text-text-primary truncate mb-1">${video.title}</h3>
                        <p class="text-xs text-text-tertiary mb-2">Published ${formatDate(video.publishedAt)}</p>
                        <a href="${video.youtubeUrl}" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center gap-2 px-3 py-1.5 bg-youtube-red hover:bg-youtube-dark-red text-white text-xs font-medium rounded transition-colors">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                            </svg>
                            View on YouTube
                        </a>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading published videos:', error);
    }
}

// ========================================
// Style Preset Management
// ========================================

let savedStyles = [];
let styleManagerModal = null;

async function loadStylePresets() {
    try {
        const response = await fetch('/api/style-presets');
        const data = await response.json();

        if (data.success) {
            savedStyles = data.presets;
            renderStylePresets();
            populateStyleDropdowns();
        }
    } catch (error) {
        console.error('Error loading style presets:', error);
    }
}

function renderStylePresets() {
    const container = document.getElementById('stylePresetsContainer');
    if (!container) return;

    if (savedStyles.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-text-tertiary text-sm">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                </svg>
                <p class="mb-2">No saved styles yet</p>
                <p class="text-xs">Create your first preset to get started!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = savedStyles.map(preset => `
        <div class="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors">
            <button onclick="toggleFavorite('${preset.id}')"
                    class="text-xl hover:scale-110 transition-transform"
                    title="${preset.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                ${preset.favorite ? '⭐' : '☆'}
            </button>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-sm text-text-primary">${preset.name}</div>
                <div class="text-xs text-text-tertiary truncate" title="${preset.style}">${preset.style}</div>
                <div class="text-xs text-text-tertiary mt-1">
                    ${preset.category || 'Custom'} • Used ${preset.usageCount || 0} times
                </div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button onclick="useStylePreset('${preset.id}')"
                        class="px-3 py-1.5 bg-youtube-blue hover:bg-youtube-light-blue text-white text-xs font-medium rounded transition-colors">
                    Use
                </button>
                <button onclick="editStylePreset('${preset.id}')"
                        class="px-3 py-1.5 bg-transparent border border-border-dark hover:bg-bg-hover text-text-primary text-xs rounded transition-colors">
                    Edit
                </button>
                <button onclick="deleteStylePreset('${preset.id}')"
                        class="px-3 py-1.5 bg-transparent hover:bg-red-500 hover:bg-opacity-20 text-red-500 text-xs rounded transition-colors">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

function populateStyleDropdowns() {
    // Populate quick style preset dropdown
    const quickDropdown = document.getElementById('quickStylePreset');
    if (quickDropdown) {
        const options = savedStyles.map(preset =>
            `<option value="${preset.id}">${preset.favorite ? '⭐ ' : ''}${preset.name}</option>`
        ).join('');
        quickDropdown.innerHTML = `
            <option value="">Select a saved style...</option>
            ${options}
        `;
    }

    // Populate batch style preset dropdown
    const batchDropdown = document.getElementById('batchStylePreset');
    if (batchDropdown) {
        const options = savedStyles.map(preset =>
            `<option value="${preset.id}">${preset.favorite ? '⭐ ' : ''}${preset.name}</option>`
        ).join('');
        batchDropdown.innerHTML = `
            <option value="">Select style for batch...</option>
            ${options}
        `;
    }
}

function useStylePresetFromDropdown(presetId) {
    if (presetId) {
        useStylePreset(presetId);
    }
}

async function useStylePreset(id) {
    const preset = savedStyles.find(p => p.id === id);
    if (!preset) return;

    // Set the style in the form
    document.getElementById('musicStyle').value = 'custom';
    const customStyleGroup = document.getElementById('customStyleGroup');
    if (customStyleGroup) {
        customStyleGroup.classList.remove('hidden');
    }
    document.getElementById('customStyle').value = preset.style;

    // Track usage
    try {
        await fetch(`/api/style-presets/${id}/use`, { method: 'POST' });
        // Reload presets to update usage count
        await loadStylePresets();
    } catch (error) {
        console.error('Error tracking usage:', error);
    }

    // Save to localStorage
    localStorage.setItem('lastUsedStyle', id);

    showNotification(`Style "${preset.name}" applied!`, 'success');
    addLogEntry('info', `Applied style preset: ${preset.name}`);
}

async function saveCurrentStyleAsPreset() {
    const styleName = prompt('Enter a name for this style preset:');
    if (!styleName || !styleName.trim()) return;

    const musicStyleSelect = document.getElementById('musicStyle');
    const customStyle = document.getElementById('customStyle').value.trim();

    let style = musicStyleSelect.value === 'custom' ? customStyle : musicStyleSelect.value;

    if (!style) {
        showNotification('Please select or enter a music style first', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/style-presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: styleName.trim(),
                style: style,
                category: 'Custom'
            })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Style preset saved!', 'success');
            addLogEntry('success', `Saved new style preset: ${styleName}`);
            await loadStylePresets();
        } else {
            throw new Error(result.error || 'Failed to save');
        }
    } catch (error) {
        console.error('Error saving style preset:', error);
        showNotification('Failed to save style preset: ' + error.message, 'error');
    }
}

async function toggleFavorite(id) {
    try {
        const response = await fetch(`/api/style-presets/${id}/favorite`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadStylePresets();
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

async function editStylePreset(id) {
    const preset = savedStyles.find(p => p.id === id);
    if (!preset) return;

    const newName = prompt('Edit preset name:', preset.name);
    if (!newName || newName.trim() === preset.name) return;

    const newStyle = prompt('Edit style description:', preset.style);
    if (!newStyle || newStyle.trim() === preset.style) return;

    try {
        const updates = {};
        if (newName.trim() !== preset.name) updates.name = newName.trim();
        if (newStyle.trim() !== preset.style) updates.style = newStyle.trim();

        const response = await fetch(`/api/style-presets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Preset updated!', 'success');
            addLogEntry('success', `Updated style preset: ${newName}`);
            await loadStylePresets();
        }
    } catch (error) {
        console.error('Error updating preset:', error);
        showNotification('Failed to update preset', 'error');
    }
}

async function deleteStylePreset(id) {
    const preset = savedStyles.find(p => p.id === id);
    if (!preset) return;

    if (!confirm(`Delete style preset "${preset.name}"?\n\nThis cannot be undone.`)) return;

    try {
        const response = await fetch(`/api/style-presets/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Preset deleted', 'info');
            addLogEntry('info', `Deleted style preset: ${preset.name}`);
            await loadStylePresets();
        }
    } catch (error) {
        console.error('Error deleting preset:', error);
        showNotification('Failed to delete preset', 'error');
    }
}

function toggleStyleManager() {
    const modal = document.getElementById('styleManagerModal');
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        loadStylePresets(); // Refresh when opening
    } else {
        modal.classList.add('hidden');
    }
}

async function exportStylePresets() {
    try {
        const response = await fetch('/api/style-presets/export');
        const data = await response.json();

        // Create download link
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `style-presets-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Style presets exported!', 'success');
    } catch (error) {
        console.error('Error exporting presets:', error);
        showNotification('Failed to export presets', 'error');
    }
}

async function importStylePresets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const merge = confirm('Merge with existing presets?\n\nClick OK to merge, Cancel to replace all.');

            const response = await fetch('/api/style-presets/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data, merge })
            });

            const result = await response.json();

            if (result.success) {
                showNotification(`Imported ${result.count} style presets!`, 'success');
                await loadStylePresets();
            }
        } catch (error) {
            console.error('Error importing presets:', error);
            showNotification('Failed to import presets: ' + error.message, 'error');
        }
    };

    input.click();
}

// Batch generation
async function startBatchGeneration() {
    const stylePresetId = document.getElementById('batchStylePreset').value;
    const numberOfSongs = parseInt(document.getElementById('batchNumberOfSongs').value);
    const lyrics = document.getElementById('batchLyrics').value.trim();
    const randomStylePresets = document.getElementById('randomStylePresets').checked;

    if (!stylePresetId) {
        showNotification('Please select a style preset for batch generation', 'warning');
        return;
    }

    if (!numberOfSongs || numberOfSongs < 1 || numberOfSongs > 50) {
        showNotification('Number of songs must be between 1 and 50', 'warning');
        return;
    }

    const preset = savedStyles.find(p => p.id === stylePresetId);

    // Count presets in the same category for random mode info
    const categoryCount = savedStyles.filter(p => p.category === preset?.category).length;

    const randomModeText = randomStylePresets && categoryCount > 1
        ? `\nRandom Mode: YES - Will randomly select from ${categoryCount} "${preset?.category}" presets for each song`
        : '';

    const confirmed = confirm(
        `Start batch generation?\n\n` +
        `Style: ${preset?.name || 'Unknown'}\n` +
        `Category: ${preset?.category || 'Unknown'}` +
        `${randomModeText}\n` +
        `Songs: ${numberOfSongs}\n` +
        `Each song will have 2 MP3 versions (1 round)\n\n` +
        `Total files: ${numberOfSongs * 2} MP3s\n` +
        `Estimated time: ${Math.ceil(numberOfSongs * 5)} minutes\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch('/api/batch-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stylePresetId,
                numberOfSongs,
                lyrics,
                randomStylePresets
            })
        });

        const result = await response.json();

        if (result.success) {
            const modeInfo = randomStylePresets ? ' (Random mode enabled)' : '';
            showNotification(`Batch generation started: ${numberOfSongs} songs${modeInfo}`, 'success');
            addLogEntry('info', `Batch generation started: ${numberOfSongs} songs with style "${preset?.name}"${modeInfo}`);
        } else {
            throw new Error(result.error || 'Failed to start batch');
        }
    } catch (error) {
        console.error('Error starting batch generation:', error);
        showNotification('Failed to start batch generation: ' + error.message, 'error');
    }
}

// Initialize style management on page load
const originalInitializeApp = initializeApp;
initializeApp = function() {
    originalInitializeApp();

    // Load style presets
    loadStylePresets();

    // Restore last used style
    const lastUsedStyle = localStorage.getItem('lastUsedStyle');
    if (lastUsedStyle) {
        setTimeout(() => useStylePreset(lastUsedStyle), 1000);
    }
};
