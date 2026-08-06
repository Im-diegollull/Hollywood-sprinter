# CLAUDE.md — Sprinter Remake

## Contexto del proyecto

Remake moderno de **Sprinter**, el clásico juego Flash de atletismo de Minijuegos/Miniplay.
El original ya no es jugable (Flash murió en 2020). Este proyecto lo revive en web moderna,
respetando la esencia del original y extendiendo la progresión.

Plataforma: **web (HTML5 + JavaScript)**, sin motor pesado.
Desarrollo en **macOS**.
Objetivo final: jugable en navegador, publicado en **itch.io** y **GitHub Pages**.
Duración estimada: **1-2 meses**.

---

## Principio rector del proyecto

> **Mantener la esencia. No sobrediseñar.**

El original funciona porque es simple: alternas teclas, corres, ganas o pierdes.
Este remake NO agrega viento, NO agrega sprint final de los rivales, NO agrega power-ups.
Lo que agrega es: que funcione sin Flash, animación pulida, y progresión que no se estanca.

Todo lo que se agregue tiene que pasar el filtro: *¿esto haría que el original fuera mejor,
o solo lo haría más complicado?*

---

## El juego original — cómo funciona de verdad

- Carrera de 100 metros lisos, **vista diagonal en perspectiva** (la pista cruza la
  pantalla de abajo-izquierda a arriba-derecha, graderío arriba y césped abajo)
- **Control único:** alternar tecla izquierda ↔ derecha lo más rápido posible
- **Sin velocidad máxima:** el único límite es lo rápido que puedas alternar
- **Sin falsa partida:** no hay descalificación, no se repite la carrera
- Cada nivel tiene su propia música característica
- 9 categorías de rivales, de niños hasta velocidad divina

### ⚠️ Mecánica crítica: los rivales NO aceleran

Este es **el** detalle que define la sensación del juego y hay que replicarlo exacto.

Los rivales arrancan a su velocidad máxima desde el disparo. Velocidad constante,
sin curva de aceleración. El jugador SÍ acelera desde cero.

**Consecuencia:** en los primeros metros los rivales siempre te sacan ventaja.
La carrera consiste en alcanzarlos y pasarlos en la segunda mitad. Esa remontada
es lo que hace que el juego se sienta bien.

Si le pones curva de aceleración a los rivales, el juego pierde su tensión característica.
**No lo hagas.**

---

## Categorías y tiempos (datos reales del original)

Estos son los rangos reales. No inventar tiempos — usar estos.

| # | Categoría | Rango de tiempo (100m) | Velocidad constante del rival |
|---|---|---|---|
| 1 | Niños | 16.03 – 14.00 s | 6.24 – 7.14 m/s |
| 2 | Physical Festival (niñas) | 14.43 – 12.90 s | 6.93 – 7.75 m/s |
| 3 | High School Competitions | 13.12 – 11.50 s | 7.62 – 8.70 m/s |
| 4 | National Sport Festival | 11.80 – 10.70 s | 8.47 – 9.35 m/s |
| 5 | The Olympics | 10.70 – 9.58 s | 9.35 – 10.44 m/s |
| 6 | Cyborg | 9.68 – 9.00 s | 10.33 – 11.11 m/s |
| 7 | Galaxy Athletes Meet | 9.00 – 8.00 s | 11.11 – 12.50 m/s |
| 8 | God Velocity | 7.50 s | 13.33 m/s |
| 9 | Yourself | Tu mejor tiempo | Replay de tu récord |

**Notas sobre el rango:** cada categoría tiene varios rivales en la pista con tiempos
distribuidos dentro de ese rango. El mejor rival de la categoría corre el tiempo bajo
del rango, el peor el tiempo alto.

**Nivel 9 (Yourself):** el rival es la repetición grabada de tu mejor carrera.
Este es el único que sí acelera, porque eres tú.

### Implicación para el balance del jugador

Para ganarle a God Velocity (7.50 s) el jugador necesita promediar 13.33 m/s.
Como el jugador acelera desde cero, su velocidad punta tiene que ser bastante más alta
que el promedio del rival. No hay tope de velocidad: quien ajusta la dificultad es
`SPEED_PER_CADENCE`, que traduce pulsaciones/segundo a m/s.

