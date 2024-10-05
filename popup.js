document.addEventListener('DOMContentLoaded', () => {
    const extractButton = document.getElementById('extract-button');
    const saveButton = document.getElementById('save-button');
    const contentDiv = document.getElementById('content');
  
    // Initialize Supabase client
    const supabaseUrl = 'https://mlnipbzcozspyroqqdhe.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbmlwYnpjb3pzcHlyb3FxZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU2NDE2NzcsImV4cCI6MjA0MTIxNzY3N30.m5SfnDu69gyr8Th2d1ZyriHeDmEwqSRcKnTRa7oUbdo';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized:', supabase);

    // Test the connection
    supabase.from('tweet_history').select('*').limit(1)
      .then(response => {
        console.log('Supabase connection test:', response);
      })
      .catch(error => {
        console.error('Supabase connection test error:', error);
      });

    let extractedTweet = null;

    extractButton.addEventListener('click', () => {
      // Get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
  
        // Inject a script into the current tab to extract the text
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => {
              // Check if we're on a Twitter/X page
              if (!window.location.hostname.includes('twitter.com') && !window.location.hostname.includes('x.com')) {
                return { error: 'Not a Twitter/X page. Please open a tweet to extract.' };
              }

              // Find the tweet text element
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
    });

    saveButton.addEventListener('click', async () => {
      if (!extractedTweet) {
        contentDiv.innerText = 'No tweet extracted to save.';
        return;
      }

      try {
        console.log('Attempting to save tweet:', extractedTweet);
        const { data, error } = await supabase
          .from('tweet_history')
          .insert([extractedTweet]);

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        console.log('Supabase response:', data);
        contentDiv.innerText = 'Tweet saved successfully!';
        saveButton.disabled = true;
      } catch (error) {
        console.error('Error saving tweet:', error);
        contentDiv.innerText = 'Error saving tweet: ' + JSON.stringify(error);
      }
    });
  });
