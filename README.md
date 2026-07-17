<<<<<<< HEAD
# Control de material d'ambulàncies

Aplicació web instal·lable per registrar el material utilitzat a les ambulàncies.

## Ús

- Materials carregats: 159.
- PIN inicial: `1805`. Canvia'l abans de distribuir l'aplicació.
- Panell d'administració: afegeix `#admin` a l'adreça.
- Exportació d'Excel: resum d'incidents, detall de consum i reposició per magatzem.
- Material crític: identificat en groc al panell.
- Funciona sense connexió després d'haver-la obert una primera vegada amb internet.

> Important: aquesta versió desa tots els registres **només al navegador de cada dispositiu**. No envia informació a cap servidor ni comparteix automàticament les dades entre ambulàncies. Cal exportar l'Excel de cada dispositiu o implementar una base de dades per centralitzar-les.

## Desenvolupament

Cal tenir Node.js 20 o superior.

```bash
npm install
npm run dev
```

Per comprovar la versió de producció:

```bash
npm run build
npm run preview
```

## Publicació a GitHub Pages

El flux de treball `.github/workflows/deploy-pages.yml` publica l'app cada vegada que es fa `push` a la branca `main`.

1. Crea un repositori nou a GitHub i puja aquest projecte a la branca `main`.
2. A GitHub, ves a **Settings → Pages** i a **Build and deployment** selecciona **GitHub Actions**.
3. Espera que acabi l'acció **Publica a GitHub Pages**. L'adreça pública apareixerà a l'apartat **Actions** o a **Settings → Pages**.

No pugis dades d'incidents reals al repositori: les dades de l'app s'emmagatzemen localment i no formen part del codi.
=======
# Control-material-ambulancies
>>>>>>> 391bc5f15dff95e029faa511c80d7519fd69e188
