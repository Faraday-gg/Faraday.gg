# Banco editorial de Ascensión: fuentes, cobertura y licencia

- **Estado:** banco inicial implementado y validable, versión `2026-11-19-1`.
- **Fecha de preparación:** 19 de noviembre de 2026.
- **Autoría editorial:** Álvaro, con Codex. Preguntas, selección de aliases y puntos propios de Faraday; no se ha descargado ni copiado el banco de Krillion.

## Qué contiene

`content/ascension.json` contiene 28 categorías y 2.637 respuestas canónicas. Los aliases no se cuentan como respuestas adicionales. Las categorías `theme` permiten que el selector diario limite la concentración de un mismo dominio. El motor conserva su propia copia de las categorías de una partida empezada: cambiar el banco después no debe cambiar sus respuestas o puntuación.

| Conjunto | Categorías | Respuestas canónicas | Cobertura |
| --- | ---: | ---: | --- |
| Países y territorios | 6 | 514 | Conjunto mundial CLDR y sus cinco agrupaciones continentales; un mismo territorio aparece en el conjunto mundial y en su continente |
| Conceptos con emoji oficial | 10 | 478 | Animales, alimentos/bebidas, transportes, ropa/accesorios, instrumentos, material deportivo, oficina/correo, herramientas, casa y tecnología |
| Laureados | 6 | 1.020 | Premios Nobel y premio de Economía, desde 1901 hasta 2025 inclusive |
| Elementos químicos | 1 | 118 | Los 118 elementos reconocidos; nombres españoles y símbolos |
| Constelaciones | 1 | 88 | Las 88 constelaciones oficiales; nombres latinos y traducciones españolas registradas |
| Provincias españolas | 1 | 50 | Las 50 provincias; no las ciudades autónomas |
| Entidades mexicanas | 1 | 32 | 31 estados y Ciudad de México |
| Lenguas | 1 | 183 | Entradas con código ISO 639-1 de dos letras en la lista consultada de Library of Congress |
| Monedas | 1 | 154 | Monedas de curso legal el 1 de enero de 2024 según el historial de CLDR 46 |

El total suma entradas por categoría, no entidades distintas en todo el juego. Los conjuntos geográficos se solapan y hay personas premiadas en más de una disciplina. La versión del JSON es la fuente de verdad sobre las cantidades.

## Fuentes primarias consultadas

