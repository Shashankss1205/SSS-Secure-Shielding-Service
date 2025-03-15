# SSS-Secure-Shielding-Service-
Protect your privacy while using AI! This browser extension auto-detects and anonymizes personal data before it's sent to LLMs like ChatGPT &amp; Claude—keeping your identity safe without losing AI’s power!

## Inspiration
With the increasing reliance on AI-driven language models like ChatGPT, Claude, DeepSeek and Gemini, privacy concerns are at an all-time high. Users often share sensitive data without realizing the risks of exposure. We wanted to create a solution that allows people to benefit from AI while maintaining full control over their personal information.

## What it does
SSS (Secure Shielding Service) is a browser extension that anonymizes user data before it is sent to AI model services like www.chatgpt.com, www.claude.ai etc. It detects and replaces personally identifiable information (PII) using an advanced anonymization analyzer. Whether you’re chatting with AI for work, research, or fun, SSS ensures your data stays private across all major browsers and LLMs.

## How we built it
We developed SSS using Flask for the backend and integrated 2 methods: "Presidio Analyzer" and "Mistral 3B model on device" to detect and anonymize PII. The system employs Faker to generate realistic fake data for pseudonymization. Mappings of anonymized data are securely stored, allowing for de-anonymization when needed. We designed it to work seamlessly across various AI platforms and LLM models.

## Challenges we ran into
Ensuring accuracy in PII detection: Choosing the Presidio Analyzer to detect different data types effectively.
Balancing privacy and usability: Anonymizing data while ensuring the AI model still provides meaningful responses.
Cross-browser compatibility: Making sure the extension works smoothly on Chrome, Firefox, Edge, and more.
Handling different AI models and websites: Adapting the anonymization process to work effectively with various LLMs services like DeepSeek, Claude, Chatgpt, Gemini required a lot of time and hardwork.

## Accomplishments that we're proud of
1. Successfully developing a real-time anonymization system that works across multiple LLMs services.
2. Creating a seamless browser extension that integrates easily into users' AI interactions.
3. Enabling both pseudonymization (fake data replacement) and redaction based on user preferences.
4. Designing a secure, configurable system that allows users to define what data gets anonymized.

## What we learned
- The importance of flexibility in privacy settings, as different users have different levels of comfort with data exposure.
- How to fine-tune AI models for effective entity recognition and anonymization.
- The challenges of cross-browser and cross-platform development for a privacy-focused tool.

## What's next for SSS (Secure Shielding Service) 
1. Expanding support for more AI models and platforms beyond ChatGPT, and Claude.
2. Adding user-defined anonymization rules, allowing even more control over privacy.
3. Enhancing speed and efficiency to ensure real-time performance without delays.
4. Exploring enterprise-level solutions for businesses handling sensitive data with AI.


# SETUP

1. ```git clone https://github.com/Shashankss1205/SSS-Secure-Shielding-Service.git```
2. ```cd SSS-Secure-Shielding-Service/```
3. ```python3 flaskBackend.py``` OR ```python flaskBackend.py```
4. Open Chrome
5. Search for ```chrome://extensions/```
6. Click on 'Load Unpacked'
7. Select the folder named "SSS-Secure-Shielding-Service".
8. Open Chatgpt and you are good to go!!