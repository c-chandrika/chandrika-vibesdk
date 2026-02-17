# VibeSDK Parent App Integration - Quick Start

## 🚀 5-Minute Integration

This guide gets you up and running with VibeSDK iframe integration in under 5 minutes.

## Step 1: Add the Iframe

```html
<iframe
  id="vibesdk"
  src="https://vibesdk-nxtwave.web-1c2.workers.dev"
  width="100%"
  height="700px"
  allow="clipboard-write; clipboard-read"
></iframe>
```

## Step 2: Add Authentication Script

```html
<script>
// Configuration
const VIBESDK_API = 'https://vibesdk-nxtwave.web-1c2.workers.dev';
const VIBESDK_IFRAME = 'https://vibesdk-nxtwave.web-1c2.workers.dev';

// Your user data (get from your auth system)
const userData = {
  id: 'user_123',           // Your internal user ID
  name: 'John Doe',         // User's name
  phone: '+919876543210'    // MUST include +91 prefix
};

// 1. Login to VibeSDK
async function getToken() {
  const response = await fetch(`${VIBESDK_API}/api/auth/parent-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await response.json();
  return data.data.accessToken;
}

// 2. Send token to iframe
async function initVibeSDK() {
  const token = await getToken();
  const iframe = document.getElementById('vibesdk');
  
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'vibesdk-auth',
      token: token
    }, VIBESDK_IFRAME);
  };
}

// 3. Listen for status
window.addEventListener('message', (event) => {
  if (event.origin !== VIBESDK_IFRAME) return;
  
  switch (event.data.type) {
    case 'vibesdk-login-success':
      console.log('✅ VibeSDK ready');
      break;
    case 'vibesdk-token-expired':
      console.log('🔄 Token expired, refreshing...');
      initVibeSDK(); // Refresh token
      break;
  }
});

// Initialize
initVibeSDK();
</script>
```

## Step 3: Add Auto-Refresh (Optional but Recommended)

```javascript
// Refresh token every 20 minutes
setInterval(initVibeSDK, 20 * 60 * 1000);
```

## That's It! 🎉

Your VibeSDK integration is complete. The iframe will now:
- ✅ Authenticate automatically
- ✅ Handle token expiry
- ✅ Work without third-party cookies
- ✅ Bypass CSRF validation

## Full Production Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Learning Platform</title>
</head>
<body>
  <div id="app">
    <h1>AI Code Generator</h1>
    <iframe id="vibesdk" src="https://vibesdk-nxtwave.web-1c2.workers.dev" 
            width="100%" height="700px"></iframe>
  </div>

  <script>
    const VIBESDK_API = 'https://vibesdk-nxtwave.web-1c2.workers.dev';
    const VIBESDK_IFRAME = 'https://vibesdk-nxtwave.web-1c2.workers.dev';
    
    class VibeSDKManager {
      constructor() {
        this.iframe = document.getElementById('vibesdk');
        this.setupListeners();
      }
      
      async init(userId, userName, userPhone) {
        try {
          const token = await this.getToken(userId, userName, userPhone);
          this.sendToken(token);
          this.startAutoRefresh(userId, userName, userPhone);
          return true;
        } catch (error) {
          console.error('VibeSDK init failed:', error);
          return false;
        }
      }
      
      async getToken(userId, userName, userPhone) {
        const response = await fetch(`${VIBESDK_API}/api/auth/parent-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: userId, 
            name: userName, 
            phone: userPhone 
          })
        });
        
        if (!response.ok) throw new Error('Login failed');
        
        const data = await response.json();
        return data.data.accessToken;
      }
      
      sendToken(token) {
        if (!this.iframe.contentWindow) return;
        
        this.iframe.contentWindow.postMessage({
          type: 'vibesdk-auth',
          token: token
        }, VIBESDK_IFRAME);
      }
      
      setupListeners() {
        window.addEventListener('message', (event) => {
          if (event.origin !== VIBESDK_IFRAME) return;
          
          switch (event.data.type) {
            case 'vibesdk-login-success':
              console.log('✅ VibeSDK authenticated');
              break;
            case 'vibesdk-token-expired':
              console.log('🔄 Refreshing token...');
              // Will be handled by auto-refresh
              break;
            case 'vibesdk-error':
              console.error('❌ Error:', event.data.message);
              break;
          }
        });
        
        this.iframe.onload = () => {
          console.log('Iframe loaded, sending token...');
        };
      }
      
      startAutoRefresh(userId, userName, userPhone) {
        setInterval(async () => {
          try {
            const token = await this.getToken(userId, userName, userPhone);
            this.sendToken(token);
            console.log('Token refreshed');
          } catch (error) {
            console.error('Token refresh failed:', error);
          }
        }, 20 * 60 * 1000); // Every 20 minutes
      }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      const vibesdk = new VibeSDKManager();
      
      // Get user data from your auth system
      const { userId, userName, userPhone } = getCurrentUser();
      
      vibesdk.init(userId, userName, userPhone);
    });
    
    // Example: Get current user from your system
    function getCurrentUser() {
      // Replace with your actual user retrieval logic
      return {
        userId: 'user_123',
        userName: 'John Doe',
        userPhone: '+919876543210'
      };
    }
  </script>
