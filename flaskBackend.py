from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from faker import Faker
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Initialize Presidio engines
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

# Initialize Faker
fake = Faker()

# Directory to store mapping files
MAPPINGS_DIR = 'mappings'
os.makedirs(MAPPINGS_DIR, exist_ok=True)

# Path to the ChatGPT mapping file
CHATGPT_MAPPING_FILE = os.path.join(MAPPINGS_DIR, "chatgpt.json")

# Generic URL that should be updated when specific URL is available
GENERIC_URL = "https://chatgpt.com/"

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# New endpoint to get mappings
@app.route('/get_mappings', methods=['GET'])
def get_mappings():
    """Return all mappings from the JSON file"""
    mappings = load_chatgpt_mappings()
    return jsonify(mappings)

def get_fake_value(entity_type, original_value):
    """Generate appropriate fake value based on entity type"""
    if entity_type == "PERSON":
        return fake.name()
    elif entity_type == "EMAIL_ADDRESS":
        return fake.email()
    elif entity_type == "PHONE_NUMBER":
        return fake.phone_number()
    elif entity_type == "CREDIT_CARD":
        return fake.credit_card_number()
    elif entity_type == "US_SSN":
        return fake.ssn()
    elif entity_type == "US_BANK_NUMBER":
        return fake.bban()
    elif entity_type == "LOCATION":
        return fake.city()
    elif entity_type == "IP_ADDRESS":
        return fake.ipv4()
    elif entity_type == "DATE_TIME":
        return fake.date()
    else:
        # Default case
        return f"FAKE_{entity_type}"

