console.log('Background script started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);

  if (message.type === 'getAuthToken') {
    chrome.storage.local.get(['authToken'], function(result) {
      console.log('Sending auth token:', result.authToken ? 'Token exists' : 'No token');
      sendResponse({token: result.authToken || null});
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.set({authToken: message.token}, function() {
      console.log('Auth token saved');
      sendResponse({status: 'success'});
      // Notify relevant tabs about the login state change
      notifyLoginStateChange();
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (message.type === 'SAVE_TWEET') {
    chrome.storage.local.get(['authToken'], function(result) {
      if (!result.authToken) {
        console.error('No auth token found');
        return;
      }

      const requestBody = {
        tweets: [message.tweetData],
        userId: JSON.parse(atob(result.authToken.split('.')[1])).sub
      };

      console.log('Saving tweet with token:', result.authToken.substring(0, 20) + '...');
      console.log('Request body:', requestBody);

      fetch('https://www.creatorbuddy.io/api/tweets/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.authToken}`
        },
        body: JSON.stringify(requestBody)
      })
      .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        // Check for auth-related headers
        const authStatus = response.headers.get('x-clerk-auth-status');
        const authReason = response.headers.get('x-clerk-auth-reason');
        
        if (authStatus === 'signed-out' || authReason === 'session-token-outdated') {
          // Clear the expired token
          chrome.storage.local.remove('authToken', function() {
            console.log('Cleared expired auth token');
          });
          
          // Create a new tab for login
          chrome.tabs.create({ url: 'https://www.creatorbuddy.io/extension-login' });
          
          throw new Error('Session expired. Please log in again.');
        }
        
        if (!response.ok) {
          return response.text().then(text => {
            console.error('Error response body:', text);
            throw new Error(`Server returned ${response.status}: ${text.substring(0, 200)}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Tweet saved successfully:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Error saving tweet:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    console.log('Received external message:', request);
    if (request.type === 'AUTH_TOKEN') {
      chrome.storage.local.set({authToken: request.token}, function() {
        console.log('Auth token saved from external message');
        sendResponse({status: 'success'});
        // Notify relevant tabs about the login state change
        notifyLoginStateChange();
      });
      return true; // Indicates that the response is sent asynchronously
    }
  }
);

function notifyLoginStateChange() {
  chrome.tabs.query({url: 'https://www.creatorbuddy.io/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, {type: 'loginStateChanged', isLoggedIn: true})
        .catch(error => console.log('Error sending message to tab:', error));
    });
  });
}

// Keep the service worker alive without sending messages
function keepAlive() {
  console.log('Keeping service worker alive');
  setTimeout(keepAlive, 20000); // Schedule next keep-alive
}

keepAlive(); // Start the keep-alive cycle