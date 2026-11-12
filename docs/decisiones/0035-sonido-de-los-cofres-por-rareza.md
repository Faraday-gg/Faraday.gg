# 0035. Sonido de los cofres: uno por rareza y una cama de fondo

- **Estado:** propuesta (código en la rama `feat/seis-cofres`)
- **Fecha:** 2026-11-12
- **Quién:** Luis, con Claude Code
- **Amplía a:** la [0027](0027-cofres.md) (apertura de los cofres) y convive con la [0034](0034-seis-cofres.md). Mantiene las protecciones de la 0027, en especial la celebración proporcional.

## Contexto

La apertura tenía una sola fanfarria que ganaba una nota por nivel de rareza, hecha con tonos sueltos sin espacio: sonaba «muy digital» y una pieza rara y una especial casi no se distinguían. Luis pidió que el sonido cambie con la rareza (mejor, más placentero y más adictivo cuanto mejor es la pieza), que haya otro sonido de fondo además del de recompensa, y que todo se apoye en estudios de psicología sobre por qué enganchan los sonidos de las tragaperras, la ruleta y los juegos.

### Qué dicen los estudios

Los enlaces están comprobados el 12 de noviembre de 2026. Los resúmenes son nuestros.

| Estudio | Qué encontró | Qué hacemos con ello |
|---|---|---|
| Dixon y otros (2014), *The impact of sound in modern multiline video slot machine play*, J. Gambling Studies. 96 jugadores, con y sin sonido | Con sonido la respuesta de la piel (activación) es mayor, la mayoría prefiere jugar con sonido y **se sobrestima más lo ganado** (24 % frente a 15 %) | El sonido es lo que hace que un premio se sienta premio: lo cuidamos. Y como infla la sensación de ganar, solo suena a premio lo que lo es |
| Cherkasova y otros (2018), *Win-concurrent sensory cues can promote riskier choice*, J. Neuroscience. 131 voluntarios | Las luces y sonidos que acompañan a una ganancia aumentan la activación (pupila) y **llevan a elegir con más riesgo** y a fijarse menos en las probabilidades | El sonido de premio va solo en la revelación, nunca en la compra. Las probabilidades siguen a la vista y el tope de 3 compras al día se mantiene |
| Dixon y otros (2015), *Using sound to unmask losses disguised as wins*, J. Gambling Studies. 157 participantes | Si una «ganancia» menor que lo apostado suena a victoria, la gente la cuenta como victoria; con otro sonido, la clasifica bien | Un lote de faradios suena a dos campanillas y nada más, también cuando sustituye a una pieza que ya se tiene |
| Salimpoor y otros (2011), *Anatomically distinct dopamine release during anticipation and experience of peak emotion to music*, Nature Neuroscience | La dopamina se libera en dos sitios: el caudado durante la **anticipación** y el núcleo accumbens en el **momento cumbre** | La cama de fondo crece con los toques y durante la tensión, se calla un instante y vuelve con el estallido: la espera es parte del placer |
| Grewe y otros (2007), *Listening to music as a re-creative process*, Music Perception (y la revisión de Bannister sobre escalofríos musicales) | Los escalofríos coinciden con la **entrada de voces o instrumentos nuevos** y con subidas de volumen y de brillo | Cada rareza añade voces que la anterior no tiene; en épica y legendaria entran de golpe el grave y las campanillas agudas |
| Fiorillo, Tobler y Schultz (2003), ya citado en la 0027 | La respuesta de la dopamina crece con la incertidumbre y con que el premio sea mejor de lo esperado | Sonidos claramente distintos por rareza: se oye enseguida que ha tocado algo mejor de lo habitual |
| Griffiths y Parke (2005), *The psychology of music in gambling environments*, J. Gambling Issues | Estudio de observación: la música de ambiente y la de las máquinas pueden influir en cómo se empieza y se sigue jugando. Los autores avisan de que solo plantea hipótesis | La cama de fondo da ambiente, pero sin ritmo ni melodía que marquen el paso |

## Decisión

### Un sonido por rareza

Todos parten del mismo arpegio mayor ascendente de campanillas y cada nivel añade algo que el anterior no tiene (`sfx.reveal` en `dist/chest-open.js`):

| Rareza | Qué suena | Duración |
|---|---|---|
| Común | 2 campanillas, casi secas | 0,3 s |
| Especial | 3 campanillas y un brillo de aire | 0,6 s |
| Rara | 4 campanillas que desembocan en un acorde que se queda sonando | 1,1 s |
| Épica | 5 campanillas más rápidas; con el acorde entran el grave y las campanillas una octava arriba | 1,7 s |
| Legendaria | Golpe grave al empezar, 7 campanillas, un soplido que sube hasta el acorde y una lluvia de campanillas agudas | 2,8 s |

