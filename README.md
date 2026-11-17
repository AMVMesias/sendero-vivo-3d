# Sendero Vivo 3D — Ecoturismo Comunitario y Naturaleza Accesible

Prototipo de aplicación web inmersiva 3D e inclusiva desarrollado para el **Laboratorio 1 (Interculturalidad)**.

## Documentación académica
* Planteamiento completo del tema, selección del grupo vulnerable y matriz de necesidades: [docs/Laboratorio_1_Planteamiento.md](./docs/Laboratorio_1_Planteamiento.md)

## Características implementadas en el prototipo
* **Recorrido amplio de 250 m con texturas PBR reales (Three.js):** pasarela continua de madera con relieve, suelo musgoso, rocas de basalto, corteza y copas orgánicas, cascada con agua animada, mapa botánico ilustrado, aves en vuelo y tapices andinos tejidos en la ramada.
* **6 estaciones comunitarias:** *Mirador de la Neblina*, *Paso de los Árboles Abuelos*, *Huerta Elevada de Saberes Medicinales*, *Quebrada y Cascada del Agua Viva*, *Mirador de Aves y Descanso Accesible* y *Ramada de Oficios y Economía Solidaria*.
* **Navegación sin esfuerzo motriz e iconografía SVG propia:** botones de mirada sin arrastre, avance continuo tramo a tramo (`W` / `S` o flechas), salto directo por estación (`1`–`6`) y modo **Paseo guiado automático**, sin depender de emojis del sistema.
* **Perspectiva ergonómica:** cambio instantáneo entre vista a altura de silla de ruedas (`1,15 m`) y vista estándar (`1,65 m`).
* **Accesibilidad visual y cognitiva:** tamaño de texto escalable, modo alto contraste, reducción de movimiento y narración en voz alta en español (`Web Speech API`).
* **Paisaje sonoro natural adaptativo (`Web Audio API`):** brisa, aves y sonido de cascada que varía según la proximidad a la vertiente, con volumen regulable y silencio rápido.

## Cómo ejecutarlo localmente
```bash
npm install
npm run dev
```
Luego abre la URL local que muestre Vite en tu navegador (por ejemplo `http://localhost:5173`).

Para generar la versión de producción:
```bash
npm run build
```
