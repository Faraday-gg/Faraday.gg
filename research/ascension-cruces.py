"""Preguntas que combinan un repertorio conocido con una segunda condición."""


def add_crosses(add, answer, categories, plain):
    catalog = {category['id']: category for category in categories}

    def publish(ident, title, description, base, rows, levels, extra_sources=()):
        points = {plain(key): value for value, keys in levels.items() for key in keys}
        selected = {
            plain(name) for row in rows for name in [row['name'], *row['aliases']]
        }
        assert points.keys() <= selected, (ident, points.keys() - selected)
        ranked = []
        for row in rows:
            values = {points[plain(key)] for key in [row['name'], *row['aliases']] if plain(key) in points}
            assert len(values) <= 1, (ident, row['name'])
            ranked.append({**row, 'points': next(iter(values), 60)})
        assert {row['points'] for row in ranked} == {10, 30, 60, 85, 100}, ident
        sources = list(base['sources']) + list(extra_sources)
        add(ident, title, description, base['theme'], ranked, sources)
        categories[-1].update(audience='discovery', connection=True)

    def overlap(left, right):
        right_index = {
            plain(name): row for row in right['answers'] for name in [row['name'], *row['aliases']]
        }
        for row in left['answers']:
            matches = {
                right_index[plain(name)]['name']: right_index[plain(name)]
                for name in [row['name'], *row['aliases']] if plain(name) in right_index
            }
            assert len(matches) <= 1, row['name']
            if matches:
                other = next(iter(matches.values()))
                yield answer(row['name'], [*row['aliases'], other['name'], *other['aliases']], id=row['id'])

    def picks(base, names):
        by_name = {plain(row['name']): row for row in base['answers']}
        return [by_name[plain(name)] for name in names.split('|')]

    world = catalog['paises-territorios']
    same_letter = [row for row in world['answers'] if plain(row['name'])[0] == plain(row['name'])[-1]]
    same_letter.append(answer('Arabia Saudita', id='sa'))
    publish('territorios-misma-letra', '¿Qué país o territorio empieza y acaba por la misma letra?',
            'Usamos los nombres de CLDR en español con variantes regionales. Las tildes no cambian la letra.',
            world, same_letter, {
                10: ['Argentina', 'Alemania', 'Australia'],
                30: ['Austria', 'Argelia', 'Andorra', 'Antártida', 'Arabia Saudita'],
                85: ['Aruba', 'San Vicente y las Granadinas', 'San Cristóbal y Nieves'],
                100: ['Anguila', 'Seychelles'],
            }, [{'title': 'FundéuRAE, Arabia Saudí y Arabia Saudita',
                 'url': 'https://www.fundeu.es/recomendacion/arabia-saudiarabia-saudita/'}])
    categories[-1]['excludedGuesses'] = ['Arabia Saudí']  # En esta variante la última letra es i.

    elements = catalog['elementos']
    publish('elementos-simbolo-una-letra', '¿Qué elemento químico tiene un símbolo de una sola letra?',
            'Vale escribir el nombre del elemento o su símbolo actual en la tabla periódica.', elements,
            [row for row in elements['answers'] if any(len(alias) == 1 for alias in row['aliases'])], {
                10: ['H', 'C', 'O', 'N', 'S'],
                30: ['F', 'I', 'P', 'K', 'U'],
                85: ['V'],
                100: ['Y'],
            })

    men = catalog['mundial-catar']
    women = catalog['mundial-femenino-2023']
    publish('mundiales-catar-australia', '¿Qué país jugó el Mundial masculino de 2022 y el femenino de 2023?',
            'La selección del país debe aparecer en la fase final de ambos Mundiales de fútbol.',
            men, list(overlap(men, women)), {
                10: ['España', 'Argentina', 'Inglaterra', 'Estados Unidos', 'Brasil'],
                30: ['Alemania', 'Francia', 'Japón', 'Países Bajos'],
                85: ['Dinamarca', 'Suiza'],
                100: ['Costa Rica'],
            }, women['sources'])

    pixar = catalog['pixar']
    oscars = catalog['oscar-animacion']
    publish('pixar-oscar-animacion', '¿Qué película de Pixar ganó el Óscar a mejor largometraje animado?',
            'Cuentan las ceremonias hasta 2025 inclusive. Vale el título original o el de tu región.',
            pixar, list(overlap(pixar, oscars)), {
                10: ['Coco', 'Buscando a Nemo', 'Ratatouille'],
                30: ['Los Increíbles', 'Up', 'Del revés', 'WALL·E'],
                85: ['Valiente'],
                100: ['Soul'],
            }, oscars['sources'])

    pokemon = catalog['pokemon-kanto']
    # Especies #001–151 en su forma de Kanto, según la Pokédex oficial.
    water = ('Squirtle|Wartortle|Blastoise|Psyduck|Golduck|Poliwag|Poliwhirl|Poliwrath|Tentacool|Tentacruel|'
             'Slowpoke|Slowbro|Seel|Dewgong|Shellder|Cloyster|Krabby|Kingler|Horsea|Seadra|Goldeen|Seaking|'
             'Staryu|Starmie|Magikarp|Gyarados|Lapras|Vaporeon|Omanyte|Omastar|Kabuto|Kabutops')
    publish('kanto-tipo-agua', '¿Qué Pokémon de Kanto tiene el tipo Agua?',
            'Busca entre los 151 originales y piensa en su forma de Kanto. Las especies con un segundo tipo también cuentan.',
            pokemon, picks(pokemon, water), {
                10: ['Squirtle', 'Blastoise', 'Magikarp', 'Psyduck', 'Gyarados'],
                30: ['Lapras', 'Vaporeon', 'Staryu', 'Slowpoke', 'Poliwag'],
                85: ['Seel', 'Seadra', 'Goldeen', 'Omanyte', 'Kabuto'],
                100: ['Omastar', 'Seaking'],
            })

    animals = catalog['emoji-animales']
    birds = 'águila|búho|cisne|dodo|flamenco|gallina|gallo|loro|oca|pájaro|paloma|pato|pavo|pavo real|pingüino|pollito'
    blackbird = answer('pájaro negro', ['cuervo', 'grajo', 'mirlo'])
    publish('aves-con-emoji', '¿Qué ave real tiene su propio emoji?',
            'Usamos Unicode Emoji 16.0. Las versiones de un mismo animal cuentan juntas, como las de un pollito.',
            animals, [*picks(animals, birds), blackbird], {
                10: ['pájaro', 'pato', 'gallina', 'pingüino', 'pollito'],
                30: ['águila', 'búho', 'loro', 'paloma', 'gallo'],
                85: ['oca', 'pájaro negro'],
                100: ['dodo'],
            })
    categories[-1]['excludedGuesses'] = ['ciervo']  # Es un animal distinto de «cuervo».

    currencies = catalog['monedas']
    names = {row['name'] for row in currencies['answers'] if any(
        word in {'dólar', 'peso', 'franco'} for word in row['name'].split())}
    publish('monedas-dolar-peso-franco', '¿Qué moneda de 2024 lleva «dólar», «peso» o «franco» en su nombre?',
            'Se toma el nombre en español y el curso legal el 1 de enero de 2024. Identifica la moneda concreta o escribe su código ISO.',
            currencies, [row for row in currencies['answers'] if row['name'] in names], {
                10: ['USD', 'MXN', 'ARS', 'COP', 'CLP'],
                30: ['CAD', 'AUD', 'CHF', 'CUP', 'DOP', 'UYU'],
                85: ['BIF', 'DJF', 'FJD', 'NAD', 'SBD', 'SRD', 'XPF'],
                100: ['KMF'],
            })

    literature = catalog['nobel-literature']
    spanish = ('Gabriel García Márquez|Mario Vargas Llosa|Pablo Neruda|Gabriela Mistral|Octavio Paz|Camilo José Cela|'
               'Jacinto Benavente|José Echegaray|Juan Ramón Jiménez|Miguel Ángel Asturias|Vicente Aleixandre')
    publish('nobel-literatura-espanol', '¿Qué Nobel de Literatura escribió su obra en español?',
            'Cuenta cualquier autor o autora de lengua española que haya recibido el Nobel de Literatura hasta 2025.',
            literature, picks(literature, spanish), {
                10: ['Gabriel García Márquez', 'Mario Vargas Llosa', 'Pablo Neruda'],
                30: ['Gabriela Mistral', 'Octavio Paz', 'Camilo José Cela'],
                85: ['Miguel Ángel Asturias', 'Jacinto Benavente'],
                100: ['José Echegaray'],
            }, [{'title': 'Instituto Cervantes, Premios Nobel de literatura en español',
                 'url': 'https://londres.cervantes.es/FichasCultura/Ficha91118_22_1.htm'}])
