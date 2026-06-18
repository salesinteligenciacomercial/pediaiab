# 🍕 Rosh Pizzaria - Sistema PdV Desktop

## ✨ Novidade: Agora é um Programa Windows!

Transformamos seu sistema em uma **aplicação desktop instalável** no Windows. Não precisa mais de navegador!

---

## 🚀 Como Começar (Desenvolvimento)

```bash
# Instalar dependências
npm install

# Rodar aplicação com Electron (modo desenvolvimento)
npm run dev:electron
```

A janela Electron abre automaticamente quando o servidor está pronto.

---

## 📦 Criar Instalador

```bash
# Build completo (web + desktop)
npm run build:electron
```

Gera:
- `dist-electron/Rosh Pizzaria PdV Setup x.x.x.exe` - Instalador interativo
- `dist-electron/Rosh Pizzaria PdV x.x.x.exe` - Versão portable

---

## 📋 O que foi adicionado

✅ **Electron** - Framework desktop  
✅ **electron-builder** - Gerador de instalador Windows  
✅ **IPC seguro** - Comunicação entre web e desktop  
✅ **Auto-updates** - Pronto para atualizações automáticas  
✅ **Menu nativo** - Menu do Windows nativo  

---

## 📄 Documentação Completa

Veja [ELECTRON_SETUP.md](./ELECTRON_SETUP.md) para:
- Estrutura de diretórios
- Como customizar ícone
- Troubleshooting
- Scripts disponíveis

---

## 📝 Scripts

```bash
npm run dev              # Modo web apenas
npm run dev:electron     # ✅ Desktop + live reload
npm run build            # Build web
npm run build:electron   # ✅ Build completo + instalador
npm run lint             # ESLint check
```

---

## 🎯 Próximo Passo

1. Customize o ícone em `public/icon.png` (256x256 PNG)
2. Atualize versão em `package.json` (`"version"`)
3. Execute `npm run build:electron` para criar instalador

---

**Dúvidas?** Consulte [ELECTRON_SETUP.md](./ELECTRON_SETUP.md)
