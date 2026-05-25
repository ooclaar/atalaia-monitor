const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const net = require('net');
const ping = require('ping');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "Atalaia - Monitoramento de Ping e Portas",
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Lógica de teste de conexão (Porta ou Ping)
ipcMain.handle('check-connection', async (event, { ip, port, type }) => {
  const time = new Date().toLocaleTimeString();
  
  if (type === 'ping') {
    try {
      const res = await ping.promise.probe(ip, { timeout: 3 });
      return { 
        status: res.alive ? 'online' : 'offline', 
        time, 
        error: res.alive ? null : 'Host inacessível (Ping)',
        latency: res.time
      };
    } catch (err) {
      return { status: 'offline', time, error: err.message };
    }
  } else {
    // Teste de Porta TCP
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 3000;
      const startTime = Date.now();

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ status: 'online', time, latency });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ status: 'offline', time, error: 'Timeout' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ status: 'offline', time, error: err.message });
      });

      socket.connect(port, ip);
    });
  }
});

// Enviar Notificação
ipcMain.on('send-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});
