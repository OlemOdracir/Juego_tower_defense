# Analisis y Plan de Mejora

Proyecto: Iron Bastion MVP  
Fecha: 2026-03-20  
Respaldo git inicial: commit `60df993` en rama `master`

## 1. Estado actual

El proyecto actual es un MVP jugable de Tower Defense construido con:

- Vite + Three.js
- Una sola escena 3D con `OrthographicCamera`
- UI HTML/CSS superpuesta
- Toda la logica principal centralizada en `src/main.js`

El build actual compila con `npm run build` y el loop base funciona:

- Colocacion de torres
- Mejora y venta
- Oleadas simples
- Enemigo terrestre unico
- Economia basica
- Panel inferior de inspeccion

## 2. Lectura tecnica del MVP

### Fortalezas

- El juego ya tiene un core loop visible y testeable.
- La presentacion visual es clara para un MVP.
- El path, torres, proyectiles y UI ya comparten un mismo estado de juego.
- La escala del proyecto aun permite refactor sin alto costo.

### Limitaciones estructurales

- `src/main.js` concentra render, estado, logica de combate, input, UI y datos de balance.
- El juego esta hardcodeado para una sola torre funcional y un solo tipo de enemigo.
- No existe capa de datos separada para torres, enemigos, oleadas o mapa.
- No hay tests ni utilidades para validar balance o reglas del juego.
- No hay sistema de guardado de snapshots de partida distinto al estado runtime.

## 3. Hallazgos principales

### Criticos

1. Reset de oleada inconsistente con la economia.
   `resetWave()` restaura creditos y vidas, pero no revierte torres compradas, mejoras realizadas ni ventas hechas durante la oleada. Esto permite explotar recursos y rompe el balance.

2. Estado excesivamente acoplado.
   El archivo unico hace que cualquier cambio de gameplay tenga alto riesgo de regresion en input, UI o render.

### Altos

3. No hay manejo de `resize`.
   La camara y el renderer calculan medidas solo al inicio. Al cambiar el tamano de ventana, el canvas y el picking del mouse pueden quedar desalineados.

4. El HUD se actualiza en cada frame.
   `gameLoop()` llama `updateHUD()` continuamente y, si hay una torre seleccionada, tambien reconstruye el panel. Es un costo innecesario de DOM que va a empeorar al agregar mas sistemas.

5. El balance actual no coincide con el GDD.
   El GDD define otra economia, otra progresion de MG-7 y una escala mayor de contenido. Hoy el MVP sirve como prueba de loop, no como base balanceada del juego final.

### Medios

6. El texto tiene problemas de codificacion.
   README, package metadata y algunos textos renderizan caracteres corruptos.

7. No existe una estrategia clara de contenido.
   El GDD plantea 5 torres, 10 enemigos, 30 oleadas, minimapa, prioridades de target y sinergias, pero la base actual todavia no esta modularizada para crecer a ese alcance sin deuda.

## 4. Brecha frente al GDD

## Implementado parcialmente

- Camara ortografica isometrica
- Grid con camino prefijado
- Torre MG-7
- Enemigo Scout Buggy basico
- Oleadas y economia basica
- HUD y panel de torre

## No implementado aun

- 4 torres adicionales
- 9 enemigos adicionales
- 30 oleadas y modo infinito
- Pathfinding dinamico
- Prioridades de targeting
- Sinergias entre torres
- Minimapa
- Velocidad x1/x2/x3 y pausa
- Tipos de terreno con bonificaciones
- Bosses, elites y habilidades especiales
- Economia completa del GDD

## Conclusion sobre la brecha

La distancia entre MVP y GDD no es un problema en si, pero exige cambiar la arquitectura antes de seguir agregando contenido. Si se agregan nuevas torres y enemigos sobre la estructura actual, el costo de mantenimiento subira muy rapido.

## 5. Objetivo recomendado

Antes de perseguir el GDD completo, conviene convertir el MVP actual en una base extensible. La meta inmediata no deberia ser "agregar todo", sino:

- estabilizar el loop actual
- separar datos de logica
- definir contratos para torres y enemigos
- introducir herramientas minimas de validacion

## 6. Plan de mejora propuesto

### Fase 0. Estabilizacion inmediata

Objetivo: corregir bugs y dejar una base segura.

