const { ipcRenderer } = require('electron');

// Estado da Aplicação
let targets = [];
let testInterval = 30;
let autoTestTimer = null;
let notificationsEnabled = true;
let searchQuery = '';
let nextCheckIn = 30;
let countdownTimer = null;

// Elementos do DOM
const monitorsList = document.getElementById('monitorsList');
const searchBox = document.getElementById('searchBox');
const headerSubtitle = document.getElementById('headerSubtitle');

// Stats Cards
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

// Inputs do Modal
const nameInput = document.getElementById('nameInput');
const ipInput = document.getElementById('ipInput');
const typeSelect = document.getElementById('typeSelect');
const portInput = document.getElementById('portInput');
const portFieldContainer = document.getElementById('portFieldContainer');

// Inicialização
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
    targets.forEach(t => testConnection(t.id));
    nextCheckIn = testInterval;
  });
}

function loadData() {
  const saved = localStorage.getItem('atalaia_targets');
  if (saved) {
    targets = JSON.parse(saved);
    // Garantir que todos tenham histórico para sparkline
    targets.forEach(t => {
      if (!t.history) t.history = Array(10).fill(0);
      if (!t.uptime) t.uptime = 100;
    });
  }
}

function saveData() {
  localStorage.setItem('atalaia_targets', JSON.stringify(targets));
}

// Adicionar novo destino
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
    category: 'Produção' // Padrão para o visual
  };

  targets.push(newTarget);
  saveData();
  renderMonitors();
  testConnection(newTarget.id);

  // Reset e fechar
  nameInput.value = '';
  ipInput.value = '';
  portInput.value = '';
  addModal.classList.remove('active');
});

async function testConnection(id) {
  const target = targets.find(t => t.id === id);
  if (!target) return;

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
    
    // Atualizar histórico para sparkline
    target.history.push(target.latency);
    if (target.history.length > 15) target.history.shift();

    // Notificação se mudar
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

function startAutoTest() {
  if (autoTestTimer) clearInterval(autoTestTimer);
  autoTestTimer = setInterval(() => {
    targets.forEach(t => testConnection(t.id));
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
  cardUptime.textContent = '99,98%'; // Simulado para o visual
}

function renderMonitors() {
  const filtered = targets.filter(t => 
    t.name.toLowerCase().includes(searchQuery) || 
    t.ip.toLowerCase().includes(searchQuery)
  );

  monitorsList.innerHTML = '';
  
  filtered.forEach(t => {
    const tr = document.createElement('tr');
    
    const statusClass = t.status === 'online' ? (t.latency > 150 ? 'slow' : 'online') : 'offline';
    const statusText = statusClass.toUpperCase();
    
    // Gerar SVG Sparkline simples
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
          <button class="action-btn" onclick="window.testTarget(${t.id})">🔄</button>
          <button class="action-btn" onclick="window.deleteTarget(${t.id})">🗑️</button>
        </div>
      </td>
    `;
    monitorsList.appendChild(tr);
  });
  
  updateStats();
  updateHeader();
}

// Funções Globais para botões inline
window.testTarget = (id) => testConnection(id);
window.deleteTarget = (id) => {
  if (confirm('Remover este monitor?')) {
    targets = targets.filter(t => t.id !== id);
    saveData();
    renderMonitors();
  }
};

init();
