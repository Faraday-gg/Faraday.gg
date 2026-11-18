"""Genera la rotación auditada a partir del banco histórico y de descargas públicas.

Uso: python3 research/preparar-tendencias-estables.py CARPETA [--auditar]
Las descargas son instantáneas locales. Las URLs y los criterios se explican en la decisión 0092.
"""
import csv
import io
import json
import math
import random
import re
import sys
import zipfile
from calendar import monthrange
from collections import Counter, defaultdict
from itertools import accumulate
from pathlib import Path
from statistics import mean
from urllib.parse import urlencode

AEMET = 'https://www.aemet.es/es/serviciosclimaticos/datosclimatologicos/valoresclimatologicos'
NGRAM = 'https://books.google.com/ngrams/graph'
WDI = 'https://data.worldbank.org/indicator/'
MONTHS = 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split()
LIMITS = (0.25, 0.115, 0.085)
ROOT = Path(__file__).resolve().parents[1]


def metrics(chart):
    """Incluye la pendiente anterior al corte para evaluar la unión con el dibujo."""
    data = chart['values'][chart['cut']-1:]
    span = chart['max'] - chart['min']
    slopes = [(b-a)/span for a,b in zip(data,data[1:])]
    turns = list(zip(slopes,slopes[1:]))
    return (max(map(abs,slopes[1:])),
            max((min(abs(a),abs(b)) for a,b in turns if a*b<0),default=0),
            mean(abs(a-b) for a,b in turns))


def playable(chart):
    return all(value<=limit+1e-9 for value,limit in zip(metrics(chart),LIMITS))


def source(title,url,provider,license_name,license_url):
    return dict(title=title,url=url,provider=provider,license=license_name,licenseUrl=license_url)


def chart(category,slug,title,detail,unit,values,start,cut,story,reference,*,period=None,labels=None,zero=False):
    span=max(values)-min(values)
    assert span>0,slug
    step=span/4.2
    order=10**math.floor(math.log10(step))
    tick=next(f*order for f in (1,2,2.5,5,10) if f*order>=step)
    low=math.floor((min(values)-span*.10)/tick)*tick
    if min(values)>=0:
        low=0 if zero else max(0,low)
    high=math.ceil((max(values)+span*.10)/tick)*tick
    if unit.startswith('%'):
        high=min(100,high)
    precision=max(2,-math.floor(math.log10(tick))+2)
    result=dict(id=f'estable-{category}-{slug}',category=category,title=title,detail=detail,unit=unit,start=start,cut=cut,
                min=round(low,precision),max=round(high,precision),tick=round(tick,precision),precision=precision,
                values=[round(value,precision) for value in values],source=reference,context=dict(story=story))
    if period:
        result.update(period=period,labels=labels)
    return result


