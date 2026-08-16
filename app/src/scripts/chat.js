/**
 * AI Chatbot for Markdown Documents
 * Meta Model API Integration (https://dev.meta.ai/docs)
 *
 * Corrections vs. the previous version, per Meta's actual docs:
 *  - Search grounding only exists on the Responses API (/v1/responses), NOT
 *    Chat Completions. Sending `search: {enabled:true}` to /chat/completions
 *    is not a real param and returns HTTP 400. @search now routes to a
 *    separate Responses API call with `tools: [{ type: 'web_search' }]`.
 *  - `reasoning_effort` is a top-level string param
 *    ("minimal"|"low"|"medium"|"high"|"xhigh"), not a nested
 *    `reasoning: { effort }` object. Muse Spark always reasons, so
 *    "none" is invalid and returns 400 - it's simply omitted by default.
 *  - Prompt caching is automatic server-side prefix caching. There is no
 *    `X-Prompt-Cache-Id` header and no Anthropic-style `cache_control`
 *    block on this protocol. The only lever is an optional top-level
 *    `prompt_cache_key` - a stable string per app/use-case, not per-request.
 *  - `max_tokens` is a deprecated alias; the canonical field is
 *    `max_completion_tokens` on Chat Completions and `max_output_tokens`
 *    on the Responses API.
 *  - `developer` is the preferred role for standing instructions (same
 *    precedence as `system`, which is only kept for OpenAI compatibility).
 */

import { $, state } from './state.js';
import { getChatConfig, isChatConfigured, loadChatConfig } from './chat-settings.js';
import { toast } from './ui.js';

let chatMessages = []; // [{role, content, citations?}]
let isStreaming = false;
let abortController = null;
let pinpointSelection = null;
let chatOpen = false;
let chatWidth = 400;
let autocompleteIndex = -1;

/* ---------- Chat Flags ---------- */
const FLAGS = {
  '@search': {
    icon: '🔍',
    description: 'Search the web for current information (via Responses API)',
    // Meta only supports tool_choice: 'auto'. The prompt already instructs
    // the model to search, so it will reliably use the web_search tool.
    apiParam: {
        useResponses: true,
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto'
    },
    transform: (prompt) => `You MUST use the web_search tool to find current, up-to-date information. Cite your sources. Question: ${prompt}`
    },
  '@insimpleterms': {
    icon: '🧒',
    description: 'Explain in simple, easy-to-understand terms',
    transform: (prompt) => `Please explain the following in simple, easy-to-understand terms, avoiding jargon where possible:\n\n${prompt}`
  },
  '@inshort': {
    icon: '⚡',
    description: 'Provide a brief, concise response (2-3 sentences)',
    transform: (prompt) => `Please provide a brief, concise response (2-3 sentences max) to the following:\n\n${prompt}`
  },
  '@deep': {
    icon: '🧠',
    description: 'Deep reasoning with high effort',
    apiParam: { reasoning_effort: 'high' },
    transform: (prompt) => `Think through this step-by-step with deep reasoning before answering:\n\n${prompt}`
  },
  '@pinpoint': {
    icon: '📍',
    description: 'Focus on a specific selected section (Ctrl+Click)',
    transform: (prompt) => {
      if (pinpointSelection) {
        return `Focus specifically on this section from the document:\n\n"""\n${pinpointSelection}\n"""\n\nQuestion: ${prompt}`;
      }
      return prompt;
    }
  },
  '@code': {
    icon: '💻',
    description: 'Generate or explain code',
    transform: (prompt) => `Provide a well-commented code solution with explanation. Use markdown code blocks. Question: ${prompt}`
  }
};

// Tool definitions for Chat Completions function calling (OpenAI-style shape).
// Note: the Responses API uses a flatter tool shape ({type, name, description,
// parameters} - no nested "function" wrapper), so this array is only used
// on the Chat Completions branch.
const AVAILABLE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_document',
      description: 'Search within the current markdown document for specific content',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  }
];

/* ---------- System Prompt Builder ---------- */
function buildSystemPrompt() {
  const docContent = state.md || '';
  const docName = state.name || 'untitled.md';

  return `You are Inkdown AI, an expert assistant helping with a markdown document called "${docName}".

DOCUMENT CONTENT:
"""
${docContent}
"""

Guidelines:
1. Reference specific sections from the document using quotes when relevant
2. Use the document's terminology and style
3. Be accurate — if something isn't in the document, say so clearly
4. Be helpful, concise, and professional
5. Use markdown formatting (bold, lists, code blocks) for clarity
6. When asked to search the web, prioritize search results with citations`;
}

