# Worker de rutes (proxy a openrouteservice)

Aquest Worker calcula rutes que **eviten de debò** els punts de càmera, fent
servir `avoid_polygons` d'[openrouteservice](https://openrouteservice.org).
El servidor públic d'OSRM que fa servir la resta de l'app no ofereix aquesta
funció: només pot suggerir alternatives, que no garanteixen res.

L'app només fa servir aquest Worker per a la ruta "evita càmeres". La resta
(comprovació de la ZBE, geocodificació) segueix igual, sense dependre'n.

## Per què cal un Worker

ORS demana una clau d'API. En una web estàtica servida a GitHub Pages no es
pot amagar cap clau dins el codi. El Worker la guarda com a secret i la injecta
ell; a més, només accepta peticions de rutes dins de Catalunya, de manera que
la clau no es pugui aprofitar per a res més.

## Desplegament

Requereix [Node](https://nodejs.org) i un compte de Cloudflare.

```sh
npm install -g wrangler          # si no el tens
cd cloudflare-worker
wrangler login

# 1) Dóna d'alta un compte gratuït a https://openrouteservice.org i copia la clau.
wrangler secret put ORS_API_KEY  # enganxa la clau quan la demani

# 2) Publica el Worker
wrangler deploy
```

`wrangler deploy` imprimeix la URL pública del Worker, del tipus
`https://zbe-routing.EL-TEU-SUBDOMINI.workers.dev`.

## Connectar-lo a l'app

Obre `ZBE_CRE.html`, busca la línia:

```js
const CAMERA_AVOID_ENDPOINT = '';
```

i posa-hi la URL del Worker:

```js
const CAMERA_AVOID_ENDPOINT = 'https://zbe-routing.EL-TEU-SUBDOMINI.workers.dev';
```

Torna a executar `node embed-data.js` no cal (això no toca les dades), però sí
que has de tornar a desplegar la pàgina (git push) i pujar la versió a
`ZBE_CRE.html` (`APP_VERSION`) i `sw.js` (`CACHE_NAME`) perquè els mòbils
agafin el canvi.

Mentre `CAMERA_AVOID_ENDPOINT` estigui buit, l'app fa servir el mètode
antic (desviaments amb OSRM), així que res es trenca abans de desplegar.

## Contracte del Worker

`POST` amb cos JSON:

```json
{
  "start": [2.1755, 41.3752],
  "end":   [2.1553, 41.3808],
  "avoid_circles": [[2.1621, 41.3794, 35]]
}
```

`avoid_circles` és una llista de `[lon, lat, radi_en_metres]`. El Worker en
fa polígons i els passa a ORS com a `avoid_polygons`. Retorna la resposta
d'ORS tal qual: una ruta en GeoJSON, o l'error d'ORS si no en troba cap.

## Límits que has de validar amb la teva clau

Res d'això s'ha pogut provar contra ORS de veritat (l'entorn on es va escriure
no hi tenia accés). Coses a mirar quan el despleguis:

- **Quota del pla gratuït** d'ORS (peticions per dia i per minut).
- **Mida de `avoid_polygons`**: si s'hi passen moltes càmeres, ORS pot
  rebutjar la petició. L'app només envia les properes al trajecte; si cal,
  ajusta el radi o el nombre.
- **Rutes impossibles**: si les zones evitades tanquen tot pas, ORS torna
  error i l'app es queda amb la ruta normal avisant-ne.