def historical(raw):
    kept=[{**item,'id':item['id'].replace('historia-','estable-',1)} for item in raw if playable(item)]
    averages = {
        'f1-fernando-alonso':(5,'¿Cómo cambió el promedio de podios de Fernando Alonso en F1?','Las temporadas del banco sin podios aportan cero al promedio, independientemente de las carreras en las que participara.'),
        'f1-lewis-hamilton':(5,'¿Cómo cambió el promedio de podios de Lewis Hamilton en F1?','En F1 el podio reúne a los tres primeros del Gran Premio. La media compara etapas de varias temporadas del mismo piloto.'),
        'f1-sergio-perez':(5,'¿Cómo evolucionó el promedio de podios de «Checo» Pérez?','La curva usa los resultados de carrera de F1DB y cuenta los podios de Sergio Pérez sin importar para qué escudería corriera.'),
        'f1-ferrari':(5,'¿Cómo cambió el promedio de carreras ganadas por Ferrari en F1?','Si los dos pilotos de Ferrari llegan al podio en un mismo Gran Premio, la cuenta sigue registrando una victoria como máximo.'),
        'f1-calendario':(5,'¿Cómo creció el calendario típico de una temporada de Fórmula 1?','Cada Gran Premio del calendario cuenta una vez. El promedio atenúa temporadas recortadas o excepcionalmente largas.'),
        'f1-circuitos-urbanos':(5,'¿Qué sitio ganaron los circuitos urbanos en el calendario de F1?','Se aplica la clasificación de F1DB para los circuitos urbanos y se cuenta cuántas veces se usaron por temporada.'),
        'f1-parrilla':(5,'¿Cómo cambió el tamaño de la parrilla habitual de Fórmula 1?','Primero se promedia cuántos pilotos tomaron la salida por carrera en cada temporada. Luego cada temporada pesa lo mismo en el promedio móvil.'),
        'f1-mclaren':(5,'¿Cómo evolucionó el promedio de victorias de McLaren en F1?','La serie reúne los Grandes Premios ganados por la escudería, aunque cambiara de alineación entre temporadas.'),
        'mundial-goles':(3,'¿Cómo cambió el promedio de goles de un Mundial masculino?','El total de cada edición incluye la prórroga. Las tandas se llevan por separado. Al haber más partidos disponibles, también hay más oportunidades de marcar.'),
        'mundial-media':(3,'¿Se marcaban más goles por partido en los primeros Mundiales?','Cada edición se divide entre sus propios partidos antes de calcular el promedio de tres torneos. Así, cada torneo pesa igual, aunque cambie su formato.'),
        'mundial-partidos':(3,'¿Cuántos partidos incluía de media un Mundial masculino?','El número se refiere al calendario de la fase final. Cambios en el número de selecciones y en el formato del torneo pueden alargarlo.'),
        'mundial-mundial-spain':(3,'¿Cómo cambió el promedio de goles de España por Mundial?','Las ediciones en las que España no se clasificó aportan cero. La curva combina cuántos torneos jugó con cuántos goles marcó en ellos.'),
        'mundial-mundial-argentina':(3,'¿Cómo cambió el promedio de goles de Argentina por Mundial?','Las ediciones en las que Argentina estuvo ausente cuentan como cero. Los goles en una tanda de penales quedan fuera.'),
        'mundial-penales':(3,'¿Qué sitio ganaron las tandas de penales en el Mundial?','La cuenta se refiere a partidos que se resolvieron en una tanda. Un penal lanzado durante el tiempo de juego o en la prórroga queda fuera.'),
        'espacio-planetas':(5,'¿A qué ritmo se descubrían exoplanetas?','El archivo asigna un año de descubrimiento a cada planeta confirmado. Una campaña puede anunciar muchos juntos y el promedio de cinco años los sitúa en su tendencia.'),
        'espacio-transito':(5,'¿A qué ritmo se encontraron planetas que eclipsaban parte de su estrella?','Un tránsito produce una pequeña caída en el brillo observado cuando el planeta pasa entre el telescopio y la estrella. Se promedian los descubrimientos atribuidos a ese método.'),
        'espacio-vaiven':(5,'¿A qué ritmo se descubrieron planetas gracias al vaivén de su estrella?','El método de velocidad radial busca el desplazamiento periódico del espectro de la estrella mientras el planeta tira de ella con su gravedad.'),
        'espacio-foto':(5,'¿A qué ritmo se encontraron exoplanetas mediante imágenes directas?','La serie cuenta los casos en los que la imagen del entorno de la estrella permitió distinguir el planeta.'),
        'espacio-silla':(5,'¿A qué ritmo sumó exoplanetas el observatorio de La Silla?','Se usa el observatorio principal indicado por el archivo. Un equipo puede combinar instrumentos o instalaciones antes de confirmar un descubrimiento.'),
        'huracan-formacion':(7,'¿Cómo cambió el promedio de huracanes en el Atlántico?','Se cuenta una vez por temporada cada sistema que llegó a tener fuerza de huracán. En la gráfica pesan por igual las temporadas activas y las tranquilas.'),
        'huracan-tormentas':(7,'¿Cómo cambió el promedio de tormentas tropicales atlánticas?','La serie incluye ciclones que alcanzaron fuerza de tormenta tropical y los que evolucionaron hasta huracán.'),
        'huracan-viento':(7,'¿Cómo cambió el promedio de los vientos máximos de los huracanes?','Se toma primero el viento más alto observado en una temporada del Atlántico. Cada máximo anual aporta por igual al promedio, cualquiera que fuera el número de tormentas.'),
        'huracan-dias-activos':(7,'¿Cuántos días por temporada solía haber tormentas tropicales activas?','Si más de una tormenta está activa el mismo día, ese día cuenta una sola vez. El promedio se calcula para el Atlántico.'),
        'huracan-categoria3':(7,'¿Cómo cambió el promedio de huracanes grandes en el Atlántico?','Para esta cuenta un gran huracán alcanza como mínimo la categoría 3. Cada sistema se cuenta una vez por temporada.'),
    }
    by_id={item['id'].removeprefix('historia-'):item for item in raw}
    for slug,(length,title,story) in averages.items():
        item=by_id[slug]
        original=item['values']
        if slug=='mundial-goles':
            # 2026 fue la primera edición de 48 equipos. La variante histórica
            # pregunta por los cambios anteriores a ese formato.
            original=original[:-1]
        values=[mean(original[i-length+1:i+1]) for i in range(length-1,len(original))]
        labels=item.get('labels')
        if labels:
            labels=labels[length-1:length-1+len(values)]
        period='ediciones' if labels else 'temporadas' if item['category'] in ('f1','huracan') else 'años'
        detail=f"{item['detail']} Cada punto es la media de las últimas {length} {period}." if period!='años' else (
            f"{item['detail']} Cada punto es la media de los últimos {length} años.")
        cut=max(4,min(item['cut']-length+1,len(values)-7))
        if slug=='mundial-goles':
            detail+=' La serie llega hasta 2022.'
        series=chart(item['category'],slug.split('-',1)[1]+'-promedio',title,detail,item['unit'],values,
                     0 if labels else item['start']+length-1,cut,story,item['source'],period=item.get('period'),labels=labels)
        if playable(series):
            kept.append(series)
    cumulative = {
        'planetas':('¿A qué ritmo fue creciendo el catálogo de exoplanetas?',
                   'Cada peldaño suma los planetas que el archivo asigna a un año. La pendiente muestra el ritmo al que se amplió el catálogo.'),
        'foto':('¿Cuántos exoplanetas se habían conseguido fotografiar?',
                'Para esta serie se suman los planetas cuyo método principal de descubrimiento fue la imagen directa. Una foto de seguimiento de un planeta descubierto de otra forma queda fuera.'),
        'lupa':('¿Cuántos exoplanetas se habían descubierto gracias a una lupa gravitatoria?',
                'Una estrella puede desviar la luz de una fuente más lejana. Cuando hay un planeta cerca, deja una pequeña señal adicional en el brillo de la fuente.'),
        'tierra':('¿Cómo creció la lista de exoplanetas de un tamaño parecido a la Tierra?',
                  'El tamaño describe el radio medido. Aun con un radio similar, dos planetas pueden tener atmósferas o temperaturas completamente distintas.'),
    }
    for slug,(title,story) in cumulative.items():
        item=by_id['espacio-'+slug]
        values=list(accumulate(item['values']))
        start=item['start']
        series=chart('espacio',slug+'-acumulados',title,
                     f"{item['detail']} Suma acumulada desde {start}, a partir de la primera observación de la gráfica.",
                     'exoplanetas acumulados',values,start,item['cut'],story,item['source'],zero=True)
        if playable(series):
            kept.append(series)
    return kept


