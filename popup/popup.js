// State of selection with default values
const state = {
  sites: ["Chatgpt"],
  models: ["Presidio"],  // Set Presidio as default
  methods: ["Pseudonymization"],  // Set Pseudonymization as default (assuming you meant this instead of "fake")
  piis: ["Names", "Emails", "Phone Numbers", "Addresses", "SSN"]  // All PIIs selected by default
};

// Dropdown elements
const dropdowns = [
  {
    name: 'sites',
    boxId: 'sitesBox',
    listId: 'sitesList',
    selectedId: 'selectedSites',
  },
  {
    name: 'models',
    boxId: 'modelsBox',
    listId: 'modelsList',
    selectedId: 'selectedModels',
  },
  {
    name: 'methods',
    boxId: 'methodsBox',
    listId: 'methodsList',
    selectedId: 'selectedMethods',
  },
  {
    name: 'piis',
    boxId: 'piisBox',
    listId: 'piisList',
    selectedId: 'selectedPIIs',
  }
];

// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const connectionStatus = document.getElementById('connectionStatus');
const checkConnectionBtn = document.getElementById('checkConnection');

// Load settings when the popup opens
document.addEventListener('DOMContentLoaded', () => {
  // Initialize chrome.storage mock for testing in browser
  if (!chrome.storage) {
    chrome.storage = {
      local: {
        get: (keys, callback) => {
          callback(state);
        },
        set: (obj, callback) => {
          Object.assign(state, obj);
          if (callback) callback();
        }
      }
    };
  }

  if (!chrome.runtime) {
    chrome.runtime = {
      sendMessage: (message, callback) => {
        callback(state);
      }
    };
  }

  // Load settings
  chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response) {
      // Load multi-select values if available
      if (response.sites) state.sites = response.sites;
      if (response.models) state.models = response.models;
      if (response.methods) state.methods = response.methods;
      if (response.piis) state.piis = response.piis;
    }
    
    // If no settings were found, use the defaults from the state object
    
    // Update UI for multi-selects
    updateAllSelections();
    
    // Send the initial configuration to backend (including defaults)
    sendConfigToBackend();
  });
  
  // Setup dropdowns
  setupDropdowns();
  
  // Check connection to the Python backend
  checkConnection();
});

// Check connection to Python backend
checkConnectionBtn.addEventListener('click', checkConnection);

async function checkConnection() {
  try {
    // Replace with your actual backend API URL
    const response = await fetch('http://localhost:5000/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      statusIndicator.classList.add('active');
      connectionStatus.textContent = 'Connected to anonymization service';
    } else {
      statusIndicator.classList.remove('active');
      connectionStatus.textContent = 'Service unavailable';
    }
  } catch (error) {
    console.error('Connection check failed:', error);
    statusIndicator.classList.remove('active');
    connectionStatus.textContent = 'Cannot connect to service';
  }
}

// Setup dropdowns
function setupDropdowns() {
  dropdowns.forEach(dropdown => {
    const box = document.getElementById(dropdown.boxId);
    const list = document.getElementById(dropdown.listId);
    
    // Toggle dropdown on click
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      list.classList.toggle('active');
      
      // Close other dropdowns
      dropdowns.forEach(otherDropdown => {
        if (otherDropdown.name !== dropdown.name) {
          document.getElementById(otherDropdown.listId).classList.remove('active');
        }
      });
    });
    
    // Handle checkbox changes
    const checkboxes = list.querySelectorAll('input[type="checkbox"]:not([disabled])');
    checkboxes.forEach(checkbox => {
      // Set initial state based on default values
      checkbox.checked = state[dropdown.name].includes(checkbox.value);
      
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        updateSelection(dropdown.name, checkbox.value, checkbox.checked);
      });
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
    dropdowns.forEach(dropdown => {
      document.getElementById(dropdown.listId).classList.remove('active');
    });
  });
}

// Update selection state
function updateSelection(dropdownName, value, isSelected) {
  if (isSelected) {
    if (!state[dropdownName].includes(value)) {
      state[dropdownName].push(value);
    }
  } else {
    state[dropdownName] = state[dropdownName].filter(item => item !== value);
  }
  
  updateSelectionUI(dropdownName);
  
  // Save to storage
  const update = {};
  update[dropdownName] = state[dropdownName];
  chrome.storage.local.set(update, () => {
    console.log(`${dropdownName} settings updated:`, state[dropdownName]);
    sendConfigToBackend();
  });
}

