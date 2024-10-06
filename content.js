console.log('Content script loaded');

let authTokenSent = false;

function sendAuthReady() {
  console.log('Sending AUTH_READY message');
  window.postMessage({ type: 'AUTH_READY' }, '*');
}

// Send AUTH_READY message when the content script loads
sendAuthReady();

// Listen for messages from the page
window.addEventListener('message', (event) => {
  console.log('Content script received message:', event.data);

  if (event.data.type === 'PAGE_READY') {
    console.log('PAGE_READY received, sending AUTH_READY');
    sendAuthReady();
  } else if (event.data.type === 'AUTH_TOKEN' && !authTokenSent) {
    console.log('Received AUTH_TOKEN, sending to background script');
    authTokenSent = true;
    chrome.runtime.sendMessage({ type: 'AUTH_TOKEN', token: event.data.token }, (response) => {
      console.log('Background script response:', response);
      window.postMessage({ type: 'AUTH_TOKEN_RECEIVED' }, '*');
    });
  }
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'loginStateChanged') {
    window.postMessage({ type: 'LOGIN_STATE_CHANGED', isLoggedIn: message.isLoggedIn }, '*');
  }
});

// Send AUTH_READY message every second for 10 seconds
let count = 0;
const interval = setInterval(() => {
  if (count < 10) {
    sendAuthReady();
    count++;
  } else {
    clearInterval(interval);
  }
}, 1000);