```javascript
// data/levels.js
export const LEVELS = [
  { id: 1, name: "Niños",                    fastest: 14.00, slowest: 16.03, runners: 4 },
  { id: 2, name: "Physical Festival",        fastest: 12.90, slowest: 14.43, runners: 4 },
  { id: 3, name: "High School Competitions", fastest: 11.50, slowest: 13.12, runners: 5 },
  { id: 4, name: "National Sport Festival",  fastest: 10.70, slowest: 11.80, runners: 5 },
  { id: 5, name: "The Olympics",             fastest:  9.58, slowest: 10.70, runners: 6 },
  { id: 6, name: "Cyborg",                   fastest:  9.00, slowest:  9.68, runners: 6 },
  { id: 7, name: "Galaxy Athletes Meet",     fastest:  8.00, slowest:  9.00, runners: 6 },
  { id: 8, name: "God Velocity",             fastest:  7.50, slowest:  7.50, runners: 1 },
  { id: 9, name: "Yourself",                 ghost: true,                    runners: 1 },
];

// Distribuir los tiempos de los rivales dentro del rango
function generateRivalTimes(level) {
  const times = [];
  for (let i = 0; i < level.runners; i++) {
    const t = level.runners === 1
      ? level.fastest
      : level.fastest + (level.slowest - level.fastest) * (i / (level.runners - 1));
    times.push(t);
  }
  return times;
}
```

---

## Mecánica central — alternar teclas

Esta es **la** mecánica del juego. Hay que clavarla antes que nada.

### Modelo de velocidad del jugador

```javascript
let speed = 0;              // velocidad actual (m/s)
let lastKey = null;         // 'left' | 'right'
let lastKeyTime = 0;
let cadence = 0;            // pulsaciones por segundo (suavizado)

const SPEED_PER_CADENCE = 1.4; // m/s por pulsación/segundo — no hay tope de velocidad
const DECAY_RATE = 8.0;     // desaceleración cuando no pulsas (m/s²)
const CADENCE_SMOOTHING = 0.15;
```

**Reglas clave:**

1. Solo cuenta la pulsación si es **la tecla contraria** a la anterior.
   Machacar la misma tecla no hace nada — eso es lo que da la mecánica de alternar.
1b. **Las dos teclas a la vez = caída.** Dos pulsaciones separadas por menos de
   25 ms no son una alternancia: el corredor se va al suelo y pierde 1.1 s sin
   poder hacer nada. Sin esta regla, aporrear las dos teclas cuatro veces por
   segundo hacía los 100 m en 4.82 s.
2. La velocidad objetivo depende de la **cadencia** (pulsaciones/segundo), no de sumar
   velocidad por cada pulsación.
3. Si dejas de pulsar, la velocidad decae. No puedes coastear.
4. Aceleración limitada al inicio — simula la fase de arranque real de un sprint.
   Esto es lo que crea la desventaja inicial frente a los rivales.

⚠️ **Promediar el hueco, nunca la cadencia.** `1/hueco` es convexa, así que
promediarla está sesgado al alza: con huecos de 40 ms y 300 ms la media de
`1/hueco` da 11.2 puls/s cuando en realidad se pulsa a 5.9. El ritmo natural
de dos dedos (par rápido + pausa) dispara ese sesgo y hacía 100 m en 8 s
pulsando a 6.5 puls/s. Se promedia el hueco y se invierte al final.

```javascript
function onKeyPress(key, eventTime) {
  if (key === lastKey) return;        // misma tecla = no cuenta

  const gap = eventTime - lastKeyTime;
  if (gap < STUMBLE_GAP) return fall(); // las dos teclas a la vez: al suelo

  const clamped = Math.min(Math.max(gap, MIN_KEY_GAP), MAX_KEY_GAP);
  avgGap += (clamped - avgGap) * GAP_SMOOTHING;

  lastKey = key;
  lastKeyTime = eventTime;
}

// Si llevas más sin pulsar que tu propio ritmo, manda el silencio y la
// cadencia cae sola: no hace falta constante de decaimiento aparte.
const cadence = 1 / Math.max(avgGap, timeSinceLastKey);

function update(dt) {
  const timeSinceKey = (performance.now() - lastKeyTime) / 1000;
  if (timeSinceKey > 0.3) cadence *= 0.9;

  const targetSpeed = cadence * SPEED_PER_CADENCE;   // sin techo

  // Aceleración limitada en la fase de arranque
  const accelLimit = speed < 5 ? 6.0 : 10.0;

  if (targetSpeed > speed) {
    speed = Math.min(speed + accelLimit * dt, targetSpeed);
  } else {
    speed = Math.max(speed - DECAY_RATE * dt, targetSpeed);
  }

  distance += speed * dt;
}
```