WEATHER = [
    ('3195','madrid','las tardes en el Retiro de Madrid','TM','Madrid, Retiro','El observatorio está en el parque del Retiro, a 667 metros de altitud. Compara las tardes típicas del verano con las del final del año.'),
    ('3195','madrid-sol','las horas de sol en el Retiro de Madrid','I','Madrid, Retiro','Las horas de sol son el brillo solar registrado, que puede ser menor que el tiempo transcurrido entre amanecer y puesta de sol.'),
    ('1024E','igeldo','las noches en el monte Igeldo','Tm','Donostia, Igeldo','La estación se encuentra sobre la costa de Donostia, a 250 metros. La gráfica sigue la mínima diaria promedio, el punto más fresco de cada jornada.'),
    ('1024E','igeldo-sol','las horas de sol en San Sebastián','I','Donostia, Igeldo','Una alta duración del día no garantiza el mismo número de horas de sol directo. Las nubes también se reflejan en esta medida.'),
    ('1082','bilbao','los días despejados cerca de Bilbao','DD','Bilbao Aeropuerto','AEMET cuenta días enteros con cielo despejado. Un día con alguna hora de sol puede quedar fuera de esta cuenta.'),
    ('1082','bilbao-lluvia','los días de lluvia cerca de Bilbao','DR','Bilbao Aeropuerto','Para contar como día de lluvia deben acumularse al menos 1 mm en el observatorio. Un chaparrón breve puede bastar si alcanza esa cantidad.'),
    ('0076','barcelona','las noches junto al aeropuerto de Barcelona','Tm','Barcelona Aeropuerto','La estación está junto al Mediterráneo. La media mensual combina las mínimas de todas las noches observadas en ese mes.'),
    ('0076','barcelona-sol','las horas de sol cerca de Barcelona','I','Barcelona Aeropuerto','Las horas se suman por mes. Febrero puede tener menos horas totales en parte porque tiene menos días.'),
    ('5783','sevilla','las tardes en Sevilla','TM','Sevilla Aeropuerto','Esta gráfica promedia la máxima de cada día. Los valores describen el mes habitual del periodo, aunque un día concreto tenga otra temperatura.'),
    ('5783','sevilla-lluvia','los días de lluvia en Sevilla','DR','Sevilla Aeropuerto','Cada observación representa el número medio de días que llegaron a 1 mm de lluvia en el mes. La cifra puede llevar decimales.'),
    ('8416','valencia','las noches en València','Tm','Valencia','La mínima media permite ver cuándo se enfrían las noches. AEMET reúne 30 años para calcular el valor de cada mes.'),
    ('5530E','granada','las heladas cerca del aeropuerto de Granada','DH','Granada Aeropuerto','La helada se cuenta cuando la temperatura cae por debajo de cero. La tabla reúne meses de 30 años y por eso puede mostrar fracciones de día.'),
    ('9434','zaragoza','las tardes en Zaragoza','TM','Zaragoza Aeropuerto','La estación del aeropuerto mide la temperatura lejos de las fachadas del centro. Cada punto resume la máxima diaria de un mismo mes en el periodo.'),
    ('8025','alicante','las noches en Alicante','Tm','Alicante','La estación mide cerca del Mediterráneo. Se promedian las mínimas diarias del mes, por lo que los días de calor excepcional tienen un peso pequeño.'),
    ('C449C','tenerife','las tardes en el aeropuerto de Tenerife Sur','TM','Tenerife Sur Aeropuerto','La estación está cerca del nivel del mar, en la vertiente sur de Tenerife. La tabla permite comparar su ciclo térmico con el de ciudades de la península.'),
    ('1387','coruna','las tardes cerca del aeropuerto de A Coruña','TM','A Coruña Aeropuerto','Las máximas medias describen la parte cálida del día en la estación del aeropuerto y muestran el ritmo anual de la costa atlántica.'),
]


