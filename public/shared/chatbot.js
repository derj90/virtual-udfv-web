/**
 * UMCE Virtual — Chatbot Client
 * FAB toggle, session management, message sending, typing indicator
 */
(function () {
  'use strict';

  const SESSION_KEY = 'umce_chat_session';
  let sessionToken = null;
  let sending = false;

  // ==========================================
  // DOM refs (resolved after partial loads)
  // ==========================================
  let fab, fabOpen, fabClose, panel, messages, form, input, sendBtn, quickActions;

  function initDom() {
    fab = document.getElementById('chat-fab');
    fabOpen = document.getElementById('chat-fab-open');
    fabClose = document.getElementById('chat-fab-close');
    panel = document.getElementById('chat-panel');
    messages = document.getElementById('chat-messages');
    form = document.getElementById('chat-form');
    input = document.getElementById('chat-input');
    sendBtn = document.getElementById('chat-send');
    quickActions = document.getElementById('chat-quick-actions');
    return !!(fab && panel && form && input);
  }

  // ==========================================
  // FAB Toggle
  // ==========================================
  function toggleChat() {
    const isOpen = panel.classList.toggle('open');
    fabOpen.classList.toggle('hidden', isOpen);
    fabClose.classList.toggle('hidden', !isOpen);
    fab.setAttribute('aria-label', isOpen ? 'Cerrar asistente virtual' : 'Abrir asistente virtual');
    if (isOpen) {
      input.focus();
      ensureSession();
    }
  }

  // ==========================================
  // Session Management
  // ==========================================
  async function ensureSession() {
    if (sessionToken) return;
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      sessionToken = saved;
      loadHistory();
      return;
    }
    try {
      const resp = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!resp.ok) throw new Error('session error');
      const data = await resp.json();
      sessionToken = data.session_token;
      localStorage.setItem(SESSION_KEY, sessionToken);
    } catch (err) {
      console.warn('Chat session error:', err.message);
    }
  }

  async function loadHistory() {
    if (!sessionToken) return;
    try {
      const resp = await fetch(`/api/chat/history?session_token=${encodeURIComponent(sessionToken)}`);
      if (!resp.ok) return;
      const history = await resp.json();
      if (history.length > 0) {
        // Clear welcome message and show history
        messages.innerHTML = '';
        history.forEach(msg => appendMessage(msg.role, msg.content));
        hideQuickActions();
        scrollToBottom();
      }
    } catch (err) {
      console.warn('Chat history error:', err.message);
    }
  }

  // ==========================================
  // Messages
  // ==========================================
  function appendMessage(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
      ? 'px-4 py-3 text-sm max-w-[85%]'
      : 'bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 max-w-[85%]';
    bubble.innerHTML = formatResponse(text);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    scrollToBottom();
    return bubble;
  }

  function showTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-msg assistant';
    wrapper.id = 'chat-typing-indicator';
    wrapper.innerHTML = `
      <div class="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 max-w-[85%]">
        <div class="chat-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('chat-typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function hideQuickActions() {
    if (quickActions) quickActions.style.display = 'none';
  }

  /** Basic markdown-like formatting */
  function formatResponse(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n- /g, '\n&#8226; ')
      .replace(/\n\d+\.\s/g, (m) => '\n' + m.trim() + ' ')
      .replace(/\n/g, '<br>')
      .replace(/`(.+?)`/g, '<code style="background:#F3F4F6;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>');
  }

  // ==========================================
  // Send Message
  // ==========================================
  async function sendMessage(text) {
    if (sending || !text.trim()) return;
    sending = true;
    input.disabled = true;
    sendBtn.disabled = true;

    await ensureSession();
    hideQuickActions();

    appendMessage('user', text);
    input.value = '';
    showTyping();

    try {
      const resp = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          message: text.trim()
        })
      });

      hideTyping();

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          appendMessage('assistant', 'Has alcanzado el limite de mensajes por hora. Intenta de nuevo mas tarde.');
        } else {
          appendMessage('assistant', err.error || 'Ocurrio un error. Intenta de nuevo.');
        }
        return;
      }

      const data = await resp.json();
      appendMessage('assistant', data.response || 'No pude generar una respuesta.');
    } catch (err) {
      hideTyping();
      appendMessage('assistant', 'Error de conexion. Verifica tu internet e intenta de nuevo.');
    } finally {
      sending = false;
      input.disabled = false;
      sendBtn.disabled = !input.value.trim();
      input.focus();
    }
  }

  // ==========================================
  // Initialize
  // ==========================================
  function init() {
    if (!initDom()) {
      // Retry once after a short delay (partials might still be loading)
      setTimeout(() => {
        if (!initDom()) return;
        bindEvents();
      }, 500);
      return;
    }
    bindEvents();
  }

  function bindEvents() {
    // FAB toggle
    fab.addEventListener('click', toggleChat);

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(input.value);
    });

    // Enable/disable send button
    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim() || sending;
    });

    // Quick action chips
    if (quickActions) {
      quickActions.addEventListener('click', (e) => {
        const chip = e.target.closest('.chat-chip');
        if (chip) sendMessage(chip.textContent);
      });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        toggleChat();
      }
    });
  }

  // Wait for DOM + partials
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  } else {
    setTimeout(init, 200);
  }
})();
