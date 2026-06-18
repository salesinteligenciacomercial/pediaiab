# 🖥️ Guia de Instalação do Rosh Pizzaria PdV (Desktop)

## Introdução

O **Rosh Pizzaria PdV** agora está disponível como uma **aplicação desktop instalável** no Windows. Você pode:
- ✅ Instalar em qualquer computador Windows
- ✅ Usar offline (após primeira sincronização)
- ✅ Atualizações automáticas
- ✅ Acesso direto na área de trabalho

---

## 📋 Desenvolvimento Local (Dev)

### 1. Clonar e instalar dependências
```bash
npm install
```

### 2. Executar em modo desenvolvimento com Electron
```bash
npm run dev:electron
```

Este comando:
- Inicia o Vite dev server na porta 5173
- Aguarda até a aplicação estar pronta
- Abre a janela Electron conectada ao dev server
- Mostra DevTools para debug

---

## 🏗️ Build e Distribuição

### 1. Gerar build de produção
```bash
npm run build:electron
```

Este comando:
1. Compila a aplicação React com Vite (`npm run build`)
2. Compila os arquivos Electron TypeScript (`npm run build:electron:main`)
3. Executa o `electron-builder` para criar instalador

### 2. Arquivos gerados
Após o build, você encontrará em `dist-electron/`:
```
dist-electron/
├── Rosh Pizzaria PdV Setup x.x.x.exe    ← Instalador interativo
└── Rosh Pizzaria PdV x.x.x.exe          ← Portable (não precisa instalar)
```

---

## 🚀 Instalação do Usuário Final

### Opção 1: Instalador (Recomendado)
1. Baixe `Rosh Pizzaria PdV Setup x.x.x.exe`
2. Clique 2x para executar
3. Escolha a pasta de instalação
4. Clique em "Instalar"
5. Atalho será criado na **Área de Trabalho** e **Menu Iniciar**

### Opção 2: Portable (Sem instalação)
1. Baixe `Rosh Pizzaria PdV x.x.x.exe`
2. Copie para qualquer pasta
3. Execute diretamente (não altera registro do Windows)
4. Ideal para usar em pen drive ou compartilhado

---

## 📦 Estrutura do Projeto

```
public/electron/
├── main.ts           ← Processo principal do Electron
└── preload.ts        ← API segura para comunicação IPC

package.json
├── "main": "main.js" ← Entry point quando instalado
├── "build":          ← Configuração electron-builder (NSIS, portable)

main.js, preload.js  ← Compilados (gerados por tsc)
dist/                ← Build web (gerado por Vite)
```

---

## ⚙️ Configurações Importantes

### 1. Menu da Aplicação
- **Arquivo** → Sair (Ctrl+Q)
- **Editar** → Desfazer, Refazer, Cortar, Copiar, Colar
- **Ajuda** → Sobre (mostra versão)

### 2. Auto-Update (Futuro)
O código está pronto para verificar atualizações automaticamente:
```typescript
autoUpdater.checkForUpdatesAndNotify(); // Em produção
```

Você precisará:
- Hospedar releases no GitHub/servidor próprio
- Configurar `electron-builder.yml` com URL de atualização

### 3. DevTools
- Em **desenvolvimento**: DevTools abrem automaticamente (F12)
- Em **produção**: DevTools desabilitado por segurança

---

## 🔧 Troubleshooting

### A aplicação não inicia
```bash
# 1. Verifique se as dependências estão instaladas
npm install

# 2. Compile os arquivos Electron novamente
npx tsc -p tsconfig.electron.json

# 3. Reconstrua tudo
npm run build:electron
```

### Erro "Cannot find module"
Certifique-se de que compilou com:
```bash
npm run build:electron:main
```

### Deseja resetar a aplicação
```bash
# Remove a instalação
# Vá para: Painel de Controle → Programas e Recursos → Desinstale "Rosh Pizzaria PdV"

# Limpa cache
rm -r %APPDATA%\Rosh Pizzaria PdV
```

---

## 📝 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Vite dev server (web apenas) |
| `npm run dev:electron` | Electron dev mode com live reload |
| `npm run build` | Build web (Vite) |
| `npm run build:electron:main` | Compila main.ts e preload.ts |
| `npm run build:electron` | Full build + instalador Windows |
| `npm run lint` | ESLint check |

---

## 🎯 Próximos Passos

1. **Customize o ícone** (`public/icon.png`)
   - Tamanho: 256x256 PNG
   - Será usado no instalador e atalho

2. **Configure auto-updates**
   - Edite `main.ts` com URL de atualização
   - Implemente servidor de releases

3. **Customize o instalador NSIS**
   - Edite `"nsis"` em `package.json` para personalizar mensagens

---

## 📞 Suporte

Para problemas com:
- **Electron**: https://www.electronjs.org/docs
- **electron-builder**: https://www.electron.build
- **Rosh Pizzaria**: Contate o desenvolvedor

---

**Versão**: 0.0.0 (Atualize em `package.json`)  
**Última atualização**: 2026-06-18
