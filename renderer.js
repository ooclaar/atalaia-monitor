const { ipcRenderer } = require('electron');

// Estado da Aplicação
let targets = [];
let testInterval = 30; // segundos
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
const autoTestStatus = document.getElementById('autoTestStatus');
const notificationsToggle = document.getElementById('notificationsToggle');
const targetsList = document.getElementById('targetsList');

// Inicialização
function init() {
  loadData();
  renderTargets();
  startAutoTest();
  
  // Listener para mudar visibilidade do campo de porta
  typeSelect.addEventListener('change', () => {
    if (typeSelect.value === 'ping') {
      portFieldContainer.style.display = 'none';
    } else {
      portFieldContainer.style.display = 'flex';
    }
  });

  notificationsToggle.addEventListener('change', () => {
    notificationsEnabled = notificationsToggle.checked;
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
  });
}

// Carregar dados do localStorage
function loadData() {
  const savedTargets = localStorage.getItem('targets');
  if (savedTargets) {
    targets = JSON.parse(savedTargets);
  }

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

// Salvar dados no localStorage
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
    alert('Por favor, preencha os campos corretamente.');
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

  // Limpar inputs
  ipInput.value = '';
  portInput.value = '';
  nameInput.value = '';
});

// Testar todos os destinos
testAllBtn.addEventListener('click', () => {
  targets.forEach(target => {
    testConnection(target.id);
  });
});

// Salvar configuração de intervalo
saveConfigBtn.addEventListener('click', () => {
  const newInterval = parseInt(intervalInput.value);
  if (isNaN(newInterval) || newInterval < 5) {
    alert('O intervalo deve ser de pelo menos 5 segundos.');
    return;
  }

  testInterval = newInterval;
  saveData();
  startAutoTest();
  alert('Configuração salva com sucesso!');
});

// Função para testar conexão individual
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

    // Detectar mudança de estado para notificação
    if (notificationsEnabled && oldStatus !== 'testing' && oldStatus !== 'Nunca') {
      if (oldStatus === 'online' && result.status === 'offline') {
        ipcRenderer.send('send-notification', {
          title: '⚠️ Host Offline',
          body: `${target.name} (${target.ip}${target.port ? ':' + target.port : ''}) parou de responder!`
        });
      } else if (oldStatus === 'offline' && result.status === 'online') {
        ipcRenderer.send('send-notification', {
          title: '✅ Host Online',
          body: `${target.name} (${target.ip}${target.port ? ':' + target.port : ''}) está de volta!`
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
}

// Deletar destino
function deleteTarget(id) {
  targets = targets.filter(t => t.id !== id);
  saveData();
  renderTargets();
}

// Iniciar/Reiniciar teste automático
function startAutoTest() {
  if (autoTestTimer) clearInterval(autoTestTimer);

  autoTestStatus.textContent = `Auto-teste: Ativo (${testInterval}s)`;
  autoTestStatus.classList.add('active');

  autoTestTimer = setInterval(() => {
    targets.forEach(target => {
      testConnection(target.id);
    });
  }, testInterval * 1000);
}

// Renderizar lista de destinos
function renderTargets() {
  if (targets.length === 0) {
    targetsList.innerHTML = `
      <div class="empty-state">
        <p>Nenhum destino cadastrado. Adicione um novo destino acima!</p>
      </div>
    `;
    return;
  }

  targetsList.innerHTML = '';
  targets.forEach(target => {
    const card = document.createElement('div');
    card.className = 'target-card';

    const statusClass = target.status;
    const statusText = target.status === 'online' ? 'Online' : (target.status === 'offline' ? 'Offline' : 'Testando...');
    const displayAddr = target.type === 'ping' ? target.ip : `${target.ip}:${target.port}`;
    const typeLabel = target.type === 'ping' ? 'Ping (ICMP)' : 'Porta TCP';

    card.innerHTML = `
      <div class="target-header">
        <div class="target-info">
          <h3>${target.name}</h3>
          <p>${displayAddr} <span style="font-size: 0.8rem; color: var(--text-secondary)">(${typeLabel})</span></p>
        </div>
        <div class="target-status ${statusClass}">
          <span class="status-dot"></span>
          ${statusText}
        </div>
      </div>
      <div class="target-details">
        <p>Último Teste: <strong>${target.lastCheck}</strong></p>
        ${target.latency ? `<p>Latência: <strong>${Math.round(target.latency)}ms</strong></p>` : ''}
        ${target.error ? `<p>Erro: <strong style="color: var(--danger-color)">${target.error}</strong></p>` : ''}
      </div>
      <div class="target-actions">
        <button class="btn-test" onclick="testConnection(${target.id})">Testar Agora</button>
        <button class="btn-delete" onclick="deleteTarget(${target.id})">Remover</button>
      </div>
    `;
    targetsList.appendChild(card);
  });
}

// Expor funções globais para os botões no HTML
window.testConnection = testConnection;
window.deleteTarget = deleteTarget;

// Iniciar app
init();