def load_chatgpt_mappings():
    """Load existing ChatGPT mappings or create an empty dict if file doesn't exist"""
    if os.path.exists(CHATGPT_MAPPING_FILE):
        try:
            with open(CHATGPT_MAPPING_FILE, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            # File exists but is invalid JSON
            return {}
    else:
        # File doesn't exist
        return {}

def save_chatgpt_mappings(mappings):
    """Save ChatGPT mappings to file"""
    try:
        with open(CHATGPT_MAPPING_FILE, 'w') as f:
            json.dump(mappings, f, indent=2)
        print(f"Successfully saved mappings to {CHATGPT_MAPPING_FILE}")
        return True
    except Exception as e:
        print(f"Error saving mappings: {e}")
        return False

@app.route('/config', methods=['POST'])
def update_config():
    """Update the anonymization configuration"""
    try:
        config = request.json
        
        if not config:
            return jsonify({"error": "No configuration provided"}), 400
        
        # Validate configuration
        if not all(key in config for key in ['sites', 'models', 'methods', 'piis']):
            return jsonify({"error": "Invalid configuration. Missing required fields"}), 400
        
        # Log the configuration for debugging
        print(f"Received configuration: {json.dumps(config, indent=2)}")
        
        # Store the configuration (you might want to persist this to disk)
        # For now, we'll use a global variable
        app.config['ANONYMIZATION_CONFIG'] = config
        
        # Apply the configuration to the analyzer settings
        # This depends on how your anonymization logic works - below is an example
        
        # Example: Update entities list based on PIIs selection
        entity_mapping = {
            "Names": "PERSON",
            "Emails": "EMAIL_ADDRESS",
            "Phone Numbers": "PHONE_NUMBER",
            "Addresses": "LOCATION",
            "SSN": "US_SSN"
        }
        
        selected_entities = []
        for pii in config.get('piis', []):
            if pii in entity_mapping:
                selected_entities.append(entity_mapping[pii])
        
        # If no PIIs are selected, default to all
        if not selected_entities:
            selected_entities = list(entity_mapping.values())
        
        # Store the entities for use in the anonymize endpoint
        app.config['SELECTED_ENTITIES'] = selected_entities
        
        # Store the anonymization method
        if "Pseudonymization" in config.get('methods', []):
            app.config['ANONYMIZATION_METHOD'] = "fake"
        else:
            app.config['ANONYMIZATION_METHOD'] = "redact"
        
        return jsonify({"status": "Configuration updated successfully", "config": config})
    
    except Exception as e:
        print(f"Error updating configuration: {e}")
        return jsonify({"error": f"Failed to update configuration: {e}"}), 500

# Update the anonymize endpoint to use the configuration
@app.route('/anonymize', methods=['POST'])
def anonymize_text():
    data = request.json
    print("Received data:", data)
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    url = data.get('url', '')
    
    # Get configuration from app config or request
    config = app.config.get('ANONYMIZATION_CONFIG', {})
    if data.get('config'):
        config = data.get('config')
    
    # Determine anonymization method from config or request
    if data.get('anonymization_method'):
        anonymization_method = data.get('anonymization_method')
    else:
        anonymization_method = app.config.get('ANONYMIZATION_METHOD', 'redact')
    
    # Get selected entities from config
    selected_entities = app.config.get('SELECTED_ENTITIES', [
        "PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "US_SSN", 
        "US_BANK_NUMBER", "LOCATION", "NRP", "DATE_TIME", "IP_ADDRESS"
    ])
    
    # Default to generic URL if none provided
    if not url:
        url = GENERIC_URL
    
    # Validate anonymization method
    if anonymization_method not in ['redact', 'fake']:
        return jsonify({"error": "Invalid anonymization method. Use 'redact' or 'fake'"}), 400
    
    # Analyze text with Presidio using selected entities
    analyzer_results = analyzer.analyze(
        text=text,
        entities=selected_entities,
        language="en"
    )
    
    # First pass: Create a consistent mapping for each unique original value
    value_mapping = {}  # Maps original values to their replacements
    mapping = {}        # Maps replacements back to original values (for de-anonymization)
    
    # Sort results by position to process them in order
    sorted_results = sorted(analyzer_results, key=lambda x: x.start)
    
    for result in sorted_results:
        entity_type = result.entity_type
        original_value = text[result.start:result.end]
        
        # Check if we've already assigned a replacement for this original value
        if original_value not in value_mapping:
            if anonymization_method == "redact":
                replacement = f"[REDACTED_{entity_type}]"
            else:  # fake
                replacement = get_fake_value(entity_type, original_value)
            
            value_mapping[original_value] = replacement
            mapping[replacement] = original_value
    
    # Second pass: Apply the replacements to the text
    # We need to replace from right to left to maintain correct indices
    anonymized_text = text
    for result in sorted(analyzer_results, key=lambda x: x.start, reverse=True):
        original_value = text[result.start:result.end]
        replacement = value_mapping[original_value]
        
        # Replace just this instance
        anonymized_text = anonymized_text[:result.start] + replacement + anonymized_text[result.end:]
    
    # Load existing mappings
    mappings = load_chatgpt_mappings()
    print(f"Loaded mappings: {mappings}")
    
    # New mapping entry for this anonymization
    new_mapping_entry = {
        "anonymization_method": anonymization_method,
        "mapping": mapping,
        "config": config  # Store the configuration with the mapping for reference
    }
    
    # Check if we need to update a generic URL to a specific one
    if GENERIC_URL in mappings and url != GENERIC_URL and url.startswith("https://chatgpt.com/c/"):
        # We have a generic URL and now received a specific one
        print(f"Updating generic URL to specific URL: {url}")
        
        # Move all mappings from generic to specific URL
        if url not in mappings:
            mappings[url] = []
        
        # Append all generic URL mappings to the specific URL
        mappings[url] = mappings[GENERIC_URL]
        
        # Remove the generic URL entry
        del mappings[GENERIC_URL]
        
        # Add the new mapping to the specific URL
        mappings[url].append(new_mapping_entry)
    else:
        # Add the new mapping to the appropriate URL
        if url not in mappings:
            mappings[url] = []
        
        mappings[url].append(new_mapping_entry)
    
    # Save updated mappings
    save_chatgpt_mappings(mappings)
    
    print(f"Mapping appended for URL: {url}")
    print(anonymized_text)
    return jsonify({
        "anonymized_text": anonymized_text,
        "mapping": mapping,
        "anonymization_method": anonymization_method,
        "config": config
    })

@app.route('/deanonymize', methods=['POST'])
def deanonymize_text():
    data = request.json
    print("Deanonymize request:", data)
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    chat_url = data.get('url', '')
    
    # Load all mappings
    mappings = load_chatgpt_mappings()
    
    # Default to generic URL if none provided
    if not chat_url:
        chat_url = GENERIC_URL
    
    # Check if we have mappings for this URL
    if chat_url not in mappings:
        # If specific URL not found, try to use the generic URL or most recent URL
        if GENERIC_URL in mappings:
            chat_url = GENERIC_URL
        elif len(mappings) > 0:
            # Get any URL (last added)
            chat_url = list(mappings.keys())[-1]
        else:
            return jsonify({"error": "No mappings found"}), 404
    
    # Get the mappings for the URL
    url_mappings = mappings.get(chat_url, [])
    
    if not url_mappings:
        return jsonify({"error": f"No mappings found for URL: {chat_url}"}), 404
    
    # De-anonymize the text using all mappings for this URL
    deanonymized_text = text
    anonymization_method = "unknown"
    
    # Apply mappings in reverse order (most recent first)
    for mapping_entry in reversed(url_mappings):
        current_mapping = mapping_entry.get("mapping", {})
        anonymization_method = mapping_entry.get("anonymization_method", "unknown")
        
        # Replace all anonymized values with their original counterparts
        for anonymized, original in current_mapping.items():
            deanonymized_text = deanonymized_text.replace(anonymized, original)
    
    print(f"De-anonymized text using mapping from URL: {chat_url}")
    return jsonify({
        "deanonymized_text": deanonymized_text,
        "anonymization_method": anonymization_method
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)