### Rivales — velocidad constante

```javascript
class Rival {
  constructor(targetTime) {
    this.speed = 100 / targetTime;   // constante, sin curva
    this.distance = 0;
  }

  update(dt) {
    this.distance += this.speed * dt;   // eso es todo
  }
}
```

Sí, es así de simple. No agregar curva de aceleración. No agregar variación.
El original funciona exactamente así y por eso se siente como se siente.

### Sin falsa partida
Decisión tomada: **no hay descalificación por salir antes**. Ni falsa partida ni
repetición de carrera. Salir pronto no penaliza, y el crono empieza con el disparo.
Rompe la fluidez y no aporta nada a la mecánica de alternar.

---

## Animación — mantener la esencia del original

El estilo de animación del original se conserva. No rehacerlo en 3D ni cambiar el look.

Lo que sí se mejora: la animación se sincroniza con la velocidad real del corredor
en vez de correr a framerate fijo. Esto elimina el efecto de "patinar" sin cambiar el estilo.

```javascript
// El frame depende de la distancia recorrida, no del tiempo
const STRIDE_LENGTH = 3.6;   // metros por ciclo completo (las dos piernas)
const cycle = distance / STRIDE_LENGTH;
```

⚠️ **El ciclo de zancada no es simétrico.** Interpolar dos senos desfasados da un
vaivén regular que el ojo lee como muñeco por muy articulado que esté el dibujo.
Un sprint tiene fases bien distintas — contacto, apoyo, impulso, talón al glúteo,
rodilla arriba, estirar, bajar — y la rodilla sube mucho más de lo que baja.
`STRIDE_POSES` en `render/Renderer.js` son ocho poses clave que se interpolan;
la pierna contraria va media vuelta desfasada y los brazos otra media.

`STRIDE_LENGTH` también importa: un velocista da unos 4.4 pasos por segundo a
tope. Con 2.0 m por ciclo las piernas iban al doble de rápido de lo real.

Con esto, si el corredor va más rápido las piernas se mueven más rápido, automáticamente
y de forma correcta.

**Referencia de sprites:** hay que recrear o adaptar el estilo del original. Opciones:
- Dibujar sprites propios imitando el estilo (pocos frames, siluetas simples)
- Adaptar assets de Kenney y ajustar la paleta
- Rotoscopiar de video de referencia de la carrera

---

## SFX — sintetizados, sin ficheros

`src/audio/SFX.js` genera todo con la Web Audio API: no hay ni un archivo de
audio en el repo. El juego no pesa más, carga instantáneo y no hay licencias
que atribuir. Lo que suena:

| Efecto | Cómo está hecho | Cuándo |
|---|---|---|
| Disparo | Ruido con paso alto + barrido 140→45 Hz + cola grave | Al pasar de "listos" a corriendo |
| Juez | Tono triangular a 392 Hz | "En sus marcas" y "listos" |
| Pisada | Ruido de banda 1300-2000 Hz + golpe a 95 Hz | Cada media zancada |
| Caída | Barrido 90→38 Hz + ruido con paso bajo | Al pulsar las dos teclas |
| Público | Dos capas de ruido en bucle, grave y aguda | Siempre, sube con la carrera |
| Meta | Rugido del público + acorde si ganas | Al cruzar |

**Las pisadas van atadas a la distancia, no al reloj.** `main.js` cuenta medias
zancadas con el mismo `STRIDE_LENGTH` que usa el renderer, así que el sonido
cae exactamente cuando el pie toca el suelo, sin sincronizar nada a mano. Si
cambia la animación, cambia el sonido solo.

Nada suena hasta la primera pulsación: los navegadores bloquean el audio sin
interacción previa, de ahí `unlock()`. **M** silencia.

