#!/usr/bin/env python3
"""Prepara el banco editorial de Ascensión desde conjuntos oficiales.

Python estándar, sin dependencias. Lee los archivos de --cache; --descargar
obtiene únicamente esas fuentes públicas. El juego usa el JSON versionado,
nunca consulta estas fuentes ni genera respuestas durante una partida.
"""
import argparse, collections, hashlib, html, json, pathlib, re, runpy, unicodedata, urllib.request, xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
URLS={
 'emoji-test.txt':'https://unicode.org/Public/emoji/16.0/emoji-test.txt',
 'annotations-es.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotations/es.xml',
 'annotationsDerived-es.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/annotationsDerived/es.xml',
 'es.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/main/es.xml',
 'en.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/main/en.xml',
 'territory.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/supplemental/supplementalData.xml',
 'regions.xml':'https://raw.githubusercontent.com/unicode-org/cldr/release-46/common/validity/region.xml',
 'languages.txt':'https://www.loc.gov/standards/iso639-2/ISO-639-2_utf-8.txt',
 'nobel-v1.json':'https://api.nobelprize.org/v1/laureate.json',
 'constellations.html':'https://starchild.gsfc.nasa.gov/docs/StarChild/questions/88constellations.html',
 'provincias.html':'https://ine.es/daco/daco42/codmun/cod_ccaa_provincia.htm',
 'unicode-license.txt':'https://www.unicode.org/license.txt',
}
parser=argparse.ArgumentParser();parser.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('/private/tmp/ascension-editorial'));parser.add_argument('--descargar',action='store_true');args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
if args.descargar:
 for name,url in URLS.items():
  request=urllib.request.Request(url,headers={'User-Agent':'Faraday-gg editorial dataset research'})
  data=urllib.request.urlopen(request,timeout=45).read();(args.cache/name).write_bytes(data)
  print('Descargado',name,len(data))
for name in URLS:assert (args.cache/name).is_file(),f'Falta {name}: usa --descargar o conserva la caché editorial'
plain=lambda s:re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower()).strip()
def answer(name,aliases=(),points=60,id=None):
 out={'id':id or re.sub(r'[^a-z0-9]+','-',plain(name)).strip('-'),'name':name,'aliases':list(dict.fromkeys(a for a in aliases if a and plain(a) and plain(a)!=plain(name))),'points':points}
 return out
categories=[]
def category(id,title,description,theme,answers,sources):
 rows={}
 for row in answers:
  key=plain(row['name'])
  if not key:continue
  if key in rows:
   rows[key]['aliases']=list(dict.fromkeys(rows[key]['aliases']+[row['name']]+row['aliases']));rows[key]['points']=min(rows[key]['points'],row['points'])
  else:rows[key]=row
 # Un alias solo puede resolver una respuesta. La forma canónica tiene prioridad.
 owners=collections.defaultdict(set)
 for row in rows.values():
  for text in [row['name']]+row['aliases']:owners[plain(text)].add(row['id'])
 for row in rows.values():row['aliases']=[s for s in row['aliases'] if len(owners[plain(s)])==1]
 rows=sorted(rows.values(),key=lambda r:(r['points'],plain(r['name'])))
 assert len(rows)>=10,(id,len(rows))
 categories.append({'id':id,'title':title,'description':description,'theme':theme,'sources':sources,'answers':rows})

UNICODE={'title':'Unicode Emoji 16.0 y nombres españoles CLDR 46','url':URLS['emoji-test.txt'],'license':'Unicode-3.0','attribution':'© Unicode, Inc. Nombres y clasificación adaptados; licencia y fuentes en research/ascension-fuentes.md.'}
CLDR={'title':'Unicode CLDR 46: nombres y agrupaciones territoriales','url':URLS['es.xml'],'license':'Unicode-3.0','attribution':'© Unicode, Inc.; licencia en research/ascension-fuentes.md.'}
main=ET.parse(args.cache/'es.xml').getroot();supp=ET.parse(args.cache/'territory.xml').getroot()
territory_names={}
territory_aliases=collections.defaultdict(list)
for el in main.findall('.//localeDisplayNames/territories/territory'):
 code=el.attrib['type'];
 if el.text and plain(el.text):territory_aliases[code].append(el.text)
 if 'alt'not in el.attrib:territory_names[code]=el.text

for el in ET.parse(args.cache/'en.xml').getroot().findall('.//localeDisplayNames/territories/territory'):
 if 'alt'not in el.attrib:territory_names.setdefault(el.attrib['type'],el.text)

