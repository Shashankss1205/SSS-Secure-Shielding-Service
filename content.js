// content.js - Chrome Extension Content Script for ProseMirror integration with deanonymization

// Global variable to store mappings
let deanonymizationMappings = {};

// Get mappings from the background script
function fetchMappings() {
  chrome.runtime.sendMessage({ action: 'getMappings' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error fetching mappings:', chrome.runtime.lastError.message);
      return;
    }
    
    if (response.error) {
      console.error('Error fetching mappings:', response.error);
      return;
    }
    
    if (response.mappings) {
      console.log('Deanonymization mappings loaded successfully:', Object.keys(response.mappings).length, 'URLs');
      deanonymizationMappings = response.mappings;
      
      // Process any existing content with new mappings
      processResponses();
    }
  });
}

// Listen for mapping updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateMappings') {
    console.log('Received updated mappings:', Object.keys(message.mappings).length, 'URLs');
    deanonymizationMappings = message.mappings;
    
    // Process content with new mappings
    processResponses();
  }
});

// Create and place the button
function createProcessButton() {
  // First check if button already exists to avoid duplicates
  if (document.getElementById('prosemirror-api-button')) {
    return;
  }
  
  // Find the ProseMirror div
  const proseMirrorDiv = document.querySelector('div.ProseMirror');
  if (!proseMirrorDiv) {
    return; // Wait until ProseMirror is available
  }
  
  // Create the button
  const apiButton = document.createElement('button');
  apiButton.id = 'prosemirror-api-button';
  apiButton.style.display = 'flex';
  apiButton.style.alignItems = 'center';
  apiButton.style.justifyContent = 'center';
  apiButton.style.margin = '10px 0';
  apiButton.style.padding = '8px';
  apiButton.style.backgroundColor = '#ffffff';
  apiButton.style.color = 'black';
  apiButton.style.border = '1px solid #000';
  apiButton.style.borderRadius = '18px';
  apiButton.style.cursor = 'pointer';
  apiButton.style.width = '36px';
  apiButton.style.height = '36px';
  
  // Create an <img> element for the icon
  const incognitoIcon = document.createElement('img');
  incognitoIcon.src = 'https://cdn-icons-png.flaticon.com/512/6463/6463397.png'; // Replace with your downloaded icon path
  incognitoIcon.alt = 'Incognito Mode';
  
  // Append the icon to the button
  apiButton.appendChild(incognitoIcon);
  
  
  // Insert the button after ProseMirror div
  proseMirrorDiv.parentNode.insertBefore(apiButton, proseMirrorDiv.nextSibling);
  
  // Add click event listener
apiButton.addEventListener('click', async () => {
  try {
    // Extract text from ProseMirror div
    const text = proseMirrorDiv.textContent;
    
    // Show loading state
    const originalHtml = apiButton.innerHTML; // Save original HTML with icon
    apiButton.innerHTML = '<span style="font-size: 12px;">Processing...</span>';
    apiButton.disabled = true;
    
    // Get current URL
    const currentUrl = window.location.href;
    
    // Send message to background script
    chrome.runtime.sendMessage(
      {
        action: 'processText',
        text: text,
        url: currentUrl
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          apiButton.innerHTML = '<span style="font-size: 10px;">Error!</span>';
          apiButton.style.backgroundColor = '#ff4444';
          setTimeout(() => {
            apiButton.innerHTML = originalHtml; // Restore original icon
            apiButton.style.backgroundColor = '#ffffff';
            apiButton.disabled = false;
          }, 3000);
          return;
        }
        
        if (response.error) {
          console.error(response.error);
          apiButton.innerHTML = '<span style="font-size: 10px;">Error!</span>';
          apiButton.style.backgroundColor = '#ff4444';
          setTimeout(() => {
            apiButton.innerHTML = originalHtml; // Restore original icon
            apiButton.style.backgroundColor = '#ffffff';
            apiButton.disabled = false;
          }, 3000);
          return;
        }
        
        // Update the ProseMirror div with the API response
        proseMirrorDiv.textContent = response.processedText || 'No response text';
        
        // Reset button state
        apiButton.innerHTML = originalHtml; // Restore original icon
        apiButton.disabled = false;
        
        // Fetch updated mappings
        fetchMappings();
      }
    );
  } catch (error) {
    console.error('Error processing text:', error);
    apiButton.innerHTML = '<span style="font-size: 10px;">Error!</span>';
    apiButton.style.backgroundColor = '#ff4444';
    setTimeout(() => {
      apiButton.innerHTML = originalHtml; // Restore original icon
      apiButton.style.backgroundColor = '#ffffff';
      apiButton.disabled = false;
    }, 3000);
  }
});
}

