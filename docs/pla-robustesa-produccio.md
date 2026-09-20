# Pla de robustesa de producció

## Principi prioritari

La disponibilitat operativa de la unitat té prioritat sobre un registre local pendent.
Un consum pendent d'una guàrdia anterior mai no pot bloquejar la guàrdia actual,
l'autorització del dispositiu ni l'enviament de nous consums.

Si un pendent no es pot sincronitzar de manera segura:

1. Es conserva separat per revisar-lo o descartar-lo.
2. S'avisa clarament la supervisió.
3. La nova guàrdia continua operativa.
4. Mai no es duplica ni es modifica silenciosament l'estoc.

## Ordre de treball

Els casos es desenvoluparan i provaran d'un en un. No es començarà el següent
fins que l'anterior tingui proves automàtiques, prova controlada i recuperació.

### 1. Pèrdua de cobertura i canvi de guàrdia

- Guardar consums sense cobertura a la cua local.
- Tancar o canviar de guàrdia amb pendents antics.
- Crear la guàrdia nova sense quedar bloquejada.
- Sincronitzar cada guàrdia per separat quan torni la cobertura.
- Permetre descartar un pendent antic amb confirmació de supervisió.
- Garantir que cada consum descompta l'estoc una sola vegada.

Estat local (pendent de publicació):

- La sincronització ja tracta cada registre de manera independent.
- Un error específic d'una guàrdia antiga queda anotat en aquell registre i no
  impedeix sincronitzar una guàrdia posterior.
- Els errors d'autorització continuen aturant la cua, perquè afecten totes les
  peticions del dispositiu i no és segur continuar enviant-les.
- Proves específiques afegides per guàrdia antiga fallida, reintent, conflicte i
  autorització revocada.

### 2. Diversos pendents de guàrdies diferents

- Identificar cada pendent amb unitat, lot, guàrdia i operació única.
- Mostrar a quina guàrdia pertany cada pendent.
- Sincronitzar-los cronològicament i de manera independent.
- Un pendent erroni no pot aturar la resta de la cua.

### 3. Recuperació de cobertura

- Detectar el retorn de connexió sense múltiples intents simultanis.
- Reintentar operacions idempotents.
- Mostrar resultat individual de cada pendent.
- No confondre autorització amb connexió o sincronització.

### 4. Canvi o substitució de mòbil

- Revocar només el dispositiu anterior de la mateixa unitat i lot.
- Conservar tot el que ja existeix al servidor.
- Separar els pendents locals del procés d'autorització.
- Poder començar a treballar amb el mòbil nou encara que l'antic tingués pendents.

### 5. Revocació i nova autorització

- Una sola autorització activa per unitat i lot.
- Auditoria de qui activa, substitueix o revoca.
- Els errors d'autorització no poden deixar una pantalla en bucle.
- Sempre hi ha d'haver una sortida segura supervisada.

Estat local (pendent de publicació):

- Els errors recuperables de la guàrdia actual ofereixen una recuperació
  protegida pel PIN de supervisió.
- La recuperació selecciona exclusivament lot, unitat i codi de guàrdia actual;
  no elimina pendents antics, d'altres unitats ni d'altres lots.
- Primer conserva l'estat local complet, després reconstrueix la base des de
  Supabase i només confirma el canvi si la reconstrucció acaba correctament.
- Si Supabase falla, es restaura automàticament l'estat local original.

### 6. Enviament repetit o doble pulsació

- Bloquejar dobles pulsacions mentre una operació està en curs.
- Identificador únic per operació.
- Repetir una petició no pot duplicar consum ni descompte d'estoc.

## Condicions abans de publicar cada canvi

- Analitzar totes les funcions i dades dependents del canvi.
- Afegir una prova automàtica que reprodueixi l'error real.
- Executar tota la bateria de proves.
- Compilar la versió de producció.
- Verificar compatibilitat amb dispositius que ja estan treballant.
- Preparar una via de recuperació i reversió.
- Publicar un sol canvi controlat cada vegada.
- Comprovar GitHub Pages i Supabase abans de provar en una unitat real.

## Estat de la incidència G451

Hipòtesi principal: consum pendent creat sense cobertura en una guàrdia anterior,
seguit d'un canvi de guàrdia i una recuperació/autorització. La cua antiga i la
guàrdia nova van quedar acoblades i la protecció va bloquejar la sincronització.

La v162 és una recuperació temporal i exclusiva per G451 durant el període de
proves. No és la solució arquitectònica definitiva.
