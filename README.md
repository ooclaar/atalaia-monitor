# 🔍 Atalaia - Monitoramento Profissional

**Atalaia** é uma aplicação desktop moderna construída com Electron para monitoramento em tempo real de destinos IP e portas. Ideal para administradores de sistemas e desenvolvedores que precisam garantir a disponibilidade de seus serviços.

## 🚀 Funcionalidades

- **Monitoramento Duplo:** Suporte para testes de porta TCP e Ping (ICMP).
- **Notificações Nativas:** Alertas instantâneos do sistema quando um host muda de estado.
- **Interface Moderna:** GUI amigável, intuitiva e com suporte a temas claros/escuros (baseado no sistema).
- **Testes Periódicos:** Intervalos configuráveis para automação do monitoramento.
- **Histórico e Latência:** Visualize o tempo de resposta e o último horário de verificação.
- **Multiplataforma:** Binários disponíveis para Windows, Linux e macOS.

## 🛠️ Tecnologias

- [Electron](https://www.electronjs.org/)
- [Node.js](https://nodejs.org/)
- [lowdb](https://github.com/typicode/lowdb)
- [ping](https://github.com/danielzzz/node-ping)

## 📦 Como Instalar e Rodar

### Pré-requisitos
- Node.js instalado em sua máquina.

### Passos
1. Clone o repositório:
   ```bash
   git clone https://github.com/ooclaar/atalaia-monitor.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie a aplicação:
   ```bash
   npm start
   ```

## 🏗️ Build (Geração de Binários)

Para gerar os binários para o seu sistema operacional atual:
```bash
npm run build
```

---
Desenvolvido por **Ramon Alonso**.
