document.addEventListener('DOMContentLoaded', () => {
    const extractButton = document.getElementById('extract-button');
    const contentDiv = document.getElementById('content');
  
    extractButton.addEventListener('click', () => {
      // Get the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
  
        // Inject a script into the current tab to extract the text
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: () => {
              // Function to be executed in the context of the page
              const elementsToRemove = ['script', 'style', 'noscript', 'iframe', 'canvas'];
              elementsToRemove.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => el.remove());
              });
  
              const bodyText = document.body.innerText;
              return bodyText;
            },
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              contentDiv.innerText = 'Error extracting text: ' + chrome.runtime.lastError.message;
              return;
            }
  
            const pageText = results[0].result;
            contentDiv.innerText = pageText || 'No text content found.';
          }
        );
      });
    });
  });
  