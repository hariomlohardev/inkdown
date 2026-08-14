/**
 * Chat API Configuration
 * Handles storing and validating API credentials for the AI chatbot
 * Fixed: Removed max_tokens (Meta API doesn't accept it)
 */

import { $ } from './state.js';
import { toast } from './ui.js';

const CHAT_CONFIG_KEY = 'inkdown:chat-config';

// Default configuration template
const DEFAULT_CONFIG = {
  baseUrl: '',
  modelId: '',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 2048,
  enabled: false
};

let config = { ...DEFAULT_CONFIG };

/* ---------- Storage ---------- */
export function loadChatConfig() {
  try {
    const raw = localStorage.getItem(CHAT_CONFIG_KEY);
    if (raw) {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('[Chat] Failed to load config:', e);
    config = { ...DEFAULT_CONFIG };
  }
  return { ...config };
}

export function saveChatConfig(newConfig) {
  config = { ...config, ...newConfig };
  try {
    localStorage.setItem(CHAT_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('[Chat] Failed to save config:', e);
    return false;
  }
}

export function getChatConfig() {
  return { ...config };
}

export function isChatConfigured() {
  return !!(config.baseUrl && config.modelId && config.apiKey);
}

export async function testChatConfig(testConfig = null) {
  const cfg = testConfig || config;
  
  if (!cfg.baseUrl || !cfg.modelId || !cfg.apiKey) {
    return { success: false, error: 'Missing required fields' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cfg.apiKey}`
  };

  // Test 1: Chat Completions endpoint
  try {
    let chatUrl = cfg.baseUrl.replace(/\/$/, '');
    if (!chatUrl.endsWith('/chat/completions')) {
      chatUrl = chatUrl.replace(/\/responses$/, '');
      chatUrl += '/chat/completions';
    }

    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_completion_tokens: 10,
        temperature: 0.7,
        stream: false
      })
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      let errorMsg = `Chat Completions: HTTP ${chatResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
      } catch (e) {}
      return { success: false, error: errorMsg };
    }

    // Test 2: Responses endpoint (for @search)
    let responsesUrl = cfg.baseUrl.replace(/\/$/, '');
    if (!responsesUrl.endsWith('/responses')) {
      responsesUrl = responsesUrl.replace(/\/chat\/completions$/, '');
      responsesUrl += '/responses';
    }

    const responsesResponse = await fetch(responsesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.modelId,
        input: [{ role: 'user', content: 'Hi' }],
        max_output_tokens: 10,
        stream: false
      })
    });

    if (!responsesResponse.ok) {
      // Responses API is optional - don't fail if it's not available
      console.warn('Responses API not available:', await responsesResponse.text());
    }

    return { 
      success: true, 
      message: '✓ Connected to Meta AI API (Chat Completions' + 
               (responsesResponse.ok ? ' + Responses)' : ')')
    };

  } catch (e) {
    return { success: false, error: e.message || 'Connection failed' };
  }
}

/* ---------- UI Integration ---------- */
export function initChatSettings() {
  loadChatConfig();

  const baseUrlInput = $('#chatBaseUrl');
  const modelIdInput = $('#chatModelId');
  const apiKeyInput = $('#chatApiKey');
  const tempInput = $('#chatTemperature');
  const maxTokensInput = $('#chatMaxTokens');
  const testBtn = $('#chatTestConfig');
  const saveBtn = $('#chatSaveConfig');

  if (!baseUrlInput || !modelIdInput || !apiKeyInput) return;

  // Populate fields
  baseUrlInput.value = config.baseUrl;
  modelIdInput.value = config.modelId;
  apiKeyInput.value = config.apiKey;
  if (tempInput) tempInput.value = config.temperature;
  if (maxTokensInput) maxTokensInput.value = config.maxTokens;

  // Test button
  if (testBtn) {
    testBtn.onclick = async () => {
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';

      const testConfig = {
        baseUrl: baseUrlInput.value.trim(),
        modelId: modelIdInput.value.trim(),
        apiKey: apiKeyInput.value.trim()
      };

      const result = await testChatConfig(testConfig);

      testBtn.disabled = false;
      testBtn.textContent = 'Test Configuration';

      if (result.success) {
        toast(result.message, 'success');
      } else {
        toast('Test failed: ' + result.error, 'error');
      }
    };
  }

  // Save button
  if (saveBtn) {
    saveBtn.onclick = () => {
      const newConfig = {
        baseUrl: baseUrlInput.value.trim(),
        modelId: modelIdInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        temperature: parseFloat(tempInput?.value) || 0.7,
        maxTokens: parseInt(maxTokensInput?.value) || 2048,
        enabled: true
      };

      if (!newConfig.baseUrl || !newConfig.modelId || !newConfig.apiKey) {
        toast('Please fill in all required fields', 'warn');
        return;
      }

      if (saveChatConfig(newConfig)) {
        toast('Chat configuration saved', 'success');
        document.dispatchEvent(new CustomEvent('chat:config-updated'));
      } else {
        toast('Failed to save configuration', 'error');
      }
    };
  }

  console.log('[Chat] Settings initialized');
}