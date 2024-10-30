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

function extractTweetData(tweetElement) {
    const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
    const userElement = tweetElement.querySelector('[data-testid="User-Name"]');
    
    const getCount = (testId) => {
        const element = tweetElement.querySelector(`[data-testid="${testId}"]`);
        if (element) {
            const countElement = element.querySelector('span[data-testid="app-text-transition-container"]');
            return countElement ? countElement.textContent.trim() : '0';
        }
        return '0';
    };

    const getRetweetCount = () => {
        const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
        if (retweetButton) {
            const countElement = retweetButton.querySelector('span[data-testid="app-text-transition-container"]');
            return countElement ? countElement.textContent.trim() : '0';
        }
        return '0';
    };

    const getName = () => {
        if (userElement) {
            const nameElement = userElement.querySelector('div[dir="ltr"] > span');
            return nameElement ? nameElement.textContent.trim() : 'Not found';
        }
        return 'Not found';
    };

    const getUsername = () => {
        // Method 1: Try to get from User-Name element
        if (userElement) {
            const spans = userElement.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                if (text.startsWith('@')) {
                    return text.substring(1);
                }
            }
        }

        // Method 2: Try to get from tweet link
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        if (tweetLink) {
            const href = tweetLink.getAttribute('href');
            const match = href.match(/\/([^/]+)\/status\//);
            if (match && match[1]) {
                return match[1];
            }
        }

        return 'Not found';
    };

    const getViews = () => {
        // Method 1: Try analytics link (for single tweet view)
        const analyticsLink = tweetElement.querySelector('a[href$="/analytics"]');
        if (analyticsLink) {
            const viewsText = analyticsLink.textContent.trim();
            const viewsMatch = viewsText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*views?/i);
            if (viewsMatch) return viewsMatch[1];
        }

        // Method 2: Try finding views in tweet metrics
        const metrics = tweetElement.querySelectorAll('[role="group"] span');
        for (const metric of metrics) {
            const text = metric.textContent.trim();
            if (text.toLowerCase().includes('view')) {
                const viewCount = text.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
                if (viewCount) return viewCount[1];
            }
        }

        return 'Not found';
    };

    const getBookmarks = () => {
        // Method 1: Try the standard bookmark button
        const bookmarkButton = tweetElement.querySelector('[data-testid="bookmark"]');
        if (bookmarkButton) {
            const countElement = bookmarkButton.querySelector('span[data-testid="app-text-transition-container"]');
            if (countElement) {
                return countElement.textContent.trim();
            }
        }
        
        // Method 2: Try finding bookmarks in tweet metrics
        const metrics = tweetElement.querySelectorAll('[role="group"] span');
        for (const metric of metrics) {
            const text = metric.textContent.trim();
            if (text.toLowerCase().includes('bookmark')) {
                const nextSibling = metric.nextElementSibling;
                if (nextSibling) {
                    const bookmarkCount = nextSibling.textContent.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
                    if (bookmarkCount) return bookmarkCount[1];
                }
            }
        }
        
        return '0';
    };

    const getDate = () => {
        // Method 1: Try finding time element directly
        const timeElement = tweetElement.querySelector('time');
        if (timeElement && timeElement.getAttribute('datetime')) {
            return timeElement.getAttribute('datetime');
        }

        // Method 2: Try finding time in tweet metadata
        const timeSpans = tweetElement.querySelectorAll('span');
        for (const span of timeSpans) {
            const text = span.textContent.trim();
            if (text.match(/\d{1,2}:\d{2} [AP]M.*\d{4}/)) {
                const parentTime = span.closest('time');
                if (parentTime && parentTime.getAttribute('datetime')) {
                    return parentTime.getAttribute('datetime');
                }
            }
        }

        return null;
    };

    // Get the tweet URL from the tweet element
    const getTweetUrl = () => {
        const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
        return tweetLink ? `https://twitter.com${tweetLink.getAttribute('href')}` : window.location.href;
    };

    return {
        tweet_text: tweetTextElement ? tweetTextElement.textContent.trim() : 'No tweet text found.',
        likes_count: getCount('like'),
        retweet_count: getRetweetCount(),
        comment_count: getCount('reply'),
        bookmark_count: getBookmarks(),
        views_count: getViews(),
        name: getName(),
        username: getUsername(),
        tweet_url: getTweetUrl(),
        tweet_date: getDate()
    };
}

// Commenting out the tweet button functionality
/*
function addButtonToTweet(tweetElement) {
    if (tweetElement.querySelector('.creatorbuddy-button')) return;

    const actionBar = tweetElement.querySelector('[role="group"]');
    if (!actionBar) return;

    const newButton = document.createElement('div');
    newButton.className = 'creatorbuddy-button';
    newButton.innerHTML = `
        <div role="button" tabindex="0" style="cursor: pointer;">
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M13.5 2c-5.621 0-10.211 4.443-10.475 10H3v2h.025c.264 5.557 4.854 10 10.475 10S23.736 19.557 24 14h.025v-2H24c-.264-5.557-4.854-10-10.5-10zm0 2c4.485 0 8.154 3.522 8.465 8H5.035c.311-4.478 3.98-8 8.465-8zm0 18c-4.485 0-8.154-3.522-8.465-8h16.93c-.311 4.478-3.98 8-8.465 8zm-2-6h4v2h-4v-2zm0-4h4v2h-4v-2zm0-4h4v2h-4V8z"/>
            </svg>
        </div>
    `;
    newButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log('CreatorBuddy button clicked for tweet:', tweetElement);
        const tweetData = extractTweetData(tweetElement);
        console.log('Extracted tweet data:', tweetData);
        chrome.runtime.sendMessage({ type: 'SAVE_TWEET', tweetData: tweetData });
    });

    actionBar.appendChild(newButton);
}

function addButtonsToTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach(addButtonToTweet);
}

// Initial addition of buttons
addButtonsToTweets();

// Use a MutationObserver to add buttons to new tweets as they're loaded
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('article[data-testid="tweet"]')) {
                        addButtonToTweet(node);
                    } else {
                        const tweets = node.querySelectorAll('article[data-testid="tweet"]');
                        tweets.forEach(addButtonToTweet);
                    }
                }
            });
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });
*/

// Keep the message listener for TWEET_SAVED
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TWEET_SAVED') {
    if (message.success) {
      alert('Tweet saved successfully!');
    } else {
      alert('Error saving tweet: ' + (message.error || 'Unknown error'));
    }
  }
});