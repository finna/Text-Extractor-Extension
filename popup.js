document.addEventListener('DOMContentLoaded', function() {
    const authButton = document.getElementById('authButton');
    const extractButton = document.getElementById('extract-button');
    const saveButton = document.getElementById('save-button');
    const statusMessage = document.getElementById('statusMessage');
    const contentDiv = document.getElementById('content');

    let extractedTweet = null;

    checkLoginStatus();

    authButton.addEventListener('click', handleAuthClick);
    extractButton.addEventListener('click', extractTweet);
    saveButton.addEventListener('click', saveTweet);

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
            } else {
                updateUI(!!response && !!response.token);
            }
        });
    }

    function updateUI(isLoggedIn) {
        if (isLoggedIn) {
            statusMessage.textContent = 'Logged in';
            authButton.textContent = 'Logout';
            extractButton.disabled = false;
        } else {
            statusMessage.textContent = 'Not logged in';
            authButton.textContent = 'Login';
            extractButton.disabled = true;
        }
        saveButton.disabled = true;
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
        chrome.tabs.create({ url: 'http://localhost:3000/extension-login' });
    }

    function logout() {
        chrome.storage.local.remove(['authToken'], function() {
            updateUI(false);
        });
    }

    function extractTweet() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
    
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    func: () => {
                        if (!window.location.hostname.includes('twitter.com') && !window.location.hostname.includes('x.com')) {
                            return { error: 'Not a Twitter/X page. Please open a tweet to extract.' };
                        }

                        const tweetElement = document.querySelector('[data-testid="tweetText"]');
                        const getCount = (testId) => {
                            const element = document.querySelector(`[data-testid="${testId}"]`);
                            if (element) {
                                const countElement = element.querySelector('span[data-testid="app-text-transition-container"]');
                                return countElement ? countElement.textContent.trim() : 'Not found';
                            }
                            return 'Not found';
                        };

                        const getRetweetCount = () => {
                            const retweetButton = document.querySelector('[data-testid="retweet"]');
                            if (retweetButton) {
                                const countElement = retweetButton.querySelector('span.css-1jxf684.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3');
                                return countElement ? countElement.textContent.trim() : 'Not found';
                            }
                            return 'Not found';
                        };

                        return {
                            tweet_text: tweetElement ? tweetElement.textContent.trim() : 'No tweet text found.',
                            likes_count: getCount('like'),
                            retweet_count: getRetweetCount(),
                            comment_count: getCount('reply'),
                            bookmark_count: getCount('bookmark')
                        };
                    },
                },
                (results) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        contentDiv.innerText = 'Error extracting tweet: ' + chrome.runtime.lastError.message;
                        return;
                    }
    
                    const { tweet_text, likes_count, retweet_count, comment_count, bookmark_count, error } = results[0].result;
                    if (error) {
                        contentDiv.innerText = error;
                        saveButton.disabled = true;
                    } else {
                        extractedTweet = { tweet_text, likes_count, retweet_count, comment_count, bookmark_count };
                        contentDiv.innerHTML = `
                            <strong>Tweet:</strong> ${tweet_text}<br><br>
                            <strong>Likes:</strong> ${likes_count}<br>
                            <strong>Retweets:</strong> ${retweet_count}<br>
                            <strong>Comments:</strong> ${comment_count}<br>
                            <strong>Bookmarks:</strong> ${bookmark_count}
                        `;
                        saveButton.disabled = false;
                    }
                }
            );
        });
    }

    function saveTweet() {
        if (!extractedTweet) {
            contentDiv.innerText = 'No tweet extracted to save.';
            return;
        }

        chrome.runtime.sendMessage({type: 'getAuthToken'}, function(response) {
            if (!response || !response.token) {
                statusMessage.textContent = 'Please log in to save tweets';
                return;
            }

            // Parse the JWT token to get the user ID
            let userId;
            try {
                const tokenParts = response.token.split('.');
                const tokenPayload = JSON.parse(atob(tokenParts[1]));
                userId = tokenPayload.sub; // Assuming 'sub' is the user ID in your JWT
            } catch (error) {
                console.error('Error parsing JWT token:', error);
                contentDiv.innerText = 'Error parsing authentication token';
                return;
            }

            const requestBody = {
                tweets: [extractedTweet],
                userId: userId
            };

            console.log('Sending request to save tweet:', requestBody);

            fetch('http://localhost:3000/api/tweets/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${response.token}`
                },
                body: JSON.stringify(requestBody)
            })
            .then(response => {
                console.log('Response status:', response.status);
                return response.text().then(text => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                    }
                    try {
                        return JSON.parse(text);
                    } catch (error) {
                        console.error('Error parsing JSON response:', error);
                        throw new Error('Invalid JSON response from server');
                    }
                });
            })
            .then(data => {
                console.log('Tweet saved successfully:', data);
                contentDiv.innerText = 'Tweet saved successfully!';
                saveButton.disabled = true;
            })
            .catch(error => {
                console.error('Error saving tweet:', error);
                contentDiv.innerText = 'Error saving tweet: ' + error.message;
            });
        });
    }
});