Un lote de faradios suena a dos campanillas suaves, por debajo de la común.

### Una cama de fondo

`Sound.bed()` es un acorde grave y suave que «respira» por debajo de todo mientras dura la apertura. No lleva ritmo ni melodía. Sigue a la escena:

1. Entra al caer el cofre.
2. Cada toque la abre un poco (más brillo y volumen).
3. Durante la tensión crece con el barrido.
4. Se calla en el instante de silencio previo al estallido.
5. Vuelve con el estallido y, con cada carta que se gira, se queda en un acorde más lleno y brillante según la mejor pieza enseñada hasta ese momento: quinta abierta (común y especial), acorde mayor completo (rara), con un brillo agudo (épica y legendaria).
6. Se apaga al cerrar. El botón de silencio también la corta.

### Menos «digital»

- **Campanilla** (`Sound.bell`): cada nota lleva armónicos que se apagan antes que la fundamental, como una lámina golpeada, y una segunda voz apenas desafinada.
- **Reverberación** generada en el navegador (ruido que se apaga, 2,4 s), que da espacio. Cuanto mejor es la rareza, más reverberación.
- Sigue sin haber archivos de sonido ni dependencias: todo se genera con Web Audio. Los duelos, el reto diario y «¡Casi casi!» suenan igual que antes (la reverberación es opcional y la tienen apagada).

### Lo que no se hace, aunque engancharía más

Los mismos estudios explican por qué estos sonidos funcionan en las tragaperras y por qué hacen daño. Juegan menores (0024, 0027), así que se usa lo que hace el premio más placentero y se deja fuera lo que empuja a gastar:

- **No se celebra lo que no es premio.** Los faradios no tienen fanfarria (Dixon 2015).
- **No hay sonido de «casi».** Nada suena a «por poco te toca una legendaria».
- **No hay sonido de premio al comprar**, ni música rápida que acelere: el sonido acompaña a lo que ha tocado, no a la decisión de gastar (Cherkasova 2018).
- **Se puede silenciar** con el botón de siempre, y el ajuste se recuerda.

## Alternativas descartadas

- **Archivos de audio grabados** (campanas, monedas reales): sonarían mejor, pero el proyecto no tiene archivos de sonido ni forma de licenciarlos y revisarlos ahora. Queda como mejora posible.
- **Música de fondo con ritmo:** la música rápida se asocia a jugar más deprisa en la literatura sobre juego; una cama sin pulso da ambiente sin marcar el paso.
- **Cambiar de tonalidad en la legendaria:** chocaría con la cama de fondo, que sigue sonando. La sorpresa se consigue con la entrada de voces y el salto de registro.
- **Que la cama anuncie la mejor rareza desde el estallido:** adelantaría el resultado de todas las cartas. Solo sube cuando la carta se gira.

## Consecuencias

- **Nadie lo ha escuchado.** El agente no puede oír. Se ha medido renderizando el sonido sin altavoces: de común a legendaria suben el pico (0,10 → 0,13 → 0,16 → 0,55 → 0,58, sin saturar), la energía media y la duración; los faradios quedan por debajo de la común (pico 0,07); la cama se calla en el silencio y se apaga al cerrar. Eso garantiza la escalera, no que suene bonito: **Luis tiene que oírlo y afinarlo.**
- **Hace los cofres más atractivos**, que es lo que se pedía y también el riesgo: según los estudios citados, el sonido de premio aumenta la activación y la sensación de ganar. Si llegan quejas o antes de vender faradios, además de retirar la compra (0027) se puede dejar la revelación en el sonido de la común para todas las rarezas.
- La evidencia viene de tragaperras y de música, con adultos; no hay estudios sobre este juego ni con menores. Es una extrapolación.
- La apertura de una legendaria crea unas 250 voces de Web Audio en pocos segundos. En el equipo de desarrollo no da problemas; no se ha probado en móviles lentos.

## Fuentes

- Dixon y otros (2014): https://pmc.ncbi.nlm.nih.gov/articles/PMC4225056
- Cherkasova y otros (2018): https://pmc.ncbi.nlm.nih.gov/articles/PMC6596211
- Dixon y otros (2015): https://www.springermedicine.com/using-sound-to-unmask-losses-disguised-as-wins-in-multiline-slot/21662046
- Salimpoor y otros (2011): https://www.zlab.mcgill.ca/publications/docs/salimpoor_2011_nn.pdf
- Grewe y otros (2007), a través de la revisión de Bannister: https://sysmus17.qmul.ac.uk/wp-content/uploads/2017/08/bannister_chills.pdf
- Griffiths y Parke (2005): https://irep.ntu.ac.uk/id/eprint/5093/
- Fiorillo, Tobler y Schultz (2003): https://www.pdn.cam.ac.uk/system/files/documents/2003-fiorillo-science.pdf