def weather(root):
    columns={'TM':(1,'°C','Media mensual de la máxima diaria.'),'Tm':(2,'°C','Media mensual de la mínima diaria.'),
             'DR':(5,'días por mes','Media mensual de días con al menos 1 mm de precipitación.'),
             'DH':(9,'días por mes','Media mensual de días de helada.'),
             'DD':(10,'días por mes','Media mensual de días despejados.'),'I':(11,'horas al día','Horas de sol del mes divididas entre sus días.')}
    charts=[]
    for code,slug,subject,column,station,story in WEATHER:
        html=(root/f'aemet-{code}.html').read_text(encoding='iso-8859-1')
        rows=re.findall(r'data-fulltext="([^"]+)">[^<]+</th>(.*?)</tr>',html,re.S)
        actual={month.lower():re.findall(r'<td[^>]*>([^<]+)</td>',row) for month,row in rows}
        if len(actual)<12 or '1981-2010' not in html:
            continue
        i,unit,description=columns[column]
        positions=[actual[month][i].strip() for month in MONTHS]
        if any(value in ('-','') for value in positions):
            continue
        values=list(map(float,positions))
        if column=='I':
            values=[value/mean(monthrange(year,i)[1] for year in range(1981,2011)) for i,value in enumerate(values,1)]
        if min(values)==max(values):
            continue
        reference=source(f'© AEMET · {station}',f'{AEMET}?l={code}',
                         'Información elaborada por la Agencia Estatal de Meteorología. Normales 1981–2010.',
                         'Condiciones de reutilización de AEMET','https://www.aemet.es/es/nota_legal')
        question=f'¿Qué temperaturas hacen {subject.replace("las tardes","por la tarde").replace("las noches","por la noche")} a lo largo del año?' if unit=='°C' else (
            f'¿Cómo cambian {subject} a lo largo del año?')
        charts.append(chart('clima',slug,question,
                            f'{description} AEMET, 1981–2010.',unit,values,0,5,story,reference,period='season',labels=MONTHS,zero=column=='I'))
    return charts


