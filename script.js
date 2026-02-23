'use strict';

// ── BACKEND URL — Aapka HF Space ─────────────────────────────────
const API_BASE = 'https://zara65724-career-assistant.hf.space';

// ── State ─────────────────────────────────────────────────────────
let state = {
  token: localStorage.getItem('ca_token') || null,
  user: JSON.parse(localStorage.getItem('ca_user') || 'null'),
  currentChatId: null,
  currentView: 'chat',
  isStreaming: false,
  skillData: { completed_courses: [], certificates: [], goals: [] }
};

// ── API Helper ────────────────────────────────────────────────────
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const resp = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (resp.status === 401) { handleLogout(); return null; }
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.detail || `Error ${resp.status}`);
  return data;
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (state.token && state.user) {
    showApp();
  } else {
    showAuthScreen();
  }
});

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateUserDisplay();
  loadChatHistory();
  loadDailyTip();
  document.getElementById('message-input').focus();
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function updateUserDisplay() {
  if (!state.user) return;
  const initial = state.user.name?.[0]?.toUpperCase() || 'U';
  document.getElementById('user-name-display').textContent = state.user.name;
  document.getElementById('user-email-display').textContent = state.user.email;
  document.getElementById('user-avatar').textContent = initial;
  const mob = document.getElementById('mobile-avatar');
  if (mob) mob.textContent = initial;
}

// ══════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.auth-tab')[tab === 'login' ? 0 : 1].classList.add('active');
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
  clearErrors();
}

