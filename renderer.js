const { ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DA APLICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
let targets = [];
let testInterval = 30;
let autoTestTimer = null;
let notificationsEnabled = true;
let searchQuery = '';
let nextCheckIn = 30;
let countdownTimer = null;
let allPaused = false;
let activeFilters = new Set();
let currentView = 'table';

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENTOS DO DOM
// ═══════════════════════════════════════════════════════════════════════════
const monitorsList = document.getElementById('monitorsList');
const monitorCardsGrid = document.getElementById('monitorCardsGrid');
const monitorCompactList = document.getElementById('monitorCompactList');
const searchBox = document.getElementById('searchBox');
const headerSubtitle = document.getElementById('headerSubtitle');
const cardOnline = document.getElementById('cardOnline');
const cardSlow = document.getElementById('cardSlow');
const cardOffline = document.getElementById('cardOffline');
const cardLatency = document.getElementById('cardLatency');
const cardUptime = document.getElementById('cardUptime');

// Modais e Botões
const addModal = document.getElementById('addModal');
const openAddModal = document.getElementById('openAddModal');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const addBtn = document.getElementById('addBtn');
const testAllBtn = document.getElementById('testAllBtn');
const pauseAllBtn = document.getElementById('pauseAllBtn');
const filterBtn = document.getElementById('filterBtn');
const filterMenu = document.getElementById('filterMenu');
const filterBadge = document.getElementById('filterBadge');

// Inputs do Modal
const nameInput = document.getElementById('nameInput');
const ipInput = document.getElementById('ipInput');
const typeSelect = document.getElementById('typeSelect');
const portInput = document.getElementById('portInput');
const portFieldContainer = document.getElementById('portFieldContainer');

// Visualizações
const tableView = document.getElementById('tableView');
const cardsView = document.getElementById('cardsView');
const compactView = document.getElementById('compactView');

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
function init() {
  loadData();
  renderMonitors();
  startAutoTest();
  startCountdown();
  setupEventListeners();
}

function setupEventListeners() {
  // Modal
  openAddModal.addEventListener('click', () => addModal.classList.add('active'));
  closeAddModal.addEventListener('click', () => addModal.classList.remove('active'));
  cancelAddBtn.addEventListener('click', () => addModal.classList.remove('active'));

  // Tipo de Teste no Modal
  typeSelect.addEventListener('change', () => {
    portFieldContainer.style.display = typeSelect.value === 'ping' ? 'none' : 'block';
  });

  // Busca
  searchBox.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderMonitors();
  });

  // Ações
  testAllBtn.addEventListener('click', () => {
    targets.forEach(t => {
      if (!t.paused) testConnection(t.id);
    });
    nextCheckIn = testInterval;
  });

  // Pausa Global
  pauseAllBtn.addEventListener('click', () => {
    allPaused = !allPaused;
    targets.forEach(t => t.paused = allPaused);
    saveData();
    updatePauseButton();
    renderMonitors();
  });

  // Filtro
  filterBtn.addEventListener('click', () => {
    filterMenu.style.display = filterMenu.style.display === 'none' ? 'block' : 'none';
  });

  // Checkboxes de Filtro
  document.getElementById('filterOnline').addEventListener('change', updateFilters);
  document.getElementById('filterOffline').addEventListener('change', updateFilters);
  document.getElementById('filterSlow').addEventListener('change', updateFilters);

  // Alternância de Visualização
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentView = e.target.dataset.view;
      renderMonitors();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GERENCIAMENTO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════
function loadData() {
  const saved = localStorage.getItem('atalaia_targets');
  if (saved) {
    targets = JSON.parse(saved);
    targets.forEach(t => {
      if (!t.history) t.history = Array(10).fill(0);
      if (!t.uptime) t.uptime = 100;
      if (!t.paused) t.paused = false;
    });
  }
}

function saveData() {
  localStorage.setItem('atalaia_targets', JSON.stringify(targets));
}

