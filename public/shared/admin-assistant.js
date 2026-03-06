/**
 * UMCE Virtual — Admin Assistant Client
 * Auth check, chat, action preview cards, execution, pending approvals
 */
(function () {
  'use strict';

  // State
  let userRole = null;
  let userEmail = '';
  let sending = false;

  // DOM refs
  const authGate = document.getElementById('auth-gate');
  const unauthorized = document.getElementById('unauthorized');
  const adminPanel = document.getElementById('admin-panel');
  const messages = document.getElementById('admin-messages');
  const form = document.getElementById('admin-form');
  const input = document.getElementById('admin-input');
  const sendBtn = document.getElementById('admin-send');
  const quickActions = document.getElementById('admin-quick-actions');
  const roleBadge = document.getElementById('role-badge');
  const userEmailEl = document.getElementById('user-email');
  const btnPending = document.getElementById('btn-pending');
  const pendingCount = document.getElementById('pending-count');
  const pendingModal = document.getElementById('pending-modal');
  const closePending = document.getElementById('close-pending');
  const pendingList = document.getElementById('pending-list');

  // ==========================================
  // Auth Check
  // ==========================================
  async function checkAuth() {
    try {
      // Check if logged in
      const meRes = await fetch('/auth/me');
      if (!meRes.ok) {
        // Not logged in — redirect to login
        window.location.href = '/auth/login';
        return;
      }
      const me = await meRes.json();
      userEmail = me.email;

      // Check role
      const roleRes = await fetch('/api/admin/role');
      if (!roleRes.ok) throw new Error('role check failed');
      const roleData = await roleRes.json();

      if (!roleData.role) {
        // No admin/editor role
        authGate.classList.add('hidden');
        unauthorized.classList.remove('hidden');
        return;
      }

      userRole = roleData.role;

      // Show admin panel
      authGate.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      adminPanel.classList.add('flex');

      // Set UI
      roleBadge.textContent = userRole;
      userEmailEl.textContent = userEmail;

      if (userRole === 'admin' && roleData.pendingCount > 0) {
        btnPending.classList.remove('hidden');
        btnPending.classList.add('flex');
        pendingCount.textContent = roleData.pendingCount;
      }

      // Create/recover session
      await fetch('/api/admin/assistant/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Load history
      await loadHistory();

    } catch (err) {
      console.error('Auth check error:', err);
      authGate.classList.add('hidden');
      unauthorized.classList.remove('hidden');
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/admin/assistant/history');
      if (!res.ok) return;
      const history = await res.json();
      if (history.length > 0) {
        // Clear welcome and render history
        messages.innerHTML = '';
        history.forEach(msg => {
          appendMessage(msg.role, msg.content);
          if (msg.action) renderActionCard(msg.action, true);
        });
        hideQuickActions();
        scrollToBottom();
      }
    } catch (err) {
      console.warn('History load error:', err.message);
    }
  }

  // ==========================================
  // Messages
  // ==========================================
  function appendMessage(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `admin-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = role === 'user'
      ? 'px-4 py-3 text-sm max-w-[85%]'
      : 'px-4 py-3 text-sm text-gray-700 max-w-[85%]';
    bubble.innerHTML = formatText(text);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  function renderActionCard(action, fromHistory) {
    const card = document.createElement('div');
    card.className = 'action-card max-w-[85%]';

    const actionLabels = { create: 'Crear', update: 'Actualizar', delete: 'Eliminar' };
    const label = actionLabels[action.action] || action.action;

    card.innerHTML = `
      <div class="action-label">${label} en ${action.table}</div>
      <pre>${JSON.stringify(action.data || { id: action.id }, null, 2)}</pre>
      ${fromHistory ? '<p class="text-xs text-gray-400">Acción ya procesada</p>' : `
      <div class="flex gap-2">
        <button class="action-execute bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          Ejecutar
        </button>
        <button class="action-cancel bg-gray-200 text-gray-600 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
          Cancelar
        </button>
      </div>
      `}
    `;

    if (!fromHistory) {
      const execBtn = card.querySelector('.action-execute');
      const cancelBtn = card.querySelector('.action-cancel');

      execBtn.addEventListener('click', async () => {
        execBtn.disabled = true;
        execBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Ejecutando...';
        cancelBtn.disabled = true;
        try {
          const res = await fetch('/api/admin/assistant/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action)
          });
          const data = await res.json();
          if (res.ok && data.success) {
            card.innerHTML = `
              <div class="action-label text-green-700">${label} en ${action.table} — Ejecutado</div>
              <p class="text-xs text-green-600">${data.result?.message || data.result?.pending ? 'Acción pendiente de aprobación' : 'Acción ejecutada correctamente.'}</p>
            `;
            // Refresh pending count
            refreshPendingCount();
          } else {
            card.innerHTML += `<p class="text-xs text-red-500 mt-2">Error: ${data.error || 'Error desconocido'}</p>`;
            execBtn.disabled = false;
            cancelBtn.disabled = false;
          }
        } catch (err) {
          card.innerHTML += `<p class="text-xs text-red-500 mt-2">Error de conexión</p>`;
          execBtn.disabled = false;
          cancelBtn.disabled = false;
        }
      });

      cancelBtn.addEventListener('click', () => {
        card.innerHTML = `
          <div class="action-label text-gray-400">${label} en ${action.table} — Cancelado</div>
          <p class="text-xs text-gray-400">Acción cancelada por el usuario.</p>
        `;
      });
    }

    messages.appendChild(card);
    scrollToBottom();
  }

  function showTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-msg assistant';
    wrapper.id = 'admin-typing';
    wrapper.innerHTML = `
      <div class="px-4 py-3 text-sm text-gray-700 max-w-[85%]">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('admin-typing');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function hideQuickActions() {
    if (quickActions) quickActions.style.display = 'none';
  }

  function formatText(text) {
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
    hideQuickActions();

    appendMessage('user', text);
    input.value = '';
    showTyping();

    try {
      const res = await fetch('/api/admin/assistant/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() })
      });

      hideTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        appendMessage('assistant', err.error || 'Ocurrió un error. Intenta de nuevo.');
        return;
      }

      const data = await res.json();
      appendMessage('assistant', data.text || 'No pude generar una respuesta.');

      // Render action card if present
      if (data.action) {
        renderActionCard(data.action, false);
      }

    } catch (err) {
      hideTyping();
      appendMessage('assistant', 'Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      sending = false;
      input.disabled = false;
      sendBtn.disabled = !input.value.trim();
      input.focus();
    }
  }

  // ==========================================
  // Pending Approvals
  // ==========================================
  async function refreshPendingCount() {
    if (userRole !== 'admin') return;
    try {
      const res = await fetch('/api/admin/role');
      const data = await res.json();
      if (data.pendingCount > 0) {
        btnPending.classList.remove('hidden');
        btnPending.classList.add('flex');
        pendingCount.textContent = data.pendingCount;
      } else {
        btnPending.classList.add('hidden');
        btnPending.classList.remove('flex');
      }
    } catch {}
  }

  async function loadPending() {
    pendingList.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">Cargando...</p>';
    try {
      const res = await fetch('/api/admin/assistant/pending');
      if (!res.ok) throw new Error('fetch failed');
      const items = await res.json();

      if (items.length === 0) {
        pendingList.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay eliminaciones pendientes.</p>';
        return;
      }

      pendingList.innerHTML = '';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-yellow-50 border border-yellow-200 rounded-xl p-4';
        const title = item.data_before?.title || item.data_before?.name || `ID ${item.target_id}`;
        const date = new Date(item.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        card.innerHTML = `
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <p class="text-sm font-semibold text-gray-800">${title}</p>
              <p class="text-xs text-gray-500">Tabla: ${item.target_table} · Por: ${item.user_email} · ${date}</p>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="approve-btn bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors">Aprobar eliminación</button>
            <button class="reject-btn bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gray-300 transition-colors">Rechazar (restaurar)</button>
          </div>
        `;

        const approveBtn = card.querySelector('.approve-btn');
        const rejectBtn = card.querySelector('.reject-btn');

        approveBtn.addEventListener('click', () => reviewAction(item.id, 'approve', card));
        rejectBtn.addEventListener('click', () => reviewAction(item.id, 'reject', card));

        pendingList.appendChild(card);
      });
    } catch (err) {
      pendingList.innerHTML = '<p class="text-red-400 text-sm text-center py-8">Error cargando pendientes.</p>';
    }
  }

  async function reviewAction(actionId, decision, card) {
    const btns = card.querySelectorAll('button');
    btns.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });

    try {
      const res = await fetch('/api/admin/assistant/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, decision })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        card.innerHTML = `<p class="text-sm text-center py-2 ${decision === 'approve' ? 'text-red-600' : 'text-green-600'}">${data.message}</p>`;
        refreshPendingCount();
      } else {
        card.innerHTML += `<p class="text-xs text-red-500 mt-2">Error: ${data.error}</p>`;
        btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
      }
    } catch {
      card.innerHTML += `<p class="text-xs text-red-500 mt-2">Error de conexión</p>`;
      btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
    }
  }

  // ==========================================
  // Event Binding
  // ==========================================
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim() || sending;
  });

  // Quick action chips
  quickActions.addEventListener('click', (e) => {
    const chip = e.target.closest('.quick-chip');
    if (chip) sendMessage(chip.dataset.msg || chip.textContent);
  });

  // Pending modal
  btnPending.addEventListener('click', () => {
    pendingModal.classList.add('open');
    loadPending();
  });

  closePending.addEventListener('click', () => {
    pendingModal.classList.remove('open');
  });

  pendingModal.addEventListener('click', (e) => {
    if (e.target === pendingModal) pendingModal.classList.remove('open');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pendingModal.classList.contains('open')) {
      pendingModal.classList.remove('open');
    }
  });

  // ==========================================
  // Init
  // ==========================================
  checkAuth();
})();