function clearErrors() {
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Please wait...';
  try {
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!data) return;
    state.token = data.access_token;
    state.user  = data.user;
    localStorage.setItem('ca_token', state.token);
    localStorage.setItem('ca_user', JSON.stringify(state.user));
    showApp();
  } catch (e) {
    errEl.textContent = e.message || 'Login failed.';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

async function handleSignup() {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');
  const btn      = document.getElementById('signup-btn');

  if (!name || !email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (password.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; return; }

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Please wait...';
  try {
    const data = await api('/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    if (!data) return;
    state.token = data.access_token;
    state.user  = data.user;
    localStorage.setItem('ca_token', state.token);
    localStorage.setItem('ca_user', JSON.stringify(state.user));
    showApp();
  } catch (e) {
    errEl.textContent = e.message || 'Signup failed.';
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create Account';
  }
}

function handleLogout() {
  state.token = null; state.user = null; state.currentChatId = null;
  localStorage.removeItem('ca_token');
  localStorage.removeItem('ca_user');
  showAuthScreen();
  switchTab('login');
}

// ══════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll(`.nav-item[data-view="${view}"]`).forEach(el => el.classList.add('active'));
  const viewEl = document.getElementById(`view-${view}`);
  viewEl.classList.remove('hidden');
  viewEl.classList.add('active');
  if (view === 'skills') loadSkillTracker();
  if (window.innerWidth < 768) closeSidebar();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar()   { document.getElementById('sidebar').classList.remove('open'); }

// ══════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════
async function startNewChat() {
  try {
    const data = await api('/new-chat', { method: 'POST' });
    if (!data) return;
    state.currentChatId = data.id;
    switchView('chat');
    clearMessages();
    showWelcomeScreen(true);
    await loadChatHistory();
    highlightCurrentChat();
    document.getElementById('message-input').focus();
    if (window.innerWidth < 768) closeSidebar();
  } catch (e) { showToast('Failed to create new chat', 'error'); }
}

function showWelcomeScreen(show) {
  document.getElementById('welcome-screen').classList.toggle('hidden', !show);
  document.getElementById('messages-container').classList.toggle('hidden', show);
}

function clearMessages() { document.getElementById('messages-list').innerHTML = ''; }

async function loadChatHistory() {
  const listEl = document.getElementById('chat-history-list');
  try {
    const chats = await api('/chat-history');
    if (!chats) return;
    if (chats.length === 0) { listEl.innerHTML = '<div class="history-skeleton">No chats yet</div>'; return; }
    listEl.innerHTML = chats.map(chat => `
      <div class="chat-history-item ${chat.id === state.currentChatId ? 'active' : ''}" id="chat-item-${chat.id}" onclick="loadChat(${chat.id})">
        <span class="chat-history-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
        <button class="chat-delete-btn" onclick="deleteChat(event,${chat.id})">🗑</button>
      </div>`).join('');
  } catch (e) { listEl.innerHTML = '<div class="history-skeleton">Failed to load</div>'; }
}

async function loadChat(chatId) {
  state.currentChatId = chatId;
  switchView('chat');
  highlightCurrentChat();
  showWelcomeScreen(false);
  clearMessages();
  try {
    const chat = await api(`/chat/${chatId}`);
    if (!chat) return;
    chat.messages.forEach(msg => renderMessage(msg.role, msg.content, msg.timestamp));
    scrollToBottom();
  } catch (e) { showToast('Failed to load chat', 'error'); }
  if (window.innerWidth < 768) closeSidebar();
}

function highlightCurrentChat() {
  document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`chat-item-${state.currentChatId}`);
  if (el) el.classList.add('active');
}

async function deleteChat(event, chatId) {
  event.stopPropagation();
  if (!confirm('Delete this chat?')) return;
  try {
    await api(`/chat/${chatId}`, { method: 'DELETE' });
    if (state.currentChatId === chatId) { state.currentChatId = null; showWelcomeScreen(true); clearMessages(); }
    await loadChatHistory();
  } catch (e) { showToast('Failed to delete chat', 'error'); }
}

async function sendMessage() {
  if (state.isStreaming) return;
  const input   = document.getElementById('message-input');
  const message = input.value.trim();
  if (!message) return;

  if (!state.currentChatId) {
    try {
      const newChat = await api('/new-chat', { method: 'POST' });
      if (!newChat) return;
      state.currentChatId = newChat.id;
    } catch (e) { showToast('Failed to start chat', 'error'); return; }
  }

  input.value = '';
  autoResize(input);
  showWelcomeScreen(false);
  renderMessage('user', message, new Date().toISOString());
  showTypingIndicator(true);
  setSendDisabled(true);
  state.isStreaming = true;

  try {
    const data = await api('/chat', { method: 'POST', body: JSON.stringify({ chat_id: state.currentChatId, message }) });
    if (!data) return;
    showTypingIndicator(false);
    renderMessage('assistant', data.reply, new Date().toISOString(), true);
    scrollToBottom();
    await loadChatHistory();
    highlightCurrentChat();
  } catch (e) {
    showTypingIndicator(false);
    showToast(e.message || 'Failed to send message', 'error');
  } finally {
    state.isStreaming = false;
    setSendDisabled(false);
    input.focus();
  }
}

function renderMessage(role, content, timestamp, animate = false) {
  const container = document.getElementById('messages-list');
  const initial   = role === 'user' ? (state.user?.name?.[0]?.toUpperCase() || 'U') : 'AI';
  const msgEl     = document.createElement('div');
  msgEl.className = `message ${role}`;
  const formatted = formatMessageContent(content);
  msgEl.innerHTML = `
    <div class="message-avatar">${initial}</div>
    <div class="message-content">
      <div class="message-bubble" id="bubble-${Date.now()}">${animate ? '' : formatted}</div>
      <div class="message-time">${formatTime(timestamp)}</div>
    </div>`;
  container.appendChild(msgEl);
  scrollToBottom();
  if (animate) {
    const bubble = msgEl.querySelector('.message-bubble');
    typewriterEffect(bubble, formatted);
  }
}

function typewriterEffect(el, htmlContent) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const words = tempDiv.textContent.split(' ');
  let idx = 0;
  el.innerHTML = '';
  const iv = setInterval(() => {
    if (idx >= words.length) { clearInterval(iv); el.innerHTML = htmlContent; return; }
    el.textContent += (idx > 0 ? ' ' : '') + words[idx];
    idx += 2;
    scrollToBottom();
  }, 20);
}

function formatMessageContent(content) {
  return content
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')
    .replace(/^/,'<p>').replace(/$/,'</p>');
}

function showTypingIndicator(show) {
  document.getElementById('typing-indicator').classList.toggle('hidden', !show);
  if (show) scrollToBottom();
}
function setSendDisabled(d) { document.getElementById('send-btn').disabled = d; }
function scrollToBottom() { const c = document.getElementById('messages-container'); c.scrollTop = c.scrollHeight; }
function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px'; }
function useSuggestion(text) { const i = document.getElementById('message-input'); i.value = text; autoResize(i); i.focus(); sendMessage(); }
function toggleProfileMenu() { document.getElementById('profile-menu').classList.toggle('hidden'); }

document.addEventListener('click', (e) => {
  const menu    = document.getElementById('profile-menu');
  const profile = document.getElementById('user-profile');
  if (menu && profile && !menu.classList.contains('hidden')) {
    if (!profile.contains(e.target) && !menu.contains(e.target)) menu.classList.add('hidden');
  }
});

// ══════════════════════════════════════════════════════════════════
// DAILY TIP
// ══════════════════════════════════════════════════════════════════
async function loadDailyTip() {
  try {
    const data = await api('/daily-tip');
    if (data?.tip) document.getElementById('daily-tip-text').textContent = data.tip;
  } catch (e) { document.getElementById('daily-tip-banner').style.display = 'none'; }
}

// ══════════════════════════════════════════════════════════════════
// RESUME UPLOAD
// ══════════════════════════════════════════════════════════════════
function handleDragOver(e)  { e.preventDefault(); document.getElementById('upload-zone').classList.add('dragover'); }
function handleDragLeave()  { document.getElementById('upload-zone').classList.remove('dragover'); }
function handleDrop(e)      { e.preventDefault(); document.getElementById('upload-zone').classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) processResumeFile(f); }
function handleFileSelect(e){ const f = e.target.files[0]; if (f) processResumeFile(f); }

