# Música

Suelta aquí los archivos con **estos nombres exactos** y el juego los coge solo.
No hay que tocar código ni registrarlos en ningún sitio.

| Archivo | Cuándo suena | Vibe |
|---|---|---|
| `menu.mp3` | Menú principal y selector | Enganchón, corto |
| `1.mp3` | Niños | Ligero, juguetón, chiptune alegre |
| `2.mp3` | Physical Festival | Pop energético, escolar |
| `3.mp3` | High School Competitions | Rock ligero, competitivo |
| `4.mp3` | National Sport Festival | Épico moderado, orquestal-electrónico |
| `5.mp3` | The Olympics | Épico, fanfarria, grandilocuente |
| `6.mp3` | Cyborg | Electrónico industrial, sintetizadores duros |
| `7.mp3` | Galaxy Athletes Meet | Synthwave espacial, atmosférico |
| `8.mp3` | God Velocity | Épico máximo, coral, intenso |
| `9.mp3` | Yourself | Ambiente, introspectivo, tenso |
| `0.mp3` | Contrarreloj *(opcional)* | Neutro, sin drama |

**No hacen falta todos.** El nivel que no tenga archivo corre en silencio y ya:
puedes ir poniéndolos de uno en uno.

## Formato

- **MP3**, 128–192 kbps. Es el único que va en todos los navegadores, Safari
  incluido. OGG suena igual de bien pero Safari no lo abre.
- **Estéreo o mono**, da igual. 44.1 kHz.
- **Que enlace bien.** El tema se repite en bucle mientras dura la carrera, así
  que corta el final justo donde empieza el compás siguiente. Si acaba con
  reverberación colgando, se oye el corte.
- **De 30 s a 2 min** está bien. Una carrera dura entre 7 y 16 segundos, pero
  el menú se queda mirando un rato.
- **Sube el archivo ya normalizado.** El juego lo reproduce al 45 % de volumen
  para que no tape el disparo ni al público, pero no le ajusta el nivel.

## Convertir a MP3

Con ffmpeg, desde lo que tengas grabado:

```sh
ffmpeg -i grabacion.wav -codec:a libmp3lame -b:a 160k public/music/5.mp3
```

Para varios de golpe:

```sh
for f in *.wav; do
  ffmpeg -i "$f" -codec:a libmp3lame -b:a 160k "${f%.wav}.mp3"
done
```

## Licencias

Si la música es tuya, no hay nada que hacer. Si viene de fuera, apúntala en
`CREDITS.md` **antes** de publicar: itch.io retira juegos por música con
derechos, y el Sprinter original usaba tracks con copyright que no se pueden
reutilizar aquí.