// ═══════════════════════════════════════════════════════════════════════════
// ADICIONAR NOVO DESTINO
// ═══════════════════════════════════════════════════════════════════════════
addBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Sem nome';
  const ip = ipInput.value.trim();
  const type = typeSelect.value;
  const port = type === 'port' ? parseInt(portInput.value) : null;

  if (!ip || (type === 'port' && isNaN(port))) {
    alert('Por favor, preencha os campos obrigatórios.');
    return;
  }

  const newTarget = {
    id: Date.now(),
    name,
    ip,
    type,
    port,
    status: 'testing',
    lastCheck: 'agora mesmo',
    latency: null,
    history: Array(10).fill(0),
    uptime: 100,
    category: 'Produção',
    paused: false
  };

  targets.push(newTarget);
  saveData();
  renderMonitors();
  testConnection(newTarget.id);

  nameInput.value = '';
  ipInput.value = '';
  portInput.value = '';
  addModal.classList.remove('active');
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTE DE CONEXÃO
// ═══════════════════════════════════════════════════════════════════════════
async function testConnection(id) {
  const target = targets.find(t => t.id === id);
  if (!target || target.paused) return;

  target.status = 'testing';
  renderMonitors();

  try {
    const result = await ipcRenderer.invoke('check-connection', {
      ip: target.ip,
      port: target.port,
      type: target.type
    });

    target.status = result.status;
    target.latency = result.latency || 0;
    target.lastCheck = 'agora mesmo';
    
    target.history.push(target.latency);
    if (target.history.length > 15) target.history.shift();

    if (notificationsEnabled && result.status === 'offline') {
      ipcRenderer.send('send-notification', {
        title: '⚠️ Atalaia: Host Offline',
        body: `${target.name} (${target.ip}) parou de responder!`
      });
    }

  } catch (error) {
    target.status = 'offline';
    target.latency = 0;
  }

  saveData();
  renderMonitors();
  updateStats();
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTES AUTOMÁTICOS
// ═══════════════════════════════════════════════════════════════════════════
function startAutoTest() {
  if (autoTestTimer) clearInterval(autoTestTimer);
  autoTestTimer = setInterval(() => {
    if (!allPaused) {
      targets.forEach(t => {
        if (!t.paused) testConnection(t.id);
      });
    }
    nextCheckIn = testInterval;
  }, testInterval * 1000);
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    nextCheckIn--;
    if (nextCheckIn < 0) nextCheckIn = testInterval;
    updateHeader();
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════════════════════════════════════════
function updateFilters() {
  activeFilters.clear();
  if (document.getElementById('filterOnline').checked) activeFilters.add('online');
  if (document.getElementById('filterOffline').checked) activeFilters.add('offline');
  if (document.getElementById('filterSlow').checked) activeFilters.add('slow');
  
  updateFilterBadge();
  renderMonitors();
}

function updateFilterBadge() {
  if (activeFilters.size > 0) {
    filterBadge.textContent = activeFilters.size;
    filterBadge.style.display = 'inline-flex';
  } else {
    filterBadge.style.display = 'none';
  }
}

function applyFilters(target) {
  if (activeFilters.size === 0) return true;
  
  const statusClass = target.status === 'online' ? (target.latency > 150 ? 'slow' : 'online') : 'offline';
  return activeFilters.has(statusClass);
}

// ═══════════════════════════════════════════════════════════════════════════
// ATUALIZAR UI
// ═══════════════════════════════════════════════════════════════════════════
function updateHeader() {
  const onlineCount = targets.filter(t => t.status === 'online').length;
  headerSubtitle.innerHTML = `
    <span class="dot online"></span> 
    ${targets.length} endpoints · última varredura agora mesmo · próxima em ${nextCheckIn}s
  `;
}

function updateStats() {
  const online = targets.filter(t => t.status === 'online').length;
  const offline = targets.filter(t => t.status === 'offline').length;
  const slow = targets.filter(t => t.status === 'online' && t.latency > 150).length;
  
  const avgLat = targets.length > 0 
    ? Math.round(targets.reduce((acc, t) => acc + (t.latency || 0), 0) / targets.length) 
    : 0;

  cardOnline.textContent = online;
  cardOffline.textContent = offline;
  cardSlow.textContent = slow;
  cardLatency.textContent = `${avgLat} ms`;
  cardUptime.textContent = '99,98%';
}

function updatePauseButton() {
  if (allPaused) {
    pauseAllBtn.innerHTML = '<span class="btn-icon">▶</span> Continuar todos';
  } else {
    pauseAllBtn.innerHTML = '<span class="btn-icon">⏸</span> Pausar todos';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
function renderMonitors() {
  const filtered = targets.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchQuery) || 
                        t.ip.toLowerCase().includes(searchQuery);
    const matchFilter = applyFilters(t);
    return matchSearch && matchFilter;
  });

  // Mostrar/Ocultar visualizações
  tableView.style.display = currentView === 'table' ? 'block' : 'none';
  cardsView.style.display = currentView === 'cards' ? 'block' : 'none';
  compactView.style.display = currentView === 'compact' ? 'block' : 'none';

  if (currentView === 'table') renderTableView(filtered);
  else if (currentView === 'cards') renderCardsView(filtered);
  else if (currentView === 'compact') renderCompactView(filtered);

  updateStats();
  updateHeader();
}

function renderTableView(filtered) {
  monitorsList.innerHTML = '';
  
  filtered.forEach(t => {
    const tr = document.createElement('tr');
    const statusClass = t.status === 'online' ? (t.latency > 150 ? 'slow' : 'online') : 'offline';
    const statusText = statusClass.toUpperCase();
    
    const maxLat = Math.max(...t.history, 1);
    const points = t.history.map((h, i) => `${(i * 10)},${32 - (h / maxLat * 30)}`).join(' ');
    const sparkline = `
      <svg class="sparkline" viewBox="0 0 150 32">
        <polyline fill="none" stroke="${statusClass === 'offline' ? '#d83b01' : '#0078d4'}" stroke-width="1.5" points="${points}" />
      </svg>
    `;

    tr.innerHTML = `
      <td>
        <div class="monitor-name">${t.name}</div>
        <div class="monitor-category">${t.category || 'Infra'}</div>
      </td>
      <td>${t.ip}</td>
      <td>${t.type === 'ping' ? '-' : t.port + ' <small style="color:#999">TCP</small>'}</td>
      <td style="color: ${statusClass === 'slow' ? 'var(--color-slow)' : 'inherit'}">
        ${t.latency ? t.latency + ' ms' : '-'}
      </td>
      <td>${sparkline}</td>
      <td>${t.uptime}%</td>
      <td>${t.lastCheck}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn" onclick="window.testTarget(${t.id})" title="Testar agora">🔄</button>
          <button class="action-btn" onclick="window.togglePause(${t.id})" title="${t.paused ? 'Retomar' : 'Pausar'}">${t.paused ? '▶' : '⏸'}</button>
          <button class="action-btn" onclick="window.deleteTarget(${t.id})" title="Remover">🗑️</button>
        </div>
      </td>
    `;
    monitorsList.appendChild(tr);
  });
}

function renderCardsView(filtered) {
  monitorCardsGrid.innerHTML = '';
  
  filtered.forEach(t => {
    const statusClass = t.status === 'online' ? (t.latency > 150 ? 'slow' : 'online') : 'offline';
    const card = document.createElement('div');
    card.className = `monitor-card monitor-card-${statusClass}`;
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${t.name}</div>
        <div class="card-status ${statusClass}">${statusClass.toUpperCase()}</div>
      </div>
      <div class="card-body">
        <div class="card-row">
          <span class="card-label">IP:</span>
          <span class="card-value">${t.ip}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Porta:</span>
          <span class="card-value">${t.type === 'ping' ? 'Ping' : t.port}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Latência:</span>
          <span class="card-value">${t.latency ? t.latency + ' ms' : '-'}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Uptime:</span>
          <span class="card-value">${t.uptime}%</span>
        </div>
      </div>
      <div class="card-footer">
        <button class="action-btn" onclick="window.testTarget(${t.id})">🔄 Testar</button>
        <button class="action-btn" onclick="window.togglePause(${t.id})">${t.paused ? '▶' : '⏸'} ${t.paused ? 'Retomar' : 'Pausar'}</button>
        <button class="action-btn" onclick="window.deleteTarget(${t.id})">🗑️</button>
      </div>
    `;
    monitorCardsGrid.appendChild(card);
  });
}

function renderCompactView(filtered) {
  monitorCompactList.innerHTML = '';
  
  filtered.forEach(t => {
    const statusClass = t.status === 'online' ? (t.latency > 150 ? 'slow' : 'online') : 'offline';
    const row = document.createElement('div');
    row.className = `compact-row compact-row-${statusClass}`;
    row.innerHTML = `
      <div class="compact-status-dot ${statusClass}"></div>
      <div class="compact-info">
        <div class="compact-name">${t.name}</div>
        <div class="compact-details">${t.ip} ${t.type === 'port' ? '(' + t.port + ')' : '(Ping)'}</div>
      </div>
      <div class="compact-latency">${t.latency ? t.latency + 'ms' : '-'}</div>
      <div class="compact-actions">
        <button class="action-btn-compact" onclick="window.testTarget(${t.id})">🔄</button>
        <button class="action-btn-compact" onclick="window.togglePause(${t.id})">${t.paused ? '▶' : '⏸'}</button>
        <button class="action-btn-compact" onclick="window.deleteTarget(${t.id})">🗑️</button>
      </div>
    `;
    monitorCompactList.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════
window.testTarget = (id) => testConnection(id);

window.togglePause = (id) => {
  const target = targets.find(t => t.id === id);
  if (target) {
    target.paused = !target.paused;
    saveData();
    renderMonitors();
  }
};

window.deleteTarget = (id) => {
  if (confirm('Remover este monitor?')) {
    targets = targets.filter(t => t.id !== id);
    saveData();
    renderMonitors();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// INICIAR
// ═══════════════════════════════════════════════════════════════════════════
init();
