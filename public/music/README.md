# Música

Suelta aquí los archivos con **estos nombres exactos** y el juego los coge solo.
No hay que tocar código ni registrarlos en ningún sitio.

La extensión da igual: se prueba `.m4a`, luego `.mp3` y luego `.ogg`, así que
vale lo que te dé el grabador. **No hace falta convertir nada.**

| Archivo | Cuándo suena | Vibe |
|---|---|---|
| `menu.m4a` ✅ | Menú principal y selector | Enganchón, corto |
| `1.m4a` ✅ | Niños | Ligero, juguetón, chiptune alegre |
| `2.m4a` ✅ | Physical Festival | Pop energético, escolar |
| `3.m4a` ✅ | High School Competitions | Rock ligero, competitivo |
| `4.m4a` ✅ | National Sport Festival | Épico moderado, orquestal-electrónico |
| `5.m4a` ✅ | The Olympics | Épico, fanfarria, grandilocuente |
| `6.m4a`/`mp3` ❌ | Cyborg | Electrónico industrial, sintetizadores duros |
| `7.m4a` ✅ | Galaxy Athletes Meet | Synthwave espacial, atmosférico |
| `8.m4a`/`mp3` ❌ | God Velocity | Épico máximo, coral, intenso |
| `9.m4a`/`mp3` ❌ | Yourself | Ambiente, introspectivo, tenso |
| `10.m4a`/`mp3` ❌ | Nacho & Juanpa | Tenso, jefe final |
| `0.m4a` ✅ | Contrarreloj *(opcional)* | Neutro, sin drama |

**No hacen falta todos.** El nivel que no tenga archivo corre en silencio y ya:
puedes ir poniéndolos de uno en uno.

✅ ya está · ❌ falta. Los que faltan son **6 Cyborg, 8 God Velocity y 9
Yourself** y **10 Nacho & Juanpa**: esos cuatro niveles corren en silencio
hasta que los pongas.

> `0.m4a` (contrarreloj) salió de "Game settings.m4a". Si iba destinado a otro
> nivel, renómbralo y ya está: el nombre del archivo es lo único que manda.

## Formato

- **M4A (AAC) o MP3.** Los dos van en todos los navegadores, Safari incluido.
  El juego prueba `.m4a` primero y baja a `.mp3` y `.ogg`, así que no hay que
  convertir nada. OGG suena igual de bien pero Safari no lo abre.
- **Estéreo o mono**, da igual. 44.1 kHz.
- **Que enlace bien.** El tema se repite en bucle mientras dura la carrera, así
  que corta el final justo donde empieza el compás siguiente. Si acaba con
  reverberación colgando, se oye el corte.
- **De 10 s a 2 min** está bien. Los temas que ya hay duran entre 6.6 s y 15.8 s,
  que es justo lo que dura una carrera, y el del menú 47 s porque ahí uno se
  queda mirando un rato. Se repiten en bucle igual.
- **Sube el archivo ya normalizado.** El juego lo reproduce al 45 % de volumen
  para que no tape el disparo ni al público, pero no le ajusta el nivel.

## Si acaso hace falta convertir

Normalmente no. Si algún día te llega un formato raro, macOS trae `afconvert`
de serie y no hay que instalar nada:

```sh
afconvert -f m4af -d aac grabacion.wav public/music/6.m4a
```

Para ver qué es un archivo: `afinfo public/music/1.m4a`.

## Licencias

Si la música es tuya, no hay nada que hacer. Si viene de fuera, apúntala en
`CREDITS.md` **antes** de publicar: itch.io retira juegos por música con
derechos, y el Sprinter original usaba tracks con copyright que no se pueden
reutilizar aquí.