---

## Música — un tema por categoría

Cada nivel tiene su música característica. Es parte de la identidad del juego.

⚠️ **Las canciones originales no se pueden usar.** El Sprinter original usaba tracks
con copyright, y aunque el juego ya no exista, los derechos siguen vigentes. Publicar
el remake con esa música en itch.io es pedir un takedown.

**Solución:** música libre que capture el mismo espíritu por nivel.

| Nivel | Vibe buscado |
|---|---|
| Niños | Ligero, juguetón, chiptune alegre |
| Physical Festival | Pop energético, escolar |
| High School Competitions | Rock ligero, competitivo |
| National Sport Festival | Épico moderado, orquestal-electrónico |
| The Olympics | Épico, fanfarria, grandilocuente |
| Cyborg | Electrónico industrial, sintetizadores duros |
| Galaxy Athletes Meet | Synthwave espacial, atmosférico |
| God Velocity | Épico máximo, coral, intenso |
| Yourself | Ambiente, introspectivo, tenso |

**Fuentes de música libre:**
- **Incompetech** (Kevin MacLeod) — CC BY, enorme catálogo, muy usado en juegos
- **OpenGameArt** — sección de música, mucha CC0
- **Free Music Archive** — filtrar por licencia CC
- **itch.io game assets** — hay packs de música para juegos gratis
- **Pixabay Music** — libre para uso comercial sin atribución

Siempre revisar la licencia antes de usar. Guardar los créditos en un archivo `CREDITS.md`.

---

## Skins por categoría

`src/render/Kits.js` da color, tamaño y cabeza a los rivales de cada nivel. El
jugador lleva **siempre** el mismo equipo: es lo que te deja encontrarte de un
vistazo entre ocho corredores.

| Nivel | Cómo se ven |
|---|---|
| 1 Niños | Bajitos (0.74), chándal amarillo y azul |
| 2 Physical Festival | Niñas con coleta, violeta y blanco |
| 3 High School | Adolescentes con los colores del centro |
| 4 National Sport | Equipación de selección, rojo y blanco |
| 5 The Olympics | Profesionales, dorsal dorado |
| 6 Cyborg | Piel metálica, visor con sensor rojo, aura |
| 7 Galaxy | Marcianos verdes con antenas, aura violeta |
| 8 God Velocity | Dorado, más alto (1.1), con aureola |
| 9 Yourself | Tu propio kit al 50 % de opacidad |

⚠️ **Ningún kit puede acercarse al rosa del jugador.** Las niñas iban de rosa
y costaba distinguirse en la pista. Si se añade un kit nuevo, comprobarlo en
carrera, no solo en la paleta.

Lo que distingue de verdad a las categorías no es el color sino la **silueta**:
la escala y el estilo de cabeza (`normal`, `ponytail`, `visor`, `antennae`,
`halo`). De espaldas y en movimiento el color se pierde antes que la forma.

---

## Rivales con nombre

`src/data/names.js` guarda un bote de 14-16 nombres por categoría, temáticos:
críos, niñas, adolescentes, atletas de selección, élite mundial, unidades
robóticas, marcianos.

**Los tiempos se barajan antes de repartirlos.** El rango de la categoría no
cambia —el mejor rival de Olimpiadas siempre hace 9.58— pero quién lo corre
cambia en cada carrera, y también su carril. Sin esto ganaba siempre el mismo
carril y te aprendías la pista en lugar de correrla. Repetir con `R` vuelve a
sortear.

---

## Nadie frena en la línea

Al cruzar la meta el crono se congela pero los corredores **siguen de largo**,
aflojando a `RUNOUT_DECEL` (3.2 m/s²). Clavarse en la línea se veía raro y no
es lo que hace un velocista.

Esto obliga a separar dos relojes en `Race`: `time` es el tiempo oficial y se
para en la meta; `runout` cuenta lo de después y es lo que mueve a la gente.
Por eso `Runner.finish()` **no** recorta la distancia a 100 m.

---

## Modos de juego

Simple, sin inflar:

1. **Carrera** — el modo campaña, los 9 niveles en orden
2. **Contrarreloj** — solo tú y el cronómetro, para farmear tu mejor tiempo