</body>
</html>
```

## Important Notes

### Phone Number Format
❌ Wrong: `9876543210`  
❌ Wrong: `919876543210`  
✅ Correct: `+919876543210`

```javascript
// Format phone number if needed
function formatPhone(phone) {
  if (phone.length === 10) return `+91${phone}`;
  if (phone.startsWith('91') && phone.length === 12) return `+${phone}`;
  return phone;
}
```

### Security (Production)
```javascript
// Validate message origin
window.addEventListener('message', (event) => {
  // Only accept messages from VibeSDK
  if (event.origin !== 'https://vibesdk-nxtwave.web-1c2.workers.dev') {
    return;
  }
  // Handle message
});
```

### Error Handling
```javascript
async function getToken() {
  try {
    const response = await fetch(...);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Login failed');
    }
    return (await response.json()).data.accessToken;
  } catch (error) {
    console.error('VibeSDK authentication error:', error);
    // Show error to user or retry
    throw error;
  }
}
```

## Troubleshooting

### Iframe doesn't load
- Check console for errors
- Verify iframe URL is correct
- Check CSP headers allow iframe

### Token not working
- Verify phone format: `+919876543210`
- Check token is being sent in correct format
- Look for 401 errors in network tab

### PostMessage not received
- Wait for iframe `onload` event
- Check iframe.contentWindow exists
- Verify target origin matches

## Testing Locally

1. Use the test HTML page: `docs/test-parent-app.html`
2. Configure local URLs:
   - API: `http://localhost:8787`
   - Iframe: `http://localhost:5173`
3. Test with any user data

## Support

For detailed information:
- 📖 Full Guide: `docs/iframe-integration.md`
- 🧪 Test Page: `docs/test-parent-app.html`
- 📋 Summary: `docs/auto-login-implementation-summary.md`

## API Reference

### POST /api/auth/parent-login

**Request:**
```json
{
  "id": "string (required)",
  "name": "string (required)",
  "phone": "string (required, format: +91XXXXXXXXXX)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "string (JWT)",
    "user": { "id": "...", "displayName": "...", ... },
    "sessionId": "string",
    "expiresAt": "string (ISO 8601)"
  }
}
```

## Message Types

### Parent → Iframe
- `vibesdk-auth` - Send token
- `vibesdk-token-clear` - Clear token

### Iframe → Parent
- `vibesdk-login-success` - Auth succeeded
- `vibesdk-login-failed` - Auth failed
- `vibesdk-token-expired` - Token expired
- `vibesdk-error` - Error occurred
