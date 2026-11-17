"""Combina las respuestas mensuales de Wikimedia Analytics con series WDI seleccionadas.

Uso: python3 research/preparar-tendencias-pop.py carpeta-de-respuestas-json > content/tendencias-pop.json
Las respuestas provienen de los enlaces exactos incluidos en source.url de cada serie.
"""
import collections
import json
import math
from pathlib import Path
import random
import sys

WDI_THEMES = ('it-net-user-zs', 'it-cel-sets-p2', 'it-net-bbnd-p2', 'eg-elc-rnew-zs', 'is-air-psgr',
              'st-int-arvl', 'ag-lnd-frst-zs', 'ag-yld-crel-kg', 'eg-use-elec-kh-pc')
PRIORITY = ('Pokémon_GO', 'La_casa_de_papel', 'Lionel_Messi', 'Among_Us', 'Shakira',
            'Copa_Mundial_de_Fútbol', 'Barbie_(película)', 'Nintendo_Switch', 'Día_de_Muertos',
            'PlayStation_5', 'Daft_Punk', 'Shrek', 'Bizarrap', 'Stranger_Things', 'Eclipse_solar')
LABELS = {'Coco_(película)': 'Coco', 'Queen': 'Queen', 'Rosalía_(cantante)': 'Rosalía',
          'BTS_(banda)': 'BTS', 'Club_Atlético_Boca_Juniors': 'Boca Juniors',
          'Club_Atlético_River_Plate': 'River Plate', 'Copa_Mundial_de_Fútbol': 'la Copa Mundial de Fútbol',
          'Real_Madrid_Club_de_Fútbol': 'el Real Madrid', 'Fútbol_Club_Barcelona': 'el FC Barcelona',
          'Juegos_Olímpicos': 'los Juegos Olímpicos', 'La_casa_de_papel': 'La casa de papel',
          'El_viaje_de_Chihiro': 'El viaje de Chihiro', 'Mi_vecino_Totoro': 'Mi vecino Totoro',
          'Día_de_Muertos': 'el Día de Muertos', 'Agujero_negro': 'los agujeros negros',
          'Telescopio_espacial_James_Webb': 'el telescopio James Webb',
          'Estación_Espacial_Internacional': 'la Estación Espacial Internacional',
          'Eclipse_solar': 'los eclipses solares', 'Super_Bowl': 'el Super Bowl',
          'Chocolate': 'el chocolate', 'Paella': 'la paella', 'Arepa': 'la arepa',
          'Empanada': 'las empanadas', 'Aurora_polar': 'las auroras polares',
          'Cometa_Halley': 'el cometa Halley', 'Mate_(infusión)': 'el mate'}

CONTEXT = {
    'Pokémon_GO': ('El pico de julio de 2016 coincide con el lanzamiento del juego en iOS y Android.',
                   'https://press.pokemon.com/en/Pokemon-GO'),
    'La_casa_de_papel': ('Netflix estrenó las dos primeras partes a escala mundial en 2018. En abril anunció una tercera parte.',
                        'https://about.netflix.com/es_es/news/netflix-continues-to-bring-new-and-diverse-stories-from-europe-middle-east-and-africa-to-the-world'),
    'Lionel_Messi': ('En diciembre de 2022, Messi ganó su primer Mundial. Marcó dos goles en la final antes de que Argentina venciera a Francia en los penales.',
                    'https://www.fifa.com/es/articles/argentina-le-gano-por-penales-a-francia-y-se-consagro-campeon-del-mundo'),
}

def month(timestamp):
    return int(timestamp[:4])*12 + int(timestamp[4:6])-1

def make_chart(data):
    items=data['items']
    by_month={month(item['timestamp']):item['views'] for item in items}
    first,last=min(by_month),max(by_month)
    if len(by_month)<24 or max(by_month.values())<8000:
        return None
    full=[start for start in range(first,last-22) if all(at in by_month for at in range(start,start+24))]
    if not full:
        return None
    peak=max(range(full[0]+6,full[-1]+23),key=lambda at:by_month.get(at,0))
    start=min(full,key=lambda at:abs(at-(peak-15)))
    values=[by_month[at]/1000 for at in range(start,start+24)]
    low,high=min(values),max(values)
    if high<=low:
        return None
    step=(high-low)/4.1
    magnitude=10**math.floor(math.log10(step))
    tick=round(next(magnitude*factor for factor in (1,2,2.5,5,10) if magnitude*factor>=step),3)
    name=data['name']
    label=LABELS.get(name,name.split('_(')[0].replace('_',' '))
    title=f'¿Cómo cambió el interés por {label} en Wikipedia?'
    chart=dict(id='wiki-'+data['url'].split('/')[-4],title=title,category=data['category'],
                detail='Lecturas mensuales del artículo en Wikipedia en español, desde todos los dispositivos.',
                unit='miles de visitas al mes',period='month',start=start,
                cut=min(11,max(5,values.index(high)-3)),min=max(0,round(math.floor((low-(high-low)*.08)/tick)*tick,3)),
                max=round(math.ceil((high+(high-low)*.08)/tick)*tick,3),tick=tick,precision=3,values=values,
                source=dict(title='Fundación Wikimedia · visitas por artículo',url=data['url'],
                            provider='Wikimedia Analytics API · Wikipedia en español · tráfico de usuarios',
                            license='CC0 1.0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/'))
    if name in CONTEXT:
        story, url = CONTEXT[name]
        chart['context'] = dict(story=story, url=url)
    return chart

def bank(directory):
    selected=collections.defaultdict(list)
    priority={name:index for index,name in enumerate(PRIORITY)}
    records=[json.loads(file.read_text()) for file in directory.glob('*.json')]
    records.sort(key=lambda item:(priority.get(item['name'],len(priority)),item['name']))
    for record in records:
        chart=make_chart(record)
        if chart:
            selected[chart['category']].append(chart)
    cycles=[]
    while selected and len(cycles)<75:
        for category in list(selected):
            cycles.append(selected[category].pop(0))
            if not selected[category]:
                del selected[category]
            if len(cycles)==75:
                break
    if len(cycles)<75:
        raise ValueError(f'Faltan series mensuales completas: {len(cycles)} de 75')
    old=json.loads((Path(__file__).parent.parent/'content/tendencias.json').read_text())
    wdi=[chart for chart in old if chart['id'][4:] in WDI_THEMES]
    random.Random(1711).shuffle(wdi)
    by_id={chart['id']:chart for chart in cycles}
    kickoff=[
        'wiki-Pok%C3%A9mon_GO','wiki-La_casa_de_papel','wiki-Lionel_Messi',
    ]
    result=[by_id[chart] for chart in kickoff]
    cycles=[chart for chart in cycles if chart['id'] not in kickoff]
    for day in range(1,34):
        count=3 if day%5==0 else 2
        for _ in range(count):
            categories={chart.get('category') for chart in result[day*3:]}
            index=next((i for i,chart in enumerate(cycles) if chart['category'] not in categories),0)
            result.append(cycles.pop(index))
        if count==2:
            result.append(wdi.pop())
    if cycles or wdi or len(result)!=102:
        raise ValueError('La edición debe tener 34 tríos')
    return result

if __name__=='__main__':
    print('[\n'+',\n'.join('  '+json.dumps(chart,ensure_ascii=False) for chart in bank(Path(sys.argv[1])))+'\n]')
