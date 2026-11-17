"""Genera el banco a partir de WDI_CSV.zip del Banco Mundial.

Descarga: https://databankfiles.worldbank.org/public/ddpext_download/WDI_CSV.zip
Uso: python3 research/preparar-tendencias.py WDI_CSV.zip > content/tendencias.json
Conserva las gráficas ya programadas cuando se actualice el banco.
"""
import csv
import io
import json
import math
import random
import sys
import zipfile

PLACES = {
    'ESP': 'España', 'MEX': 'México', 'CHL': 'Chile', 'URY': 'Uruguay',
    'COL': 'Colombia', 'ARG': 'Argentina', 'PER': 'Perú', 'CRI': 'Costa Rica',
    'BRA': 'Brasil', 'ECU': 'Ecuador', 'GTM': 'Guatemala', 'PAN': 'Panamá',
    'WLD': 'el mundo', 'JPN': 'Japón', 'KOR': 'Corea del Sur', 'ISL': 'Islandia',
    'USA': 'Estados Unidos', 'IND': 'India', 'CHN': 'China', 'NLD': 'Países Bajos',
    'FRA': 'Francia', 'DEU': 'Alemania', 'GBR': 'Reino Unido', 'DNK': 'Dinamarca',
    'NZL': 'Nueva Zelanda', 'AUS': 'Australia', 'KEN': 'Kenia', 'NOR': 'Noruega',
    'PRT': 'Portugal', 'ITA': 'Italia', 'SGP': 'Singapur', 'IDN': 'Indonesia',
}
# Indicador, países, pregunta, pista sobre qué se mide, unidad, divisor y ventana.
SERIES = [
    ('IT.NET.USER.ZS','ESP MEX IND','¿Cuánta gente usaba Internet en {}?',
     'Cuenta a quienes se conectaron en los tres meses anteriores, desde cualquier lugar.', '% de la población',1,2003,2022),
    ('IT.CEL.SETS.P2','COL KEN CHN','¿Cuántas líneas móviles había por cada 100 personas en {}?',
     'Una persona puede tener varias líneas. El valor puede pasar de 100.', 'líneas por 100 personas',1,2001,2020),
    ('IT.NET.BBND.P2','ESP URY KOR','¿Cómo se extendió la banda ancha fija en {}?',
     'Cuenta conexiones fijas, como la fibra o el cable. Excluye los datos móviles.', 'conexiones por 100 personas',1,2005,2023),
    ('SP.POP.TOTL','MEX JPN IND','¿Cuántas personas vivían en {}?',
     'Es la población residente estimada a mitad de cada año.', 'millones de personas',1e6,1994,2023),
    ('SP.URB.TOTL.IN.ZS','ESP PER CHN','¿Qué parte de la población de {} vivía en ciudades?',
     'Cada país define qué considera una zona urbana.', '% de la población',1,1990,2023),
    ('SP.DYN.TFRT.IN','CHL KOR FRA','¿Cuántos hijos por mujer indica la tasa de fecundidad de {}?',
     'La cifra resume las tasas por edad de cada año. Es una medida hipotética, no el recuento de una generación.', 'hijos por mujer',1,1997,2023),
    ('SP.DYN.LE00.IN','ESP BRA WLD','¿Cómo cambió la esperanza de vida al nacer en {}?',
     'Una persona recién nacida viviría esos años si se mantuvieran las tasas de mortalidad del año.', 'años',1,1998,2023),
    ('SP.POP.65UP.TO.ZS','ARG JPN ITA','¿Qué porcentaje de la gente tenía 65 años o más en {}?',
     'La serie muestra el peso del grupo en la población total, incluidos quienes siguen trabajando.', '% de la población',1,1993,2023),
    ('SP.DYN.CBRT.IN','ESP COL USA','¿Cuántos bebés nacían al año por cada 1.000 habitantes en {}?',
     'La tasa divide los nacimientos del año entre la población estimada a mitad de ese año.', 'nacimientos por 1.000 personas',1,1998,2023),
    ('SH.DYN.MORT','PER KEN IND','¿Cómo cambió la mortalidad antes de cumplir cinco años en {}?',
     'Es la probabilidad estimada por cada mil nacimientos, a partir de la mortalidad de cada año.', 'por 1.000 nacidos vivos',1,1997,2023),
    ('EG.ELC.ACCS.ZS','GTM KEN IND','¿A cuánta gente le llegaba la electricidad en {}?',
     'Mide acceso a electricidad, con conexión a la red o mediante una fuente fuera de ella.', '% de la población',1,2002,2022),
    ('EG.ELC.RNEW.ZS','ESP CHL DNK','¿Cuánta electricidad se generaba con renovables en {}?',
     'Incluye, entre otras fuentes, agua, viento y sol. El porcentaje es sobre la generación eléctrica.', '% de la electricidad generada',1,2000,2021),
    ('EG.FEC.RNEW.ZS','CRI DEU ISL','¿Cuánto del consumo de energía en {} venía de fuentes renovables?',
     'Incluye usos finales como el transporte y la calefacción, además de la electricidad.', '% del consumo final de energía',1,2000,2021),
    ('EN.GHG.CO2.PC.CE.AR5','ESP CHN USA','¿Cuánto CO₂ se emitía por habitante en {}?',
     'Divide las emisiones de CO₂ entre la población. Excluye la silvicultura y los cambios de uso del suelo.', 'toneladas de CO₂ por persona',1,1998,2019),
    ('AG.LND.FRST.ZS','BRA CRI WLD','¿Qué parte de la superficie terrestre de {} era bosque?',
     'Cuenta superficie forestal según la definición de la FAO. Excluye árboles de uso agrícola y parques urbanos.', '% de la superficie terrestre',1,1997,2022),
    ('AG.YLD.CREL.KG','ESP MEX USA','¿Cuánto cereal se cosechaba por hectárea en {}?',
     'Agrupa cereales recogidos para grano seco, como maíz, trigo y arroz.', 'toneladas por hectárea',1000,1996,2022),
    ('AG.PRD.FOOD.XD','ARG BRA WLD','¿Cómo cambió la producción de alimentos en {}?',
     'El índice pondera alimentos por su valor. Un 100 equivale al promedio de 2014 a 2016.', 'índice (2014–2016 = 100)',1,1998,2022),
    ('FP.CPI.TOTL.ZG','ESP MEX GBR','¿Cuánto subían los precios al consumidor en {}?',
     'Mide el cambio anual de una canasta de consumo. Si la cifra baja de cero, esa canasta se abarató.', '% de cambio anual',1,2004,2023),
    ('NY.GDP.MKTP.CD','CHL CHN WLD','¿Cómo cambió el tamaño de la economía de {}?',
     'El PIB está en dólares del año. La serie recoge también el efecto de los precios y el tipo de cambio.', 'miles de millones de USD corrientes',1e9,1998,2023),
    ('NE.EXP.GNFS.ZS','ESP MEX SGP','¿Cuánto pesaban las exportaciones en la economía de {}?',
     'Incluye bienes y servicios vendidos al exterior. Pueden superar el PIB en economías muy abiertas.', '% del PIB',1,1997,2023),
    ('SL.UEM.TOTL.ZS','ESP COL USA','¿Qué parte de la fuerza laboral buscaba empleo en {}?',
     'Entre quienes tienen o buscan empleo, cuenta a quienes no trabajan pero están disponibles y buscan trabajo.', '% de la fuerza laboral',1,2002,2023),
    ('SL.AGR.EMPL.ZS','PER IND KEN','¿Cuánta gente trabajaba en el campo o en la pesca en {}?',
     'Dentro de la población ocupada, agrupa agricultura, ganadería, silvicultura y pesca.', '% del empleo',1,1998,2023),
    ('SL.EMP.TOTL.SP.FE.ZS','ESP CHL DEU','¿Cómo cambió la proporción de mujeres adultas con empleo en {}?',
     'Cuenta a las mujeres de 15 años o más con empleo sobre todas las mujeres de esas edades.', '% de mujeres de 15 años o más',1,1998,2023),
    ('EG.USE.ELEC.KH.PC','ESP BRA NOR','¿Cuánta electricidad se consumía por persona en {}?',
     'Divide el consumo eléctrico de todo el país entre sus habitantes. También cuenta lo que usan comercios e industrias.', 'kWh por persona',1,1996,2022),
    ('SH.H2O.BASW.ZS','COL KEN IND','¿Cuánta gente tenía acceso básico a agua potable en {}?',
     'La fuente es mejorada y se tarda como máximo 30 minutos en ir, recoger el agua y volver.', '% de la población',1,2000,2022),
    ('SH.STA.BASS.ZS','BRA IND IDN','¿Cuánta gente tenía saneamiento básico en {}?',
     'Cuenta el acceso a una instalación mejorada que no se comparte con otros hogares.', '% de la población',1,2000,2022),
    ('SH.IMM.MEAS','MEX ECU WLD','¿Qué parte de la infancia había recibido la vacuna del sarampión en {}?',
     'Es la cobertura estimada entre menores de 12 a 23 meses.', '% de menores de 12–23 meses',1,1999,2023),
    ('BX.TRF.PWKR.DT.GD.ZS','MEX GTM PER','¿Cuánto pesaba el dinero enviado desde el extranjero en {}?',
     'Mide remesas personales recibidas, incluidas transferencias personales y remuneraciones de trabajadores.', '% del PIB',1,2000,2023),
    ('EN.POP.DNST','ESP NLD SGP','¿Cuán concentrada estaba la población de {}?',
     'Divide el número de habitantes por la superficie terrestre, sin contar las aguas interiores.', 'personas por km²',1,1992,2022),
    ('SH.XPD.CHEX.GD.ZS','ESP CHL USA','¿Cuánta actividad económica representaba el gasto en salud en {}?',
     'Incluye el gasto corriente público y privado en salud, sin las inversiones de capital.', '% del PIB',1,2001,2022),
    ('IS.AIR.PSGR','ESP MEX JPN','¿Cuántos pasajeros transportaban las aerolíneas registradas en {}?',
     'Suma trayectos nacionales e internacionales. Una persona puede contar varias veces.', 'millones de pasajeros',1e6,1999,2022),
    ('ST.INT.ARVL','ESP MEX FRA','¿Cuántas llegadas de turistas internacionales registraba {}?',
     'Son llegadas, no personas únicas. Según la fuente nacional, pueden registrarse en frontera o en alojamientos.', 'millones de llegadas',1e6,1999,2020),
    ('SH.XPD.OOPC.CH.ZS','ARG IND KOR','¿Cuánto del gasto sanitario salía directamente del bolsillo en {}?',
     'Incluye pagos directos de los hogares. Las primas y aportaciones al seguro se contabilizan aparte.', '% del gasto corriente en salud',1,2001,2022),
    ('NV.IND.MANF.ZS','ESP MEX DEU','¿Qué peso tenía la industria manufacturera en {}?',
     'Mide el valor añadido al transformar materiales en productos, descontando los insumos de producción.', '% del PIB',1,2000,2023),
]

