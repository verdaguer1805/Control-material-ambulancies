# Preparació de Figueres, Girona i Blanes

Estat (16/09/2026): migració aplicada a Supabase després de les proves reals
en una transacció revertida. Configuració de les quatre zones habilitada a v127.

| Zona | Centrals | Submagatzems | Ambulàncies |
|---|---:|---:|---:|
| Olot (existent, sense canvis) | 1 | 4 | 9 |
| Figueres | 1 | 9 | 18 |
| Girona | 1 | 10 | 23 |
| Blanes | 1 | 9 | 22 |
| Total després de l'activació | 4 | 32 | 72 |

Material supervisor depèn del central de cada zona i no compta com a ambulància.
Les excepcions de mínims d'Olot es mantenen.

## Fitxers preparats

- `warehouse-expansion-plan.json`: assignacions, identificadors i pesos per magatzem.
- `warehouse-expansion-review.sql`: transacció per crear les tres zones noves.
- `../src/warehouse-expansion.mjs`: configuració desactivada i planificador verificable.
- `../scripts/prepare-warehouse-expansion.mjs`: regenera el JSON i SQL amb el catàleg actual.

Els 31 magatzems nous reben els 145 materials del catàleg: 4.495 files amb quantitat
inicial 1.000. Els conflictes d'identificadors o assignacions interrompen l'operació.
La inserció conserva quantitats i mínims existents, també en repetir-la.
L'app no crida cap inicialitzador automàtic per aquestes zones.

Els mínims inicials utilitzen una còpia dels mínims de Camprodon en el moment de
l'activació. Cada submagatzem multiplica aquesta base pel seu nombre d'ambulàncies.
El central suma la base de les ambulàncies directes i els mínims dels submagatzems,
aplica un 30% de seguretat i arrodoneix a l'alça. Els ajustos posteriors dels mínims
dels submagatzems recalculen el central; el percentatge es pot ajustar per material.
Canvis futurs a Camprodon no reescriuen els mínims de les zones noves.

## Resultats de verificació

- 12 proves JavaScript correctes, incloent aïllament entre zones i preservació d'Olot.
- Compilació de Vite correcta. Avís de mida dels paquets, sense error de compilació.
- SQL executat amb PostgreSQL local (PGlite), amb 4.495 inventaris creats.
- Comprovats recàlcul, canvi de marge, segona execució sense reiniciar quantitats
  ni mínims, rebuig d'accés amb rol no autoritzat i rebuig d'Olot a la nova funció.
- La prova PostgreSQL local substitueix els helpers d'autorització.
- Addicionalment s'ha executat la migració real a Supabase dins d'una transacció
  amb `ROLLBACK`, amb un usuari i sessió efímers creats dins la mateixa transacció.
  Ha verificat entrada +20, trasllat de 7, consum corregit de 2 a 5 sense doble
  descompte, mínims i marge del central, RLS de supervisor de Girona (11 magatzems),
  rebuig d'escriptura a Figueres i rebuig de canvi de marge per un supervisor.
  L'usuari i totes les operacions de prova han quedat revertits.
- La migració definitiva incorpora una comprovació d'igualtat de l'inventari
  complet d'Olot abans i després. Resultat: Olot 1+4, Figueres 1+9, Girona 1+10,
  Blanes 1+9 (centrals + submagatzems).

Comandes: `npm run prepare:warehouses`, `npm run test:warehouses`,
`node tests/warehouse-expansion-db.mjs`, `npm run build -- --outDir dist-expansion-check`.
La prova PostgreSQL necessita `@electric-sql/pglite` a `tmp/warehouse-db-test`.

## Notes operatives

Els permisos, mínims reals i fluxos de consum, entrada i trasllat s'han comprovat
contra les funcions instal·lades a Supabase. Les funcions heretades creen materials inexistents amb base 300:
el catàleg actual queda precreat a 1.000, però ampliar-lo requerirà una migració
explícita. No s'ha canviat aquesta lògica compartida amb Olot.

`WAREHOUSE_DEPLOYMENTS` habilita Olot, Figueres, Girona i Blanes. Els altres lots
continuen desactivats. No s'ha canviat cap codi d'accés ni s'ha deixat cap usuari
de prova a Supabase.