// Prompt caching is automatic, but a stable prompt_cache_key increases the
// odds of landing on a backend that already holds this doc's prefix.
// Must be a fixed string per app/use-case - NOT per-request or per-user.
function getCacheKey() {
  const name = (state.name || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `inkdown-doc-${name || 'session'}`;
}

/* ---------- Message Processing ---------- */
function processUserMessage(text) {
  let processedText = text;
  const activeFlags = [];
  const apiParams = {};

  for (const [flag, config] of Object.entries(FLAGS)) {
    if (processedText.includes(flag)) {
      activeFlags.push(flag);
      processedText = processedText.replace(flag, '').trim();
      processedText = config.transform(processedText);

      if (config.apiParam) {
        Object.assign(apiParams, config.apiParam);
      }
    }
  }

  return { text: processedText, flags: activeFlags, apiParams };
}

/* ---------- Shared error handling ---------- */
async function throwForBadResponse(response) {
  const errorText = await response.text();
  let errorMsg = `HTTP ${response.status}`;
  try {
    const errorJson = JSON.parse(errorText);
    errorMsg = errorJson.error?.message || errorJson.message || errorMsg;
  } catch (e) {}
  throw new Error(errorMsg);
}

/* ---------- Chat Completions (/v1/chat/completions) ---------- */
async function sendChatCompletionsMessage(message, onChunk, config, apiParams) {
  let url = config.baseUrl.replace(/\/$/, '');
  if (!url.endsWith('/chat/completions')) {
    url = url.replace(/\/responses$/, '');
    url += '/chat/completions';
  }

  // "developer" is the highest-precedence role for standing instructions.
  // "system" is only accepted for OpenAI compatibility and carries the
  // same precedence, so there's no reason to prefer it here.
  const messages = [
    { role: 'developer', content: buildSystemPrompt() }
  ];

  const recentHistory = chatMessages.slice(-10);
  recentHistory.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content });
  });

  messages.push({ role: 'user', content: message });

  const payload = {
    model: config.modelId,
    messages,
    temperature: config.temperature,
    stream: true,
    prompt_cache_key: getCacheKey()
  };

  // reasoning_effort is top-level. Muse Spark always reasons, so we only
  // ever set this when a flag asks for more effort - never "none".
  if (apiParams.reasoning_effort) {
    payload.reasoning_effort = apiParams.reasoning_effort;
  }

  if (config.maxTokens) {
    payload.max_completion_tokens = Number(config.maxTokens);
  }

  if (apiParams.use_tools) {
    payload.tools = AVAILABLE_TOOLS;
    payload.tool_choice = 'auto';
  }

  abortController = new AbortController();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: abortController.signal
  });

  if (!response.ok) {
    await throwForBadResponse(response);
  }

  return await parseChatCompletionsStream(response, onChunk);
}

/* ---------- Responses API (/v1/responses) ---------- */
// Used for @search (search grounding) and anything else that needs the
// agentic Responses surface. Chat Completions has no search tool.
async function sendResponsesMessage(message, onChunk, config, apiParams) {
  let url = config.baseUrl.replace(/\/$/, '');
  if (!url.endsWith('/responses')) {
    url = url.replace(/\/chat\/completions$/, '');
    url += '/responses';
  }

  const input = [];
  const recentHistory = chatMessages.slice(-10);
  recentHistory.forEach(msg => {
    input.push({ role: msg.role, content: msg.content });
  });
  input.push({ role: 'user', content: message });

  const payload = {
    model: config.modelId,
    instructions: buildSystemPrompt(),
    input,
    tools: apiParams.tools || [{ type: 'web_search' }],
    tool_choice: apiParams.tool_choice || 'auto',
    stream: true,
    prompt_cache_key: getCacheKey()
  };

  if (apiParams.reasoning_effort) {
    payload.reasoning_effort = apiParams.reasoning_effort;
  }

  if (config.maxTokens) {
    payload.max_output_tokens = Number(config.maxTokens);
  }

  abortController = new AbortController();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: abortController.signal
  });

  if (!response.ok) {
    await throwForBadResponse(response);
  }

  return await parseResponsesStream(response, onChunk);
}