def reader(archive, name):
    return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding='utf-8-sig'))

def window(row, start, end):
    runs = []
    points = []
    for year in range(start, end + 1):
        raw = row[str(year)]
        if not raw:
            if points:
                runs.append(points)
            points = []
        else:
            points.append((year, float(raw)))
    runs.append(points)
    return max(runs, key=len)

def chart(code, area, title, detail, unit, divisor, start, end, raw, metadata):
    run = window(raw, start, end)
    if len(run) < 12:
        raise ValueError(f'{code} {area}: solo {len(run)} años seguidos')
    start = run[0][0]
    values = [value / divisor for _, value in run]
    span = max(values) - min(values)
    if not span:
        raise ValueError(f'{code} {area}: serie plana')
    rough_tick = span / 3.2
    magnitude = 10 ** math.floor(math.log10(rough_tick))
    tick = next(factor * magnitude for factor in (1, 2, 2.5, 5, 10) if factor*magnitude >= rough_tick)
    precision = max(0, 1-math.floor(math.log10(tick)))
    if tick / magnitude == 2.5:
        precision += 1
    precision = max(precision, 2)
    values = [round(value, precision) for value in values]
    low = math.floor((min(values) - span*.12) / tick) * tick
    if min(values) >= 0:
        low = max(0, low)
    high = math.ceil((max(values) + span*.12) / tick) * tick
    ceiling = 100 if unit.startswith('%') and max(values) <= 100 else high
    high = min(high, ceiling)
    cut = min(len(values)-7, round((len(values)-1)*.58))
    if metadata['License Type'] != 'CC BY-4.0':
        raise ValueError(f'{code}: licencia {metadata["License Type"]!r}')
    original = metadata['Source'].strip()
    return dict(id=f'{area.lower()}-{code.lower().replace(".", "-")}', title=title.format(PLACES[area]).replace("de el mundo", "del mundo"),
                detail=detail, unit=unit, start=start, cut=cut, min=round(low, precision),
                max=round(high, precision), tick=round(tick, precision), precision=precision,
                values=values,
                source=dict(title='Banco Mundial · World Development Indicators',
                            url=f'https://datos.bancomundial.org/indicador/{code}?locations={area}',
                            provider=original, license='CC BY 4.0'))

def make_bank(filename):
    selections = {(code, area) for code, areas, *_ in SERIES for area in areas.split()}
    with zipfile.ZipFile(filename) as wdi:
        data = {(row['Indicator Code'], row['Country Code']): row for row in reader(wdi, 'WDICSV.csv')
                if (row['Indicator Code'], row['Country Code']) in selections}
        metadata = {row['Series Code']: row for row in reader(wdi, 'WDISeries.csv')}
    choices = [(code, area, chart(code, area, *params, data[code, area], metadata[code]))
               for code, areas, *params in SERIES for area in areas.split()]
    rng = random.Random(171126)
    for _ in range(100_000):
        rng.shuffle(choices)
        if all(len({code for code, _, _ in choices[i:i+3]}) == 3 and
               len({area for _, area, _ in choices[i:i+3]}) == 3 for i in range(0, len(choices), 3)):
            return [item for _, _, item in choices]
    raise ValueError('No se encontró un reparto de tres temas y lugares distintos por día')

if __name__ == '__main__':
    print('[\n' + ',\n'.join('  ' + json.dumps(item, ensure_ascii=False)
                             for item in make_bank(sys.argv[1])) + '\n]')