async function processResumeFile(file) {
  const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx?)$/i)) { showToast('Only PDF and DOCX files', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('File too large. Max 5MB.', 'error'); return; }

  document.getElementById('resume-results').classList.add('hidden');
  document.getElementById('upload-status').classList.remove('hidden');
  document.getElementById('file-name').textContent  = file.name;
  document.getElementById('file-size').textContent  = formatFileSize(file.size);
  animateProgress(0, 40, 1500);
  document.getElementById('upload-label').textContent = 'Uploading and extracting text...';

  const formData = new FormData();
  formData.append('file', file);
  try {
    animateProgress(40, 80, 2000);
    document.getElementById('upload-label').textContent = 'Analyzing with AI...';
    const data = await api('/upload-resume', { method: 'POST', body: formData, headers: {} });
    animateProgress(80, 100, 500);
    document.getElementById('upload-label').textContent = '✅ Analysis complete!';
    setTimeout(() => { document.getElementById('upload-status').classList.add('hidden'); renderResumeResults(data.analysis); }, 800);
  } catch (e) {
    document.getElementById('upload-status').classList.add('hidden');
    showToast(e.message || 'Analysis failed.', 'error');
  }
}

function animateProgress(from, to, duration) {
  const fill = document.getElementById('progress-fill');
  const start = Date.now();
  const tick = () => {
    const p = Math.min((Date.now() - start) / duration, 1);
    fill.style.width = (from + (to - from) * p) + '%';
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderResumeResults(analysis) {
  const resultsEl = document.getElementById('resume-results');
  resultsEl.classList.remove('hidden');
  const score = analysis.ats_score || 0;
  const scoreEl   = document.getElementById('ats-score-display');
  const ringFill  = document.getElementById('score-ring-fill');
  let current = 0;
  const iv = setInterval(() => { current = Math.min(current + 2, score); scoreEl.textContent = current; if (current >= score) clearInterval(iv); }, 30);
  setTimeout(() => { ringFill.style.strokeDashoffset = 314 - (score / 100) * 314; }, 100);
  if (score >= 75) ringFill.style.stroke = 'var(--success)';
  else if (score >= 50) ringFill.style.stroke = 'var(--warning)';
  else ringFill.style.stroke = 'var(--danger)';
  document.getElementById('score-label-text').textContent = score >= 75 ? '🟢 Strong ATS compatibility' : score >= 50 ? '🟡 Moderate — improvements needed' : '🔴 Low — significant gaps found';
  document.getElementById('career-match-badges').innerHTML = (analysis.career_match || []).map(r => `<span class="score-badge">${escapeHtml(r)}</span>`).join('');
  document.getElementById('overall-summary').textContent   = analysis.overall_summary || '';
  document.getElementById('strengths-list').innerHTML      = (analysis.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
  document.getElementById('weaknesses-list').innerHTML     = (analysis.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join('');
  document.getElementById('keyword-gaps').innerHTML        = (analysis.keyword_gaps || []).map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('');
  document.getElementById('bullet-improvements').innerHTML = (analysis.bullet_improvements || []).map(b => `<div class="bullet-item"><div class="bullet-original">❌ ${escapeHtml(b.original)}</div><div class="bullet-improved">✅ ${escapeHtml(b.improved)}</div></div>`).join('');
  document.getElementById('recommendations-list').innerHTML= (analysis.top_recommendations || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetUpload() {
  document.getElementById('resume-results').classList.add('hidden');
  document.getElementById('upload-status').classList.add('hidden');
  document.getElementById('resume-file').value = '';
  document.getElementById('progress-fill').style.width = '0%';
}

// ══════════════════════════════════════════════════════════════════
// SKILL TRACKER
// ══════════════════════════════════════════════════════════════════
async function loadSkillTracker() {
  try {
    const data = await api('/skill-tracker');
    if (!data) return;
    state.skillData = { completed_courses: data.completed_courses || [], certificates: data.certificates || [], goals: data.goals || [] };
    renderTrackerLists();
    updateProgressDisplay(data.progress_percent || 0);
  } catch (e) { showToast('Failed to load skill tracker', 'error'); }
}

function renderTrackerLists() {
  renderList('goals-list',        state.skillData.goals,             'goals');
  renderList('courses-list',      state.skillData.completed_courses, 'courses');
  renderList('certificates-list', state.skillData.certificates,      'certificates');
  document.getElementById('stat-courses').textContent = state.skillData.completed_courses.length;
  document.getElementById('stat-certs').textContent   = state.skillData.certificates.length;
  document.getElementById('stat-goals').textContent   = state.skillData.goals.length;
}

function renderList(containerId, items, type) {
  const el = document.getElementById(containerId);
  if (!items.length) { el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-subtle);padding:0.25rem 0;">Nothing added yet</div>'; return; }
  el.innerHTML = items.map((item, idx) => `
    <div class="tracker-item">
      <span class="tracker-item-text" title="${escapeHtml(item)}">${escapeHtml(item)}</span>
      <button class="tracker-item-remove" onclick="removeItem('${type}',${idx})">✕</button>
    </div>`).join('');
}

function removeItem(type, idx) {
  const keyMap = { goals: 'goals', courses: 'completed_courses', certificates: 'certificates' };
  state.skillData[keyMap[type]].splice(idx, 1);
  renderTrackerLists();
}

function addItem(type) {
  document.getElementById(`${type}-input-row`).classList.remove('hidden');
  document.getElementById(`${type}-input`).focus();
}

function cancelAdd(type) {
  document.getElementById(`${type}-input-row`).classList.add('hidden');
  document.getElementById(`${type}-input`).value = '';
}

function saveItem(type) {
  const input = document.getElementById(`${type}-input`);
  const value = input.value.trim();
  if (!value) return;
  const keyMap = { goals: 'goals', courses: 'completed_courses', certificates: 'certificates' };
  state.skillData[keyMap[type]].push(value);
  input.value = '';
  document.getElementById(`${type}-input-row`).classList.add('hidden');
  renderTrackerLists();
}

document.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('tracker-input') && e.key === 'Enter') {
    saveItem(e.target.id.replace('-input', ''));
  }
});

async function saveSkillTracker() {
  const btn = document.getElementById('save-tracker-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const data = await api('/skill-tracker', { method: 'POST', body: JSON.stringify({
      completed_courses: state.skillData.completed_courses,
      certificates:      state.skillData.certificates,
      goals:             state.skillData.goals
    })});
    if (data) { updateProgressDisplay(data.progress_percent || 0); showToast('Progress saved! 🎉', 'success'); }
  } catch (e) { showToast('Failed to save.', 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Progress`;
  }
}

function updateProgressDisplay(percent) {
  document.getElementById('overall-progress-fill').style.width  = percent + '%';
  document.getElementById('overall-progress-label').textContent = percent.toFixed(1) + '%';
}

// ══════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatTime(iso) { try { return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } }
function formatFileSize(b) { if (b<1024) return b+' B'; if (b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }

let toastTimeout;
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 4000);
}