El nivel 9 (Yourself) ya cubre la funcionalidad de fantasma, no hace falta un modo aparte.

---

## Stack

| Componente | Tecnología |
|---|---|
| Render | HTML5 Canvas 2D |
| Lenguaje | JavaScript (vanilla o TypeScript) |
| Build | Vite |
| Audio | Web Audio API |
| Persistencia | localStorage (récords, progreso, replay del fantasma) |
| Sprites | Propios, estilo del original |
| Deploy | GitHub Pages + itch.io |
| Control de versiones | Git + GitHub |

**Por qué no Godot:** este juego es 2D simple, una sola pantalla, sin física compleja.
Canvas puro es más liviano, carga instantáneo en web y el código es más portable.
Godot para el roguelike tiene sentido; aquí sería sobreingeniería.

---

## Estructura del proyecto

```
sprinter-remake/
├── index.html
├── src/
│   ├── main.js              # Entry point, game loop
│   ├── game/
│   │   ├── Runner.js        # Corredor del jugador
│   │   ├── Rival.js         # Rival de velocidad constante
│   │   ├── Ghost.js         # Nivel 9 — replay del récord del jugador
│   │   ├── Race.js          # Estado de la carrera, cronómetro, salida
│   │   ├── Input.js         # Teclado + táctil
│   │   └── Physics.js       # Modelo de cadencia/velocidad
│   ├── render/
│   │   ├── Renderer.js      # Dibujo en canvas
│   │   ├── Animation.js     # Frames sincronizados con distancia
│   │   └── Track.js         # Proyección diagonal, carriles, graderío, césped
│   ├── audio/
│   │   ├── MusicManager.js  # Un track por nivel
│   │   └── SFX.js           # Disparo, pasos, público
│   ├── data/
│   │   └── levels.js        # Las 9 categorías con sus tiempos reales
│   ├── ui/
│   │   ├── Menu.js
│   │   ├── HUD.js           # Cronómetro, velocidad, posición
│   │   └── Results.js       # Resultado de la carrera
│   └── storage/
│       └── Records.js       # localStorage
├── assets/
│   ├── sprites/
│   └── audio/
├── CREDITS.md               # Atribución de música y assets
└── CLAUDE.md
```

---

## Roadmap

### Semana 1-2 — La mecánica central
**Objetivo:** que alternar teclas se sienta bien. Nada más importa si esto falla.

- [x] Setup del proyecto con Vite
- [x] Canvas con game loop (requestAnimationFrame + delta time)
- [x] Sistema de input: detectar alternancia izquierda/derecha
- [x] Modelo de velocidad basado en cadencia
- [x] Rectángulo que se mueve según la velocidad
- [x] Cronómetro y distancia en pantalla
- [x] **Calibrar constantes** hasta que 7.5s sea posible pero muy difícil
      (calibrado por simulación — falta validar la sensación jugando)

**Milestone:** correr 100m con un cuadrado y que se sienta bien.

---

### Semana 3-4 — Carrera completa
**Objetivo:** una carrera de verdad con rivales y resultado.

- [x] Secuencia de salida: "En sus marcas... listos... ¡YA!" (sin descalificación)
- [x] Clase Rival con velocidad constante
- [x] Varios rivales en carriles con tiempos distribuidos en el rango
- [x] Línea de meta y detección de llegada + posición final
- [x] Pantalla de resultado (tu tiempo, posición, tiempos de los rivales)
- [x] Cámara diagonal que sigue al jugador
- [x] Pista con carriles, graderío y césped en perspectiva

**Milestone:** carrera completa jugable contra rivales reales.

---

### Semana 5-6 — Contenido y progresión
**Objetivo:** el juego completo.

- [x] Las 9 categorías con sus tiempos reales
- [x] Progresión: ganar desbloquea la siguiente categoría
- [x] Guardado en localStorage (nivel alcanzado, récords por categoría)
- [x] Grabación del replay para el nivel 9 (Yourself)
- [x] Nivel 9 funcionando con el fantasma
- [x] Menú principal + selector de categoría
- [x] Modo contrarreloj

**Milestone:** juego completo de principio a fin.

---

### Semana 7-8 — Pulido y deploy
**Objetivo:** que se vea y suene profesional.

