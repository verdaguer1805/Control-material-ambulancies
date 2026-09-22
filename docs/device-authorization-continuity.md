# Continuïtat de l'autorització dels dispositius

## Problema comprovat

Una sessió anònima nova rep un `auth.uid()` diferent. L'autorització del dispositiu
està vinculada a l'`auth.uid()` anterior. A G450 i T1742, l'autorització i la sessió
antigues continuaven existint al servidor quan els mòbils van presentar identitats
noves. No hi ha evidència de revocació espontània al servidor. No sabem encara quin
component va fer perdre la sessió local original.

## Fase 1, preparada en local (no publicada)

- Després d'una autorització confirmada, conservar una còpia de la sessió en
  IndexedDB, separada de l'emmagatzematge ordinari de Supabase. Actualitzar-la quan
  Supabase renova el token.
- Si falta la sessió ordinària, provar de restaurar exactament la mateixa identitat.
  La còpia només és vàlida per al mateix usuari, unitat i lot. Cal tornar a consultar
  `get_device_authorization`; cap còpia local pot habilitar enviaments revocats.
- Si la recuperació falla temporalment, mostrar «Acceso pendiente de verificar» i
  permetre guardar el treball localment com a pendent. No afirmar que s'ha enviat ni
  modificar estoc fins que el servidor confirmi l'autorització.
- Un dispositiu mai autoritzat continua en mode demostració.

## Verificació abans de publicar

Comprovacions locals fetes: 94 proves automatitzades correctes, proves de base de
dades aïllada d'activació i TSNU correctes, i 11 comprovacions amb IndexedDB real
en un navegador. La compilació de Vite també és correcta. Això **no equival** a
una prova en el navegador gestionat dels mòbils d'empresa.

1. Provar en un navegador de proves autorització inicial, tancament i reobertura,
   actualització de versió i renovació de token.
2. Eliminar només la clau de sessió ordinària en aquell navegador: ha de recuperar
   el mateix usuari i la mateixa autorització, sense crear cap usuari nou.
3. Simular xarxa caiguda i token no recuperable: TSU i TSNU han de guardar localment
   i indicar pendent; cap enviament o estoc s'ha de confirmar.
4. Revocar el dispositiu de proves al servidor: no pot enviar ni sincronitzar.
5. Canviar unitat o lot: la còpia anterior no pot autoritzar la nova assignació.
6. Desplegar primer en un dispositiu de proves i observar-lo abans d'estendre-ho a
   dispositius en servei. No cal tornar a introduir el codi a les unitats ja actives
   si la seva sessió actual està sana.

## Límit conegut i fase següent

Si s'esborren tant localStorage com IndexedDB, cap PWA pot demostrar per si sola que
continua sent el mateix mòbil. En aquest cas cal reautorització supervisada. Per
eliminar la dependència de la sessió anònima cal dissenyar una credencial de dispositiu
revocable al servidor, independent de la sessió, i provar-la sense interrompre
les unitats actuals. No s'ha d'usar el nom de la unitat com a secret.