// Function to find the best URL match for deanonymization
function findBestUrlMatch(currentUrl) {
  // If there's an exact match, use it
  if (deanonymizationMappings[currentUrl]) {
    return currentUrl;
  }
  
  // Extract the conversation ID from the URL if it's a ChatGPT URL
  const match = currentUrl.match(/chatgpt\.com\/c\/([a-zA-Z0-9-]+)/);
  if (match) {
    const conversationId = match[1];
    
    // Look for any URL containing this conversation ID
    for (const url in deanonymizationMappings) {
      if (url.includes(conversationId)) {
        return url;
      }
    }
  }
  
  // If no match found, return null
  return null;
}

// Function to deanonymize text based on mappings
function deanonymizeText(text, url) {
  if (!text || typeof text !== 'string') return text;
  
  // Find the best URL match
  const bestMatchUrl = findBestUrlMatch(url);
  if (!bestMatchUrl) {
    console.log(`No mappings found for URL: ${url}`);
    return text;
  }
  
  const urlMappings = deanonymizationMappings[bestMatchUrl];
  if (!urlMappings || !Array.isArray(urlMappings)) {
    console.log(`Invalid mappings for URL: ${bestMatchUrl}`);
    return text;
  }
  
  console.log(`Applying mappings for URL: ${bestMatchUrl}`);
  let deanonymizedText = text;
  
  // Apply all mapping groups for this URL
  urlMappings.forEach((mappingGroup, index) => {
    if (!mappingGroup.mapping) {
      console.warn(`Mapping group ${index} has no mapping property`);
      return;
    }
    
    const mapping = mappingGroup.mapping;
    
    // Replace each anonymized string with its original value
    for (const [anonymized, original] of Object.entries(mapping)) {
      // Create a regular expression to match the anonymized string (word boundary to match whole words)
      try {
        const regex = new RegExp('\\b' + anonymized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        const beforeCount = (deanonymizedText.match(regex) || []).length;
        deanonymizedText = deanonymizedText.replace(regex, original);
        const afterCount = (deanonymizedText.match(new RegExp('\\b' + original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')) || []).length;
        
        if (beforeCount > 0) {
          console.log(`Replaced "${anonymized}" with "${original}" (${beforeCount} -> ${afterCount})`);
        }
      } catch (e) {
        console.error(`Error creating regex for "${anonymized}":`, e);
      }
    }
  });
  
  return deanonymizedText;
}

// Process responses that need deanonymization
function processResponses() {
  const currentUrl = window.location.href;
  
  // Process sent messages
  const sentElements = document.getElementsByClassName("whitespace-pre-wrap");
  for (let i = 0; i < sentElements.length; i++) {
    const element = sentElements[i];
    
    // Skip if already processed
    if (element.dataset.deanonymized === 'true') {
      continue;
    }
    
    const originalText = element.textContent;
    const deanonymizedText = deanonymizeText(originalText, currentUrl);
    
    // Update text if it changed
    if (deanonymizedText !== originalText) {
      element.textContent = deanonymizedText;
      console.log('Sent message deanonymized');
    }
    
    // Mark as processed
    element.dataset.deanonymized = 'true';
  }
  
  // Also try to find messages with different class names
  const alternativeSentSelectors = [
    '.whitespace-pre-wrap', 
    '.message-content',
    '[data-message-author-role="user"] p',
    '[data-testid="conversation-turn-user"] p'
  ];
  
  alternativeSentSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Skip if already processed
        if (element.dataset.deanonymized === 'true') {
          continue;
        }
        
        const originalText = element.textContent;
        const deanonymizedText = deanonymizeText(originalText, currentUrl);
        
        // Update text if it changed
        if (deanonymizedText !== originalText) {
          element.textContent = deanonymizedText;
          console.log(`Sent message deanonymized using selector: ${selector}`);
        }
        
        // Mark as processed
        element.dataset.deanonymized = 'true';
      }
    } catch (err) {
      console.warn(`Error processing selector ${selector}:`, err);
    }
  });
  
  // Process received messages
  const receivedElements = document.getElementsByClassName("prose");
  for (let i = 0; i < receivedElements.length; i++) {
    const element = receivedElements[i];
    
    // Skip if already processed
    if (element.dataset.deanonymized === 'true') {
      continue;
    }
    
    const originalText = element.textContent;
    const deanonymizedText = deanonymizeText(originalText, currentUrl);
    
    // Update text if it changed
    if (deanonymizedText !== originalText) {
      // Use innerHTML to preserve formatting
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node;
      
      while (node = walker.nextNode()) {
        const nodeText = node.nodeValue;
        const nodeDeanonymized = deanonymizeText(nodeText, currentUrl);
        if (nodeText !== nodeDeanonymized) {
          node.nodeValue = nodeDeanonymized;
        }
      }
      
      console.log('Received message deanonymized');
    }
    
    // Mark as processed
    element.dataset.deanonymized = 'true';
  }
  
  // Also try to find responses with different class names
  const alternativeReceivedSelectors = [
    '.prose', 
    '.markdown-content',
    '[data-message-author-role="assistant"] p',
    '[data-testid="conversation-turn-assistant"] p'
  ];
  
  alternativeReceivedSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Skip if already processed
        if (element.dataset.deanonymized === 'true') {
          continue;
        }
        
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let hasChanges = false;
        let node;
        
        while (node = walker.nextNode()) {
          const nodeText = node.nodeValue;
          const nodeDeanonymized = deanonymizeText(nodeText, currentUrl);
          if (nodeText !== nodeDeanonymized) {
            node.nodeValue = nodeDeanonymized;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          console.log(`Received message deanonymized using selector: ${selector}`);
        }
        
        // Mark as processed
        element.dataset.deanonymized = 'true';
      }
    } catch (err) {
      console.warn(`Error processing selector ${selector}:`, err);
    }
  });
}