- [ ] Sprites de corredor con animación sincronizada
- [x] Aspecto distinto por categoría (niños, niñas, cyborgs, marcianos, dios)
- [x] Reproductor de música por nivel — faltan los archivos, ver `public/music/`
- [x] SFX: disparo de salida, pasos, público (sintetizados, sin ficheros)
- [ ] Partículas de polvo en las zancadas
- [ ] Soporte táctil (dos botones grandes en mobile)
- [ ] Deploy a GitHub Pages + itch.io
- [ ] README con GIF de gameplay

**Milestone:** link público y jugable.

---

## Decisiones técnicas clave

### Game loop con delta time
Nunca asumir 60fps. Todo movimiento multiplicado por `dt`.

```javascript
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap para evitar saltos
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
```

### Unidades
La lógica del juego trabaja en **metros y segundos**, nunca en píxeles.
El renderer es el único que convierte. Esto mantiene los tiempos realistas
y hace el juego independiente de la resolución.

```javascript
const PIXELS_PER_METER = 40;
```

### Nivel 9 — Yourself
Grabar la posición del jugador cada frame durante su mejor carrera de la categoría 8.
Guardar en localStorage y reproducir como corredor semitransparente.

```javascript
// Grabar
ghostData.push({ t: raceTime, x: distance });

// Reproducir: interpolar entre los dos samples más cercanos al tiempo actual
```

Si el jugador aún no tiene un récord guardado, usar el tiempo de God Velocity como fallback.

### Input táctil
Dos zonas grandes en la mitad inferior de la pantalla. Misma lógica de alternancia.
Usar `touchstart` con `preventDefault()` para evitar delay y scroll.

---

## Recursos

| Recurso | URL |
|---|---|
| Vite | https://vite.dev |
| MDN Canvas API | https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API |
| MDN Web Audio API | https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API |
| Incompetech (música CC) | https://incompetech.com |
| OpenGameArt | https://opengameart.org |
| Pixabay Music | https://pixabay.com/music/ |
| Audio SFX gratis | https://freesound.org |
| Sprinter original (referencia) | https://www.miniplay.com/game/sprinter |
| Deploy GitHub Pages | https://pages.github.com |
| Publicar en itch.io | https://itch.io/docs/creators/html5 |

---

## Convenciones de código

```javascript
// Variables y funciones: camelCase
let currentSpeed = 0;
function updateRunner(dt) {}

// Constantes: UPPER_SNAKE_CASE
const RACE_DISTANCE = 100;

// Clases: PascalCase
class Runner {}

// Exports nombrados
export { Runner };
```

---

## Estado actual

- [x] Proyecto creado con Vite
- [ ] Repositorio GitHub creado
- [x] Canvas + game loop funcionando
- [x] Mecánica de alternancia implementada

### Calibración actual (simulada, cadencia constante y perfecta)

`SPEED_PER_CADENCE = 1.23` está calibrado para que **6 pulsaciones/s den 14.30 s**.
Sin tope de velocidad, la escalera queda así:

| Categoría | Tiempo | Puls/s para ganar |
|---|---|---|
| 1 Niños | 14.00 s | 6.1 |
| 2 Physical Festival | 12.90 s | 6.7 |
| 3 High School | 11.50 s | 7.6 |
| 4 National Sport | 10.70 s | 8.3 |
| 5 Olympics | 9.58 s | 9.4 |
| 6 Cyborg | 9.00 s | 10.1 |
| 7 Galaxy | 8.00 s | 11.8 |
| 8 God Velocity | 7.50 s | 12.8 |

La pantalla de resultados muestra tus **pulsaciones por segundo de media**. Es la
forma de comprobar si la calibración está mal o si simplemente se pulsa más rápido
de lo que uno cree: si el juego mide 10 y tú creías ir a 6, el problema no es la
curva.

Con el estimador de cadencia corregido estos números son honestos: el tiempo ya no
depende de lo irregular que se pulse. Pulsando a 6/s con temblores de ±0% a ±70%
salen 13.9-14.0 s en los cuatro casos. Ajustar con el panel de calibración (`F2`)
si la curva se siente dura o blanda.

### Ángulo de la pista

