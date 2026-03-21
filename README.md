# Iron Bastion

Tower Defense isometrico 2.5D con Three.js, camara ortografica y modelos geometricos.

## Scripts

```bash
npm install
npm run dev
npm test
npm run build
```

Abre `http://localhost:5173`.

## Arquitectura actual

- `src/game/core/`: reglas headless del juego
- `src/data/`: definiciones editables de torres, enemigos, oleadas y mapa
- `src/game/runtime/`: renderers y presenters desacoplados
- `src/main.js`: orquestacion del runtime principal
- `src/preview.js` + `preview.html`: preview aislado de torre, enemigo y panel

## Flujo de trabajo recomendado

- Cambios de balance, economia, targeting y oleadas: editar `src/data/` y validar con `npm test`
- Cambios de render y UI: editar `src/game/runtime/` y revisar con `npm run dev`
- Preview aislado: abrir `/preview.html` o `/preview.html?level=4`

## Estado del MVP refactorizado

- MG-7 Vulcan modularizada como definicion independiente
- Scout Buggy modularizado como definicion independiente
- Oleadas y mapa extraidos a datos declarativos
- Reset de oleada basado en snapshot real
- HUD reactivo, sin rerender completo por frame
- Resize desacoplado del viewport principal
- Tests del core para economia, targeting, armadura, reset y fin de oleada
