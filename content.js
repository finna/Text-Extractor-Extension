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
        if (userElement) {
            const usernameElement = userElement.querySelector('div[dir="ltr"] span:nth-child(2)');
            return usernameElement ? usernameElement.textContent.trim().replace('@', '') : 'Not found';
        }
        return 'Not found';
    };

    const getViews = () => {
        // Method 1: Look for a specific structure
        const viewsContainer = tweetElement.querySelector('a[href$="/analytics"]');
        if (viewsContainer) {
            const viewsText = viewsContainer.textContent.trim();
            const viewsMatch = viewsText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*views?/i);
            if (viewsMatch) return viewsMatch[1];
        }

        // Method 2: Look for elements with specific class combinations
        const possibleViewsElements = tweetElement.querySelectorAll('span[class*="r-bcqeeo"][class*="r-qvutc0"][class*="r-1tl8opc"]');
        for (const element of possibleViewsElements) {
            if (/^\d+(?:,\d+)*(?:\.\d+)?[KMB]?$/.test(element.textContent.trim())) {
                return element.textContent.trim();
            }
        }

        // Method 3: Look for elements near the word "Views"
        const viewsLabel = Array.from(tweetElement.querySelectorAll('span')).find(el => el.textContent.trim().toLowerCase() === 'views');
        if (viewsLabel) {
            const siblings = viewsLabel.parentElement.children;
            for (const sibling of siblings) {
                const text = sibling.textContent.trim();
                if (/^\d+(?:,\d+)*(?:\.\d+)?[KMB]?$/.test(text)) {
                    return text;
                }
            }
        }

        // Method 4: Search for a number followed by "Views" in the entire tweet
        const tweetText = tweetElement.innerText;
        const globalViewsMatch = tweetText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*views?/i);
        if (globalViewsMatch) return globalViewsMatch[1];

        return '0';
    };

    const getBookmarks = () => {
        const bookmarkButton = tweetElement.querySelector('[data-testid="bookmark"]');
        if (bookmarkButton) {
            const countElement = bookmarkButton.querySelector('span[data-testid="app-text-transition-container"]');
            if (countElement) {
                return countElement.textContent.trim();
            }
        }
        
        // If the above method doesn't work, try an alternative approach
        const allSpans = tweetElement.querySelectorAll('span');
        for (const span of allSpans) {
            if (span.textContent.trim().toLowerCase() === 'bookmarks') {
                const nextSpan = span.nextElementSibling;
                if (nextSpan && nextSpan.tagName === 'SPAN') {
                    return nextSpan.textContent.trim();
                }
            }
        }
        
        return '0';
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
        tweet_url: window.location.href
    };
}

function addButtonToTweet(tweetElement) {
    if (tweetElement.querySelector('.creatorbuddy-button')) return; // Button already added

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TWEET_SAVED') {
    if (message.success) {
      alert('Tweet saved successfully!');
    } else {
      alert('Error saving tweet: ' + (message.error || 'Unknown error'));
    }
  }
});