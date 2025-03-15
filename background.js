// background.js - Handles API requests from the content script

// Global variable to store mappings
let mappingsCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 3000; // 30 seconds in milliseconds

// Function to fetch mappings from the backend
async function fetchMappings() {
  try {
    const currentTime = Date.now();
    
    // Use cached mappings if they exist and aren't too old
    if (mappingsCache && (currentTime - lastFetchTime < CACHE_TTL)) {
      return mappingsCache;
    }
    
    const response = await fetch('http://localhost:5000/get_mappings');
    if (!response.ok) {
      throw new Error(`Failed to fetch mappings: ${response.status} ${response.statusText}`);
    }
    
    mappingsCache = await response.json();
    lastFetchTime = currentTime;
    
    return mappingsCache;
  } catch (error) {
    console.error('Error fetching mappings:', error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processText') {
    // Make the API call to your localhost backend
    fetch('http://localhost:5000/anonymize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: request.text, url: request.url, anonymization_method: 'fake' }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ processedText: data.anonymized_text || data.text });
      
      // After successful anonymization, fetch the latest mappings and notify content script
      fetchMappings().then(mappings => {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: 'updateMappings',
          mappings: mappings
        });
      });
    })
    .catch(error => {
      console.error('Error in background script:', error);
      sendResponse({ error: error.message });
    });
    
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
  
  if (request.action === 'getMappings') {
    fetchMappings()
      .then(mappings => {
        sendResponse({ mappings });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated. Fetching initial mappings...');
  fetchMappings().catch(err => console.error('Initial mappings fetch failed:', err));
});