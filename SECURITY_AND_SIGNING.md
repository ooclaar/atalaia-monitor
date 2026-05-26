# Guia de Segurança e Assinatura de Código (Code Signing) - Atalaia

Este documento detalha os passos necessários para assinar o aplicativo **Atalaia** e garantir que ele seja reconhecido como seguro pelo Windows (SmartScreen) e macOS (Gatekeeper).

---

## 1. Windows: Certificado Standard (OV)

O certificado **Standard (OV)** valida a existência da sua organização ou identidade individual.

### Passo a Passo para Obtenção:
1. **Escolha uma CA:** Compre um certificado de assinatura de código de uma Autoridade Certificadora (ex: [Sectigo](https://www.sectigo.com/), [DigiCert](https://www.digicert.com/), [GlobalSign](https://www.globalsign.com/)).
2. **Validação:** A CA solicitará documentos para validar sua identidade ou empresa.
3. **Exportação:** Após a aprovação, você receberá o certificado. Exporte-o para o formato `.pfx` (PKCS#12) e defina uma senha forte.

### Configuração no GitHub Actions:
Adicione os seguintes **Secrets** nas configurações do seu repositório GitHub (`Settings > Secrets and variables > Actions`):

| Secret | Descrição |
| :--- | :--- |
| `WIN_CSC_LINK` | O arquivo `.pfx` convertido para uma string **Base64**. |
| `WIN_CSC_KEY_PASSWORD` | A senha que você definiu ao exportar o arquivo `.pfx`. |

> **Comando para converter o PFX em Base64 (Linux/Mac):**
> `base64 -w 0 seu_certificado.pfx > certificado_base64.txt`

---

## 2. macOS: Apple Developer Program

Para o macOS, a assinatura é obrigatória para evitar que o app seja bloqueado.

### Requisitos:
1. **Conta Developer:** Inscreva-se no [Apple Developer Program](https://developer.apple.com/programs/) (USD 99/ano).
2. **Certificado:** No portal da Apple, crie um certificado do tipo **Developer ID Application**.
3. **App-Specific Password:** Crie uma senha específica para o app no seu ID Apple para permitir a notarização automática.

### Configuração no GitHub Actions:
Adicione os seguintes **Secrets**:

| Secret | Descrição |
| :--- | :--- |
| `APPLE_ID` | Seu e-mail da conta Apple Developer. |
| `APPLE_ID_PASSWORD` | A **App-Specific Password** (não é a senha da sua conta). |
| `APPLE_TEAM_ID` | O ID de 10 caracteres da sua equipe Apple. |
| `CSC_LINK` | O certificado `.p12` da Apple em **Base64**. |
| `CSC_KEY_PASSWORD` | A senha do certificado `.p12`. |

---

## 3. Por que o SmartScreen ainda aparece? (Reputação)

Mesmo com o certificado **Standard (OV)**, o Windows SmartScreen pode exibir um aviso nos primeiros downloads. Isso ocorre porque o certificado ainda não tem "reputação" acumulada nos servidores da Microsoft.

**Como acelerar a confiança:**
1. **Submissão Manual:** Envie seu binário assinado para análise no [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission).
2. **Uso Constante:** À medida que mais usuários baixam e executam o app clicando em "Executar assim mesmo", a reputação aumenta e o aviso desaparece automaticamente.

---

## 4. Segurança do Aplicativo (Hardening)

Como Analista de Segurança, você notará que o Atalaia foi construído com as seguintes proteções:

*   **Context Isolation:** Habilitado para isolar o processo de renderização do sistema operacional.
*   **Node Integration:** Desabilitado no frontend para prevenir ataques de injeção de script.
*   **Sandbox:** O Electron executa os processos de renderização em um ambiente restrito.
*   **Permissions:** O app solicita apenas as permissões necessárias para rede (ICMP/TCP).

---

**Desenvolvido com foco em segurança e performance.**