WORDS = {
    'robot':('robot','La palabra puede describir una máquina de fábrica o un personaje de ficción. La serie reúne su presencia en el conjunto de libros del corpus.'),
    'television':('televisión','El término en inglés abarca el aparato, el medio de comunicación y la industria. La curva mide el vocabulario impreso en libros, cualquiera que fuera su tema.'),
    'cassette':('casete','La palabra sirve tanto para cintas de casete como para otros cartuchos. Dibujas la trayectoria del vocablo, que puede perdurar después de que cambie el soporte musical.'),
    'videogame':('videojuego en una sola palabra','La búsqueda mide «videogame» como una sola palabra. La variante «video game», en dos, tiene su propia serie.'),
    'internet':('internet en minúscula','La edición distingue «internet» de «Internet». También pueden aparecer textos que hablen de la red con otras palabras.'),
    'email':('correo electrónico','«Email» se cuenta como una palabra. Las variantes «e-mail» o «electronic mail» pueden haber seguido curvas distintas.'),
    'telephone':('teléfono','La frecuencia mide la palabra «telephone» frente a todas las palabras del corpus. Está separada de «phone», la otra forma inglesa habitual.'),
    'typewriter':('máquina de escribir','Una máquina puede seguir apareciendo en novelas y memorias cuando deja de usarse en las oficinas. Esa huella también entra en la curva.'),
    'telegraph':('telégrafo','El conteo distingue mayúsculas y minúsculas. También puede incluir contextos donde «telegraph» funciona como verbo.'),
    'steam engine':('máquina de vapor','La búsqueda exige las palabras «steam engine» seguidas. Una mención en un manual cuenta igual que una en una novela.'),
    'digital camera':('cámara digital','La frase puede perder espacio frente a «camera» a secas a medida que cambia el uso del adjetivo. Aquí solo cuentan las dos palabras juntas.'),
    'pizza':('pizza','La forma escrita «pizza» aparece tanto en recetas como en otros géneros. Cada millón mide palabras publicadas en el corpus, en lugar de porciones vendidas.'),
    'hamburger':('hamburguesa','«Hamburger» en minúscula es la forma buscada. La cifra describe libros, incluidos recetarios o historias, y se divide por el total de palabras del año.'),
    'skateboard':('monopatín','«Skateboard» mide el nombre del objeto. Las formas «skateboarding» y «skateboards» tienen recuentos distintos.'),
    'surfboard':('tabla de surf','La búsqueda se limita a «surfboard» en singular. La frecuencia se puede comparar entre décadas porque usa un denominador común de un millón de palabras.'),
    'disco music':('música disco','La etiqueta en dos palabras es la que se busca. Un libro sobre música disco sigue contando aunque se haya publicado mucho después de la época que describe.'),
    'hip hop':('hip hop sin guion','Solo cuentan «hip» y «hop» consecutivas, escritas en minúscula. Otras grafías pueden crecer a un ritmo distinto.'),
    'karaoke':('karaoke','El japonés aporta una palabra que el inglés escribe igual. La gráfica muestra cuándo aparece en libros del corpus en inglés.'),
    'breakdance':('breakdance en una palabra','La variante «break dance» queda aparte. Un libro puede usar también el término «breaking» para hablar del baile.'),
    'punk rock':('punk rock','El nombre de este estilo aparece en textos sobre música y en libros de otros géneros. La serie mantiene juntas las dos palabras.'),
    'science fiction':('ciencia ficción','Dos palabras consecutivas identifican el término. La frecuencia se calcula sobre todo el corpus elegido, así que pueden contar ensayos sobre el género y reseñas.'),
    'roller skating':('patinaje sobre ruedas','La serie sigue «roller skating». Términos de disciplinas como el patinaje en línea pueden figurar en series distintas.'),
    'solar energy':('energía solar','La curva incluye textos técnicos y de divulgación. Una mención describe el vocabulario de los libros y no se contabiliza como un panel instalado.'),
    'recycling':('reciclaje','La palabra «recycling» puede aludir al papel, al vidrio o a la reutilización de materiales en otros ámbitos. La suma reúne esos usos.'),
    'plastic bag':('bolsa de plástico','La secuencia buscada está en singular. Las menciones pueden hablar de fabricación, compras, basura u otros usos.'),
    'wind turbine':('aerogenerador','La búsqueda cuenta la frase «wind turbine» en singular. Una novela y un manual pueden aportar menciones, aunque su público sea muy distinto.'),
    'greenhouse effect':('efecto invernadero','La expresión describe un concepto, no una medida de temperatura. Se mira cuánto espacio ocupó la frase en el vocabulario de los libros.'),
    'electric car':('coche eléctrico','La expresión también puede aparecer en libros históricos sobre automóviles. El gráfico sigue las palabras en singular, sin inferir ventas de coches.'),
    'motorcycle':('motocicleta','La frecuencia sigue la forma «motorcycle» en minúscula. Las publicaciones especializadas y las obras de ficción comparten el mismo recuento.'),
    'space station':('estación espacial','Puede aparecer en ciencia ficción y en descripciones de misiones reales. La serie reúne las apariciones de las dos palabras en inglés.'),
    'comic book':('cómic en formato de libro','La búsqueda se restringe a «comic book». Pueden existir más menciones si también se incluyen variantes como «comics» o «graphic novel».'),
    'paperback':('libro de bolsillo','«Paperback» describe una edición de tapa blanda. La palabra puede aparecer en catálogos o libros que hablan de otras ediciones.'),
    'audiobook':('audiolibro','La gráfica busca «audiobook» en una palabra. Una mención en letras impresas mide la llegada del término al vocabulario del libro.'),
}