Medido sobre una captura del original a pantalla completa (vídeo de gameplay,
no la miniatura, que estaba deformada): las líneas de carril bajan hacia la
derecha con pendiente **0.20** y la línea de salida sube con pendiente **0.35**.
Las dos salen de la misma proyección: guiñada **37°** y eje vertical aplastado
a **0.26**, o sea una cámara bastante baja sobre la pista.

Lo que hay fuera de la pista también importa: el césped va pegado al carril 1
y por fuera del carril 8 **solo hay cielo azul, no hay graderío**. Números de
carril pintados sobre el tartán junto a la salida y juez de salida de rojo
sobre el césped.

Las constantes viven en `src/render/Track.js`. `SCALE` es el zoom: el original
está en unos 122 px/m, pero a esa distancia solo caben 8 m de pista y los
rivales se salen de pantalla en cuanto te sacan ventaja. Está puesto en 100,
que deja ver unos 12 m con los carriles llenando el ancho igual.

Los corredores se miden contra `LANE_PITCH`, no en píxeles fijos: si se mueve
el zoom, los atletas acompañan solos.

### Semana 3-4 verificada

Las 8 categorías con rivales se comprobaron por simulación. Cadencia necesaria
para ganar: 6 puls/s basta para Niños, 8 llega hasta National Sport Festival,
10 hasta Cyborg y 12 gana a God Velocity.

### Semana 5-6 verificada

- **Progresión:** ganar una categoría desbloquea la siguiente. Solo la 1 empieza
  abierta. El desbloqueo no retrocede aunque vuelvas a ganar una anterior.
- **Fantasma:** el replay se graba cada 0.04 s en un array plano `[t, x, t, x…]`
  y solo se guarda cuando bates tu récord de God Velocity. Se comprobó que el
  fantasma sí acelera (0.5 m al medio segundo, 30 m a los 3 s), que es lo que lo
  distingue de un rival normal. Sin replay guardado, el nivel 9 cae en God
  Velocity a 7.50 s.
- **Contrarreloj:** carrera sin rivales. No se gana ni se pierde, solo cronometra.

**Claves de localStorage:** `sprinter:records` (récord por categoría),
`sprinter:progress` (categoría más alta desbloqueada), `sprinter:ghost` (replay).

### El exploit de las dos teclas (corregido)

Se podía hacer 100 m en menos de 5 s pulsando izquierda y derecha **a la vez**,
solo cuatro veces por segundo. Pasaba el filtro de alternancia (izquierda ≠
derecha) y el hueco de milisegundos entre las dos teclas se leía como una
cadencia de 300 pulsaciones/s.

Tres cambios, y los tres hacen falta:

1. **Sellar las pulsaciones con `event.timeStamp`**, no con el cronómetro de
   carrera ni con `performance.now()` al procesarlas. El cronómetro solo avanza
   una vez por frame, así que falseaba los huecos; y si la pestaña se congela,
   los eventos se entregan de golpe y leer el reloj en ese momento daría huecos
   de 1 ms entre teclas pulsadas con separación real.
2. **Techo a la cadencia instantánea** (`MIN_KEY_GAP`, 50 ms = 20 puls/s).
3. **Caída** por debajo de `STUMBLE_GAP` (25 ms).

El umbral está medido, no puesto a ojo: alternando a 16 puls/s con ±50% de
temblor el hueco más corto fue de 32 ms, así que no salta jugando rápido y
sucio. Aporreando las dos teclas no se termina la carrera.

**Próximo paso:** Semana 7-8. Los SFX ya están (sintetizados, ver arriba) y el
reproductor de música también: solo falta soltar los archivos en
`public/music/` con el nombre del nivel (`5.mp3`), en MP3 de 128-192 kbps y que
enlacen bien en bucle. El nivel sin archivo corre en silencio y no rompe nada.
Queda polvo en las zancadas, botones táctiles grandes y deploy. El corredor ya tiene extremidades articuladas y pose de caída, pero
sigue siendo geometría dibujada a mano, no sprites. El ciclo de zancada va
atado a la distancia, así que los sprites entran sin tocar la lógica.

`CREDITS.md` ya está creado con la tabla de música vacía: hay que rellenar una
fila por tema antes de publicar, sobre todo si alguno viene de fuera.
