# Sistema Modular de Vehiculos y Oleadas

## Objetivo

Reducir el costo de produccion visual y de balance separando cada vehiculo enemigo en tres capas reutilizables:

- movilidad
- chasis
- torreta o modulo de arma

La combinacion de estas capas define un enemigo jugable y permite generar oleadas variadas sin modelar un vehiculo totalmente nuevo para cada caso.

## Capas modulares

### 1. Movilidad

- `wheels-light`
  - 4 ruedas
  - pensado para humvee, pickups, camionetas artilladas

- `wheels-medium`
  - 8 ruedas
  - pensado para APC e IFV

- `tracks-heavy`
  - orugas
  - pensado para tanques o blindados pesados

### 2. Chasis

- `recon`
  - ligero, perfil bajo, rapido

- `utility`
  - ligero, mas alto y utilitario

- `apc`
  - voluminoso, blindado medio

- `assault`
  - pesado, blindado frontal marcado

### 3. Modulo de arma

- `pintle-mg`
  - ametralladora simple

- `autocannon`
  - canion automatico medio

- `missile-rack`
  - lanzamisiles o cohetera ligera

- `heavy-cannon`
  - canion pesado para chasis de orugas

## Progresion de oleadas

La mezcla debe ser aleatoria pero controlada por tier.

### Fase 1: oleadas tempranas

- Solo vehiculos `light`
- Objetivo: introducir lectura visual y velocidad

### Fase 2: oleadas medias

- Mayormente `light`
- Empiezan a entrar `medium`
- Objetivo: obligar al jugador a mezclar dano

### Fase 3: oleadas tardias

- `medium` frecuentes
- `heavy` ocasionales y luego regulares
- Objetivo: exigir anti-blindaje real

## Regla de generacion

- La oleada se genera con semilla fija por indice de oleada.
- Asi cada build es reproducible.
- La composicion es aleatoria solo dentro del pool permitido por fase.

## Estado actual implementado

- Catalogo modular de enemigos basado en movilidad + chasis + torreta.
- Generador de oleadas por tier:
  - primeras oleadas: solo ligeros
  - medias: ligeros + medios
  - finales: medios + pesados
- Render modular simple reutilizando la misma logica de ruedas/orugas y modulo de arma.

## Siguiente paso recomendado

- Anadir combate enemigo contra torres.
- Dar HP y clase de armadura a torres.
- Reusar esta misma base modular para introducir un Humvee artillado como primer enemigo ofensivo real.
