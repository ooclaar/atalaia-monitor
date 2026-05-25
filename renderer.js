const { ipcRenderer } = require('electron');

// Estado da Aplicação
let targets = [];
let testInterval = 30;
let autoTestTimer = null;
let notificationsEnabled = true;

// Elementos do DOM
const ipInput = document.getElementById('ipInput');
const typeSelect = document.getElementById('typeSelect');
const portInput = document.getElementById('portInput');
const portFieldContainer = document.getElementById('portFieldContainer');
const nameInput = document.getElementById('nameInput');
const addBtn = document.getElementById('addBtn');
const testAllBtn = document.getElementById('testAllBtn');
const intervalInput = document.getElementById('intervalInput');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const notificationsToggle = document.getElementById('notificationsToggle');
const targetsList = document.getElementById('targetsList');

// Modais e Navegação
const addModal = document.getElementById('addModal');
const openAddModal = document.getElementById('openAddModal');
const closeAddModal = document.getElementById('closeAddModal');
const navMonitor = document.getElementById('navMonitor');
const navSettings = document.getElementById('navSettings');
const pageMonitor = document.getElementById('pageMonitor');
const pageSettings = document.getElementById('pageSettings');

// Stats
const statTotal = document.getElementById('statTotal');
const statOnline = document.getElementById('statOnline');
const statOffline = document.getElementById('statOffline');

// Inicialização
function init() {
  loadData();
  renderTargets();
  startAutoTest();
  setupEventListeners();
}

function setupEventListeners() {
  // Navegação
  navMonitor.addEventListener('click', () => switchPage('monitor'));
  navSettings.addEventListener('click', () => switchPage('settings'));

  // Modais
  openAddModal.addEventListener('click', () => addModal.style.display = 'flex');
  closeAddModal.addEventListener('click', () => addModal.style.display = 'none');

  // Tipo de Teste
  typeSelect.addEventListener('change', () => {
    portFieldContainer.style.visibility = typeSelect.value === 'ping' ? 'hidden' : 'visible';
  });

  // Notificações
  notificationsToggle.addEventListener('change', () => {
    notificationsEnabled = notificationsToggle.checked;
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
  });
}

function switchPage(page) {
  navMonitor.classList.remove('active');
  navSettings.classList.remove('active');
  pageMonitor.style.display = 'none';
  pageSettings.style.display = 'none';

  if (page === 'monitor') {
    navMonitor.classList.add('active');
    pageMonitor.style.display = 'block';
  } else {
    navSettings.classList.add('active');
    pageSettings.style.display = 'block';
  }
}

// Carregar dados
function loadData() {
  const savedTargets = localStorage.getItem('targets');
  if (savedTargets) targets = JSON.parse(savedTargets);

  const savedInterval = localStorage.getItem('testInterval');
  if (savedInterval) {
    testInterval = parseInt(savedInterval);
    intervalInput.value = testInterval;
  }

  const savedNotifications = localStorage.getItem('notificationsEnabled');
  if (savedNotifications !== null) {
    notificationsEnabled = savedNotifications === 'true';
    notificationsToggle.checked = notificationsEnabled;
  }
}

function saveData() {
  localStorage.setItem('targets', JSON.stringify(targets));
  localStorage.setItem('testInterval', testInterval.toString());
}

// Adicionar novo destino
addBtn.addEventListener('click', () => {
  const ip = ipInput.value.trim();
  const type = typeSelect.value;
  const port = type === 'port' ? parseInt(portInput.value) : null;
  const name = nameInput.value.trim() || 'Sem nome';

  if (!ip || (type === 'port' && isNaN(port))) {
    alert('Preencha os campos corretamente.');
    return;
  }

  const newTarget = {
    id: Date.now(),
    ip,
    port,
    type,
    name,
    status: 'testing',
    lastCheck: 'Nunca',
    error: null,
    latency: null
  };

  targets.push(newTarget);
  saveData();
  renderTargets();
  testConnection(newTarget.id);

  // Limpar e fechar
  ipInput.value = '';
  portInput.value = '';
  nameInput.value = '';
  addModal.style.display = 'none';
});