def books(root):
    frequencies={}
    for group in ('inventos','cultura','ambiente'):
        data=json.loads((root/f'ngram-{group}.json').read_text())
        frequencies.update((entry['ngram'],entry['timeseries']) for entry in data)
    charts=[]
    for term,(label,story) in WORDS.items():
        for start,end in ((1980,2019),(1970,2009),(1960,1999),(1950,1989),(1935,1974)):
            window=frequencies[term][start-1920:end-1919]
            values=[mean(window[i:i+2])*1_000_000 for i in range(0,len(window),2)]
            if max(values)<.01 or max(values)==min(values):
                continue
            params=urlencode(dict(content=term,year_start=start,year_end=end,corpus='eng_2019',smoothing=0))
            reference=source('Google Books Ngram Viewer · inglés 2019',f'{NGRAM}?{params}','Google Books, corpus inglés de 2019.',
                             'CC BY 3.0','https://creativecommons.org/licenses/by/3.0/')
            labels=list(range(start+1,end+1,2))
            candidate=chart('libros',term.replace(' ','-'),f'¿Con qué frecuencia aparecía «{term}» en los libros?',
                            f'{label[0].upper()+label[1:]}. Libros en inglés. Cada punto promedia dos años y se etiqueta con el segundo.',
                            'apariciones por millón de palabras',values,0,8,story,reference,period='biennium',labels=labels)
            if playable(candidate) and max(values[8:])-min(values[8:])>0.16*(max(values)-min(values)):
                charts.append(candidate)
                break
    return charts


