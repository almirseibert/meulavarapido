# 📦 Kit de Publicação — Meu Lava Rápido (Google Play)

Tudo o que você precisa para subir o app na Google Play está nesta pasta.

## Comece por aqui
1. **[MANUAL_PUBLICACAO.md](MANUAL_PUBLICACAO.md)** — passo a passo completo, do build à publicação.
2. **[TEXTOS_LOJA.md](TEXTOS_LOJA.md)** — todos os textos prontos para copiar e colar.
3. **[POLITICA_PRIVACIDADE.md](POLITICA_PRIVACIDADE.md)** — modelo para publicar em uma URL.

## Imagens prontas para enviar (`assets/`)
- `icon-512.png` — ícone da loja (512×512)
- `feature-graphic.png` — gráfico de destaque (1024×500)
- `screenshot-01..06-*.png` — capturas promocionais (1080×1920)
- `fluxo-publicacao.png` — diagrama de apoio do manual

## Regerar as artes
```bash
cd play-store
npm install          # só na 1ª vez (instala o sharp)
node build-assets.js # ícone, destaque e capturas
node build-flow.js   # diagrama do fluxo
```
Edite cores, textos e números de exemplo em `build-assets.js`.

## ⚠️ Antes de publicar (resumo)
- Decida sobre **anúncios** (AdMob): remover ou trocar os IDs de teste por reais — ver Parte 0 do manual.
- Configure as **assinaturas** (mensal/anual) e o **RevenueCat** — ver Parte 7.
- Contas pessoais novas: **teste fechado com 12 testadores por 14 dias** — ver Parte 9.
