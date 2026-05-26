const { ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const LATENCY_SLOW_THRESHOLD = 150; // ms - Define quando um host é considerado "Lento"

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
let currentTheme = 'light';

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
const exportBtn = document.getElementById('exportBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

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
  applyTheme();
  renderMonitors();
  startAutoTest();
  startCountdown();
  setupEventListeners();
  // Inicializar ícones Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
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
  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    filterMenu.style.display = filterMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!filterMenu.contains(e.target) && e.target !== filterBtn) {
      filterMenu.style.display = 'none';
    }
  });

  // Checkboxes de Filtro
  document.getElementById('filterOnline').addEventListener('change', updateFilters);
  document.getElementById('filterOffline').addEventListener('change', updateFilters);
  document.getElementById('filterSlow').addEventListener('change', updateFilters);

  // Exportar
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  // Tema
  themeToggleBtn.addEventListener('click', toggleTheme);

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
// TEMA
// ═══════════════════════════════════════════════════════════════════════════
function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme();
  saveData();
}

function applyTheme() {
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark-mode');
    themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
  } else {
    document.documentElement.classList.remove('dark-mode');
    themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
  }
  // Re-renderizar ícones Lucide após mudança de tema
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
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
      if (t.paused === undefined) t.paused = false;
    });
  }
  
  const savedTheme = localStorage.getItem('atalaia_theme');
  if (savedTheme) {
    currentTheme = savedTheme;
  }
}

function saveData() {
  localStorage.setItem('atalaia_targets', JSON.stringify(targets));
  localStorage.setItem('atalaia_theme', currentTheme);
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
  
  let statusClass;
  if (target.status === 'offline') {
    statusClass = 'offline';
  } else if (target.latency > LATENCY_SLOW_THRESHOLD) {
    statusClass = 'slow';
  } else {
    statusClass = 'online';
  }
  
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
  const online = targets.filter(t => t.status === 'online' && t.latency <= LATENCY_SLOW_THRESHOLD).length;
  const offline = targets.filter(t => t.status === 'offline').length;
  const slow = targets.filter(t => t.status === 'online' && t.latency > LATENCY_SLOW_THRESHOLD).length;
  
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
    let statusClass = t.status;
    if (t.status === 'online' && t.latency > LATENCY_SLOW_THRESHOLD) statusClass = 'slow';
    
    const statusText = statusClass.toUpperCase();
    
    const maxLat = Math.max(...t.history, 1);
    const points = t.history.map((h, i) => `${(i * 10)},${32 - (h / maxLat * 30)}`).join(' ');
    const sparkline = `
      <svg class="sparkline" viewBox="0 0 150 32">
        <polyline fill="none" stroke="${statusClass === 'offline' ? '#d83b01' : (statusClass === 'slow' ? '#ffb900' : '#0078d4')}" stroke-width="1.5" points="${points}" />
      </svg>
    `;

    tr.innerHTML = `
      <td>
        <div class="monitor-name">${t.name}</div>
        <div class="monitor-category">${t.category || 'Infra'}</div>
      </td>
      <td>${t.ip}</td>
      <td>${t.type === 'ping' ? '-' : t.port + ' <small style="color:#999">' + (t.type === 'port' ? 'HTTP' : 'TCP') + '</small>'}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td><strong>${t.latency || 0} ms</strong></td>
      <td>${sparkline}</td>
      <td>99,98%</td>
      <td>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <small style="color:#666">agora mesmo</small>
          <div class="action-buttons">
            <button class="action-btn" onclick="window.togglePause(${t.id})" title="Pausar/Continuar"><i data-lucide="${t.paused ? 'play' : 'pause'}"></i></button>
            <button class="action-btn" onclick="window.deleteTarget(${t.id})" title="Remover"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </td>
    `;
    monitorsList.appendChild(tr);
  });
  
  // Re-renderizar ícones Lucide após renderizar a tabela
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function renderCardsView(filtered) {
  monitorCardsGrid.innerHTML = '';
  
  filtered.forEach(t => {
    let statusClass = t.status;
    if (t.status === 'online' && t.latency > LATENCY_SLOW_THRESHOLD) statusClass = 'slow';
    
    const card = document.createElement('div');
    card.className = `monitor-card status-${statusClass}`;
    
    card.innerHTML = `
      <div class="card-header">
        <h3>${t.name}</h3>
        <span class="status-dot ${statusClass}"></span>
      </div>
      <div class="card-body">
        <p><strong>IP:</strong> ${t.ip}</p>
        <p><strong>Porta:</strong> ${t.type === 'ping' ? 'Ping' : t.port}</p>
        <p><strong>Latência:</strong> ${t.latency || 0} ms</p>
        <p><strong>Status:</strong> ${statusClass.toUpperCase()}</p>
      </div>
      <div class="card-footer">
        <button class="btn-small" onclick="window.togglePause(${t.id})">${t.paused ? 'Continuar' : 'Pausar'}</button>
        <button class="btn-small" onclick="window.deleteTarget(${t.id})">Remover</button>
      </div>
    `;
    monitorCardsGrid.appendChild(card);
  });
}

function renderCompactView(filtered) {
  monitorCompactList.innerHTML = '';
  
  filtered.forEach(t => {
    let statusClass = t.status;
    if (t.status === 'online' && t.latency > LATENCY_SLOW_THRESHOLD) statusClass = 'slow';
    
    const div = document.createElement('div');
    div.className = `compact-row compact-row-${statusClass}`;
    
    div.innerHTML = `
      <span class="compact-status-dot ${statusClass}"></span>
      <div class="compact-info">
        <div class="compact-name">${t.name}</div>
        <div class="compact-details">${t.ip}${t.port ? ':' + t.port : ''}</div>
      </div>
      <div class="compact-latency">${t.latency || 0}ms</div>
      <div class="compact-actions">
        <button class="action-btn-compact" onclick="window.togglePause(${t.id})">${t.paused ? '▶' : '⏸'}</button>
        <button class="action-btn-compact" onclick="window.deleteTarget(${t.id})">✕</button>
      </div>
    `;
    monitorCompactList.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AÇÕES GLOBAIS
// ═══════════════════════════════════════════════════════════════════════════
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
// EXPORTAÇÃO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════
function exportData() {
  if (targets.length === 0) {
    alert('Nenhum monitor para exportar!');
    return;
  }

  const headers = ['Nome', 'IP', 'Porta', 'Tipo', 'Status', 'Latência (ms)', 'Uptime 24h', 'Última Verificação'];
  
  const rows = targets.map(t => {
    let statusClass = t.status;
    if (t.status === 'online' && t.latency > LATENCY_SLOW_THRESHOLD) statusClass = 'Lento';
    else if (t.status === 'online') statusClass = 'Online';
    else statusClass = 'Offline';
    
    const lastCheck = new Date().toLocaleString('pt-BR');
    return [
      `"${t.name}"`,
      t.ip,
      t.port || 'N/A',
      t.type || 'ping',
      statusClass,
      t.latency || 0,
      '99.98%',
      lastCheck
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `atalaia-export-${timestamp}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIAR
// ═══════════════════════════════════════════════════════════════════════════
init();
