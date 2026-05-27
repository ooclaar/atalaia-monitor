# 🔍 Atalaia - Monitoramento Profissional de Infraestrutura

**Atalaia** é uma aplicação desktop de alta performance construída com Electron, projetada para monitoramento em tempo real de endpoints, servidores e dispositivos de rede. Com foco em clareza visual e precisão técnica, o Atalaia oferece uma visão holística da saúde da sua infraestrutura.

## 🚀 Novas Funcionalidades e Melhorias

### 📊 Visualização Tripla e Flexível
Escolha o modo que melhor se adapta ao seu fluxo de trabalho:
- **Modo Tabela:** Visão clássica e detalhada com gráficos de tendência (sparklines) e última verificação precisa.
- **Modo Cards:** Visual moderno com destaque para latência, uptime real e barra de histórico de disponibilidade.
- **Modo Compacto:** Layout denso em duas colunas, ideal para monitorar dezenas de hosts simultaneamente em uma única tela.

### 📈 Métricas Reais e Precisas
- **Uptime Dinâmico:** Cálculo real de disponibilidade baseado no histórico de testes (não apenas placeholders).
- **Latência Média Global:** Resumo inteligente que ignora hosts offline para fornecer uma métrica real da saúde da rede.
- **Tempo Relativo:** Feedback em tempo real de quando cada host foi verificado (ex: "agora mesmo", "há 30s").

### 🛠️ Gestão e Controle
- **Edição Dinâmica:** Altere nomes, IPs ou portas de monitores existentes sem precisar removê-los.
- **Ações Rápidas em Hover:** Interface limpa onde os controles (Editar, Pausar, Remover) aparecem suavemente ao passar o mouse.
- **Filtros Inteligentes:** Filtre seus monitores por nome, IP, porta ou categoria.

## 📥 Downloads e Releases

As versões mais recentes compiladas para **Windows**, **macOS** e **Linux** podem ser encontradas no link abaixo:

🔗 **[Últimas Releases - GitHub Actions](https://github.com/ooclaar/atalaia-monitor/actions/runs/26491290408)**

## 🏗️ Como Rodar e Desenvolver

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v20 ou superior)
- [pnpm](https://pnpm.io/) ou `npm`

### Instalação
```bash
# Clone o repositório
git clone https://github.com/ooclaar/atalaia-monitor.git

# Entre no diretório
cd atalaia-monitor

# Instale as dependências
npm install

# Inicie em modo de desenvolvimento
npm start
```

### Build Multiplataforma
Para gerar os binários para o seu sistema operacional:
```bash
npm run build
```



---
Desenvolvido com foco em **Infraestrutura e Segurança**.
