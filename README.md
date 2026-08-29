# Orbit Desktop

Cliente Windows independente para o Orbit. A interface principal é carregada de `https://lucas-pc.tail0624c3.ts.net:8443` (servidor auto-hospedado via Tailscale Funnel); por isso mudanças publicadas no site aparecem automaticamente aos usuários. A versão atual fica em `package.json` e na aba [Releases](https://github.com/Kinglucas962/orbit-desktop-releases/releases).

## Uso

1. Instale o Node.js LTS e, nesta pasta, execute `npm install`.
2. Para abrir em desenvolvimento: `npm run dev`.
3. Para criar o instalador Windows x64: `npm run dist`.
4. O instalador final fica em `dist/Orbit Setup.exe`.

O instalador cria atalhos na Área de Trabalho e no Menu Iniciar. Fechar a janela envia o Orbit para a bandeja do sistema; use o ícone da bandeja para abrir ou sair.

Ao iniciar uma transmissão de tela, o Orbit mostra um seletor seguro com as telas e janelas disponíveis. O site remoto recebe apenas a fonte escolhida.

## Atualizações pelo GitHub Releases

O atualizador está ligado ao repositório público `Kinglucas962/orbit-desktop-releases`. Também é possível substituir o destino com `ORBIT_UPDATE_OWNER` e `ORBIT_UPDATE_REPO` no ambiente de build/execução.

Para cada atualização, aumente a versão do `package.json`, execute `npm run dist` e envie os arquivos gerados em `dist/` para uma GitHub Release com a mesma tag da versão. O Orbit detecta a Release, oferece o download e mostra o botão **Reiniciar e atualizar** quando terminar.

## Ícone

O ícone (janela, bandeja e instalador) fica em `src/assets/` (`orbit-icon.png`, `orbit-tray.png`, `orbit.ico`), referenciado em `src/main.js` e em `build.win.icon` no `package.json`.
