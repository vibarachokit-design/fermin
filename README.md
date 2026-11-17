# Vuelo del Gaviotín

Juego educativo sobre la conservación del Gaviotín Chico en Mejillones. HTML5 Canvas y JavaScript puro, sin dependencias ni compilación.

## Cómo jugarlo
El juego debe abrirse desde un servidor web (no con doble clic en `index.html`):

```bash
py -m http.server 8123 --directory juego-gaviotin/juego
```
Luego abrir http://localhost:8123. Para publicarlo basta subir la carpeta completa a cualquier hosting estático (GitHub Pages, Netlify, servidor propio).

## Fases
1. **La migración**: esquivar gaviotas y halcones, aprovechar ráfagas, juntar estrellas (50 s).
2. **La pesca**: zambullirse para atrapar 10 peces, evitando basura, redes, pelícanos y lobos marinos. La energía baja con el tiempo.
3. **Proteger el nido**: usar la herramienta correcta para cada amenaza (letrero→personas, cerco→perros, desvío→vehículos, luz cálida→focos). De noche aparecen focos de luz.

Cada fase termina con una tarjeta "¿Sabías que…?". Hay 3 vidas por fase, opción de reintentar fase, mejor puntaje guardado en el navegador, pausa (P/Esc) y silencio.

## Controles
| | Teclado | Celular / mouse |
|---|---|---|
| Fase 1 | Flechas o WASD | Arrastrar el dedo |
| Fase 2 | ← → moverse, mantener Espacio para zambullirse | Tocar el cielo para moverse, mantener el dedo en el agua para zambullirse |
| Fase 3 | 1–4 aplica la herramienta a la amenaza más urgente | Tocar herramienta y luego la amenaza |

## Estructura
- `index.html`, `game.js`: el juego completo.
- `assets/`: arte optimizado (8 MB), generado con `python tools/build_assets.py` desde `../Gaviotin_Arte_Kit/PNG`.
- `window.__gav.step(segundos)`: gancho de prueba que avanza la simulación sin depender del reloj.

## Audio
- `assets/audio/music_*.mp3`: música entregada (normalizada a −16 LUFS, sin silencios, sin carátula). Cambia por escena con transición suave; de noche la fase 3 pasa al tema nocturno.
- `assets/audio/sfx_*.mp3`: 15 efectos generados con ElevenLabs (gaviotín, chapuzones, peces, polluelos, interfaz) y el resto sintetizados con `python tools/synth_sfx.py assets/audio` (gratis, sin servicios externos).
- `assets/audio/amb_*.mp3` y `*_loop.mp3`: ambientes y loops (viento, bahía, bajo el agua, desierto, motores, pasos, zumbido del foco).
- Si falta un archivo, el juego usa un sonido sintetizado de respaldo.

## Créditos
Arte generado con IA a partir de `gaviotin-prompts-arte.md`. No incluye el logo de la Fundación Gaviotín Chico; para usarlo se necesita el archivo oficial y su autorización.