// Update UI for a single dropdown
function updateSelectionUI(dropdownName) {
  const selectedContainer = document.getElementById(`selected${dropdownName.charAt(0).toUpperCase() + dropdownName.slice(1)}`);
  const placeholder = document.querySelector(`#${dropdownName}Box .placeholder`);
  
  selectedContainer.innerHTML = '';
  
  if (state[dropdownName].length > 0) {
    placeholder.style.display = 'none';
    
    state[dropdownName].forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'selected-tag';
      tag.innerHTML = `${item} <span class="remove">×</span>`;
      
      tag.querySelector('.remove').addEventListener('click', (e) => {
        e.stopPropagation();
        // Find and uncheck the checkbox - fix the id generation
        let itemId = item.toLowerCase().replace(/\s+/g, '-');
        // Remove 's' at the end for specific types that might cause issues
        if (dropdownName === 'piis') {
          // For PIIs, the HTML IDs are like "pii-name" not "pii-names"
          if (itemId === 'names') itemId = 'name';
          else if (itemId === 'emails') itemId = 'email';
          else if (itemId === 'addresses') itemId = 'address';
          else if (itemId === 'phone-numbers') itemId = 'phone';
          // SSN already correct
        }
        
        const checkbox = document.getElementById(`${dropdownName.slice(0, -1)}-${itemId}`);
        if (checkbox) {
          checkbox.checked = false;
        } else {
          console.warn(`Checkbox not found: ${dropdownName.slice(0, -1)}-${itemId}`);
        }
        updateSelection(dropdownName, item, false);
      });
      
      selectedContainer.appendChild(tag);
    });
  } else {
    placeholder.style.display = 'inline';
  }
  
  // Update checkboxes to match state
  const list = document.getElementById(`${dropdownName}List`);
  const checkboxes = list.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = state[dropdownName].includes(checkbox.value);
  });
}

// Update all selections UI
function updateAllSelections() {
  dropdowns.forEach(dropdown => {
    updateSelectionUI(dropdown.name);
  });
}

// Send configuration to backend
async function sendConfigToBackend() {
  try {
    const config = {
      sites: state.sites,
      models: state.models,
      methods: state.methods,
      piis: state.piis
    };
    
    console.log('Sending config to backend:', config);
    
    const response = await fetch('http://localhost:5000/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config)
    });
    
    if (response.ok) {
      console.log('Configuration sent to backend successfully');
    } else {
      console.error('Failed to send configuration to backend');
    }
  } catch (error) {
    console.error('Error sending configuration to backend:', error);
  }
}

// Toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('extensionToggle');
  const toggleStatus = document.getElementById('toggleStatus');
  
  // Load the saved state
  chrome.storage.local.get(['extensionEnabled'], (result) => {
    // Default to enabled if not set
    const isEnabled = result.extensionEnabled !== undefined ? result.extensionEnabled : true;
    toggleSwitch.checked = isEnabled;
    updateToggleUI(isEnabled);
  });
  
  // Handle toggle changes
  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    
    // Update UI
    updateToggleUI(isEnabled);
    
    // Save state
    chrome.storage.local.set({ extensionEnabled: isEnabled }, () => {
      console.log(`Extension ${isEnabled ? 'enabled' : 'disabled'}`);
    });
    
    // Send to backend
    sendExtensionStatusToBackend(isEnabled);
  });
});

// Update toggle UI based on state
function updateToggleUI(isEnabled) {
  const toggleStatus = document.getElementById('toggleStatus');
  
  if (isEnabled) {
    toggleStatus.textContent = 'Enabled';
    toggleStatus.className = 'status-text enabled';
  } else {
    toggleStatus.textContent = 'Disabled';
    toggleStatus.className = 'status-text disabled';
  }
}

// Send extension status to backend
async function sendExtensionStatusToBackend(isEnabled) {
  try {
    const response = await fetch('http://localhost:5000/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extensionEnabled: isEnabled })
    });
    
    if (response.ok) {
      console.log(`Extension status sent to backend: ${isEnabled}`);
    } else {
      console.error('Failed to send extension status to backend');
    }
  } catch (error) {
    console.error('Error sending extension status to backend:', error);
  }
}