# 🏰 Iron Bastion — Tower Defense MVP v0.2

Tower Defense isométrico 2.5D con Three.js, cámara ortográfica y modelos geométricos.

## Setup (Windows / Mac / Linux)

```bash
cd iron-bastion-mvp
npm install
npm run dev
```

Abre `http://localhost:5173`

## Controles

| Acción | Control |
|--------|---------|
| Colocar torre | Click izquierdo en celda verde |
| Inspeccionar torre | Click izquierdo sobre torre |
| Mejorar torre | Botón MEJORAR en panel |
| Vender torre | Botón VENDER (con confirmación) |
| Rotar cámara | Click derecho + arrastrar |
| Zoom | Scroll del mouse |
| Iniciar oleada | Botón ▶ Oleada |

## Incluye (v0.2)

- ✅ Cámara isométrica ortográfica con zoom y rotación
- ✅ Grid 14x10 con camino, curvas, líneas de carretera y bordillos
- ✅ Torre CIWS MG-7 Vulcan con diseño inspirado en Phalanx
- ✅ 5 niveles de mejora: 1→4 cañones → Gatling rotatoria
- ✅ Cada nivel crece 15% en tamaño y cuesta el doble
- ✅ Enemigo Scout Buggy con dirección correcta y rotación suave
- ✅ Panel inferior estilo game UI profesional con:
  - Preview 3D rotatoria de la torre
  - Stats en tarjetas 2x2 (Daño, Cadencia, Rango, Escala)
  - Preview del siguiente nivel
  - Botón MEJORAR (verde) y VENDER (con monedas + confirmación)
- ✅ Sistema económico (créditos, recompensas, venta al 60%)
- ✅ 10 oleadas progresivas con reinicio por oleada o total
- ✅ Efectos: proyectiles, muzzle flash, partículas de impacto
- ✅ Terreno decorado con rocas, arbustos, marcadores de spawn/base
- ✅ Paleta Tailwind Slate cohesiva

## Estructura

```
iron-bastion-mvp/
├── package.json
├── index.html          # Layout + HUD + Panel HTML
├── src/
│   ├── styles.css      # Toda la UI (panel, botones, stats, overlays)
│   └── main.js         # Juego completo (Three.js + lógica + UI)
└── README.md
```

## Build para producción

```bash
npm run build
```

Archivos en `dist/` — deployable en Netlify, Vercel, itch.io, GitHub Pages.
