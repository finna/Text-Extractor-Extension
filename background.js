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
  chrome.tabs.query({url: 'http://localhost:3000/*'}, function(tabs) {
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