COUNTRIES = {
    'ESP':('ES','España'),'MEX':('MX','México'),'ARG':('AR','Argentina'),'BRA':('BR','Brasil'),
    'CHL':('CL','Chile'),'COL':('CO','Colombia'),'PRT':('PT','Portugal'),'JPN':('JP','Japón'),
    'KOR':('KR','Corea del Sur'),'IND':('IN','India'),'ISL':('IS','Islandia'),
    'NOR':('NO','Noruega'),'USA':('US','Estados Unidos'),'PER':('PE','Perú'),
}
TELECOM='Unión Internacional de Telecomunicaciones (UIT) · World Development Indicators'
WDI_SERIES = [
    ('red','IT.NET.USER.ZS','tecnologia','¿Qué parte de la población usaba internet en {}?',
     'Personas que habían usado internet desde cualquier lugar en los tres meses anteriores.',
     '% de la población',TELECOM,1995,2022,
     'El indicador puede contar una conexión en casa, en el teléfono, en el trabajo o en un centro público. Mide personas, aunque se conecten desde varios dispositivos.',
     ('ESP','MEX','CHL','KOR','IND','BRA','ISL')),
    ('movil','IT.CEL.SETS.P2','tecnologia','¿Cuántas líneas móviles había por cada cien personas en {}?',
     'Suscripciones de telefonía móvil, incluidas las prepago activas.',
     'líneas por 100 habitantes',TELECOM,1992,2019,
     'El cociente puede superar cien. Alguien puede alternar dos tarjetas SIM o usar una línea de trabajo además de la personal.',
     ('ESP','COL','JPN','IND','PRT','BRA','PER')),
    ('fijo','IT.MLT.MAIN.P2','tecnologia','¿Qué pasó con el teléfono fijo en {}?',
     'Suscripciones a telefonía fija por cada 100 habitantes.',
     'líneas por 100 habitantes',TELECOM,1992,2021,
     'Una sola línea puede servir a todo un hogar. El indicador cuenta suscripciones, por lo que el número de personas que las usan es distinto.',
     ('ESP','MEX','ARG','NOR','USA','JPN','PRT')),
    ('urbano','SP.URB.TOTL.IN.ZS','ciudades','¿Qué parte de la población vivía en zonas urbanas en {}?',
     'Población urbana según la definición nacional, dividida entre la población total.',
     '% de la población','División de Población de Naciones Unidas · World Urbanization Prospects',1970,2000,
     'Una localidad que crece y pasa a clasificarse como urbana también puede elevar la proporción. El indicador mide dónde vive la población y depende de la definición del país.',
     ('MEX','BRA','CHL','COL','PRT','KOR','PER')),
    ('luz','EG.ELC.ACCS.ZS','ciudades','¿Qué parte de la población tenía acceso a la electricidad en {}?',
     'Proporción con acceso a electricidad según el Banco Mundial.',
     '% de la población','Banco Mundial · Global Electrification Database',1995,2022,
     'El dato mide acceso. Dos lugares con un nivel parecido de acceso pueden consumir cantidades de energía muy diferentes.',
     ('IND','PER','COL','MEX','BRA')),
]