| Fuente | Uso concreto | Licencia o tratamiento |
| --- | --- | --- |
| [Unicode Emoji 16.0](https://unicode.org/Public/emoji/16.0/emoji-test.txt) | Pertenencia de un concepto al repertorio oficial y subgrupo de referencia | Unicode-3.0; datos adaptados y atribución conservada |
| [Unicode CLDR 46: anotaciones españolas](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotations/es.xml) y [anotaciones derivadas](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotationsDerived/es.xml) | Nombres españoles de los conceptos; no se convierten todas las palabras clave en aliases | Unicode-3.0 |
| [CLDR 46: español](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/main/es.xml), [respaldo inglés](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/main/en.xml), [códigos regulares](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/validity/region.xml) y [datos suplementarios](https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/supplemental/supplementalData.xml) | Nombres de países/territorios, agrupación continental, nombres de lenguas y de monedas, historial de curso legal | Unicode-3.0 |
| [Nobel Prize API v1: laureados](https://api.nobelprize.org/v1/laureate.json) | Nombres y pertenencia a las seis categorías hasta 2025 | CC0. El [comunicado oficial de Nobel Media](https://www.mynewsdesk.com/us/nobelprize.org/pressreleases/open-data-about-the-nobel-prize-now-available-832152) distingue los proyectos de datos abiertos del resto del sitio. No se usan biografías, motivaciones, retratos, logotipos ni medallas |
| [Library of Congress: códigos ISO 639](https://www.loc.gov/standards/iso639-2/php/code_list.php) y [archivo de códigos](https://www.loc.gov/standards/iso639-2/ISO-639-2_utf-8.txt) | Identificación del conjunto de lenguas con código de dos letras; nombres españoles desde CLDR | Se transcriben hechos identificativos y nombres; se conserva la referencia oficial |
| [IUPAC: tabla periódica](https://iupac.org/what-we-do/periodic-table-of-elements/) | Existencia y símbolos de los 118 elementos | Lista factual, sin reproducir imagen o diseño de la tabla |
| [Real Sociedad Española de Química: El Club del Alambique, marzo de 2024](https://gehci.rseq.org/wp-content/uploads/2024/11/4a_El_Club_del_Alambique_Vol2_No1_Marzo_2024_corregido.pdf) | Contraste de los nombres españoles de elementos, incluidas variantes como lawrencio/laurencio | Solo nombres y variantes; no se reproduce el artículo, sus ilustraciones o su tabla gráfica |
| [IAU: constelaciones](https://iauarchive.eso.org/public/themes/constellations/) y [NASA StarChild: lista de las 88](https://starchild.gsfc.nasa.gov/docs/StarChild/questions/88constellations.html) | Pertenencia al conjunto y nombres latinos | Lista de hechos; traducciones españolas y aliases preparados por Faraday. No se usan mapas estelares ni imágenes |
| [INE: provincias por comunidad autónoma](https://ine.es/daco/daco42/codmun/cod_ccaa_provincia.htm) | Conjunto completo de las 50 provincias y denominaciones cooficiales | Solo nombres de demarcaciones; referencia oficial conservada |
| [INEGI: división estatal con nombres](https://cuentame.inegi.gob.mx/imprime_tu_mapa/doc/nal-division_estatal_con_nombres-color.pdf) | Conjunto completo de las 32 entidades federativas | Solo nombres de demarcaciones; no se reproduce el mapa |

Algunas consultas web de Nobel respondieron 403; las versiones públicas de su API sí se descargaron con el identificador de la investigación editorial. Las descargas no utilizaron credenciales ni sesión. El banco de juego conserva únicamente los nombres y su categoría, no las fechas de nacimiento, afiliaciones u otros campos del volcado original.

## Rareza editorial

Los puntos son una clasificación editorial fija de familiaridad estimada. No son probabilidades, frecuencias de respuesta ni porcentajes de jugadores. La API del juego no recalcula los puntos a partir de los intentos recibidos y no solicita una clasificación a un modelo durante la partida.

Se distinguen 10, 30, 60, 85 y 100 puntos. Las listas manuales del preparador separan referencias muy reconocibles, conocidas, menos inmediatas y especializadas. El resto recibe el nivel base de su dominio: por ejemplo, muchos laureados poco presentes en cultura general quedan en 85, mientras que muchos objetos cotidianos quedan en 60. Hay al menos una respuesta de 100 puntos en cada categoría para que 700 puntos sea un resultado alcanzable.

Esta calibración es una primera valoración editorial, no un estudio de familiaridad de la población hispanohablante. Antes de ampliar la competición conviene revisar qué respuestas se rechazan, la distribución real de aciertos y si alguna categoría concede puntos de forma demasiado fácil. Cualquier corrección crea una versión nueva; no cambia una edición ya iniciada. No se presenta el nivel de 100 como una única respuesta secreta ni se promete que solo pueda existir una por categoría.

## Alias y normalización

- El motor ignora tildes, mayúsculas y diferencias de puntuación. El banco añade nombres alternativos reales: Reino Unido/UK, patata/papa, aguacate/palta, euskera/vasco, nombres cooficiales de provincias y abreviaturas monetarias.
- En laureados, las etiquetas habituales se enlazan mediante el identificador estable de la API y se conserva su literal como alias: por ejemplo, Alexander Fleming/Sir Alexander Fleming y Madre Teresa/Anjezë Gonxhe Bojaxhiu. Las iniciales o los tratamientos no deben convertir una respuesta conocida en otra entidad de más puntos. Se aceptan apellidos solo cuando identifican una única entrada de esa categoría. Por ejemplo, «Curie» es ambiguo en Física y no se asigna arbitrariamente a Marie o Pierre; el nombre completo sí funciona.
- No se usa la lista genérica de palabras clave de CLDR como si cada palabra fuese una respuesta válida: «animal», «objeto» o «mascota» no deberían resolver nombres concretos.
- Las presentaciones repetidas de un mismo concepto se agrupan, como las caras y los cuerpos de varios animales o los libros de distintos colores. No se inflan las cantidades contando tonos de piel ni selectores de presentación como entidades nuevas.
- El propio carácter emoji no es un alias del banco inicial. La respuesta se escribe con palabras.
- El motor sugiere una corrección de una sola edición cuando hay un único candidato; la sugerencia no concede puntos automáticamente. Los aliases de cada categoría se validan para impedir que el mismo texto resuelva dos respuestas distintas.

## Límites deliberados

Los títulos de los conjuntos emoji dicen expresamente «con emoji oficial». No representan todos los alimentos, animales o instrumentos existentes. Se fijan a Unicode 16.0 y CLDR 46; propuestas y altas posteriores no se incluyen automáticamente. Algunos nombres de CLDR son descripciones de objetos, no nombres de especies o de modelos concretos.

CLDR proporciona un catálogo geográfico, no un reconocimiento de soberanía. El conjunto mundial incluye 257 entradas regulares con nombre disponible, incluidas dependencias y territorios; figuran Vaticano, Palestina y Kosovo. La agrupación de los continentes es la de CLDR y debe leerse en la descripción de la categoría: no se deduce una política territorial propia ni se intercambian las agrupaciones durante la partida. Algunas clasificaciones transcontinentales pueden diferir de los usos escolares del jugador; es un punto a vigilar en los reportes.

Las categorías de Nobel tienen corte explícito en 2025. La de Economía corresponde al premio del Banco de Suecia en memoria de Alfred Nobel. Las categorías de lenguas incluyen entradas históricas y construidas con código de dos letras; no se anuncian como una lista de todas las lenguas vivas. La de monedas tiene fecha fija en enero de 2024 y no describe el curso legal actual ni contiene criptomonedas.

El banco inicial favorece conjuntos cerrados y verificables. Todavía no cubre preguntas abiertas de cine, videojuegos, marcas, música popular o especies ilimitadas. Para ampliarlo sin rechazos injustos hay que preparar primero una fuente con cobertura suficiente, aliases revisados y reglas claras de pertenencia; no basta con añadir unas cuantas respuestas famosas.

## Reproducción y comprobación

```sh
python3 research/preparar-ascension.py --cache /private/tmp/ascension-editorial --descargar
node tests/ascension-banco.test.mjs
```

El preparador usa la biblioteca estándar de Python y escribe el JSON y `research/ascension-manifest.json`. La descarga solo pertenece a la preparación editorial; no forma parte del servidor, el despliegue o una partida. El manifiesto registra SHA-256 de cada archivo descargado. Si se vuelve a descargar, se deben revisar las diferencias de hashes y de contenido antes de sustituir el banco: la API Nobel y las páginas de referencia pueden recibir correcciones aun con el corte de premios en 2025.

La prueba valida el banco real con el mismo normalizador del motor, la ausencia de aliases ambiguos, el tamaño mínimo, los cinco valores de puntos, una respuesta de 100 por categoría, los aliases de España y Latinoamérica y varias fronteras del conjunto (ciudades que no son provincias, premios no recibidos, etc.).

## Aviso de licencia Unicode

Los datos adaptados de Unicode conservan su atribución tanto en el JSON como en las fuentes de cada categoría. La licencia completa descargada se conserva en [licenses/unicode-license.txt](licenses/unicode-license.txt). Copyright © 1991–2026 Unicode, Inc. Unicode y sus logotipos son marcas de Unicode, Inc.; el proyecto utiliza datos, sin sugerir afiliación ni respaldo.
