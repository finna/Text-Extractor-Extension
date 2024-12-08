document.addEventListener('DOMContentLoaded', function() {
    const authButton = document.getElementById('authButton');
    const saveButton = document.getElementById('save-button');
    const statusMessage = document.getElementById('statusMessage');
    const contentDiv = document.getElementById('content');

    let extractedTweet = null;

    checkLoginStatus();

    authButton.addEventListener('click', handleAuthClick);
    saveButton.addEventListener('click', extractAndSaveTweet);

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'loginStateChanged') {
            updateUI(request.isLoggedIn);
        }
    });

    function checkLoginStatus() {
        chrome.runtime.sendMessage({type: 'getAuthToken'}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error getting auth token:', chrome.runtime.lastError);
                updateUI(false);
            } else if (response && response.token) {
                // Check if token is expired by trying to parse it
                try {
                    const payload = JSON.parse(atob(response.token.split('.')[1]));
                    const isExpired = Date.now() >= payload.exp * 1000;
                    
                    if (isExpired) {
                        console.log('Token is expired, clearing it');
                        chrome.storage.local.remove('authToken', function() {
                            updateUI(false);
                        });
                    } else {
                        updateUI(true);
                    }
                } catch (error) {
                    console.error('Error parsing token:', error);
                    updateUI(false);
                }
            } else {
                updateUI(false);
            }
        });
    }

    function updateUI(isLoggedIn) {
        if (isLoggedIn) {
            statusMessage.textContent = 'Logged in';
            authButton.textContent = 'Logout';
            saveButton.disabled = false;
        } else {
            statusMessage.textContent = 'Not logged in';
            authButton.textContent = 'Login';
            saveButton.disabled = true;
        }
    }

    function handleAuthClick() {
        chrome.runtime.sendMessage({type: 'getAuthToken'}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error getting auth token:', chrome.runtime.lastError);
                login();
            } else if (response && response.token) {
                logout();
            } else {
                login();
            }
        });
    }

    function login() {
        chrome.tabs.create({ url: 'https://www.creatorbuddy.io/extension-login' });
    }

    function logout() {
        chrome.storage.local.remove(['authToken'], function() {
            updateUI(false);
        });
    }

    function extractAndSaveTweet() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];

            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    func: () => {
                        if (!window.location.hostname.includes('twitter.com') && !window.location.hostname.includes('x.com')) {
                            return { error: 'Not a Twitter/X page. Please open a tweet to extract.' };
                        }

                        const mainContent = document.querySelector('main[role="main"]');
                        if (!mainContent) {
                            return { error: 'Could not find main tweet content' };
                        }

                        const tweetElement = mainContent.querySelector('[data-testid="tweetText"]');
                        const userElement = mainContent.querySelector('[data-testid="User-Name"]');
                        
                        const getCount = (testId) => {
                            const element = mainContent.querySelector(`[data-testid="${testId}"]`);
                            if (element) {
                                const countElement = element.querySelector('span[data-testid="app-text-transition-container"]');
                                return countElement ? countElement.textContent.trim() : 'Not found';
                            }
                            return 'Not found';
                        };

                        const getRetweetCount = () => {
                            const retweetButton = mainContent.querySelector('[data-testid="retweet"]');
                            if (retweetButton) {
                                const countElement = retweetButton.querySelector('span.css-1jxf684.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3');
                                return countElement ? countElement.textContent.trim() : 'Not found';
                            }
                            return 'Not found';
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
                                const spans = userElement.querySelectorAll('span');
                                for (const span of spans) {
                                    const text = span.textContent.trim();
                                    if (text.startsWith('@')) {
                                        return text.substring(1);
                                    }
                                }
                            }
                            return 'Not found';
                        };

                        const getViews = () => {
                            const viewsContainer = mainContent.querySelector('a[href$="/analytics"]');
                            if (viewsContainer) {
                                const viewsText = viewsContainer.textContent.trim();
                                const viewsMatch = viewsText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*views?/i);
                                if (viewsMatch) return viewsMatch[1];
                            }

                            const possibleViewsElements = mainContent.querySelectorAll('span[class*="r-bcqeeo"][class*="r-qvutc0"][class*="r-1tl8opc"]');
                            for (const element of possibleViewsElements) {
                                if (/^\d+(?:,\d+)*(?:\.\d+)?[KMB]?$/.test(element.textContent.trim())) {
                                    return element.textContent.trim();
                                }
                            }

                            const viewsLabel = Array.from(mainContent.querySelectorAll('span')).find(el => el.textContent.trim().toLowerCase() === 'views');
                            if (viewsLabel) {
                                const siblings = viewsLabel.parentElement.children;
                                for (const sibling of siblings) {
                                    const text = sibling.textContent.trim();
                                    if (/^\d+(?:,\d+)*(?:\.\d+)?[KMB]?$/.test(text)) {
                                        return text;
                                    }
                                }
                            }

                            const bodyText = mainContent.innerText;
                            const globalViewsMatch = bodyText.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*views?/i);
                            if (globalViewsMatch) return globalViewsMatch[1];

                            return 'Not found';
                        };

                        const getDate = () => {
                            try {
                                const timeElement = mainContent.querySelector('time');
                                if (!timeElement) {
                                    console.warn('Time element not found');
                                    return null;
                                }
                                const date = timeElement.getAttribute('datetime');
                                if (!date) {
                                    console.warn('Datetime attribute not found');
                                    return null;
                                }
                                console.log('Extracted date:', date);
                                return date;
                            } catch (error) {
                                console.error('Error extracting date:', error);
                                return null;
                            }
                        };

                        const result = {
                            tweet_text: tweetElement ? tweetElement.textContent.trim() : 'No tweet text found.',
                            likes_count: getCount('like'),
                            retweet_count: getRetweetCount(),
                            comment_count: getCount('reply'),
                            bookmark_count: getCount('bookmark'),
                            views_count: getViews(),
                            name: getName(),
                            username: getUsername(window.location.href),
                            tweet_url: window.location.href,
                            tweet_date: getDate()
                        };

                        console.log('Extracted tweet data:', result);
                        return result;
                    },
                },
                (results) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        contentDiv.innerText = 'Error extracting tweet: ' + chrome.runtime.lastError.message;
                        return;
                    }

                    console.log('Extraction results:', results);
                    const { tweet_text, likes_count, retweet_count, comment_count, bookmark_count, views_count, name, username, tweet_url, tweet_date, error } = results[0].result;
                    
                    if (error) {
                        contentDiv.innerText = error;
                        return;
                    }

                    const extractedTweet = { tweet_text, likes_count, retweet_count, comment_count, bookmark_count, views_count, name, username, tweet_url, tweet_date };
                    
                    chrome.runtime.sendMessage({type: 'getAuthToken'}, function(response) {
                        if (!response || !response.token) {
                            statusMessage.textContent = 'Please log in to save tweets';
                            return;
                        }

                        let userId;
                        try {
                            const tokenParts = response.token.split('.');
                            const tokenPayload = JSON.parse(atob(tokenParts[1]));
                            userId = tokenPayload.sub;
                        } catch (error) {
                            console.error('Error parsing JWT token:', error);
                            contentDiv.innerText = 'Error parsing authentication token';
                            return;
                        }

                        const tweetToSave = {
                            tweet_text: extractedTweet.tweet_text,
                            likes_count: normalizeCount(extractedTweet.likes_count),
                            retweet_count: normalizeCount(extractedTweet.retweet_count),
                            comment_count: normalizeCount(extractedTweet.comment_count),
                            bookmark_count: normalizeCount(extractedTweet.bookmark_count),
                            views_count: normalizeCount(extractedTweet.views_count),
                            name: extractedTweet.name,
                            username: extractedTweet.username,
                            tweet_url: extractedTweet.tweet_url,
                            tweet_date: extractedTweet.tweet_date
                        };

                        // Send message to background script to save tweet
                        chrome.runtime.sendMessage({
                            type: 'SAVE_TWEET',
                            tweetData: tweetToSave
                        }, response => {
                            if (chrome.runtime.lastError) {
                                console.error('Error saving tweet:', chrome.runtime.lastError);
                                contentDiv.innerText = 'Error saving tweet: ' + chrome.runtime.lastError.message;
                                return;
                            }

                            if (response.success) {
                                console.log('Tweet saved successfully:', response.data);
                                contentDiv.innerText = 'Tweet saved successfully!';
                                const formattedDate = new Date(extractedTweet.tweet_date).toLocaleString();
                                document.getElementById('tweetDate').textContent = `Tweet Date: ${formattedDate}`;
                            } else {
                                console.error('Error saving tweet:', response.error);
                                contentDiv.innerText = 'Error saving tweet: ' + response.error;
                            }
                        });
                    });
                }
            );
        });
    }

    function normalizeCount(countString) {
        if (typeof countString !== 'string') return 0;
        
        const cleanedString = countString.replace(/,/g, '').toUpperCase();
        if (cleanedString.endsWith('K')) {
            return parseFloat(cleanedString.slice(0, -1)) * 1000;
        } else if (cleanedString.endsWith('M')) {
            return parseFloat(cleanedString.slice(0, -1)) * 1000000;
        } else if (cleanedString.endsWith('B')) {
            return parseFloat(cleanedString.slice(0, -1)) * 1000000000;
        } else {
            return parseInt(cleanedString, 10) || 0;
        }
    }
});
