"""Genera las preguntas con copias locales de los archivos enlazados en FUENTES.

Uso: python3 research/preparar-tendencias-historias.py carpeta-de-datos
Los nombres de entrada están en cada lector. No consulta servicios al jugar.
"""
import csv
import io
import json
import math
from pathlib import Path
import random
import re
from statistics import mean, median
import sys
import zipfile

FUENTES = {
    'f1': ('F1DB · resultados y calendario', 'https://github.com/f1db/f1db', 'Contribuidores de F1DB', 'CC BY 4.0'),
    'mundial': ('OpenFootball · World Cup', 'https://github.com/openfootball/worldcup.json', 'OpenFootball', 'Dominio público'),
    'nombres': ('Social Security Administration · National Baby Names', 'https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data', 'Social Security Administration. Copia del archivo nacional hasta 2020.', 'CC0 1.0'),
    'espacio': ('NASA Exoplanet Archive · Planetary Systems Composite Data', 'https://exoplanetarchive.ipac.caltech.edu/docs/API_PSCompParsColumns.html', 'NASA Exoplanet Archive, operado por Caltech para el Exoplanet Exploration Program de la NASA.', 'Datos públicos'),
    'huracan': ('NOAA · HURDAT2 del Atlántico', 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-02272026.txt', 'NOAA National Hurricane Center, edición de febrero de 2026.', 'Datos públicos'),
}
USDA = 'https://www.ers.usda.gov'
FOOD_FILES = {
    'fruit': '5345/fruit-fresh',
    'dairy': '5331/dairy-products',
    'juices': '5349/fruit-juices',
    'potatoes': '5375/vegetables-potatoes',
    'coffee': '5327/coffee-tea-cocoa-and-spices-availability',
}
LICENSE_URL = {
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
}

def make_chart(group, slug, title, detail, unit, rows, cut_at, story, *, labels=False, food=None, story_url=None):
    years, raw = zip(*sorted(rows.items()))
    if len(years) < 12 or max(raw) == min(raw):
        raise ValueError(f'Serie insuficiente: {slug}')
    if not labels and list(years) != list(range(years[0],years[-1]+1)):
        raise ValueError(f'Hueco sin observación: {slug}')
    span = max(raw)-min(raw)
    rough = span/3.8
    order = 10**math.floor(math.log10(rough))
    tick = next(f*order for f in (1,2,2.5,5,10) if f*order>=rough)
    low = max(0,math.floor((min(raw)-span*.12)/tick)*tick)
    high = math.ceil((max(raw)+span*.12)/tick)*tick
    if unit.startswith('%'):
        high = min(100,high)
    precision = max(3,-math.floor(math.log10(tick))+2)
    if food:
        title_source,url,provider,license_name = ('USDA ERS · Food Availability',f'{USDA}/media/{FOOD_FILES[food]}.csv',
            'United States Department of Agriculture, Economic Research Service.', 'Datos públicos')
    else:
        title_source,url,provider,license_name = FUENTES[group]
    source = dict(title=title_source,url=url,provider=provider,license=license_name,
                  licenseUrl=LICENSE_URL.get(license_name,url))
    cut=min(len(years)-7,max(5,sum(year<=cut_at for year in years)-1))
    chart = dict(id=f'historia-{group}-{slug}',category=group,title=title,detail=detail,unit=unit,
                 start=0 if labels else years[0],cut=cut,min=round(low,precision),max=round(high,precision),
                 tick=round(tick,precision),precision=precision,values=[round(v,precision) for v in raw],
                 source=source,context=dict(story=story))
    if story_url:
        chart['context']['url']=story_url
    if labels:
        chart.update(period='edition',labels=list(years))
    return chart

def number(value):
    try:
        return float(value)
    except (ValueError,TypeError):
        return None

def food(root):
    fruit='Fresh fruit (retail weight): Per capita availability'
    dairy='Dairy products: Per capita availability'
    juice='Selected fruit juices: Per capita availability - Processed weight'
    potato='Potatoes: Per capita availability'
    food_items=[
        ('fruit','aguacates','aguacate fresco',fruit,'Noncitrus-Avocados-Pounds',1994,2021,2006,
         'En 2006 la oferta daba para kilo y medio por persona. En 2020 rozó los cuatro kilos. El salto se mide en el mercado nacional, sin distinguir cómo se repartió entre hogares.'),
        ('fruit','mangos','mango fresco',fruit,'Noncitrus-Mangoes-Pounds',1991,2021,2005,
         'El mango se cuenta como fruta fresca. Un jugo o un mango congelado pertenecen a otra estadística.'),
        ('fruit','arandanos','arándanos azules frescos',fruit,'Noncitrus-Blueberries-Pounds',1990,2021,2004,
         'Los arándanos de la gráfica son los azules. El USDA lleva otra cuenta para los rojos.'),
        ('fruit','pinya','piña fresca',fruit,'Noncitrus-Pineapples-Pounds',1990,2021,2003,
         'La serie sigue la piña fresca. La de lata, aunque se coma a cucharadas, tiene su propia tabla.'),
        ('fruit','kiwi','kiwi fresco',fruit,'Noncitrus-Kiwifruit-Pounds',1992,2021,2006,
         'El salto entre fechas mide la oferta por persona. Incluye lo que se produjo en el país y el saldo de las importaciones y exportaciones.'),
        ('fruit','fresas','fresas frescas',fruit,'Noncitrus-Strawberries-Pounds',1990,2021,2004,
         'Para la curva importan las fresas que llegan al mercado como fruta fresca. Las que se congelan para batidos van por separado.'),
        ('fruit','cerezas','cerezas frescas',fruit,'Noncitrus-Cherries-Pounds',1990,2021,2005,
         'Cada punto reúne todo un año de disponibilidad. Por eso la línea salta de una cosecha a otra y el pico no representa un solo mes.'),
        ('fruit','pomelos','pomelo fresco',fruit,'Citrus-Grapefruit-Pounds',1990,2021,2004,
         'La fruta entera y el jugo cuentan en series distintas. Los kilos de la gráfica corresponden a la fruta fresca.'),
        ('dairy','helado','helado tradicional',dairy,'Frozen dairy products-Ice cream-Pounds',1990,2021,2004,
         'El USDA estima la disponibilidad del helado a partir de la producción. El helado bajo en grasa y el yogur helado tienen filas propias.'),
        ('dairy','yogur','yogur',dairy,'Yogurt-Pounds',1990,2021,2005,
         'La cuenta es de yogur refrigerado. Una tarrina congelada va en el grupo de postres, aunque lleve la misma palabra en la etiqueta.'),
        ('dairy','mantequilla','mantequilla',dairy,'Butter-Pounds',1970,2001,1984,
         'La cifra incluye la mantequilla que acaba en recetas o en restaurantes. El dato anual suma usos en toda la cadena alimentaria.'),
        ('dairy','mozzarella','mozzarella', 'Selected cheeses varieties: Per capita availability','Italian type-Mozzarella-Pounds',1995,2020,2007,
         'Los kilos de mozzarella incluyen la que va encima de una pizza y la que se vende como queso de mesa.'),
        ('juices','naranja','jugo de naranja',juice,'Citrus-Orange-Gallons, single-strength',1990,2021,2004,
         'La unidad equivale a jugo listo para beber. El concentrado se expresa como su equivalente diluido.'),
        ('juices','manzana','jugo de manzana',juice,'Noncitrus-Apple-Gallons, single-strength',1990,2021,2005,
         'Los litros incluyen tanto jugo directo como jugo reconstituido. Las manzanas que se venden enteras se miden en otra serie.'),
        ('potatoes','chips','papas fritas de bolsa',potato,'Processing-Chips-Retail-Pounds',1990,2021,2005,
         'La tabla mide el peso del producto vendido al por menor, ya cortado y frito. Esos kilos no equivalen a los de la papa recién cosechada.'),
        ('potatoes','congeladas','productos de papa congelados',potato,'Processing-Frozen-Retail-Pounds',1980,2010,1994,
         'Las papas precocidas para freír entran en la misma categoría que otros productos congelados de papa.'),
    ]
    lookup={}
    for name in FOOD_FILES:
        groups={}
        for row in csv.DictReader((root/f'{name}.csv').open(encoding='utf-8-sig')):
            if 'Attribute' in row and (value:=number(row['Value'])) is not None and row['Year'].isdigit():
                groups.setdefault((row['Commodity'],row['Attribute']),{})[int(row['Year'])]=value
        lookup[name]=groups
    charts=[]
    for file,slug,label,group,key,start,end,cut,story in food_items:
        series=lookup[file][group,key]
        values={y:series[y]*(3.785411784 if file=='juices' else .45359237) for y in range(start,end+1)}
        unit=('litros' if file=='juices' else 'kg')+' por persona al año'
        charts.append(make_chart('comida',slug,f'¿Qué cantidad de {label} había disponible por persona en Estados Unidos?',
            'El USDA divide la oferta anual de alimentos entre la población.',unit,values,cut,story,food=file))
    rows=csv.DictReader((root/'coffee.csv').open(encoding='utf-8-sig'))
    coffee={int(r['Year']):float(r['Pcc Total (Retail) Amount'])*.45359237 for r in rows
            if r['Commodity']=='Coffee' and 1970<=int(r['Year'])<=2000}
    charts.append(make_chart('comida','cafe','¿Cuánto café había disponible por persona en Estados Unidos?',
        'Peso al por menor de todo el café de la tabla, convertido a kilogramos.', 'kg por persona al año',coffee,1985,
        'Los kilos se refieren al café antes de prepararlo. Una taza incorpora agua, así que la curva no mide el peso de la bebida.',food='coffee'))
    return charts

def zipped_csv(archive,name):
    return list(csv.DictReader(io.TextIOWrapper(archive.open(name),encoding='utf-8-sig')))

def formula1(root):
    with zipfile.ZipFile(root/'f1.zip') as archive:
        races=zipped_csv(archive,'f1db-races.csv')
        results=zipped_csv(archive,'f1db-races-race-results.csv')
    byrace={}
    values={}
    for row in results:
        byrace.setdefault(row['raceId'],[]).append(row)
    for race in races:
        year=int(race['year'])
        if year>2024:
            continue
        values.setdefault(year,[]).append((race,byrace.get(race['id'],[])))
    charts=[]
    def add(slug,title,detail,unit,start,end,cut,story,metric):
        rows={}
        for year in range(start,end+1):
            rows[year]=metric(values[year])
        charts.append(make_chart('f1',slug,title,detail,unit,rows,cut,story))
    for key,label,start,cut,story in [
        ('fernando-alonso','Fernando Alonso',2001,2008,'Tras dos temporadas completas fuera de la parrilla, Alonso volvió en 2021. En 2023 sumó ocho podios con Aston Martin, y en 2024 acabó sin ninguno.'),
        ('lewis-hamilton','Lewis Hamilton',2007,2014,'Cada podio cuenta igual, tanto si ganó la carrera como si terminó tercero. Al sumar por temporada aparece el cambio de ritmo a lo largo de su carrera.'),
        ('sebastian-vettel','Sebastian Vettel',2007,2013,'Los podios se cuentan por dorsal y piloto en los Grandes Premios, también cuando Vettel cambió de equipo.'),
        ('sergio-perez','Sergio «Checo» Pérez',2011,2017,'Un podio en una carrera vale uno. Las clasificaciones y los esprints quedan fuera de la serie.'),
        ('kimi-raikkonen','Kimi Räikkönen',2001,2008,'En el recuento anual también se ven los años en que Räikkönen se apartó de la Fórmula 1.'),
        ('michael-schumacher','Michael Schumacher',1991,2000,'La serie reúne sus carreras con distintos equipos. Un año sin competir cuenta como cero podios.'),
    ]:
        add(key,f'¿Cuántas veces subía al podio {label} en una temporada de F1?',
            'Suma de primeros, segundos y terceros puestos en Grandes Premios.','podios por temporada',start,
            min(start+27,2024),cut,story,
            lambda season,key=key:sum(r['driverId']==key and r['positionNumber'] in ('1','2','3') for _,group in season for r in group))
    for key,label in [('ferrari','Ferrari'),('mclaren','McLaren'),('williams','Williams')]:
        add(key,f'¿Cuántos Grandes Premios ganaba {label} en una temporada?',
            'Victorias del constructor en carrera.','victorias por temporada',1985,2015,1999,
            'Cuenta una victoria para el constructor que puso al ganador en pista. Los puntos y el resultado del otro coche no cambian la cifra.',
            lambda season,key=key:sum(r['constructorId']==key and r['positionNumber']=='1' for _,group in season for r in group))
    metrics=[
        ('calendario','¿Cuántas carreras tenía una temporada de Fórmula 1?','Grandes Premios celebrados.','carreras por temporada',1995,2024,2009,
         'La longitud de una temporada cambia con las altas, bajas y cancelaciones del calendario.',len),
        ('parrilla','¿Cuántos pilotos tomaban la salida en una carrera típica de F1?','Media de pilotos que salieron, también desde el pit lane.','pilotos por carrera',1980,2009,1994,
         'Los pilotos que no llegaron a salir no se suman. Cada carrera pesa igual en su año.',
         lambda season:mean(sum(r['positionText'] not in ('DNS','DNQ','DNPQ','WD') for r in group) for _,group in season)),
        ('pole','¿Con qué frecuencia ganaba el piloto que salía desde la pole?','Proporción de carreras con victoria desde el primer cajón.','% de carreras',1984,2014,1998,
         'Esta cuenta usa el puesto real de salida. Una sanción de parrilla puede separar al más rápido del sábado del primero en salir.',
         lambda season:100*sum(any(r['positionNumber']=='1' and r['gridPositionNumber']=='1' for r in group) for _,group in season)/len(season)),
        ('monaco','¿Cuánto duraba el Gran Premio de Mónaco para quien lo ganaba?','Tiempo oficial de carrera del ganador, expresado en minutos.','minutos de carrera',1990,2019,2004,
         'El dato mide la carrera entera. Interrupciones, lluvia y ritmos distintos hacen que dos Grandes Premios en las mismas calles no duren lo mismo.',
         lambda season:next(float(r['timeMillis'])/60000 for race,group in season if race['grandPrixId']=='monaco' for r in group if r['positionNumber']=='1' and r['timeMillis'])),
        ('circuitos-urbanos','¿Cuántas carreras corría la F1 en circuitos urbanos?','Calendario anual, con el tipo de circuito de F1DB.','carreras por temporada',1995,2024,2008,
         'La clasificación de F1DB es por trazado. Así se pueden separar las carreras en calles de las celebradas en autódromos permanentes.',
         lambda season:sum(race['circuitType']=='STREET' for race,_ in season)),
        ('largada','¿Cuántos ganadores de F1 salían fuera de los tres primeros puestos?','Ganadores con parrilla numérica a partir del cuarto puesto.','carreras por temporada',1989,2019,2003,
         'Solo cuentan las remontadas que acabaron en victoria. Se usa la parrilla real después de las sanciones.',
         lambda season:sum(any(r['positionNumber']=='1' and r['gridPositionNumber'].isdigit() and int(r['gridPositionNumber'])>=4 for r in group) for _,group in season)),
        ('ganadores','¿Cuántos pilotos distintos ganaban al menos un Gran Premio en un año?','Recuento de ganadores únicos por temporada.','pilotos por temporada',1989,2019,2003,
         'Un piloto que gana diez carreras aporta uno al total, igual que quien gana solo una.',
         lambda season:len({r['driverId'] for _,group in season for r in group if r['positionNumber']=='1'})),
        ('margen','¿A cuántos segundos terminaba el segundo en una carrera típica de F1?','Mediana anual de diferencias registradas en segundos.','segundos',1990,2020,2005,
         'La mediana evita que una carrera con una diferencia excepcional marque por sí sola el año. Se omiten los segundos puestos con diferencia expresada en vueltas.',
         lambda season:median(float(r['gapMillis'])/1000 for _,group in season for r in group if r['positionNumber']=='2' and r['gapMillis'])),
    ]
    for item in metrics:
        add(*item)
    return charts

def names(root):
    with zipfile.ZipFile(root/'nombres.zip') as archive:
        dataset={}
        for name in archive.namelist():
            match=re.search(r'/raw-data/yob(\d{4})\.txt$',name)
            if match and 1970<=int(match[1])<=2020:
                dataset[int(match[1])]={ (key,sex):int(count) for key,sex,count in
                                     csv.reader(io.TextIOWrapper(archive.open(name),encoding='utf-8-sig')) }
    choices=[
        ('Luna','F',1988,2002,'La serie distingue Luna de otras variantes. Un nombre de cuatro letras puede recorrer una trayectoria muy distinta de otro que suene parecido.'),
        ('Mateo','M',1990,2004,'Mateo, Matheo y Matthew tienen líneas separadas en esta base. Cada año cuenta solo la grafía exacta Mateo.'),
        ('Santiago','M',1990,2004,'La curva sigue Santiago en Estados Unidos. Un cambio aquí puede ser distinto del que se observe en España o en países latinoamericanos.'),
        ('Valentina','F',1990,2004,'La misma escritura se usa en varios países. La serie pertenece a las solicitudes de la Seguridad Social de Estados Unidos.'),
        ('Camila','F',1990,2003,'La diferencia entre Camila y Camilla importa: la Seguridad Social publica frecuencias por grafía.'),
        ('Thiago','M',1998,2011,'Thiago y Tiago están contados por separado. Los primeros años con menos de cinco casos salen suprimidos en la fuente.'),
        ('Sofia','F',1990,2005,'La tabla registra Sofia con esta escritura. Sophia es una serie distinta y queda fuera de la gráfica.'),
        ('Liam','M',1990,2004,'Cada punto cuenta registros, de modo que un salto puede combinar la popularidad del nombre y los cambios en el total de nacimientos.'),
        ('Olivia','F',1985,2001,'El dato es un número de registros, a diferencia de los listados de nombres que indican su posición en un ranking.'),
        ('Elsa','F',1992,2007,'La serie permite comparar un nombre que ya existía mucho antes de que Elsa apareciera en la película Frozen. El registro no pregunta qué motivó la elección.'),
        ('Arya','F',1998,2010,'Mucho antes de un nombre de moda, la serie puede arrancar con unos pocos casos. La fuente protege a los grupos con menos de cinco registros.'),
        ('Ariel','F',1975,1988,'La Seguridad Social separa los registros por sexo. Esta gráfica sigue a las niñas llamadas Ariel.'),
        ('Isabella','F',1985,2001,'La curva reúne Isabella con dos eles, según el registro. Isabel, Isabela y Bella conservan sus propias series.'),
        ('Enzo','M',1992,2008,'Enzo se cuenta exactamente con esa escritura y solo en los registros de Estados Unidos.'),
        ('Dylan','M',1980,1995,'El registro reúne a todos los Dylan de la serie masculina, independientemente del origen familiar del nombre.'),
        ('Leonardo','M',1987,2002,'La curva sigue la frecuencia en registros individuales, y puede dar un salto aunque la clasificación de otros nombres apenas se mueva.'),
        ('Mia','F',1988,2003,'La corta grafía Mia forma una serie propia. Los cambios se ven en el número de registros, no en el puesto de un listado.'),
    ]
    result=[]
    for name,sex,start,cut,story in choices:
        values={y:dataset[y].get((name,sex)) for y in range(start,min(start+30,2020)+1)}
        last_missing=max((y for y,val in values.items() if val is None),default=start-1)
        values={y:val for y,val in values.items() if y>last_missing}
        who='niñas llamadas' if sex=='F' else 'niños llamados'
        result.append(make_chart('nombres',name.lower(),f'¿Cuántos registros hubo de {who} {name}?',
            'Solicitudes de la Seguridad Social en Estados Unidos, por año de nacimiento.','registros por año',values,cut,story))
    return result

def planets(root):
    with (root/'planetas.csv').open(encoding='utf-8-sig') as file:
        data=list(csv.DictReader(file))
    filters=[
        ('planetas','¿Cuántos exoplanetas se descubrían en un año?', 'Cada planeta cuenta en el año de descubrimiento recogido en el archivo.','El catálogo fecha más de mil quinientos descubrimientos en 2016. Un anuncio puede confirmar muchos planetas juntos, y el año no indica cuándo se tomaron las imágenes originales.',lambda r:True),
        ('transito','¿Cuántos exoplanetas delataban su presencia al tapar parte de una estrella?', 'Solo el método de tránsito.','El tránsito produce un descenso pequeño en el brillo de la estrella. El archivo distingue esa técnica de captar una imagen del planeta.',lambda r:r['discoverymethod']=='Transit'),
        ('vaiven','¿Cuántos planetas revelaba el vaivén de su estrella?', 'Planetas descubiertos por velocidad radial.','La gravedad del planeta también mueve a su estrella. Los cambios en su espectro permiten detectar ese movimiento.',lambda r:r['discoverymethod']=='Radial Velocity'),
        ('lupa','¿Cuántos planetas se encontraban gracias a una lupa gravitatoria?', 'El archivo clasifica este método como microlente gravitacional.','Un objeto que pasa delante de una estrella más lejana curva su luz. Un planeta puede añadir una pequeña señal a esa ampliación.',lambda r:r['discoverymethod']=='Microlensing'),
        ('foto','¿Cuántos planetas se podían encontrar en una imagen directa?', 'Descubrimientos clasificados como imagen directa.','El método busca separar la tenue luz del planeta del brillo de su estrella, en lugar de medir el movimiento de la estrella.',lambda r:r['discoverymethod']=='Imaging'),
        ('tierra','¿Cuántos mundos descubiertos tenían un radio parecido al de la Tierra?', 'Radio publicado entre 0,8 y 1,25 radios terrestres.','Radio parecido dice algo sobre el tamaño. La curva no dice si el planeta tiene aire, océanos o una temperatura apta para vivir.',lambda r:(v:=number(r['pl_rade'])) is not None and .8<=v<=1.25),
        ('doble-radio','¿Cuántos mundos encontrados tenían entre una y dos Tierras de radio?', 'Radio publicado mayor que uno y hasta dos radios terrestres.','Duplicar el radio multiplica el volumen por ocho en una esfera. La gráfica solo agrupa tamaños y no supone que todos tengan la misma densidad.',lambda r:(v:=number(r['pl_rade'])) is not None and 1<v<=2),
        ('subneptuno','¿Cuántos mundos descubiertos tenían entre dos y cuatro radios terrestres?', 'Mayor de dos y hasta cuatro radios de la Tierra.','Este intervalo de tamaños separa mundos más grandes que la Tierra de los gigantes. Se usa el radio del archivo, dejando aparte los casos sin estimación.',lambda r:(v:=number(r['pl_rade'])) is not None and 2<v<=4),
        ('gigantes','¿Cuántos gigantes de más de diez radios terrestres se descubrieron por año?', 'Radio publicado mayor que diez veces el terrestre.','Este tamaño es del orden del de Júpiter. El tamaño por sí solo no establece cuánta masa tiene cada mundo.',lambda r:(v:=number(r['pl_rade'])) is not None and v>10),
        ('kepler','¿Cuántos planetas se atribuyen a Kepler cada año?', 'El archivo debe indicar Kepler como instalación del descubrimiento.','Una detección puede confirmarse bastante después de que el telescopio observe la estrella. El año es el publicado por el archivo.',lambda r:r['disc_facility']=='Kepler'),
        ('k2','¿Cuántos planetas encontró la segunda etapa de Kepler?', 'Se usa la instalación K2 por separado de Kepler.','K2 figura con su propio nombre en el archivo. Así se pueden comparar sus descubrimientos con los de la misión original.',lambda r:r['disc_facility']=='K2'),
        ('tess','¿Cuántos planetas se han asociado al telescopio TESS?', 'Recuento anual de descubrimientos atribuidos a TESS.','La línea usa el año de descubrimiento registrado. Un candidato aún sin confirmar no entra en este recuento.',lambda r:'Satellite (TESS)' in r['disc_facility']),
        ('keck','¿Cuántos planetas se descubrieron desde el observatorio Keck?', 'El archivo atribuye el descubrimiento a W. M. Keck Observatory.','Instalación y método son dos campos distintos. Se suman todos los métodos atribuidos a Keck.',lambda r:r['disc_facility']=='W. M. Keck Observatory'),
        ('silla','¿Cuántos planetas registró el observatorio de La Silla, en Chile?', 'Instalación de descubrimiento «La Silla Observatory».','Aunque en Chile haya varios observatorios, la serie solo cuenta los descubrimientos que el archivo atribuye a La Silla.',lambda r:r['disc_facility']=='La Silla Observatory'),
        ('varios','¿Cuántos planetas nuevos vivían en sistemas con compañía?', 'Sistemas con dos o más planetas conocidos en este archivo.','La etiqueta refleja lo que se conoce hoy sobre el sistema. Un planeta contado aquí quizá parecía solitario el día en el que se anunció.',lambda r:r['sy_pnum'].isdigit() and int(r['sy_pnum'])>=2),
        ('tres','¿Cuántos planetas nuevos pertenecían a sistemas con al menos tres mundos conocidos?', 'Tres o más planetas en el sistema según la tabla.','La serie cuenta planetas, así que un anuncio de tres mundos en un solo sistema añade tres.',lambda r:r['sy_pnum'].isdigit() and int(r['sy_pnum'])>=3),
        ('varios-ojos','¿Cuántos planetas se acreditaron a varios observatorios a la vez?', 'Instalación de descubrimiento «Multiple Observatories».','Algunos descubrimientos no se atribuyen a un único telescopio. La gráfica sigue esa etiqueta concreta del archivo.',lambda r:r['disc_facility']=='Multiple Observatories'),
    ]
    result=[]
    for slug,title,detail,story,match in filters:
        start=2007 if slug!='tess' else 2012
        series={y:0 for y in range(start,2025)}
        for r in data:
            year=int(r['disc_year'])
            if year in series and match(r):
                series[year]+=1
        result.append(make_chart('espacio',slug,title,detail,'planetas por año',series,2013 if slug=='planetas' else 2019 if slug=='tess' else 2016,story))
    return result

def worldcup(root):
    editions={}
    with zipfile.ZipFile(root/'mundial-json.zip') as archive:
        for name in archive.namelist():
            match=re.search(r'/(\d{4})/worldcup\.json$',name)
            if not match or not 1950<=int(match[1])<=2026:
                continue
            rounds=[]
            for r in json.loads(archive.read(name))['matches']:
                score=r['score']
                a,b=score.get('et',score.get('ft')) if isinstance(score,dict) else score
                rounds.append((r['team1'],r['team2'],a,b,isinstance(score,dict) and 'p' in score))
            editions[int(match[1])]=rounds
    assert len(editions)==20
    assert len(editions[2026])==104
    assert sum(a+b for _,_,a,b,_ in editions[2022])==172
    assert sum(a+b for _,_,a,b,_ in editions[2026])==308
    charts=[]
    def add(slug,title,detail,unit,story,metric):
        rows={year:metric(rounds) for year,rounds in editions.items()}
        charts.append(make_chart('mundial',slug,title,detail,unit,rows,1990,story,labels=True))
    specs=[
        ('goles','¿Cuántos goles cabían en un Mundial masculino?','Suma de goles del torneo, incluida la prórroga.','goles por edición',
         'Los goles de las tandas no cuentan. Un Mundial con más selecciones puede sumar más goles aunque el promedio por partido baje.',
         lambda rs:sum(a+b for _,_,a,b,_ in rs)),
        ('media','¿Cuántos goles se marcaban en un partido típico de un Mundial?','Media de goles por partido de cada Mundial masculino.','goles por partido',
         'Dividir por el número de encuentros deja comparar ediciones con formatos distintos. La prórroga suma y la tanda de penales queda fuera.',
         lambda rs:mean(a+b for _,_,a,b,_ in rs)),
        ('sin-goles','¿Cuántos partidos de un Mundial acababan 0–0?','Marcador al terminar el partido, incluida la prórroga.','partidos por edición',
         'Un 0–0 sigue contando como tal aunque después se decida quién avanza en los penales.',
         lambda rs:sum(a==b==0 for _,_,a,b,_ in rs)),
        ('empates','¿Qué proporción de cruces de un Mundial acababa empatada?','Marcador al terminar la prórroga, cuando la hubo.','% de partidos',
         'La tanda resuelve una eliminatoria, pero a efectos del dato el encuentro acabó con el marcador igualado.',
         lambda rs:100*sum(a==b for _,_,a,b,_ in rs)/len(rs)),
        ('penales','¿Cuántos partidos del Mundial se decidían por penales?','Solo tandas de desempate.','tandas por edición',
         'Un penal durante el juego no cuenta como tanda. Los ceros tempranos reflejan ediciones sin este desempate registrado.',
         lambda rs:sum(p for *_,p in rs)),
        ('goleadas','¿Cuántos partidos del Mundial llegaron a cinco goles?','Se suman ambos marcadores.','partidos por edición',
         'Un 5–0 y un 3–2 cuentan igual. La gráfica sigue partidos cargados de goles, aunque el resultado sea ajustado.',
         lambda rs:sum(a+b>=5 for _,_,a,b,_ in rs)),
        ('ventaja','¿Cuántos goles hubo en la mayor goleada de cada Mundial?','Mayor diferencia de goles entre ganador y perdedor.','goles de diferencia',
         'Un 6–1 marca una diferencia de cinco. La pregunta mide lo desigual del marcador, no el total de goles que vio la grada.',
         lambda rs:max(abs(a-b) for _,_,a,b,_ in rs)),
        ('partidos','¿Cuántos partidos veía quien seguía todo el Mundial?','Encuentros disputados en la fase final masculina.','partidos por edición',
         'El calendario de la fase final cambia al ampliarse el torneo. Las clasificatorias se juegan aparte.',
         len),
        ('selecciones','¿Cuántas selecciones llegaban a la fase final del Mundial?','Equipos distintos con al menos un partido disputado.','selecciones por edición',
         'Cuenta las selecciones que jugaron y permite ver cuándo se amplió el torneo. Los anfitriones cuentan como cualquier otro equipo.',
         lambda rs:len({team for a,b,*_ in rs for team in (a,b)})),
        ('ambos','¿En qué porcentaje de partidos del Mundial marcaban ambos equipos?','Cada selección debía marcar al menos un gol antes de la tanda.','% de partidos',
         'Un 1–1 y un 4–1 cuentan igual. Un 4–0 se queda fuera por muchos goles que se marcaran.',
         lambda rs:100*sum(a>0 and b>0 for _,_,a,b,_ in rs)/len(rs)),
        ('tres','¿Cuántos goles sumó el partido con más goles de cada Mundial?','Máximo de goles en un solo partido.','goles en un partido',
         'Aquí gana el marcador más abultado en conjunto. Un empate 4–4 podría superar a un 7–0.',
         lambda rs:max(a+b for _,_,a,b,_ in rs)),
    ]
    for spec in specs:
        add(*spec)
    charts[0]['context'] = dict(
        story='En 2022 se marcaron 172 goles. En 2026, el torneo se amplió a 48 selecciones y acabó con 308 en 104 partidos.',
        url='https://inside.fifa.com/tournament-organisation/fifa-world-cup-2026-by-the-numbers/on-the-pitch')
    for key,label in [('Brazil','Brasil'),('Argentina','Argentina'),('Spain','España'),('Mexico','México'),('France','Francia'),('Uruguay','Uruguay')]:
        add('mundial-'+key.lower(),f'¿Cuántos goles marcó {label} en cada Mundial masculino?',
            'Goles de la selección en la fase final.','goles por edición',
            'Una edición sin participar cuenta como cero. El total también depende de cuántos partidos disputó la selección.',
            lambda rs,key=key:sum((a if team1==key else b if team2==key else 0) for team1,team2,a,b,_ in rs))
    return charts

def hurricanes(root):
    years={year:[] for year in range(1985,2025)}
    live=None
    for line in (root/'huracanes.txt').read_text().splitlines():
        parts=[part.strip() for part in line.split(',')]
        if re.fullmatch(r'AL\d{6}',parts[0]):
            year=int(parts[0][-4:])
            live=[] if year in years else None
            if live is not None:
                years[year].append(live)
        elif live is not None:
            lat=float(parts[4][:-1])*(1 if parts[4][-1]=='N' else -1)
            lon=float(parts[5][:-1])*(1 if parts[5][-1]=='E' else -1)
            live.append((parts[0],parts[2],parts[3],lat,lon,int(parts[6]),int(parts[7])))
    def hu(track,min_wind=64):
        return any(p[2]=='HU' and p[5]>=min_wind for p in track)
    def tropical(point):
        return point[2] in ('SS','TS','HU') and point[5]>=34
    def tracks(pred):
        return lambda season:sum(pred(track) for track in season)
    stats=[
        ('formacion','¿Cuántas tormentas del Atlántico llegaron a ser huracanes?', 'Sistemas que alcanzaron fuerza de huracán una vez o más.','huracanes por temporada',
         'Una tormenta puede subir y bajar de categoría en su recorrido. Si alcanzó fuerza de huracán, cuenta una sola vez.',tracks(hu)),
        ('tormentas','¿Cuántos ciclones del Atlántico alcanzaban fuerza de tormenta tropical?', 'Incluye los que después llegaron a huracán.','ciclones por temporada',
         'Se cuenta el sistema, no cada medición. Un ciclón de muchos días aporta lo mismo al total que uno breve.',tracks(lambda tr:any(map(tropical,tr)))),
        ('categoria3','¿Cuántos huracanes grandes aparecían en el Atlántico?', 'Al menos categoría 3 en algún punto de la trayectoria.','huracanes por temporada',
         'Aquí «grande» se refiere al viento, no al tamaño en el mapa. El umbral es 96 nudos.',tracks(lambda tr:hu(tr,96))),
        ('categoria4','¿Cuántos huracanes del Atlántico alcanzaban categoría 4 o 5?', 'Vientos máximos de 113 nudos o más en estado de huracán.','huracanes por temporada',
         'Un huracán de categoría 5 cuenta también en esta serie. El registro recoge la intensidad máxima observada en cualquier punto.',tracks(lambda tr:hu(tr,113))),
        ('categoria5','¿Cuántos huracanes llegaban a la máxima categoría en el Atlántico?', 'Categoría 5, desde 137 nudos.','huracanes por temporada',
         'Estas temporadas suelen contener pocos casos. La ausencia de categoría 5 no implica que el Atlántico estuviera en calma.',tracks(lambda tr:hu(tr,137))),
        ('viento','¿Qué viento máximo llegó a registrar un huracán en el Atlántico?', 'Máximo por temporada, convertido de nudos a kilómetros por hora.','km/h',
         'La cifra mide viento sostenido de la estimación oficial. El dato no mide la ráfaga más fuerte que pudo sentir una persona.',lambda s:max(p[5] for tr in s for p in tr if p[2]=='HU')*1.852),
        ('dias-activos','¿Cuántos días hubo alguna tormenta tropical activa en el Atlántico?', 'Días distintos, aunque hubiera más de un sistema a la vez.','días por temporada',
         'Dos tormentas activas el mismo martes aportan un solo día al total. Así se ve durante cuánto tiempo hubo actividad.',lambda s:len({p[0] for tr in s for p in tr if tropical(p)})),
        ('dias-hu','¿Cuántos días hubo algún huracán activo en el Atlántico?', 'Al menos una observación marcada como huracán ese día.','días por temporada',
         'Un día con varios huracanes cuenta una sola vez. La curva mide duración en calendario, no número de sistemas.',lambda s:len({p[0] for tr in s for p in tr if p[2]=='HU'})),
        ('julio','¿Cuántas tormentas tropicales estuvieron activas en julio en el Atlántico?', 'Sistemas con al menos una observación de fuerza tropical en julio.','ciclones por julio',
         'Una tormenta que nace en junio y sigue activa el 1 de julio entra en la cuenta de julio.',tracks(lambda tr:any(tropical(p) and p[0][4:6]=='07' for p in tr))),
        ('septiembre','¿Cuántos huracanes estuvieron activos en septiembre en el Atlántico?', 'Un mismo huracán cuenta una vez en el mes.','huracanes por septiembre',
         'No hace falta que se formara en septiembre. Basta con que pasara parte de su trayectoria como huracán durante el mes.',tracks(lambda tr:any(p[2]=='HU' and p[0][4:6]=='09' for p in tr))),
        ('octubre','¿Cuántos huracanes siguieron activos en octubre en el Atlántico?', 'Sistemas observados como huracán en cualquier fecha de octubre.','huracanes por octubre',
         'Octubre usa la misma regla que cualquier mes. Un ciclón puede aparecer en dos meses si mantiene fuerza de huracán.',tracks(lambda tr:any(p[2]=='HU' and p[0][4:6]=='10' for p in tr))),
        ('noviembre','¿Cuántas tormentas tropicales alcanzaron noviembre en el Atlántico?', 'Actividad tropical observada en noviembre, sin importar el mes de formación.','ciclones por noviembre',
         'La última parte del año también puede traer actividad. El récord del año completo no tiene por qué coincidir con el de noviembre.',tracks(lambda tr:any(tropical(p) and p[0][4:6]=='11' for p in tr))),
        ('golfo','¿Cuántos huracanes cruzaron la zona central del Golfo de México?', 'Fuerza de huracán entre 22° y 29° N, 90° y 96° O.','huracanes por temporada',
         'La caja sigue un sector del Golfo. Un huracán cerca de Florida, fuera del recuadro, pertenece a otra zona del mapa.',tracks(lambda tr:any(p[2]=='HU' and 22<=p[3]<=29 and -96<=p[4]<=-90 for p in tr))),
        ('tierra-firme','¿Cuántos huracanes tocaron tierra con fuerza de huracán?', 'Marca de llegada a tierra en el registro, en cualquier costa de la cuenca atlántica.','huracanes por temporada',
         'Cuenta sistemas distintos. Si un huracán tocó tierra dos veces, aporta uno al total.',tracks(lambda tr:any(p[1]=='L' and p[2]=='HU' for p in tr))),
        ('presion','¿Hasta dónde cayó la presión central del huracán más profundo de cada temporada?', 'Menor presión observada mientras el sistema era huracán.','hectopascales',
         'En esta gráfica el récord está abajo. Una presión más baja indica una depresión más profunda, aunque no mide por sí sola el viento ni los daños.',lambda s:min(p[6] for tr in s for p in tr if p[2]=='HU' and p[6]>0)),
        ('tropicos','¿Cuántos huracanes llegaron a fuerza de huracán al sur de los 20° N?', 'Al menos una observación con fuerza de huracán por debajo de esa latitud.','huracanes por temporada',
         'La línea de 20° N cruza el Caribe. Cuenta sistemas con fuerza de huracán allí, incluso si alcanzaron su máximo más al norte.',tracks(lambda tr:any(p[2]=='HU' and p[3]<20 for p in tr))),
        ('lejos-atlantico','¿Cuántos huracanes alcanzaron su fuerza en el Atlántico oriental?', 'Al menos una observación de huracán al este de 40° O.','huracanes por temporada',
         'La estadística usa un meridiano para separar la parte oriental de la cuenca. Una misma trayectoria puede salir de esa zona después.',tracks(lambda tr:any(p[2]=='HU' and p[4]>-40 for p in tr))),
    ]
    return [make_chart('huracan',slug,title,detail,unit,{year:metric(years[year]) for year in range(1990,2024)},2004,story)
            for slug,title,detail,unit,story,metric in stats]

def bank(root):
    groups=[food(root),formula1(root),names(root),planets(root),worldcup(root),hurricanes(root)]
    groups[0][0]['title']='¿Cuánto aguacate había para cada persona en Estados Unidos?'
    assert all(len(group)==17 for group in groups),[len(group) for group in groups]
    first=[groups[i].pop(0) for i in (0,1,3)]
    second=[groups[i].pop(0) for i in (2,4,5)]
    rng=random.Random(20261117)
    for group in groups:
        rng.shuffle(group)
    return [*first,*second,*(item for row in zip(*groups) for item in row)]

if __name__=='__main__':
    print('[\n'+',\n'.join('  '+json.dumps(item,ensure_ascii=False) for item in bank(Path(sys.argv[1])))+'\n]')