/* ---------- Dispatcher ---------- */
async function sendMessage(message, onChunk, apiParams = {}) {
  const config = getChatConfig();

  if (!isChatConfigured()) {
    throw new Error('Chat API not configured. Please set up your API credentials in Settings.');
  }

  if (apiParams.useResponses) {
    return await sendResponsesMessage(message, onChunk, config, apiParams);
  }
  return await sendChatCompletionsMessage(message, onChunk, config, apiParams);
}

/* ---------- Chat Completions SSE Parser ---------- */
// Standard OpenAI-compatible shape: one `data: {...}` line per chunk,
// content lives at choices[0].delta.content, stream ends with `data: [DONE]`.
async function parseChatCompletionsStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onChunk(fullText);
        }
      } catch (e) {
        // Ignore parse errors for incomplete JSON chunks
      }
    }
  }

  // Fallback: if streaming never produced deltas, try parsing what's left
  // as a plain (non-streamed) response.
  if (!fullText && buffer) {
    try {
      const data = JSON.parse(buffer);
      fullText = data.choices?.[0]?.message?.content || '';
      if (fullText) onChunk(fullText);
    } catch (e) {}
  }

  return { text: fullText, citations: [] };
}

/* ---------- Responses API SSE Parser ---------- */
// Semantic, typed events rather than raw deltas-only chunks. Each event is
// `event: <name>` then `data: {...}` then a blank line; the JSON payload
// also carries its own "type" field, so we just read that off the data line
// and ignore the separate `event:` line.
async function parseResponsesStream(response, onChunk) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  const citations = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue; // skip blank lines & "event:" lines

      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        continue; // incomplete JSON chunk, wait for more data
      }

      if (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string') {
        fullText += parsed.delta;
        onChunk(fullText);
      } else if (parsed.type === 'response.completed') {
        const outputs = parsed.response?.output || [];
        for (const item of outputs) {
          if (item.type !== 'message' || !Array.isArray(item.content)) continue;
          for (const part of item.content) {
            if (!Array.isArray(part.annotations)) continue;
            for (const a of part.annotations) {
              if (a.type === 'url_citation' && a.url) {
                citations.push({ url: a.url, title: a.title || a.url });
              }
            }
          }
        }
        // Prefer the server's assembled output_text as the source of truth.
        if (typeof parsed.response?.output_text === 'string') {
          fullText = parsed.response.output_text;
          onChunk(fullText);
        }
      } else if (parsed.type === 'response.failed' || parsed.type === 'error') {
        const msg = parsed.response?.error?.message || parsed.error?.message || 'Response failed';
        throw new Error(msg);
      }
    }
  }

  return { text: fullText, citations };
}

/* ---------- UI Rendering ---------- */
function renderUserMessage(message) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message user';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chat-message-content';
  contentDiv.textContent = message.content;

  msgDiv.appendChild(contentDiv);

  if (message.flags && message.flags.length > 0) {
    const flagsDiv = document.createElement('div');
    flagsDiv.className = 'chat-message-flags';
    message.flags.forEach(flag => {
      const flagSpan = document.createElement('span');
      flagSpan.className = 'chat-flag';
      const cfg = FLAGS[flag];
      flagSpan.innerHTML = cfg ? `${cfg.icon} ${flag}` : flag;
      flagsDiv.appendChild(flagSpan);
    });
    msgDiv.appendChild(flagsDiv);
  }

  return msgDiv;
}

function renderAssistantMessage(content, isStreaming = false, citations = []) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message assistant';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chat-message-content';

  if (content && window.marked) {
    contentDiv.innerHTML = window.marked.parse(content);
  } else {
    contentDiv.textContent = content || '';
  }

  msgDiv.appendChild(contentDiv);

  if (isStreaming) {
    const cursor = document.createElement('span');
    cursor.className = 'chat-cursor';
    contentDiv.appendChild(cursor);
  }

  if (!isStreaming && citations && citations.length > 0) {
    const sourcesDiv = document.createElement('div');
    sourcesDiv.className = 'chat-message-sources';
    const label = document.createElement('div');
    label.className = 'chat-sources-label';
    label.textContent = 'Sources';
    sourcesDiv.appendChild(label);

    citations.forEach(c => {
      const link = document.createElement('a');
      link.href = c.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'chat-source-link';
      link.textContent = c.title;
      sourcesDiv.appendChild(link);
    });

    msgDiv.appendChild(sourcesDiv);
  }

  return msgDiv;
}