testAllBtn.addEventListener('click', () => {
  targets.forEach(target => testConnection(target.id));
});

saveConfigBtn.addEventListener('click', () => {
  const newInterval = parseInt(intervalInput.value);
  if (isNaN(newInterval) || newInterval < 5) {
    alert('Intervalo mínimo: 5 segundos.');
    return;
  }
  testInterval = newInterval;
  saveData();
  startAutoTest();
  alert('Configurações salvas!');
});

async function testConnection(id) {
  const index = targets.findIndex(t => t.id === id);
  if (index === -1) return;

  const target = targets[index];
  const oldStatus = target.status;
  target.status = 'testing';
  renderTargets();

  try {
    const result = await ipcRenderer.invoke('check-connection', {
      ip: target.ip,
      port: target.port,
      type: target.type
    });

    if (notificationsEnabled && oldStatus !== 'testing' && oldStatus !== 'Nunca') {
      if (oldStatus === 'online' && result.status === 'offline') {
        ipcRenderer.send('send-notification', {
          title: '⚠️ Atalaia: Host Offline',
          body: `${target.name} (${target.ip}) parou de responder!`
        });
      } else if (oldStatus === 'offline' && result.status === 'online') {
        ipcRenderer.send('send-notification', {
          title: '✅ Atalaia: Host Online',
          body: `${target.name} (${target.ip}) está de volta!`
        });
      }
    }

    target.status = result.status;
    target.lastCheck = result.time;
    target.error = result.error || null;
    target.latency = result.latency || null;
  } catch (error) {
    target.status = 'offline';
    target.lastCheck = new Date().toLocaleTimeString();
    target.error = error.message;
  }

  saveData();
  renderTargets();
  updateStats();
}

function deleteTarget(id) {
  if (confirm('Deseja remover este host?')) {
    targets = targets.filter(t => t.id !== id);
    saveData();
    renderTargets();
    updateStats();
  }
}

function startAutoTest() {
  if (autoTestTimer) clearInterval(autoTestTimer);
  autoTestTimer = setInterval(() => {
    targets.forEach(target => testConnection(target.id));
  }, testInterval * 1000);
}

function updateStats() {
  statTotal.textContent = targets.length;
  statOnline.textContent = targets.filter(t => t.status === 'online').length;
  statOffline.textContent = targets.filter(t => t.status === 'offline').length;
}

function renderTargets() {
  if (targets.length === 0) {
    targetsList.innerHTML = `<tr><td colspan="6" class="empty-state">Nenhum host cadastrado.</td></tr>`;
    updateStats();
    return;
  }

  targetsList.innerHTML = '';
  targets.forEach(target => {
    const row = document.createElement('tr');
    
    const statusClass = `badge-${target.status}`;
    const statusText = target.status === 'online' ? 'Online' : (target.status === 'offline' ? 'Offline' : 'Testando');
    const displayAddr = target.type === 'ping' ? target.ip : `${target.ip}:${target.port}`;
    const latencyText = target.latency ? `${Math.round(target.latency)}ms` : '-';

    row.innerHTML = `
      <td><strong>${target.name}</strong></td>
      <td>${displayAddr}</td>
      <td>${target.type === 'ping' ? 'Ping' : 'Porta'}</td>
      <td>
        <span class="badge ${statusClass}">
          <span class="dot"></span> ${statusText}
        </span>
      </td>
      <td>${latencyText}</td>
      <td>
        <button class="btn btn-icon" onclick="testConnection(${target.id})" title="Testar agora">🔄</button>
        <button class="btn btn-icon" onclick="deleteTarget(${target.id})" title="Remover">🗑️</button>
      </td>
    `;
    targetsList.appendChild(row);
  });
  updateStats();
}

window.testConnection = testConnection;
window.deleteTarget = deleteTarget;

init();