- Corregir `resetWave()` con snapshot real de partida.
- Agregar manejo de `resize` para renderer, camara y preview.
- Actualizar HUD y panel solo cuando cambie el estado.
- Corregir textos y codificacion UTF-8.
- Agregar `.editorconfig` y convenciones basicas si quieres endurecer consistencia.

Entregable esperado:

- partida sin exploits de economia
- UI estable al redimensionar
- textos legibles

### Fase 1. Refactor de arquitectura

Objetivo: separar responsabilidades sin cambiar demasiado el gameplay.

- Extraer configuraciones a modulos de datos:
  - `src/data/towers.js`
  - `src/data/enemies.js`
  - `src/data/waves.js`
  - `src/data/map.js`
- Separar el runtime por sistemas:
  - `src/game/state.js`
  - `src/game/spawn-system.js`
  - `src/game/combat-system.js`
  - `src/game/tower-system.js`
  - `src/game/enemy-system.js`
  - `src/game/ui-system.js`
  - `src/game/scene-factory.js`
- Introducir ids por tipo:
  - `towerType`
  - `enemyType`
- Separar construccion visual de comportamiento.

Entregable esperado:

- mismo gameplay actual, pero con codigo organizado para crecer

### Fase 2. Vertical slice alineado al GDD

Objetivo: validar que la arquitectura nueva soporta variedad real.

- Mantener MG-7
- Agregar 1 torre adicional de otro arquetipo:
  - recomendacion: Mortero o Sniper
- Agregar 2 enemigos nuevos:
  - uno blindado
  - uno rapido o aereo
- Introducir prioridades de targeting
- Rebalancear primeras 5 a 8 oleadas con datos externos

Entregable esperado:

- mini version del juego con decisiones tacticas reales

### Fase 3. Sistemas del core game

Objetivo: acercarse al GDD sin perder control.

- Economia extendida:
  - bonus por oleada
  - inicio anticipado
  - interes limitado
- Tipos de dano y armadura
- Enemigos con habilidades simples
- Soporte para AoE y proyectiles especiales
- Temporizador entre oleadas
- Controles de velocidad

Entregable esperado:

- loop jugable mas profundo y mejor balanceable

### Fase 4. Contenido y polish

Objetivo: producir una version presentable.

- 5 torres base
- 10 enemigos
- oleadas 1-30
- bosses y variantes elite
- minimapa
- mejores FX y audio
- tutorial corto o tooltips utiles

## 7. Orden de implementacion recomendado

Si el objetivo es avanzar con minimo riesgo, este orden es el correcto:

1. Estabilizar bugs del MVP
2. Refactorizar arquitectura
3. Agregar una segunda torre y mas tipos de enemigo
4. Rehacer oleadas y economia en formato de datos
5. Agregar sistemas avanzados del GDD
6. Recién despues expandir contenido completo

## 8. Riesgos si no se refactoriza primero

- Cada nueva torre duplicara logica y efectos.
- Cada nuevo enemigo obligara a meter mas excepciones en el loop.
- El balance sera dificil de ajustar porque hoy esta mezclado con render y UI.
- Bugs de estado van a multiplicarse con venta, mejoras, bosses y habilidades.

## 9. Siguiente sprint recomendado

Sprint corto de alto retorno:

1. Corregir `resetWave()`
2. Agregar `resize`
3. Reducir rerenders del HUD
4. Separar datos de MG-7, Scout y oleadas a modulos
5. Dejar lista la estructura para una segunda torre

## 10. Respaldo git

Se creo un repositorio git local para respaldar el estado actual.

- Rama actual: `master`
- Commit de respaldo: `60df993`
- Mensaje: `backup: estado inicial del MVP`

Sugerencia operativa:

- usar `master` o `main` solo para estados estables
- crear ramas por trabajo, por ejemplo:
  - `fix/reset-wave`
  - `refactor/game-architecture`
  - `feature/sniper-tower`

## 11. Recomendacion final

Este proyecto ya tiene suficiente base visual y jugable para seguir creciendo, pero no deberia crecer "directo" hacia el GDD sin una fase corta de estabilizacion y refactor.

La mejor inversion inmediata es convertir el MVP actual en una base extensible. Eso baja riesgo, acelera iteracion y te acerca mucho mas rapido a una version seria del juego.