// Function to check and ensure the button exists
function ensureButtonExists() {
  if (!document.getElementById('prosemirror-api-button')) {
    createProcessButton();
  }
}

// Function to reset deanonymization flags
function resetDeanonymizationFlags() {
  // This allows text to be reprocessed with new mappings
  document.querySelectorAll('[data-deanonymized="true"]').forEach(element => {
    element.dataset.deanonymized = 'false';
  });
}

// Initial setup
async function initialize() {
  // Load the mappings first
  await fetchMappings();
  
  // Then set up the rest of the extension
  createProcessButton();
  processResponses();
  
  // Set up interval to ensure button always exists and to process new responses (every 2 seconds)
  setInterval(() => {
    ensureButtonExists();
    processResponses();
  }, 2000);
  
  // Set up interval to periodically fetch new mappings (every 3 seconds)
  setInterval(() => {
    fetchMappings();
  }, 3000);
  
  // Set up MutationObserver to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    // Check if new elements were added that we care about
    let needToCreateButton = false;
    let needToProcessResponses = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check added nodes
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          // Check if ProseMirror was added
          if (node.classList && node.classList.contains('ProseMirror') || 
              node.querySelector && node.querySelector('.ProseMirror')) {
            needToCreateButton = true;
          }
          
          // Check if response was added
          if (node.classList && (node.classList.contains('whitespace-pre-wrap') || node.classList.contains('prose')) || 
              node.querySelector && (node.querySelector('.whitespace-pre-wrap') || node.querySelector('.prose'))) {
            needToProcessResponses = true;
          }
        }
      }
    }
    
    // Update as needed
    if (needToCreateButton) {
      ensureButtonExists();
    }
    
    if (needToProcessResponses) {
      processResponses();
    }
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start the initialization process
initialize();