function renderThinkingIndicator(isSearching = false) {
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'chat-message assistant';
  thinkingDiv.id = 'chatThinking';

  thinkingDiv.innerHTML = `
    <div class="chat-thinking">
      <div class="chat-thinking-dots">
        <span class="chat-thinking-dot"></span>
        <span class="chat-thinking-dot"></span>
        <span class="chat-thinking-dot"></span>
      </div>
      <span class="chat-thinking-text">${isSearching ? '🔍 Searching the web...' : 'Thinking...'}</span>
    </div>
  `;

  return thinkingDiv;
}

function renderChatHistory() {
  const historyDiv = $('#chatHistory');
  if (!historyDiv) return;

  historyDiv.innerHTML = '';

  if (chatMessages.length === 0) {
    historyDiv.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-title">Ask me anything</div>
        <div class="chat-empty-desc">
          I have full context of your document.<br>
          Type <code>@</code> for commands.
        </div>
      </div>
    `;
    return;
  }

  chatMessages.forEach(msg => {
    if (msg.role === 'user') {
      historyDiv.appendChild(renderUserMessage(msg));
    } else {
      historyDiv.appendChild(renderAssistantMessage(msg.content, false, msg.citations || []));
    }
  });

  historyDiv.scrollTop = historyDiv.scrollHeight;
}

function updateChatStatus(text) {
  const statusEl = $('#chatStatus');
  if (statusEl) statusEl.textContent = text;
}

/* ---------- Chat Actions ---------- */
export async function sendChatMessage() {
  const input = $('#chatInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text || isStreaming) return;

  if (!isChatConfigured()) {
    toast('Please configure your AI API in Settings', 'warn');
    return;
  }

  const processed = processUserMessage(text);
  const isSearching = processed.flags.includes('@search');

  const userMessage = {
    role: 'user',
    content: text,
    flags: processed.flags
  };
  chatMessages.push(userMessage);

  input.value = '';
  input.style.height = 'auto';
  renderChatHistory();
  hideAutocomplete();

  const historyDiv = $('#chatHistory');
  historyDiv.appendChild(renderThinkingIndicator(isSearching));
  historyDiv.scrollTop = historyDiv.scrollHeight;
  updateChatStatus(isSearching ? '🔍 Searching...' : 'Thinking...');

  isStreaming = true;
  updateSendButton();

  let currentAssistantContent = '';

  try {
    const result = await sendMessage(
      processed.text,
      (partialText) => {
        // Remove thinking indicator on first chunk
        const thinking = $('#chatThinking');
        if (thinking) thinking.remove();

        currentAssistantContent = partialText;

        let msgElement = historyDiv.querySelector('#currentAssistant');
        if (!msgElement) {
          msgElement = renderAssistantMessage(partialText, true);
          msgElement.id = 'currentAssistant';
          historyDiv.appendChild(msgElement);
        }

        const contentDiv = msgElement.querySelector('.chat-message-content');
        if (window.marked) {
          contentDiv.innerHTML = window.marked.parse(partialText);
        } else {
          contentDiv.textContent = partialText;
        }

        const cursor = document.createElement('span');
        cursor.className = 'chat-cursor';
        contentDiv.appendChild(cursor);

        historyDiv.scrollTop = historyDiv.scrollHeight;
      },
      processed.apiParams
    );

    const thinking = $('#chatThinking');
    if (thinking) thinking.remove();

    // Finalize assistant message (remove streaming cursor + id)
    const msgElement = historyDiv.querySelector('#currentAssistant');
    if (msgElement) msgElement.remove();

    const finalText = result.text || currentAssistantContent;
    const finalCitations = result.citations || [];

    historyDiv.appendChild(renderAssistantMessage(finalText, false, finalCitations));
    historyDiv.scrollTop = historyDiv.scrollHeight;

    chatMessages.push({ role: 'assistant', content: finalText, citations: finalCitations });

    updateChatStatus(isSearching ? 'Search complete' : 'Ready');
    setTimeout(() => updateChatStatus('Ready'), 2000);

  } catch (e) {
    const thinking = $('#chatThinking');
    if (thinking) thinking.remove();

    const msgElement = historyDiv.querySelector('#currentAssistant');
    if (msgElement) msgElement.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'chat-message assistant';

    if (e.name === 'AbortError') {
      errorDiv.innerHTML = '<div class="chat-aborted">⏹ Response stopped</div>';
      updateChatStatus('Stopped');
    } else {
      errorDiv.innerHTML = `<div class="chat-error">⚠ ${e.message}</div>`;
      updateChatStatus('Error');
    }

    historyDiv.appendChild(errorDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;

    // Remove the failed user message from history so retry works
    chatMessages.pop();
  } finally {
    isStreaming = false;
    abortController = null;
    updateSendButton();
    pinpointSelection = null;
  }
}

export function stopChatStream() {
  if (abortController) {
    abortController.abort();
  }
}

function updateSendButton() {
  const sendBtn = $('#chatSend');
  if (!sendBtn) return;

  if (isStreaming) {
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
    sendBtn.title = 'Stop';
  } else {
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    sendBtn.title = 'Send';
  }
}

/* ---------- @ Autocomplete ---------- */
function showAutocomplete() {
  const dropdown = $('#chatAutocomplete');
  const list = $('#chatAutocompleteList');
  if (!dropdown || !list) return;

  list.innerHTML = '';
  autocompleteIndex = -1;

  // Group commands by category
  const groups = {
    'Search & Web': ['@search'],
    'Response Style': ['@insimpleterms', '@inshort', '@deep'],
    'Focus & Code': ['@pinpoint', '@code']
  };

  let firstGroup = true;

  for (const [groupName, flags] of Object.entries(groups)) {
    // Add divider between groups (not before first)
    if (!firstGroup) {
      const divider = document.createElement('div');
      divider.className = 'chat-autocomplete-divider';
      list.appendChild(divider);
    }
    firstGroup = false;

    // Group label (subtle)
    const groupLabel = document.createElement('div');
    groupLabel.style.cssText = 'padding: 6px 12px 2px; font-size: 10px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
    groupLabel.textContent = groupName;
    list.appendChild(groupLabel);

    // Add items
    flags.forEach(flag => {
      const config = FLAGS[flag];
      if (!config) return;

      const item = document.createElement('div');
      item.className = 'chat-autocomplete-item';
      item.dataset.flag = flag;
      
      item.innerHTML = `
        <div class="cmd-icon">${config.icon}</div>
        <div class="cmd-text">
          <div class="cmd-name">${flag}</div>
          <div class="cmd-desc">${config.description}</div>
        </div>
      `;
      
      item.onclick = () => insertFlag(flag);
      list.appendChild(item);
    });
  }

  dropdown.classList.add('open');
}

function hideAutocomplete() {
  const dropdown = $('#chatAutocomplete');
  if (dropdown) dropdown.classList.remove('open');
  autocompleteIndex = -1;
}

function insertFlag(flag) {
  const input = $('#chatInput');
  if (!input) return;

  const currentValue = input.value;
  const atIndex = currentValue.lastIndexOf('@');

  if (atIndex !== -1) {
    input.value = currentValue.substring(0, atIndex) + flag + ' ';
  } else {
    input.value = currentValue + flag + ' ';
  }

  input.focus();
  hideAutocomplete();
}

function navigateAutocomplete(direction) {
  const list = $('#chatAutocompleteList');
  if (!list) return;

  const items = list.querySelectorAll('.chat-autocomplete-item');
  if (items.length === 0) return;

  items.forEach(item => item.classList.remove('selected'));

  if (direction === 'down') {
    autocompleteIndex = (autocompleteIndex + 1) % items.length;
  } else {
    autocompleteIndex = (autocompleteIndex - 1 + items.length) % items.length;
  }

  items[autocompleteIndex].classList.add('selected');
  items[autocompleteIndex].scrollIntoView({ block: 'nearest' });
}

function selectAutocompleteItem() {
  const list = $('#chatAutocompleteList');
  if (!list) return false;

  const items = list.querySelectorAll('.chat-autocomplete-item');
  if (autocompleteIndex >= 0 && autocompleteIndex < items.length) {
    const flag = items[autocompleteIndex].dataset.flag;
    insertFlag(flag);
    return true;
  }
  return false;
}

function filterAutocomplete(query) {
  const list = $('#chatAutocompleteList');
  if (!list) return;

  const items = list.querySelectorAll('.chat-autocomplete-item');
  let visibleCount = 0;

  items.forEach(item => {
    const flag = item.dataset.flag.toLowerCase();
    const desc = item.querySelector('.cmd-desc').textContent.toLowerCase();

    if (flag.includes(query) || desc.includes(query)) {
      item.style.display = 'flex';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  if (visibleCount === 0) hideAutocomplete();
}

/* ---------- Chat Panel Toggle ---------- */
export function toggleChat() {
  chatOpen = !chatOpen;
  updateChatVisibility();
}

export function openChat() { chatOpen = true; updateChatVisibility(); }
export function closeChat() { chatOpen = false; updateChatVisibility(); }

function updateChatVisibility() {
  const chatPanel = $('#chatPanel');
  const chatBtn = $('#chatToggle');

  if (!chatPanel) return;

  if (chatBtn) {
    chatBtn.setAttribute('aria-expanded', String(chatOpen));
    chatBtn.setAttribute(
      'aria-label',
      chatOpen ? 'Close chat (Ctrl+Space)' : 'Open chat (Ctrl+Space)'
    );
  }

  if (chatOpen) {
    chatPanel.style.display = 'flex';
    chatPanel.style.width = chatWidth + 'px';
    if (chatBtn) chatBtn.classList.add('active');

    const input = $('#chatInput');
    if (input) setTimeout(() => input.focus(), 100);
  } else {
    chatPanel.style.display = 'none';
    if (chatBtn) chatBtn.classList.remove('active');
  }
}

/* ---------- Pinpoint Feature ---------- */
function setupPinpoint() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Control') {
      document.body.classList.add('pinpoint-mode');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!e.ctrlKey) {
      document.body.classList.remove('pinpoint-mode');
    }
  });

  if (state.docEl) {
    state.docEl.addEventListener('click', (e) => {
      if (!e.ctrlKey || !chatOpen) return;

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        pinpointSelection = selection.toString().trim();
        toast('📍 Text pinned for @pinpoint', 'success');
      } else {
        const target = e.target;
        if (target.textContent) {
          pinpointSelection = target.textContent.trim().substring(0, 500);
          toast('📍 Element pinned for @pinpoint', 'success');
        }
      }
    });
  }
}

/* ---------- Resizable Panel ---------- */
function setupResizable() {
  const chatPanel = $('#chatPanel');
  const resizeHandle = $('#chatResizeHandle');
  if (!chatPanel || !resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = chatPanel.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const diff = startX - e.clientX;
    const newWidth = Math.max(320, Math.min(800, startWidth + diff));
    chatPanel.style.width = newWidth + 'px';
    chatWidth = newWidth;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
    }
  });
}

/* ---------- Auto-resize textarea ---------- */
function setupAutoResize() {
  const input = $('#chatInput');
  if (!input) return;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });
}

/* ---------- Initialization ---------- */
export function initChat() {
  loadChatConfig();

  const sendBtn = $('#chatSend');
  const input = $('#chatInput');
  const closeBtn = $('#chatClose');
  const toggleBtn = $('#chatToggle');

  if (sendBtn) {
    sendBtn.onclick = () => {
      if (isStreaming) stopChatStream();
      else sendChatMessage();
    };
  }

  if (toggleBtn) toggleBtn.onclick = toggleChat;
  if (closeBtn) closeBtn.onclick = closeChat;

  if (input) {
    input.addEventListener('keydown', (e) => {
      const dropdown = $('#chatAutocomplete');
      const isOpen = dropdown && dropdown.classList.contains('open');

      if (e.key === 'Enter' && !e.shiftKey) {
        if (isOpen && autocompleteIndex >= 0) {
          e.preventDefault();
          selectAutocompleteItem();
        } else {
          e.preventDefault();
          if (!isStreaming) sendChatMessage();
        }
      } else if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        navigateAutocomplete('down');
      } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        navigateAutocomplete('up');
      } else if (e.key === 'Escape' && isOpen) {
        hideAutocomplete();
      }
    });

    input.addEventListener('input', () => {
      const value = input.value;
      const atIndex = value.lastIndexOf('@');

      if (atIndex !== -1) {
        const typed = value.substring(atIndex + 1).toLowerCase();
        // Only show if @ is recent and not followed by space
        if (!typed.includes(' ') && typed.length < 20) {
          showAutocomplete();
          if (typed.length > 0) filterAutocomplete(typed);
        } else {
          hideAutocomplete();
        }
      } else {
        hideAutocomplete();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      toggleChat();
    }
  });

  setupResizable();
  setupPinpoint();
  setupAutoResize();

  document.addEventListener('chat:config-updated', () => {
    if (chatOpen) {
      updateChatStatus(isChatConfigured() ? 'Ready' : 'Not configured');
    }
  });

  console.log('[Chat] Initialized with Meta Model API (Chat Completions + Responses)');
}

export function clearChatHistory() {
  chatMessages = [];
  renderChatHistory();
  updateChatStatus('Ready');
}