def expand(s):
 out=[]
 for token in s.split():
  if '~'not in token:out.append(token);continue
  a,b=token.split('~');b=a[:-len(b)]+b
  if len(a)==2:
   first=(ord(a[0])-65)*26+ord(a[1])-65;last=(ord(b[0])-65)*26+ord(b[1])-65
   out.extend(chr(n//26+65)+chr(n%26+65) for n in range(first,last+1))
  else:out.extend(str(n).zfill(len(a)) for n in range(int(a),int(b)+1))
 return out
regular=set(expand(ET.parse(args.cache/'regions.xml').getroot().find('.//id[@idStatus="regular"]').text))
contain={g.attrib['type']:g.attrib['contains'].split() for g in supp.findall('.//territoryContainment/group') if 'status'not in g.attrib and 'grouping'not in g.attrib}
def leaves(code):
 if code in regular:return {code}
 return set().union(*(leaves(c) for c in contain.get(code,[]))) if code in contain else set()
extra_country_alias={
 'US':['Estados Unidos','USA','EEUU','EE. UU.','Estados Unidos de America'], 'GB':['Reino Unido','UK','Gran Bretaña','United Kingdom'],
 'NL':['Holanda'],'CZ':['República Checa'],'CI':['Costa de Marfil'],'PS':['Palestina','Estado de Palestina'],'VA':['Vaticano','Ciudad del Vaticano'],
 'XK':['Kosovo'],'MM':['Birmania'],'CD':['Congo Kinshasa','Republica Democratica del Congo'],'CG':['Congo Brazzaville','Republica del Congo'],
 'SZ':['Suazilandia'],'CV':['Cabo Verde'],'TL':['Timor Oriental'],'MK':['Macedonia'],'KR':['Corea del Sur'],'KP':['Corea del Norte'],
 'AE':['Emiratos Arabes','EAU'],'BN':['Brunei'],'FM':['Estados Federados de Micronesia'],'VC':['San Vicente y las Granadinas'],
 'KN':['San Cristobal y Nieves'],'HK':['Hong Kong'],'MO':['Macao'],'TW':['Taiwan'],'TR':['Turquia'],
}
common_countries=set('ES MX AR CO PE CL US GB FR DE IT PT BR CN JP IN RU AU NZ CA'.split())
familiar_countries=set('BO EC VE UY PY CR CU DO GT HN NI SV PA PR ZA EG MA DZ TN KE NG ET GH SN CM GR CH AT BE NL DK NO SE FI IE IS PL RO CZ UA TR IL SA AE TH VN ID PH SG MY KR KP AF PK BD IR IQ SY JO LB QA KW JM HT BS BB TT FJ'.split())
deep_countries=set('AC AG AI AX BQ BL BV CC CK CP CQ CW DG EA EH FK FO GF GG GI GL GP GS GU HM IC IM IO JE KI KM KY MH MP MQ MS NC NF NR NU PF PM PN PW RE SB SC SH SJ SM ST SX TA TC TF TK TL TO TV UM VG VI WF YT'.split())
summit_countries=set('TK BT SJ SH BL'.split())
def country_answer(code):
 pts=100 if code in summit_countries else 10 if code in common_countries else 30 if code in familiar_countries else 85 if code in deep_countries else 60
 return answer(territory_names[code],territory_aliases[code]+extra_country_alias.get(code,[]),pts,code.lower())
geo_description='Se aceptan países y territorios con entrada geográfica regular en Unicode CLDR 46; no es una lista de Estados soberanos. Incluye Vaticano, Palestina y Kosovo. Se aceptan nombres habituales y variantes regionales.'
category('paises-territorios','Nombra un país o territorio del mundo',geo_description,'geografia',[country_answer(c) for c in regular], [CLDR,{'title':'CLDR 46: códigos geográficos regulares','url':URLS['regions.xml'],'license':'Unicode-3.0'}])
for code,name in [('150','Europa'),('142','Asia'),('002','África'),('019','América'),('009','Oceanía')]:
 members=leaves(code)
 category('territorios-'+plain(name),'Nombra un país o territorio de '+name,'La agrupación usada es la de Unicode CLDR 46. '+geo_description,'geografia',[country_answer(c) for c in members],[CLDR,{'title':'CLDR 46: agrupación continental','url':URLS['territory.xml'],'license':'Unicode-3.0'}])

# Emoji: nombres de objetos/conceptos, no variantes de tono de piel ni duplicados de presentación.
tts={}
for filename in ['annotations-es.xml','annotationsDerived-es.xml']:
 for el in ET.parse(args.cache/filename).getroot().findall('.//annotation'):
  if el.attrib.get('type')=='tts':tts[el.attrib['cp'].replace('\ufe0f','')]=el.text
emojis=[];group=sub=''
for line in (args.cache/'emoji-test.txt').read_text().splitlines():
 if line.startswith('# group:'):group=line.split(': ',1)[1]
 if line.startswith('# subgroup:'):sub=line.split(': ',1)[1]
 if '; fully-qualified'not in line:continue
 raw=line.split(';')[0]
 if re.search(r'1F3F[B-F]|200D',raw):continue
 emoji=''.join(chr(int(c,16)) for c in raw.split());name=tts.get(emoji.replace('\ufe0f',''))
 if name:emojis.append({'name':name,'emoji':emoji,'group':group,'sub':sub})
# Consolidaciones editoriales de presentaciones que expresan el mismo concepto.
rename={
 'cara de mono':'mono','cara de perro':'perro','cara de gato':'gato','cara de tigre':'tigre','cara de caballo':'caballo','cara de vaca':'vaca','cara de cerdo':'cerdo','cara de ratón':'ratón','cara de conejo':'conejo','cara de dragón':'dragón',
 'pollito rompiendo el cascarón':'pollito','pollito de frente':'pollito','ballena soltando un chorro':'ballena',
 'manzana roja':'manzana','manzana verde':'manzana','espiga de maíz':'maíz','cuña de queso':'queso','muslo de pollo':'pollo','corte de carne':'carne','cuenco con cuchara':'cereales',
 'coche próximo':'coche','coche de policía próximo':'coche de policía','taxi próximo':'taxi','autobús próximo':'autobús','avión aterrizando':'avión','avión despegando':'avión','tren bala':'tren de alta velocidad','barco a motor':'lancha motora',
 'cocinar':'huevo frito','cucurucho de helado':'helado','tarta de cumpleaños':'tarta','trozo de tarta':'tarta','tarro de miel':'miel','tableta de chocolate':'chocolate','vaso de leche':'leche','bebida caliente':'café','tazón de té':'té','copa de vino':'vino','jarra de cerveza':'cerveza','jarras de cerveza brindando':'cerveza','copas brindando':'brindis',
 'espagueti':'espaguetis','patata asada':'batata','raíz de jengibre':'jengibre','túberculo comestible':'tubérculo comestible',
 'gorra con visera':'gorra','vaqueros':'pantalones vaqueros','ropa de mujer':'blusa','mochila escolar':'mochila','traje de baño de una pieza':'bañador',
 'lupa orientada hacia la izquierda':'lupa','lupa orientada hacia la derecha':'lupa','cámara con flash':'cámara de fotos','batería baja':'pila',
 'libro cerrado':'libro','libro abierto':'libro','libro verde':'libro','libro azul':'libro','libro naranja':'libro','libros':'libro','periódico enrollado':'periódico','sobre entrante':'sobre','sobre con flecha':'sobre',
 'carpeta de archivos abierta':'carpeta de archivos','calendario recortable':'calendario','calendario de espiral':'calendario','clips unidos':'clip','chincheta redonda':'chincheta',
 'balón de fútbol':'fútbol','balón de baloncesto':'baloncesto','pelota de voleibol':'voleibol','balón de fútbol americano':'fútbol americano','balón de rugby':'rugby','pelota de tenis':'tenis','pelota de softball':'sóftbol','guante de boxeo':'boxeo','banderín en hoyo':'golf','patín de hielo':'patinaje sobre hielo','máscara de buceo':'buceo','caña de pescar':'pesca','piedra de curling':'curling','esquís':'esquí','uniforme de artes marciales':'artes marciales',
}
regional={
 'plátano':['banana','banano'],'patata':['papa'],'aguacate':['palta'],'cacahuetes':['cacahuate','mani','maní','cacahuete'],'alubias':['frijoles','porotos','judías','habichuelas'],'maíz':['elote','choclo'],'melocotón':['durazno'],'sandía':['patilla'],'fresa':['frutilla'],'gamba':['camarón','camaron'],'bogavante':['langosta'],'pavo':['guajolote'],'oca':['ganso'],'bicho':['oruga'],'cerdo':['chancho','puerco'],'mofeta':['zorrillo'],'búho':['buho','lechuza'],'t-rex':['tiranosaurio','tiranosaurio rex'],'saurópodo':['sauropodo','dinosaurio de cuello largo'],'pájaro':['ave','pajaro'],
 'alce':['moose'],'dromedario':['camello de una joroba'],'camello':['camello de dos jorobas'],'carnero':['oveja macho'],'caniche':['poodle'],
 'cruasán':['croissant'],'beicon':['bacon','tocino'],'perrito caliente':['hot dog','perro caliente','pancho'],'palomitas':['pochoclo','cotufas','pororó','cabritas'],'tortitas':['panqueques','hot cakes','pancakes'],'gofre':['waffle'],'bretzel':['pretzel'],'pan relleno':['kebab','pita','pan pita'],'tazón de fideos':['ramen','fideos'],'dónut':['donut','dona','rosquilla'],'magdalena':['cupcake'],'piruleta':['chupetín','paleta'],'tarta':['pastel','torta'],'pastel':['pie','pay'],'granizado hawaiano':['kakigori','hielo raspado'],'caja de bento':['bento'],'bola de arroz':['onigiri'],'galleta de arroz':['senbei'],'brocheta':['oden'],'pastel de pescado japonés':['narutomaki'],'caja para llevar':['comida para llevar'],'té de burbujas':['bubble tea','boba'],'bebida tropical':['coctel tropical'],'vaso de whisky':['whisky','whiskey'],'botella descorchada':['champán','champagne'],'tetrabrik':['zumo','jugo'],'cubito de hielo':['hielo'],
 'teléfono móvil':['celular','móvil','movil'],'ordenador portátil':['laptop','computadora portátil','portátil'],'ordenador de sobremesa':['computadora','ordenador','computadora de escritorio'],'ratón de ordenador':['mouse','raton'],'televisión':['televisor','tv'],'busca':['buscapersonas','pager'],'disco óptico':['cd'],'disco DVD':['dvd'],'cinta de vídeo':['vhs'],'máquina de fax':['fax'],
 'pantalones vaqueros':['jeans','vaqueros','pantalón','pantalones','mezclilla'],'camiseta':['remera','playera','polera'],'bañador':['traje de baño','malla'],'bikini':['biquini'],'pantalones cortos':['shorts'],'zapatilla deportiva':['tenis','zapatillas','deportivas'],'chancla':['chancleta','ojota'],'sandalia de mujer':['sandalia'],'bota de mujer':['bota'],'bota de senderismo':['bota de montaña'],'calcetines':['medias','calcetin'],'pintalabios':['labial'],'bailarina':['manoletina'],'piedra preciosa':['diamante'],'rosario':['cuentas de oración'],
 'bolígrafo':['lapicero','pluma','birome','boligrafo'],'lápiz de cera':['crayón','crayola'],'bloc de notas de espiral':['bloc de notas'],'carpeta de archivos':['carpeta'],'correo electrónico':['email','e-mail'],'regla':['regla de medir'],'sierra de carpintería':['sierra','serrucho'],'tornillo de banco':['prensa de banco'],'tornillo y tuerca':['tornillo','tuerca'],'caja de herramientas':['herramientas'],'alambique':['retorta'],'adn':['ácido desoxirribonucleico'],
 'inodoro':['retrete','wc','váter','excusado'],'desatascador':['destapador','sopapa'],'cubo':['balde','cubeta'],'bote de crema':['loción','crema'],'cuchilla de afeitar':['rasuradora','afeitadora'],'trampa de ratones':['ratonera'],'rollo de papel':['papel higiénico'],'imperdible':['alfiler de gancho','seguro'],'cesta':['canasta'],'sofá y lámpara':['sofá','sillon','sillón'],'cepillo de dientes':['cepillo dental'],
 'fútbol':['futbol','soccer'],'baloncesto':['basquetbol','básquet','basketball'],'béisbol':['beisbol','baseball'],'sóftbol':['softball'],'tenis de mesa':['ping pong','ping-pong'],'bádminton':['badminton'],'disco volador':['frisbee'],'balón de fútbol americano':['futbol americano'],'críquet':['cricket'],'esquí':['esqui','ski'],'flauta':['flauta dulce'],'teclado musical':['piano'],'tamboril':['djembe'],'maracas':['maraca'],'saxofón':['saxo'],'corneta de posta':['corneta'],'acordeón':['acordeon'],
}
common_emoji=set(map(plain,['perro','gato','caballo','vaca','cerdo','mono','león','tigre','elefante','ratón','conejo','pájaro','pez','ballena','delfín','serpiente','tortuga','rana','mariposa','abeja','manzana','plátano','pizza','hamburguesa','pan de molde','huevo','café','leche','agua','cerveza','vino','chocolate','helado','fútbol','baloncesto','tenis','guitarra','teclado musical','camiseta','vestido','gorra','pantalones vaqueros','gafas','coche','avión','autobús','taxi','bicicleta','moto','tren','barco','teléfono móvil','ordenador portátil','televisión','cámara de fotos','libro','lápiz','bolígrafo','regla','tijeras','martillo','llave inglesa','destornillador','cama','silla','puerta','ducha','inodoro']))
familiar_emoji=set(map(plain,['ambulancia','coche de policía','coche de bomberos','camión articulado','camión de reparto','camioneta','cohete','helicóptero','metro','tractor','tranvía','velero','lancha motora','patinete','monopatín','barco de pasajeros','avioneta','ferri','minibús','patines','tren de alta velocidad','ordenador de sobremesa','gorila','oso','panda','koala','pingüino','loro','águila','pato','gallo','gallina','oveja','cabra','canguro','pulpo','tiburón','cangrejo','gamba','caracol','araña','hormiga','cocodrilo','dinosaurio','mango','piña','pera','sandía','melón','limón','tomate','patata','zanahoria','cebolla','ajo','brócoli','pepino','aguacate','ensalada','queso','carne','pollo','taco','burrito','paella','sushi','arroz cocido','palomitas','galleta','tarta','caramelo','miel','té','mate','balonmano','golf','boxeo','béisbol','voleibol','rugby','tenis de mesa','violín','trompeta','tambor','flauta','saxofón','abrigo','bufanda','guantes','calcetines','anillo','corbata','mochila','bolso','bikini','bañador','zapatilla deportiva','chancla','radio','impresora','teclado','ratón de ordenador','pila','bombilla','linterna','vela','periódico','cuaderno','sobre','clip','chincheta','calendario','papelera','carpeta de archivos','hacha','escalera','imán','balanza','engranaje','gancho','microscopio','telescopio','escoba','jabón','esponja','espejo','ventana','bañera','sofá y lámpara','cubo','extintor','carrito de la compra']))
summit_emoji=set(map(plain,['tejón','tubérculo comestible','dango','monorraíl','sari','arpa','lacrosse','organizador de fichas','tornillo de banco','trampa de ratones','minidisc']))
# Una décima categoría lleva aparatos y electrónica, no edificios para evitar conjuntos subjetivos.
emoji_specs=[
 ('emoji-animales','Nombra un animal que tenga emoji oficial','animal-','emoji-animales'),
 ('emoji-comida','Nombra un alimento o bebida con emoji oficial','FOOD','emoji-comida'),
 ('emoji-transportes','Nombra un vehículo o medio de transporte con emoji oficial','TRANSPORT','emoji-transporte'),
 ('emoji-ropa','Nombra una prenda o accesorio con emoji oficial','clothing','emoji-ropa'),
 ('emoji-musica','Nombra un instrumento musical con emoji oficial','musical-instrument','emoji-musica'),
 ('emoji-deportes','Nombra un deporte o material deportivo con emoji oficial','sport','emoji-deporte'),
 ('emoji-oficina','Nombra un objeto de papelería, correo u oficina con emoji oficial','OFFICE','emoji-oficina'),
 ('emoji-herramientas','Nombra una herramienta u objeto del grupo de herramientas de emoji','tool','emoji-herramientas'),
 ('emoji-casa','Nombra un objeto doméstico con emoji oficial','household','emoji-casa'),
 ('emoji-tecnologia','Nombra un aparato u objeto de tecnología con emoji oficial','TECH','emoji-tecnologia'),
]
for catid,title,select,theme in emoji_specs:
 rows=[]
 for e in emojis:
  subgroup=e['sub'];name=e['name']
  allowed=(subgroup.startswith(select) if select.endswith('-') else (e['group']=='Food & Drink' and subgroup!='dishware') if select=='FOOD' else subgroup.startswith('transport-') and subgroup!='transport-sign' if select=='TRANSPORT' else subgroup in ['office','book-paper','writing','mail'] if select=='OFFICE' else subgroup in ['computer','phone','light & video'] if select=='TECH' else subgroup==select)
  if not allowed:continue
  if select=='animal-' and name in ['nariz de cerdo','huellas de pezuñas','pluma','ala','caracola','tela de araña']:continue
  if select=='animal-' and name in ['unicornio','dragón','cara de dragón']:continue
  if select=='FOOD' and name in ['biberón','tetera','brindis','copas brindando','líquido derramándose']:continue
  if select=='TRANSPORT' and name in ['ancla','autopista','barril de petróleo','estación de tren','luces de policía','obras','parada de autobús','rueda','salvavidas','semáforo','semáforo horizontal','señal de stop','surtidor de gasolina','vía de tren','asiento de transporte']:continue
  if select=='TECH' and name in ['lupa orientada hacia la izquierda','lupa orientada hacia la derecha','vela','lámpara japonesa','lámpara de aceite','fotograma de película','claqueta']:continue
  canonical=rename.get(name,name)
  pts=100 if plain(canonical)in summit_emoji else 10 if plain(canonical)in common_emoji else 30 if plain(canonical)in familiar_emoji else 85 if len(canonical)>20 else 60
  rows.append(answer(canonical,[name]+regional.get(canonical,[]),pts))
 category(catid,title,'Se acepta el concepto en español, sus variantes regionales registradas. Conjunto fijo de Unicode Emoji 16.0 y nombres CLDR 46. Las variantes gráficas del mismo concepto se agrupan. No incluye propuestas de emoji posteriores a esa versión.',theme,rows,[UNICODE,{'title':'CLDR 46: nombres españoles de emoji','url':URLS['annotations-es.xml'],'license':'Unicode-3.0'}])

# Nobel: nombres de laureados, no biografías, motivaciones ni imágenes. Corte de premios: 2025.
nobel=json.loads((args.cache/'nobel-v1.json').read_text())['laureates']
common_nobel=set(map(plain,['Albert Einstein','Marie Curie','Pierre Curie','Nelson Mandela','Barack H. Obama','Bob Dylan','Gabriel García Márquez','Mario Vargas Llosa','Ernest Hemingway','Pablo Neruda','Albert Camus','Alexander Fleming','Mother Teresa']))
familiar_nobel=set(map(plain,['Max Planck','Niels Bohr','Werner Heisenberg','Erwin Schrödinger','Richard P. Feynman','Peter W. Higgs','James D. Watson','Francis H. C. Crick','Severo Ochoa','Santiago Ramón y Cajal','Ivan Pavlov','Robert Koch','Milton Friedman','Paul Krugman','Joseph E. Stiglitz','Amartya Sen','John F. Nash Jr.','F. A. Hayek','Jean-Paul Sartre','William Faulkner','Samuel Beckett','José Saramago','Octavio Paz','Gabriela Mistral','Toni Morrison','Doris Lessing','Rudyard Kipling','Hermann Hesse','Thomas Mann','Rabindranath Tagore','Winston Churchill','Martin Luther King Jr.','Malala Yousafzai','Dalai Lama','Desmond Tutu','Mikhail Gorbachev','Rigoberta Menchú Tum','Aung San Suu Kyi','Henry Kissinger','International Committee of the Red Cross','United Nations','European Union','Médecins Sans Frontières','UNICEF']))
rare_nobel=set(map(plain,['Wilhelm Conrad Röntgen','Paul A. M. Dirac','Enrico Fermi','Louis de Broglie','Wolfgang Pauli','Otto Hahn','Fritz Haber','Linus Pauling','Dorothy Crowfoot Hodgkin','Irène Joliot-Curie','Frederick Sanger','Marie Curie, née Sklodowska','Tu Youyou','Katalin Karikó','Drew Weissman','Robert G. Edwards','Barbara McClintock','Konrad Lorenz','Eric R. Kandel','Daniel Kahneman','Elinor Ostrom','Esther Duflo','Abhijit Banerjee','Angus Deaton','Robert J. Shiller','Alice Munro','Kazuo Ishiguro','Annie Ernaux','Han Kang','Jon Fosse','Svetlana Alexievich','Patrick Modiano','Mo Yan','J. M. Coetzee','Juan Ramón Jiménez','Camilo José Cela','Jacinto Benavente','José Echegaray','Adolfo Pérez Esquivel','Carlos Saavedra Lamas','Juan Manuel Santos','Oscar Arias Sánchez','Kofi Annan','Jimmy Carter','Liu Xiaobo','Lech Walesa','Shirin Ebadi','Denis Mukwege','Nadia Murad']))
summit_nobel=set(map(plain,['Charles Glover Barkla','Francis W. Aston','Johannes Fibiger','Henrik Pontoppidan','Fredrik Bajer','Ragnar Frisch']))
# El ID de la fuente conserva la identidad aunque la API use el nombre de nacimiento,
# invierta nombre/apellido o retire iniciales. Se conserva su literal como alias.
nobel_labels={'845':'Barack H. Obama','339':'Alexander Fleming','540':'Mother Teresa',
 '888':'Peter W. Higgs','373':'James D. Watson','372':'Francis H. C. Crick','685':'F. A. Hayek',
 '551':'Dalai Lama','568':'Médecins Sans Frontières','525':'UNICEF','918':'Tu Youyou',
 '724':'Eric R. Kandel','1042':'Han Kang','855':'Liu Xiaobo','545':'Lech Walesa'}
nobel_extra={
 'Albert Einstein':['Einstein'],'Marie Curie':['Maria Sklodowska Curie','Maria Curie','Marie Sklodowska Curie'],'Marie Curie, née Sklodowska':['Marie Curie','Maria Curie','Maria Sklodowska Curie'],'Pierre Curie':['Pierre Curie'],
 'Barack H. Obama':['Barack Obama','Obama'],'Mother Teresa':['Madre Teresa','Teresa de Calcuta','Madre Teresa de Calcuta'],
 'John F. Nash Jr.':['John Nash','Nash'],'F. A. Hayek':['Friedrich Hayek','Friedrich August von Hayek'],'Dalai Lama':['Dalai Lama','Tenzin Gyatso'],
 'International Committee of the Red Cross':['Comité Internacional de la Cruz Roja','Cruz Roja','CICR','ICRC'],
 'United Nations':['Organización de las Naciones Unidas','Naciones Unidas','ONU','UN'],'European Union':['Unión Europea','UE','EU'],
 'Médecins Sans Frontières':['Médicos Sin Fronteras','MSF','Doctors Without Borders'],'UNICEF':['Unicef','Fondo de las Naciones Unidas para la Infancia'],
 'Office of the United Nations High Commissioner for Refugees':['ACNUR','UNHCR','Alto Comisionado de las Naciones Unidas para los Refugiados'],
 'International Campaign to Ban Landmines':['Campaña Internacional para la Prohibición de las Minas Antipersona','ICBL'],
 'Organisation for the Prohibition of Chemical Weapons':['Organización para la Prohibición de las Armas Químicas','OPAQ','OPCW'],
 'International Atomic Energy Agency':['Organismo Internacional de Energía Atómica','OIEA','IAEA'],
 'World Food Programme':['Programa Mundial de Alimentos','PMA','WFP'],'International Campaign to Abolish Nuclear Weapons':['Campaña Internacional para Abolir las Armas Nucleares','ICAN'],
 'Pugwash Conferences on Science and World Affairs':['Conferencias Pugwash','Pugwash'],'Institute of International Law':['Instituto de Derecho Internacional'],
 'Friends Service Council':['Consejo de Servicio de los Amigos'],'American Friends Service Committee':['Comité Americano de Servicio de los Amigos'],
 'International Peace Bureau':['Oficina Internacional de la Paz'],'National Dialogue Quartet':['Cuarteto para el Diálogo Nacional de Túnez','Cuarteto de Túnez'],
 'Center for Civil Liberties':['Centro para las Libertades Civiles'],'Memorial':['Memorial'],'Nihon Hidankyo':['Hidankyo'],
}
for code,label in [('physics','Física'),('chemistry','Química'),('medicine','Medicina o Fisiología'),('literature','Literatura'),('peace','la Paz'),('economics','Economía')]:
 rows=[]
 for p in nobel:
  prizes=[pr for pr in p.get('prizes',[]) if pr['category']==code and int(pr['year'])<=2025]
  if not prizes:continue
  source_name=' '.join(filter(None,[p.get('firstname',''),p.get('surname','')])).strip()
  name=nobel_labels.get(p['id'],source_name)
  key=plain(name);pts=100 if key in summit_nobel else 10 if key in common_nobel else 30 if key in familiar_nobel else 60 if key in rare_nobel else 85
  aliases=[source_name,p.get('surname','')]+nobel_extra.get(name,[])
  # Normalización de las iniciales para admitir el nombre habitual sin iniciales intermedias.
  short=re.sub(r'\b[A-Z]\.\s*','',name);short=re.sub(r'\s+Jr\.?$','',short);aliases.append(short)
  rows.append(answer(name,aliases,pts,'nobel-'+p['id']))
 title='Nombra una persona o entidad premiada con el Nobel de '+label if code=='peace' else 'Nombra una persona premiada con el Nobel de '+label
 if code=='economics':title='Nombra una persona premiada con el Nobel de Economía'
 category('nobel-'+code,title,'Se admiten laureados de 1901 a 2025, inclusive, aunque hayan fallecido. El de Economía es el premio del Banco de Suecia en memoria de Alfred Nobel. El apellido solo se acepta cuando identifica a una única respuesta dentro de esta categoría.','nobel',rows,[{'title':'Nobel Prize API: laureados y categorías, corte 2025','url':URLS['nobel-v1.json'],'license':'CC0-1.0','attribution':'Nobel Prize API, datos abiertos; solo nombres y pertenencia a categoría.'}])

# Elementos: 118 nombres, símbolos y variantes de español; la química no cambia con el idioma.
element_names='Hidrógeno Helio Litio Berilio Boro Carbono Nitrógeno Oxígeno Flúor Neón Sodio Magnesio Aluminio Silicio Fósforo Azufre Cloro Argón Potasio Calcio Escandio Titanio Vanadio Cromo Manganeso Hierro Cobalto Níquel Cobre Zinc Galio Germanio Arsénico Selenio Bromo Kriptón Rubidio Estroncio Itrio Circonio Niobio Molibdeno Tecnecio Rutenio Rodio Paladio Plata Cadmio Indio Estaño Antimonio Telurio Yodo Xenón Cesio Bario Lantano Cerio Praseodimio Neodimio Prometio Samario Europio Gadolinio Terbio Disprosio Holmio Erbio Tulio Iterbio Lutecio Hafnio Tántalo Wolframio Renio Osmio Iridio Platino Oro Mercurio Talio Plomo Bismuto Polonio Astato Radón Francio Radio Actinio Torio Protactinio Uranio Neptunio Plutonio Americio Curio Berkelio Californio Einstenio Fermio Mendelevio Nobelio Lawrencio Rutherfordio Dubnio Seaborgio Bohrio Hasio Meitnerio Darmstadtio Roentgenio Copernicio Nihonio Flerovio Moscovio Livermorio Teneso Oganesón'.split()
element_symbols='H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split()
assert len(element_names)==len(element_symbols)==118
extra_elements={'Hierro':['Fierro'],'Zinc':['Cinc'],'Kriptón':['Criptón'],'Itrio':['Ytrio'],'Circonio':['Zirconio'],'Yodo':['Iodo'],'Tántalo':['Tantalio'],'Wolframio':['Tungsteno','Volframio'],'Telurio':['Teluro'],'Iterbio':['Yterbio'],'Lawrencio':['Laurencio'],'Hasio':['Hassio'],'Darmstadtio':['Darmstatio','Darmstadio'],'Teneso':['Téneso']}
rows=[]
for i,(name,symbol)in enumerate(zip(element_names,element_symbols),1):
 pts=10 if name in ['Oxígeno','Hidrógeno','Carbono','Oro','Plata','Hierro','Helio'] else 30 if i<=30 or name in ['Cobre','Zinc','Plomo','Mercurio','Uranio','Plutonio','Estaño','Yodo','Platino'] else 100 if name=='Protactinio' else 85 if i>=57 and name not in ['Neodimio','Wolframio','Uranio','Plutonio'] else 60
 rows.append(answer(name,[symbol]+extra_elements.get(name,[]),pts,'elemento-'+str(i)))
category('elementos','Nombra un elemento químico de la tabla periódica','Se aceptan los 118 elementos reconocidos por IUPAC: nombre en español, variante registrada o símbolo químico. No se admiten elementos hipotéticos.','ciencia',rows,[{'title':'IUPAC: tabla periódica de los elementos','url':'https://iupac.org/what-we-do/periodic-table-of-elements/'},{'title':'Real Sociedad Española de Química: nombres en español','url':'https://gehci.rseq.org/wp-content/uploads/2024/11/4a_El_Club_del_Alambique_Vol2_No1_Marzo_2024_corregido.pdf'}])

# Constelaciones: nombres latinos oficiales con traducciones españolas de uso astronómico.
constellation_pairs='''Andromeda|Andrómeda
Antlia|Máquina Neumática
Apus|Ave del Paraíso
Aquarius|Acuario
Aquila|Águila
Ara|Altar
Aries|Aries
Auriga|Auriga|Cochero
Bootes|Boyero|Boötes
Caelum|Cincel
Camelopardalis|Jirafa
Cancer|Cáncer
Canes Venatici|Perros de Caza|Lebreles
Canis Major|Can Mayor
Canis Minor|Can Menor
Capricornus|Capricornio
Carina|Carina|Quilla
Cassiopeia|Casiopea
Centaurus|Centauro
Cepheus|Cefeo
Cetus|Ballena
Chamaeleon|Camaleón
Circinus|Compás
Columba|Paloma
Coma Berenices|Cabellera de Berenice
Corona Australis|Corona Austral
Corona Borealis|Corona Boreal
Corvus|Cuervo
Crater|Copa
Crux|Cruz del Sur
Cygnus|Cisne
Delphinus|Delfín
Dorado|Dorada
Draco|Dragón
Equuleus|Caballito
Eridanus|Erídano
Fornax|Horno
Gemini|Géminis
Grus|Grulla
Hercules|Hércules
Horologium|Reloj
Hydra|Hidra
Hydrus|Hidra Macho|Hidra Austral
Indus|Indio
Lacerta|Lagarto
Leo|Leo
Leo Minor|León Menor
Lepus|Liebre
Libra|Libra
Lupus|Lobo
Lynx|Lince
Lyra|Lira
Mensa|Mesa
Microscopium|Microscopio
Monoceros|Unicornio
Musca|Mosca
Norma|Escuadra
Octans|Octante
Ophiuchus|Ofiuco|Serpentario
Orion|Orión
Pavo|Pavo Real
Pegasus|Pegaso
Perseus|Perseo
Phoenix|Fénix
Pictor|Pintor|Caballete
Pisces|Piscis
Piscis Austrinus|Pez Austral
Puppis|Popa
Pyxis|Brújula
Reticulum|Retículo
Sagitta|Flecha
Sagittarius|Sagitario
Scorpius|Escorpio|Escorpión
Sculptor|Escultor
Scutum|Escudo
Serpens|Serpiente
Sextans|Sextante
Taurus|Tauro
Telescopium|Telescopio
Triangulum|Triángulo
Triangulum Australe|Triángulo Austral
Tucana|Tucán
Ursa Major|Osa Mayor
Ursa Minor|Osa Menor
Vela|Velas
Virgo|Virgo
Volans|Pez Volador
Vulpecula|Zorra|Zorrita'''
rows=[]
for line in constellation_pairs.splitlines():
 latin,spanish,*more=line.split('|');pts=10 if spanish in ['Orión','Osa Mayor','Osa Menor'] else 30 if spanish in ['Aries','Tauro','Géminis','Cáncer','Leo','Virgo','Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis','Casiopea','Andrómeda','Cruz del Sur'] else 100 if latin=='Mensa' else 85 if latin in ['Antlia','Apus','Caelum','Circinus','Fornax','Indus','Norma','Octans','Pictor','Pyxis','Reticulum','Sextans'] else 60
 rows.append(answer(spanish,[latin]+more,pts,'const-'+plain(latin).replace(' ','-')))
assert len(rows)==88
category('constelaciones','Nombra una de las 88 constelaciones oficiales','Se aceptan nombres latinos de la Unión Astronómica Internacional y las traducciones españolas registradas. No se aceptan asterismos como el Carro o el Triángulo de Verano como constelaciones independientes.','astronomia',rows,[{'title':'IAU: las 88 constelaciones','url':'https://iauarchive.eso.org/public/themes/constellations/'},{'title':'NASA StarChild: lista completa de las 88 constelaciones','url':URLS['constellations.html']}])

# Geografía cercana: conjuntos administrativos completos.
province_names='Álava|Albacete|Alicante|Almería|Ávila|Badajoz|Islas Baleares|Barcelona|Burgos|Cáceres|Cádiz|Castellón|Ciudad Real|Córdoba|A Coruña|Cuenca|Girona|Granada|Guadalajara|Gipuzkoa|Huelva|Huesca|Jaén|León|Lleida|La Rioja|Lugo|Madrid|Málaga|Murcia|Navarra|Ourense|Asturias|Palencia|Las Palmas|Pontevedra|Salamanca|Santa Cruz de Tenerife|Cantabria|Segovia|Sevilla|Soria|Tarragona|Teruel|Toledo|Valencia|Valladolid|Bizkaia|Zamora|Zaragoza'.split('|')
province_alias={'Álava':['Araba'],'Alicante':['Alacant'],'Castellón':['Castelló'],'A Coruña':['La Coruña','Coruña'],'Girona':['Gerona'],'Gipuzkoa':['Guipúzcoa'],'Lleida':['Lérida'],'Ourense':['Orense'],'Bizkaia':['Vizcaya'],'Islas Baleares':['Baleares','Illes Balears'],'La Rioja':['Rioja']}
rows=[answer(n,province_alias.get(n,[]),10 if n in ['Madrid','Barcelona','Valencia','Sevilla','Málaga'] else 30 if n in ['Alicante','Cádiz','Granada','Córdoba','Murcia','Asturias','Zaragoza','A Coruña','Bizkaia','Islas Baleares','Las Palmas','Santa Cruz de Tenerife'] else 100 if n=='Palencia' else 85 if n in ['Soria','Zamora','Teruel','Cuenca','Guadalajara','Ávila','Lugo'] else 60) for n in province_names]
assert len(rows)==50
category('provincias-espana','Nombra una provincia de España','Se aceptan las 50 provincias y sus nombres oficiales o tradicionales registrados. Ceuta y Melilla son ciudades autónomas, no provincias.','geografia-espana',rows,[{'title':'Instituto Nacional de Estadística: provincias por comunidad autónoma','url':URLS['provincias.html']}])
mex_names='Aguascalientes|Baja California|Baja California Sur|Campeche|Coahuila de Zaragoza|Colima|Chiapas|Chihuahua|Ciudad de México|Durango|Guanajuato|Guerrero|Hidalgo|Jalisco|Estado de México|Michoacán de Ocampo|Morelos|Nayarit|Nuevo León|Oaxaca|Puebla|Querétaro|Quintana Roo|San Luis Potosí|Sinaloa|Sonora|Tabasco|Tamaulipas|Tlaxcala|Veracruz de Ignacio de la Llave|Yucatán|Zacatecas'.split('|')
mex_alias={'Coahuila de Zaragoza':['Coahuila'],'Ciudad de México':['CDMX','Distrito Federal','DF'],'Estado de México':['México','Edomex'],'Michoacán de Ocampo':['Michoacán'],'Veracruz de Ignacio de la Llave':['Veracruz']}
rows=[answer(n,mex_alias.get(n,[]),10 if n in ['Ciudad de México','Estado de México','Jalisco','Nuevo León'] else 30 if n in ['Yucatán','Quintana Roo','Oaxaca','Chiapas','Puebla','Baja California','Chihuahua','Sinaloa','Sonora','Veracruz de Ignacio de la Llave'] else 100 if n=='Tlaxcala' else 85 if n in ['Colima','Nayarit','Campeche'] else 60) for n in mex_names]
category('entidades-mexico','Nombra una entidad federativa de México','Se aceptan los 31 estados y la Ciudad de México, con sus nombres completos o habituales. No se aceptan ciudades como Cancún o Guadalajara como si fueran estados.','geografia-latam',rows,[{'title':'INEGI: división estatal y nombres de las 32 entidades','url':'https://cuentame.inegi.gob.mx/imprime_tu_mapa/doc/nal-division_estatal_con_nombres-color.pdf'}])

# Idiomas ISO 639-1: conjunto cerrado de códigos de dos letras y nombres CLDR.
lang_names={x.attrib['type']:x.text for x in main.findall('.//localeDisplayNames/languages/language') if 'alt'not in x.attrib};rows=[]
lang_extra={'es':['castellano'],'eu':['vasco','vascuence'],'ca':['valenciano'],'zh':['chino mandarín','mandarín'],'fa':['farsi'],'ay':['aymara'],'qu':['quechua','quichua'],'he':['hebreo'],'nl':['holandés'],'my':['myanmar'],'ro':['moldavo'],'ht':['criollo haitiano'],'km':['jemer','camboyano'],'kl':['groenlandés','kalaallisut'],'bo':['tibetano']}
for line in (args.cache/'languages.txt').read_text(encoding='utf-8-sig').splitlines():
 parts=line.split('|')
 if len(parts)<4 or not parts[2]:continue
 code=parts[2];name=lang_names[code];pts=10 if code in ['es','en','fr','de','it','pt','zh','ja'] else 30 if code in ['ar','ru','hi','ca','eu','gl','ko','nl','sv','no','da','fi','el','tr','pl','ro','uk','he','la','qu','gn','ay'] else 100 if code=='ho' else 85 if code in ['aa','ab','av','ae','ba','bi','ch','cv','dz','ff','hz','ii','ik','iu','ki','kj','kr','kv','kw','lg','li','lu','mh','na','ng','nr','oj','os','pi','rn','sg','ss','st','tn','ts','tw','ty','ve','vo','wa','wo','za'] else 60
 rows.append(answer(name,lang_extra.get(code,[])+parts[3].split('; '),pts,'idioma-'+code))
category('idiomas','Nombra una lengua con código ISO 639-1','Se aceptan las lenguas con código ISO 639-1 de dos letras de la lista consultada, incluidos latín, esperanto y otras lenguas históricas o construidas presentes. Escribe su nombre, no hace falta conocer el código.','lenguas',rows,[{'title':'Library of Congress: códigos ISO 639-1 y 639-2','url':'https://www.loc.gov/standards/iso639-2/php/code_list.php'},{'title':'Unicode CLDR 46: nombres españoles de lenguas','url':URLS['es.xml'],'license':'Unicode-3.0'}])

# Monedas: conjunto fijado al 1 de enero de 2024; evita cambiar validez durante una edición.
currency_names={x.attrib['type']:next((d.text for d in x.findall('displayName') if 'count'not in d.attrib),None) for x in main.findall('.//currencies/currency')}
codes=set()
for region in supp.findall('.//currencyData/region'):
 for c in region:
  if c.attrib.get('tender')!='false' and c.attrib.get('from','0000')<='2024-01-01' and c.attrib.get('to','9999')>='2024-01-01':codes.add(c.attrib['iso4217'])
currency_extra={'USD':['dólar americano','dólar de Estados Unidos'],'EUR':['euro'],'GBP':['libra esterlina','libra británica'],'JPY':['yen'],'CNY':['yuan','renminbi'],'MXN':['peso mexicano'],'ARS':['peso argentino'],'COP':['peso colombiano'],'CLP':['peso chileno'],'PEN':['sol','sol peruano'],'BOB':['boliviano'],'BRL':['real','real brasileño'],'CHF':['franco suizo'],'RUB':['rublo ruso'],'INR':['rupia india'],'KRW':['won surcoreano'],'TRY':['lira turca'],'VND':['dong'],'THB':['baht'],'HUF':['florín húngaro'],'PLN':['zloty','esloti'],'GTQ':['quetzal'],'HNL':['lempira'],'NIO':['córdoba nicaragüense'],'CRC':['colón costarricense'],'PYG':['guaraní'],'UYU':['peso uruguayo'],'VES':['bolívar','bolívar venezolano'],'PAB':['balboa'],'CUP':['peso cubano'],'DOP':['peso dominicano'],'ILS':['séquel','shekel','nuevo séquel israelí']}
rows=[]
for code in sorted(codes):
 assert currency_names.get(code),code
 pts=10 if code in ['USD','EUR','GBP','JPY','MXN','ARS','COP','CLP'] else 30 if code in ['CNY','BRL','PEN','BOB','PYG','UYU','VES','CHF','RUB','INR','KRW','CAD','AUD','CRC','GTQ','DOP','CUP','HNL','NIO'] else 100 if code=='BTN' else 85 if code in ['BIF','BWP','CVE','DJF','ERN','FJD','FKP','GMD','GNF','KMF','LSL','MGA','MOP','MRU','MVR','NAD','PGK','RWF','SBD','SCR','SHP','SLE','SRD','STN','SZL','TOP','VUV','WST','XPF'] else 60
 rows.append(answer(currency_names[code],currency_extra.get(code,[])+[code],pts,'moneda-'+code.lower()))
category('monedas','Nombra una moneda de curso legal el 1 de enero de 2024','Conjunto fijado a esa fecha con el historial de monedas de Unicode CLDR 46. Se aceptan nombres específicos y códigos ISO; «peso», «dólar» o «franco» sin país no identifican una moneda concreta. No incluye criptomonedas ni monedas ya retiradas en esa fecha.','economia',rows,[{'title':'Unicode CLDR 46: monedas por territorio e historial','url':URLS['territory.xml'],'license':'Unicode-3.0'},{'title':'Unicode CLDR 46: nombres españoles de monedas','url':URLS['es.xml'],'license':'Unicode-3.0'}])

# Etiquetas de rotación del banco inicial. Los diez temas de emojis comparten
# familia para que una partida no tenga dos preguntas con la misma mecánica.
for row in categories:
 ident=row['id']
 if ident.startswith('emoji-'):
  row['theme']='emojis'
  row['audience']='familiar' if ident in {'emoji-animales','emoji-comida','emoji-transportes','emoji-ropa','emoji-casa'} else 'discovery'
 elif ident.startswith('nobel-'):
  row['audience']='challenge'
 elif ident in {'paises-territorios','idiomas'}:
  row['audience']='familiar'
  if ident=='idiomas':row['theme']='lengua'
 elif ident in {'territorios-oceania','constelaciones','monedas'}:
  row['audience']='challenge'
  if ident=='constelaciones':row['theme']='espacio'
 else:
  row['audience']='discovery'
  if ident in {'provincias-espana','entidades-mexico'}:row['theme']='geografia'

runpy.run_path(str(ROOT/'research/ascension-cultura-general.py'))['add_sets'](category,answer,categories)
assert len(categories)>=45
assert sum(len(c['answers'])for c in categories)>=2000
assert len({c['id']for c in categories})==len(categories)
for c in categories:
 assert len({a['id']for a in c['answers']})==len(c['answers']),c['id']
 assert all(a['points']in [10,30,60,85,100]for a in c['answers'])
 assert any(a['points']==100 for a in c['answers']),f'Falta respuesta de cumbre: {c["id"]}'
 # Alias vacíos o iguales a otros nombres se han retirado; evita números como alias sueltos.
 for a in c['answers']:a['aliases']=list(dict.fromkeys(s for s in a['aliases'] if s.strip()and not s.isdecimal()))

out={'version':'2026-11-19-2','date':'2026-11-19','rarity':'editorial','rarityNote':'Puntos editoriales fijos de familiaridad estimada, no probabilidades ni porcentajes de jugadores. No se modifican con las respuestas recibidas.','attribution':'Contiene datos adaptados de Unicode CLDR 46 y Unicode Emoji 16.0 (© Unicode, Inc.; Unicode-3.0), datos abiertos de Nobel Prize API (CC0), y listas de hechos de fuentes oficiales. Fuentes, criterios, hashes y licencias en research/ascension-fuentes.md.','categories':categories}
(ROOT/'content/ascension.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
manifest={name:{'url':url,'sha256':hashlib.sha256((args.cache/name).read_bytes()).hexdigest()}for name,url in URLS.items()}
(ROOT/'research/ascension-manifest.json').write_text(json.dumps({'checked':'2026-11-19','files':manifest},ensure_ascii=False,indent=2)+'\n')
for c in categories:print(c['id'],len(c['answers']),dict(collections.Counter(a['points']for a in c['answers'])))
print('TOTAL',len(categories),sum(len(c['answers'])for c in categories))