def worldbank(root):
    charts=[]
    for slug,code,category,title,detail,unit,provider,start,end,story,countries in WDI_SERIES:
        with zipfile.ZipFile(root/f'wdi-{code}.zip') as archive:
            filename=next(name for name in archive.namelist() if name.startswith('API_'))
            lines=io.TextIOWrapper(archive.open(filename),encoding='utf-8-sig')
            for _ in range(4):
                next(lines)
            rows={row['Country Code']:row for row in csv.DictReader(lines)}
        for country in countries:
            entries=[rows[country][str(year)] for year in range(start,end+1)]
            if not all(entries):
                continue
            values=list(map(float,entries))
            if max(values)==min(values):
                continue
            alpha2,name=COUNTRIES[country]
            reference=source(f'Banco Mundial · {code} · {name}',f'{WDI}{code}?locations={alpha2}',provider,
                             'CC BY 4.0','https://creativecommons.org/licenses/by/4.0/')
            charts.append(chart(category,f'{slug}-{alpha2.lower()}',title.format(name),detail,unit,values,start,
                                (len(values)-1)//2,story,reference))
    return charts


def nature(root):
    url='https://www.nps.gov/aboutus/visitation-numbers.htm'
    html=(root/'nps-total.html').read_text()
    counts=re.findall(r'<strong>([0-9]{4})</strong>\s*</p>\s*</td>\s*<td[^>]*>\s*<p>([0-9,.]+)',html)
    visits={int(year):int(re.sub(r'[^0-9]','',count))/1e6 for year,count in counts}
    nps=source('National Park Service · Recreation Visits by Year',url,
               'National Park Service · Visitor Use Statistics. No claim to original U.S. Government works.',
               'Datos públicos','https://www.nps.gov/aboutus/disclaimer.htm')
    parks=chart('parques','visitas','¿Cuánto creció el público de los parques nacionales de Estados Unidos?',
                'Visitas recreativas de toda la red del National Park Service, en millones al año.',
                'millones de visitas', [visits[y] for y in range(1950,1976)],1950,10,
                'Se cuentan visitas y no personas únicas. Alguien que vuelve varias veces puede figurar varias veces, y las unidades incluidas en la red pueden cambiar con el tiempo.',nps)
    with (root/'co2-annmean-mlo.csv').open() as stream:
        years={int(row['year']):float(row['mean']) for row in csv.DictReader(line for line in stream if not line.startswith('#'))}
    noaa=source('NOAA GML · Mauna Loa','https://gml.noaa.gov/ccgg/trends/data.html',
                'Xin Lan, NOAA Global Monitoring Laboratory, y Ralph Keeling, Scripps Institution of Oceanography.',
                'Datos públicos','https://gml.noaa.gov/ccgg/trends/data.html')
    carbon=chart('atmosfera','mauna-loa','¿Cómo cambió el CO₂ medido en el volcán Mauna Loa?',
                'Concentración anual media en el observatorio de Hawái.', 'partes por millón',
                [years[y] for y in range(1985,2017)],1985,14,
                'La media anual reúne meses con concentraciones distintas. Para ver la oscilación dentro de cada año hay que consultar el registro mensual de NOAA.',noaa)
    return [parks,carbon]


def bank(root, audit=False):
    raw=json.loads((ROOT/'content/tendencias-historias.json').read_text())
    history=historical(raw)
    candidates=history+weather(root)+books(root)+worldbank(root)+nature(root)
    available=[item for item in candidates if playable(item)]
    groups=defaultdict(list)
    for item in available:
        groups[item['category']].append(item)
    # Las tres primeras rondas enseñan tres formas distintas de una curva.
    initial_ids=('estable-clima-madrid','estable-libros-cassette','estable-comida-aguacates')
    initial=[next(item for item in available if item['id']==name) for name in initial_ids]
    for item in initial:
        groups[item['category']].remove(item)
    randomizer=random.Random(20261118)
    for items in groups.values():
        randomizer.shuffle(items)
    # Las categorías numerosas se reparten entre las partidas antes que las pequeñas.
    leftover=sum(map(len,groups.values()))%3
    for _ in range(leftover):
        max(groups.values(),key=len).pop()
    rounds=[initial]
    while any(groups.values()):
        keys=list(groups)
        randomizer.shuffle(keys)
        three=sorted(keys,key=lambda key:len(groups[key]),reverse=True)[:3]
        assert all(groups[key] for key in three),{key:len(items) for key,items in groups.items()}
        game=[groups[key].pop() for key in three]
        randomizer.shuffle(game)
        rounds.append(game)
    subsequent=rounds[1:]
    randomizer.shuffle(subsequent)
    selected=initial+[item for game in subsequent for item in game]
    if audit:
        for title,items in [('Original',raw),('Final',selected)]:
            stats=list(zip(*(metrics(item) for item in items)))
            print(title,len(items),f'aptas: {sum(map(playable,items))}',Counter(item['category'] for item in items),
                  'Máximos (%)',*(round(100*max(column),2) for column in stats),
                  'Medias (%)',*(round(100*mean(column),2) for column in stats),file=sys.stderr)
        used={item['id'] for item in selected}
        print('Series anteriores intactas:',sum(item['id'].replace('historia-','estable-',1) in used for item in raw),
              'Promedios adaptados:',sum(item.endswith('-promedio') for item in used),
              'Acumulados adaptados:',sum(item.endswith('-acumulados') for item in used),file=sys.stderr)
    return selected


if __name__=='__main__':
    print('[\n'+',\n'.join('  '+json.dumps(item,ensure_ascii=False) for item in bank(Path(sys.argv[1]),'--auditar' in sys.argv))+'\n]')
