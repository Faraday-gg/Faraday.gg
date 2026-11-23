"""Selecciones editoriales propias. Cada línea agrupa respuestas del mismo valor.

La barra vertical separa conceptos y el signo igual separa los alias de un concepto.
Las fuentes definen el conjunto o documentan los ejemplos cuando se indica selección.
"""

SETS = [
    ('pixar', 'cine', 'familiar', '¿Qué largometraje estrenó Pixar hasta 2025?',
     'Cuenta la filmografía del estudio hasta 2025 inclusive. Puedes usar el título original o el de tu región.',
     'Filmografía oficial de Pixar', 'https://www.pixar.com/feature-films/', """
10 Toy Story|Coco|Cars|Buscando a Nemo=Finding Nemo|Ratatouille|Los Increíbles=The Incredibles|Up=Up Una aventura de altura
30 Toy Story 2|Toy Story 3|Toy Story 4|Del revés=Intensamente=Inside Out|Monstruos S. A.=Monsters Inc=Monsters Incorporated=Monstruos SA|WALL·E=Wall E=WALL-E|Buscando a Dory=Finding Dory|Valiente=Brave=Indomable|Soul|Luca
60 Del revés 2=Intensamente 2=Inside Out 2|Los Increíbles 2=Incredibles 2|Cars 2|Cars 3|Bichos=A Bug's Life=Bichos una aventura en miniatura|Monstruos University=Monsters University|Red=Turning Red|Elemental=Elementos
85 Onward=Unidos|Lightyear|Elio
100 El viaje de Arlo=Un gran dinosaurio=The Good Dinosaur
"""),
    ('disney-animacion', 'cine', 'familiar', '¿Qué película estrenó Walt Disney Animation Studios?',
     'Cuenta la filmografía de ese estudio hasta Vaiana 2 (Moana 2), inclusive. Vale el título de tu región.',
     'Filmografía de Walt Disney Animation Studios', 'https://disneyanimation.com/films/', """
10 El rey león=The Lion King|Aladdín=Aladdin|La sirenita=The Little Mermaid|La bella y la bestia=Beauty and the Beast|Frozen=Frozen El reino del hielo=Frozen Una aventura congelada|Blancanieves y los siete enanitos=Blancanieves=Snow White and the Seven Dwarfs|Cenicienta=La Cenicienta=Cinderella|Mulán=Mulan|Encanto|Vaiana=Moana
30 Bambi|Dumbo|Pinocho=Pinocchio|La bella durmiente=Sleeping Beauty|Peter Pan|Alicia en el país de las maravillas=Alice in Wonderland|El libro de la selva=The Jungle Book|101 dálmatas=One Hundred and One Dalmatians=Ciento un dálmatas|Pocahontas|Hércules=Hercules|Tarzán=Tarzan|Lilo y Stitch=Lilo and Stitch|Zootrópolis=Zootopia|Enredados=Tangled
60 Frozen 2=Frozen II|Vaiana 2=Moana 2|Raya y el último dragón=Raya and the Last Dragon|Big Hero 6=Grandes héroes|¡Rompe Ralph!=Ralph el demoledor=Wreck-It Ralph|Ralph rompe Internet=Wifi Ralph=Ralph Breaks the Internet|Bolt=Volt|Tiana y el sapo=La princesa y el sapo=The Princess and the Frog|El jorobado de Notre Dame=The Hunchback of Notre Dame|La dama y el vagabundo=Lady and the Tramp|Robin Hood|Los aristogatos=The Aristocats|Tod y Toby=El zorro y el sabueso=The Fox and the Hound|La espada en la piedra=Merlín el encantador=The Sword in the Stone
85 Fantasía=Fantasia|Fantasía 2000=Fantasia 2000|Basil el ratón superdetective=Policías y ratones=The Great Mouse Detective|Oliver y su pandilla=Oliver y compañía=Oliver & Company|Bernardo y Bianca=Los rescatadores=The Rescuers|Bernardo y Bianca en Cangurolandia=Los rescatadores en Cangurolandia=The Rescuers Down Under|Hermano oso=Tierra de osos=Brother Bear|El emperador y sus locuras=Las locuras del emperador=The Emperor's New Groove|Atlantis El imperio perdido=Atlantis The Lost Empire|El planeta del tesoro=Treasure Planet|Chicken Little|Descubriendo a los Robinson=Descubriendo a los Robinsons=La familia del futuro=Meet the Robinsons|Vacas vaqueras=Zafarrancho en el rancho=Home on the Range|Dinosaurio=Dinosaur|Winnie the Pooh=El regreso de Winnie the Pooh|Wish=Wish El poder de los deseos|Mundo extraño=Un mundo extraño=Strange World
100 Los tres caballeros=The Three Caballeros|Saludos amigos|Música maestro=Make Mine Music|Tiempo de melodía=Melody Time|Las aventuras de Bongo Mickey y las judías mágicas=Fun and Fancy Free|Las aventuras de Ichabod y el señor Sapo=The Adventures of Ichabod and Mr. Toad=Dos personajes fabulosos|Taron y el caldero mágico=El caldero mágico=The Black Cauldron|Lo mejor de Winnie the Pooh=The Many Adventures of Winnie the Pooh
"""),
    ('oscar-animacion', 'cine', 'discovery', '¿Qué película ganó el Óscar a mejor largometraje animado?',
     'Busca ganadoras del premio a largometraje animado en las ceremonias de 2002 a 2025. Valen títulos originales y traducidos.',
     'Base de datos oficial de los Óscar', 'https://awardsdatabase.oscars.org/', """
10 Shrek|Buscando a Nemo=Finding Nemo|Coco|Frozen=Frozen El reino del hielo=Frozen Una aventura congelada|Ratatouille
30 El viaje de Chihiro=Spirited Away|Los Increíbles=The Incredibles|Toy Story 3|Toy Story 4|Up=Up Una aventura de altura|WALL·E=Wall E|Del revés=Intensamente=Inside Out|Zootrópolis=Zootopia
60 Happy Feet=Happy Feet Rompiendo el hielo|Brave=Valiente=Indomable|Big Hero 6=Grandes héroes|Soul|Encanto|Spider-Man Un nuevo universo=Spider-Man Into the Spider-Verse|Pinocho de Guillermo del Toro=Guillermo del Toro's Pinocchio
85 Rango|Wallace y Gromit La maldición de las verduras=Wallace y Gromit La batalla de los vegetales=Wallace & Gromit The Curse of the Were-Rabbit|El niño y la garza=The Boy and the Heron
100 Flow=Flow Un mundo que salvar
"""),
    ('pokemon-kanto', 'videojuegos', 'familiar', 'Nombra uno de los primeros 151 Pokémon',
     'Vale cualquier especie de la Pokédex de Kanto, del número 1 al 151. Escribe el nombre de la especie.',
     'Pokédex oficial y repertorio original de Kanto', 'https://www.pokemon.com/el/pokedex', """
10 Pikachu|Bulbasaur|Charmander|Squirtle|Charizard|Eevee|Mewtwo|Snorlax|Mew
30 Ivysaur|Venusaur|Charmeleon|Wartortle|Blastoise|Caterpie|Butterfree|Pidgey|Rattata|Raichu|Jigglypuff|Meowth|Psyduck|Growlithe|Arcanine|Abra|Machamp|Geodude|Slowpoke|Gastly|Gengar|Onix|Magikarp|Gyarados|Lapras|Ditto|Vaporeon|Jolteon|Flareon|Articuno|Zapdos|Moltres|Dragonite
60 Metapod|Weedle|Beedrill|Pidgeotto|Pidgeot|Spearow|Ekans|Arbok|Sandshrew|Nidorina|Nidoqueen|Nidorino|Nidoking|Clefairy|Vulpix|Ninetales|Zubat|Golbat|Oddish|Diglett|Dugtrio|Persian|Golduck|Mankey|Primeape|Poliwag|Poliwhirl|Kadabra|Alakazam|Machop|Machoke|Bellsprout|Tentacool|Graveler|Golem|Ponyta|Rapidash|Slowbro|Magnemite|Magneton|Farfetch’d=Farfetchd|Seel|Grimer|Muk|Shellder|Cloyster|Haunter|Drowzee|Krabby|Voltorb|Exeggcute|Cubone|Marowak|Hitmonlee|Hitmonchan|Lickitung|Koffing|Weezing|Rhyhorn|Rhydon|Chansey|Tangela|Kangaskhan|Horsea|Staryu|Starmie|Mr. Mime=Mr Mime|Scyther|Jynx|Electabuzz|Magmar|Pinsir|Tauros|Porygon|Omanyte|Kabuto|Aerodactyl|Dratini|Dragonair
85 Kakuna|Raticate|Fearow|Sandslash|Nidoran hembra=Nidoran female|Nidoran macho=Nidoran male|Clefable|Wigglytuff|Gloom|Vileplume|Paras|Parasect|Venonat|Venomoth|Poliwrath|Weepinbell|Victreebel|Tentacruel|Doduo|Dodrio|Dewgong|Hypno|Kingler|Electrode|Exeggutor|Seadra|Goldeen|Omastar|Kabutops
100 Seaking
"""),
    ('smash-luchadores', 'videojuegos', 'discovery', 'Nombra un luchador de Super Smash Bros. Ultimate',
     'Cuenta el plantel de Nintendo Switch, incluidos los descargables y sus variantes jugables.',
     'Nintendo, plantel oficial de Super Smash Bros. Ultimate', 'https://www.smashbros.com/es_ES/fighter/index.html', """
10 Mario|Luigi|Link|Pikachu|Kirby|Sonic|Donkey Kong=Donkey
30 Samus|Yoshi|Fox|Ness|Captain Falcon=Capitán Falcon|Peach|Bowser|Zelda|Mewtwo|Wario|Diddy Kong|Pac-Man=Pacman|Ryu|Cloud|Steve
60 Dark Samus=Samus Oscura|Daisy|Ice Climbers|Sheik|Dr. Mario=Doctor Mario|Pichu|Falco|Marth|Lucina|Young Link=Link niño|Ganondorf|Roy|Chrom|Mr. Game & Watch=Mr Game and Watch=Game and Watch|Meta Knight|Pit|Dark Pit=Pit Sombrío|Zero Suit Samus=Samus Zero|Snake=Solid Snake|Ike|Entrenador Pokémon=Pokémon Trainer|Squirtle|Ivysaur|Charizard|Lucas|King Dedede=Rey Dedede=Dedede|Olimar=Alph|Lucario|R.O.B.=ROB|Toon Link=Link caricatura|Wolf|Aldeano=Villager|Mega Man=Megaman|Rosalina y Destello=Estela y Destello=Rosalina and Luma|Little Mac|Greninja|Palutena|Robin=Dara|Shulk|Bowser Jr.|Dúo Duck Hunt=Duck Hunt|Ken|Corrin|Bayonetta|Inkling|Ridley|Simon Belmont=Simon|Richter Belmont=Richter|King K. Rool=Rey K Rool|Canela=Isabelle|Incineroar|Joker|Héroe=Hero|Banjo y Kazooie=Banjo & Kazooie|Terry Bogard=Terry|Byleth|Min Min|Alex|Enderman|Zombie=Zombi|Sephiroth=Sefirot|Pyra|Mythra|Kazuya|Sora
85 Entrenadora de Wii Fit=Entrenador de Wii Fit=Wii Fit Trainer|Tirador Mii=Mii Gunner|Luchador Mii=Mii Brawler|Planta Piraña=Piranha Plant
100 Espadachín Mii=Mii Swordfighter
"""),
    ('deportes-paris', 'deporte', 'familiar', '¿Qué deporte formó parte de los Juegos Olímpicos de París 2024?',
     'Cuenta cualquiera de los 32 deportes del programa. Puedes nombrar una disciplina y se agrupa con su deporte.',
     'Comité Olímpico Internacional, programa de París 2024', 'https://library.olympics.com/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=3415338&parentDocumentId=3415336&skipCopyright=true&skipWatermark=true', """
10 Fútbol=Balompié|Baloncesto=Básquet=Básquetbol=Basket=Basketball=Baloncesto 3x3|Atletismo=Maratón|Natación y deportes acuáticos=Natación=Natación artística=Natación sincronizada=Waterpolo=Clavados=Saltos de trampolín=Aguas abiertas|Tenis|Ciclismo=BMX=Mountain bike=Ciclismo de montaña=Ciclismo en pista=Ciclismo en ruta
30 Voleibol=Vóley=Voleibol de playa=Vóley playa|Gimnasia=Gimnasia artística=Gimnasia rítmica=Gimnasia en trampolín|Boxeo|Judo|Surf|Golf|Balonmano=Handball|Hockey sobre césped=Hockey sobre hierba=Hockey|Rugby=Rugby a siete=Rugby 7
60 Esgrima|Bádminton|Tenis de mesa=Ping pong|Taekwondo|Levantamiento de pesas=Halterofilia|Remo|Vela|Tiro con arco=Arquería|Tiro deportivo=Tiro olímpico|Triatlón|Patineta=Skate=Skateboarding|Escalada deportiva=Escalada|Breaking=Breakdance
85 Hípica=Equitación=Doma clásica=Salto ecuestre|Lucha=Lucha libre olímpica=Lucha grecorromana|Piragüismo=Canotaje=Canoa eslalon=Canoa sprint=Kayak
100 Pentatlón moderno=Pentatlón
"""),
    ('mundial-catar', 'deporte', 'familiar', '¿Qué selección jugó el Mundial masculino de Catar 2022?',
     'Son las 32 selecciones de la fase final masculina. Escribe el país o el nombre habitual de la selección.',
     'FIFA, selecciones y grupos de Catar 2022', 'https://www.fifa.com/es/articles/qatar-2022-todo-lo-que-tienes-que-saber', """
10 Argentina=La Albiceleste|Brasil=Brazil|España=Spain|Francia=France|Inglaterra=England|Alemania=Germany|Portugal|México=Mexico
30 Catar=Qatar|Uruguay|Estados Unidos=USA=EEUU|Marruecos=Morocco|Japón=Japan|Países Bajos=Holanda=Netherlands|Croacia=Croatia|Bélgica=Belgium
60 Ecuador|Senegal|Irán=Iran|Polonia=Poland|Arabia Saudí=Arabia Saudita|Corea del Sur=República de Corea|Australia|Dinamarca=Denmark|Suiza=Switzerland|Canadá=Canada
85 Costa Rica|Serbia|Camerún=Cameroon|Ghana|Gales=Wales
100 Túnez=Tunisia
"""),
    ('mundial-femenino-2023', 'deporte', 'discovery', 'Nombra una selección del Mundial femenino de 2023',
     'Busca las 32 selecciones que jugaron la fase final en Australia y Nueva Zelanda.',
     'FIFA, selecciones clasificadas al Mundial femenino de 2023', 'https://www.fifa.com/es/articles/los-equipos-clasificados-a-la-copa-mundial-femenina-de-la-fifa-2023', """
10 España|Estados Unidos=EEUU=USA|Inglaterra|Australia|Nueva Zelanda
30 Brasil|Argentina|Colombia|Francia|Alemania|Japón|Suecia|Canadá|Países Bajos=Holanda
60 Noruega|Suiza|Dinamarca|China|Corea del Sur=República de Corea|Portugal|Italia|Irlanda=República de Irlanda|Costa Rica|Panamá|Sudáfrica|Nigeria|Marruecos
85 Filipinas|Vietnam|Jamaica|Zambia
100 Haití
"""),
    ('deportes-invierno', 'deporte', 'discovery', '¿Qué deporte se disputó en los Juegos de Invierno de 2026?',
     'Cuentan los deportes y las disciplinas del programa de Milano Cortina.',
     'Comité Olímpico Internacional, programa de Milano Cortina 2026', 'https://gstatic.olympics.com/s3/mc2026/documents/Education%20Programme/OVEP/English%20Toolkit/OVEP-Fundamentals-2023%20-%20English.pdf', """
10 Esquí alpino=Esquí=Slalom=Eslalon|Snowboard=Snowboarding|Hockey sobre hielo=Hockey|Patinaje artístico=Patinaje sobre hielo
30 Curling|Esquí de fondo=Esquí a campo traviesa|Saltos de esquí|Patinaje de velocidad
60 Bobsleigh=Bobsled|Biatlón|Esquí acrobático=Esquí libre=Freestyle skiing
85 Skeleton|Luge|Patinaje de velocidad en pista corta=Short track
100 Combinada nórdica|Esquí de montaña=Esquí de travesía=Skimo
"""),
    ('hierbas-y-especias', 'cocina', 'familiar', 'Abre el especiero: ¿qué hierba o especia sacarías?',
     'Busca un condimento aromático individual, como los que usas para cocinar. Valen nombres regionales.',
     'FDA, referencia para las denominaciones de hierbas y especias', 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cpg-sec-525750-spices-definitions', """
10 Canela|Pimienta negra=Pimienta|Orégano|Perejil|Comino|Ajo en polvo=Ajo=Ajos|Pimentón=Paprika=Páprika|Albahaca|Romero|Clavo de olor=Clavo
30 Cilantro=Culantro=Semillas de cilantro=Coriandro|Tomillo|Laurel=Hoja de laurel|Nuez moscada|Vainilla|Jengibre|Cúrcuma|Azafrán|Menta=Hierbabuena|Mostaza=Semillas de mostaza|Pimienta blanca|Cayena=Pimienta de cayena
60 Eneldo|Anís=Anís verde|Anís estrellado|Cardamomo|Salvia|Hinojo=Semilla de hinojo|Ajedrea|Estragón|Cebolla en polvo=Cebolla deshidratada|Semilla de apio|Cebollino=Cebollín|Pimienta de Jamaica=Pimienta gorda=Pimienta dulce=Allspice|Mejorana
85 Macis|Alcaravea=Comino de prado|Perifollo|Semillas de amapola=Amapola|Sumac=Zumaque|Achiote=Annatto=Onoto
100 Asafétida
"""),
    ('legumbres-secas', 'cocina', 'familiar', '¿Qué legumbre se cosecha como semilla seca para comer?',
     'Usamos la clasificación de legumbres secas de la FAO. Las variedades y los nombres regionales cuentan por su tipo.',
     'FAO, definición y clases de legumbres secas', 'https://www.fao.org/fileadmin/user_upload/pulses-2016/Exhibit/totem1_B_roll-up_v1.pdf', """
10 Garbanzo|Lenteja=Lentejas|Judía seca=Alubia=Frijol=Fréjol=Poroto=Habichuela=Frijol negro=Frijol pinto=Frijol mungo=Judía mungo=Mungo=Frijol azuki=Azuki
30 Guisante seco=Guisante=Arveja=Chícharo=Arveja seca|Haba seca=Haba=Habas
60 Altramuz=Altramuz seco=Chochos=Tarwi=Lupino|Caupí=Frijol de ojo negro=Carilla=Frijol carita=Frijol de carita=Chícharo de vaca
85 Guandú=Gandul=Guandul|Veza=Vicia
100 Frijol bambara=Maní bambara=Voandzeia|Frijol alado=Judía alada|Frijol espada=Judía espada
"""),
    ('instrumentos-orquesta', 'musica', 'familiar', 'Nombra un instrumento que suene en una orquesta sinfónica',
     'Valen instrumentos de cuerda, viento, percusión o teclado del catálogo de la orquesta y sus variantes habituales.',
     'Philharmonia, familias e instrumentos orquestales', 'https://philharmonia.co.uk/resources/instruments/', """
10 Violín|Flauta travesera=Flauta=Flauta transversal|Trompeta|Piano|Arpa
30 Violonchelo=Chelo=Cello|Viola|Contrabajo|Clarinete|Trombón|Tuba|Saxofón=Saxo
60 Oboe|Fagot|Trompa=Corno francés=Corno|Timbales orquestales=Timbales=Timbal|Flautín=Piccolo|Xilófono|Platillos=Platos|Triángulo|Tambor de caja=Caja=Redoblante|Bombo|Pandereta|Gong
85 Corno inglés=Trompa inglesa|Clarinete bajo=Clarón|Contrafagot|Vibráfono|Marimba|Carillón orquestal=Glockenspiel|Campanas tubulares|Castañuelas|Clave=Clavecín|Órgano|Clarinete en mi bemol=Requinto|Clarinete contrabajo|Trombón bajo
100 Celesta
"""),
    ('planetas-y-enanos', 'espacio', 'familiar', '¿Qué planeta o planeta enano del sistema solar visitarías?',
     'Valen los ocho planetas y los cinco planetas enanos de la lista de la NASA.',
     'NASA, planetas del sistema solar', 'https://science.nasa.gov/solar-system/planets/', """
10 Tierra=La Tierra|Marte|Júpiter|Saturno
30 Venus|Mercurio|Neptuno|Urano
60 Plutón=Pluto
85 Ceres|Eris
100 Haumea|Makemake
"""),
    ('huesos-largos', 'cuerpo', 'familiar', 'Nombra un hueso largo del cuerpo humano',
     'Busca los huesos largos del esqueleto adulto. Los dedos y los huesos largos numerados cuentan por su tipo.',
     'OpenStax, esqueleto apendicular y sus huesos', 'https://openstax.org/books/anatomy-and-physiology-2e/pages/8-introduction', """
10 Fémur|Tibia|Húmero
30 Radio|Cúbito=Ulna|Peroné=Fíbula|Clavícula
60 Falange=Falanges|Metacarpiano=Metacarpo=Metacarpianos
100 Metatarsiano=Metatarso=Metatarsianos
"""),
    ('capitales-ue', 'geografia', 'familiar', '¿Qué ciudad es capital de un país de la Unión Europea?',
     'Nombra la capital de uno de los 27 países de la UE. Valen sus nombres habituales en español y en el idioma local.',
     'Unión Europea, fichas oficiales de los países miembros', 'https://european-union.europa.eu/principles-countries-history/eu-countries_es', """
10 Madrid|París=Paris|Roma=Rome|Berlín=Berlin|Lisboa=Lisbon
30 Atenas=Athens|Bruselas=Bruxelles=Brussels|Ámsterdam=Amsterdam|Dublín=Dublin|Viena=Wien=Vienna|Praga=Praha|Estocolmo=Stockholm
60 Copenhague=København=Copenhagen|Helsinki|Varsovia=Warszawa=Warsaw|Budapest|Bucarest=București|Sofía=Sofia
85 Bratislava|Zagreb|Luxemburgo=Luxembourg|Vilna=Vilnius|Riga|Tallin=Tallinn
100 La Valeta=Valletta|Liubliana=Ljubljana|Nicosia=Lefkosia
"""),
    ('estados-usa', 'geografia', 'discovery', '¿Qué estado de Estados Unidos visitarías?',
     'Cuenta cualquiera de los 50 estados. Escribe el nombre del estado, en español o en inglés.',
     'U.S. Mint, los 50 estados en el programa de monedas', 'https://www.usmint.gov/learn/coins-and-medals/circulating-coins/quarter/50-state-quarters', """
10 California|Texas|Florida|Nueva York=New York|Hawái=Hawaii|Alaska
30 Nevada|Arizona|Colorado|Illinois|Massachusetts|Washington=Estado de Washington|Oregón=Oregon|Pensilvania=Pennsylvania|Nueva Jersey=New Jersey|Luisiana=Louisiana
60 Alabama|Arkansas|Connecticut|Georgia|Idaho|Indiana|Iowa|Kansas|Kentucky|Maine|Maryland|Míchigan=Michigan|Minnesota|Misisipi=Mississippi|Misuri=Missouri|Montana|Nuevo México=New Mexico|Carolina del Norte=North Carolina|Carolina del Sur=South Carolina|Ohio|Oklahoma|Tennessee|Utah|Virginia|Wisconsin|Wyoming
85 Delaware|Dakota del Norte=North Dakota|Dakota del Sur=South Dakota|Nebraska|Nuevo Hampshire=New Hampshire|Vermont
100 Rhode Island|Virginia Occidental=West Virginia
"""),
    ('letras-griegas', 'lengua', 'discovery', '¿Qué letra del alfabeto griego reconoces?',
     'Puedes escribir el nombre español o la transcripción habitual de una de sus 24 letras.',
     'Unicode, repertorio de letras griegas', 'https://www.unicode.org/charts/PDF/U0370.pdf', """
10 Alfa=Alpha|Beta|Omega|Delta
30 Gamma=Gama|Épsilon=Epsilon|Pi|Sigma|Zeta
60 Lambda|Kappa=Capa|Ómicron=Omicron|Tau|Theta=Teta|Phi=Fi|Iota|Eta|Psi
85 Mu=Mi|Nu=Ni|Rho=Ro|Chi=Ji|Ípsilon=Upsilon=Ypsilon
100 Xi=Ksi
"""),
    ('shakespeare', 'literatura', 'discovery', 'Si vas al teatro a ver a Shakespeare, ¿qué obra eliges?',
     'Cuentan las obras de teatro del catálogo Folger. Puedes usar el título original o uno de sus títulos habituales en español.',
     'Folger Shakespeare Library, catálogo de obras', 'https://www.folger.edu/explore/shakespeares-works/all-works/', """
10 Romeo y Julieta=Romeo and Juliet|Hamlet|Macbeth|Otelo=Othello
30 El rey Lear=King Lear|La tempestad=The Tempest|Sueño de una noche de verano=El sueño de una noche de verano=A Midsummer Night's Dream|El mercader de Venecia=The Merchant of Venice|Julio César=Julius Caesar
60 La fierecilla domada=La doma de la fiera=The Taming of the Shrew|Mucho ruido y pocas nueces=Much Ado About Nothing|Ricardo III=Richard III=Ricardo 3|Antonio y Cleopatra=Antony and Cleopatra|Noche de reyes=Twelfth Night|Enrique V=Henry V=Enrique 5|Como gustéis=As You Like It|Las alegres comadres de Windsor=The Merry Wives of Windsor|Enrique VIII=Henry VIII=Enrique 8
85 Coriolano=Coriolanus|Tito Andrónico=Titus Andronicus|Timón de Atenas=Timon of Athens|Troilo y Crésida=Troilus and Cressida|Cuento de invierno=The Winter's Tale|Medida por medida=Measure for Measure|Los dos hidalgos de Verona=The Two Gentlemen of Verona|Trabajos de amor perdidos=Love's Labor's Lost|La comedia de las equivocaciones=The Comedy of Errors|Bien está lo que bien acaba=All's Well That Ends Well|Cimbelino=Cymbeline|Pericles=Pericles Prince of Tyre|Ricardo II=Richard II=Ricardo 2|El rey Juan=King John|Enrique IV parte 1=Henry IV Part 1|Enrique IV parte 2=Henry IV Part 2|Enrique VI parte 1=Henry VI Part 1|Enrique VI parte 2=Henry VI Part 2|Enrique VI parte 3=Henry VI Part 3
100 Los dos nobles caballeros=The Two Noble Kinsmen
"""),
    ('grammy-album', 'musica', 'challenge', '¿Qué disco ganó el Grammy a álbum del año?',
     'Cuenta cualquier álbum ganador en las ceremonias de 2000 a 2025. Escribe el título del disco.',
     'Recording Academy, ganadores de álbum del año', 'https://www.grammy.com/awards/categories/album-of-the-year/', """
10 1989|21|25|Cowboy Carter|Midnights
30 Fearless|Folklore|Random Access Memories|Supernatural|When We All Fall Asleep, Where Do We Go?|24K Magic
60 The Suburbs|Golden Hour|Morning Phase|Babel|Harry's House|We Are|Taking the Long Way
85 Two Against Nature|O Brother, Where Art Thou?=O Brother Where Art Thou soundtrack|Come Away with Me|Speakerboxxx/The Love Below=Speakerboxxx The Love Below|Genius Loves Company|How to Dismantle an Atomic Bomb|Raising Sand
100 River The Joni Letters=River The Joni Letters Herbie Hancock
"""),
    ('zodiaco-chino', 'tradiciones', 'familiar', '¿Qué animal elegirías del zodiaco chino?',
     'Hay doce animales en este ciclo tradicional. Se aceptan sus nombres habituales en español.',
     'Smithsonian, los doce animales del Año Nuevo lunar', 'https://www.si.edu/events/lunar-new-year', """
10 Dragón|Tigre|Perro
30 Conejo=Liebre|Mono|Serpiente
60 Rata=Ratón|Caballo|Cerdo=Jabalí|Gallo
85 Buey=Búfalo=Vaca
100 Cabra=Oveja=Carnero
"""),
    ('escala-mohs', 'naturaleza', 'challenge', 'Nombra un mineral de la escala de dureza de Mohs',
     'Busca uno de los diez minerales de referencia, desde el más blando hasta el más duro.',
     'National Park Service, escala de Mohs', 'https://www.nps.gov/articles/mohs-hardness-scale.htm', """
10 Diamante|Cuarzo
30 Talco|Yeso
60 Topacio|Calcita
85 Fluorita|Corindón|Ortoclasa=Ortosa=Feldespato ortoclasa
100 Apatito=Apatita
"""),
]


def add_sets(add, answer, categories):
    for ident, theme, audience, title, description, source, url, values in SETS:
        rows = []
        for line in values.strip().splitlines():
            points, concepts = line.strip().split(' ', 1)
            for concept in concepts.split('|'):
                name, *aliases = concept.split('=')
                rows.append(answer(name, aliases, int(points)))
        add(ident, title, description, theme, rows, [{'title': source, 'url': url}])
        categories[-1]['audience'] = audience
