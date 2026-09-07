// Cloudflare Worker: proxy cap a openrouteservice per calcular rutes que
// EVITIN de debò zones concretes (avoid_polygons), cosa que el servidor
// públic d'OSRM no ofereix.
//
// Per què un Worker i no cridar ORS directament des de la web: ORS demana una
// clau d'API que no es pot posar dins un fitxer estàtic servit a GitHub Pages
// (qualsevol la robaria). El Worker la guarda com a secret i la injecta ell.
//
// El Worker NOMÉS accepta el que necessita l'app (dos punts dins de Catalunya
// i una llista de cercles a evitar) i construeix la petició a ORS ell mateix,
// perquè la clau no es pugui fer servir per a res més.
//
// Desplegament (resumit; vegeu README.md):
//   1. wrangler secret put ORS_API_KEY   (clau de openrouteservice.org)
//   2. wrangler deploy
//   3. posa la URL resultant a CAMERA_AVOID_ENDPOINT dins ZBE_CRE.html

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

// Requadre ampli de Catalunya: rebutja peticions de fora, perquè el proxy no
// es pugui fer servir per gastar la teva quota d'ORS rutejant per tot el món.
const BBOX = { minLon: 0.0, maxLon: 3.4, minLat: 40.5, maxLat: 42.9 };
const MAX_CIRCLES = 250;   // topall de zones a evitar per petició
const CIRCLE_POINTS = 12;  // costats del polígon que aproxima cada cercle
const EARTH_R = 6371008.8, DEG = Math.PI / 180;

function inBBox([lon, lat]) {
  return lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat;
}

// Cercle [lon, lat, radi_m] -> anell de polígon GeoJSON tancat.
function circleToRing([lon, lat, radius]) {
  const r = Math.min(Math.max(radius, 5), 200); // límits de seguretat
  const cosLat = Math.cos(lat * DEG);
  const ring = [];
  for (let k = 0; k <= CIRCLE_POINTS; k++) {
    const ang = (k / CIRCLE_POINTS) * 2 * Math.PI;
    const dx = (r * Math.cos(ang)) / (EARTH_R * DEG * cosLat);
    const dy = (r * Math.sin(ang)) / (EARTH_R * DEG);
    ring.push([lon + dx, lat + dy]);
  }
  return ring;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    // L'origen permès es pot restringir amb la variable ALLOWED_ORIGIN
    // (p.ex. https://oscarbellosido.github.io). Per defecte, qualsevol.
    const allowed = env.ALLOWED_ORIGIN || '*';
    const reqOrigin = request.headers.get('Origin') || '';
    const origin = allowed === '*' ? '*' : (reqOrigin === allowed ? allowed : allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Només POST' }, 405, origin);
    }
    if (!env.ORS_API_KEY) {
      return json({ error: 'Falta configurar ORS_API_KEY al Worker' }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: 'Cos JSON no vàlid' }, 400, origin);
    }

    const { start, end, avoid_circles } = payload || {};
    if (!Array.isArray(start) || !Array.isArray(end) || start.length !== 2 || end.length !== 2) {
      return json({ error: 'Cal start i end com a [lon, lat]' }, 400, origin);
    }
    if (!inBBox(start) || !inBBox(end)) {
      return json({ error: 'Punts fora de l\'àrea permesa' }, 400, origin);
    }

    const circles = Array.isArray(avoid_circles) ? avoid_circles.slice(0, MAX_CIRCLES) : [];
    const polygons = circles
      .filter((c) => Array.isArray(c) && c.length === 3 && inBBox(c))
      .map((c) => [circleToRing(c)]);

    const body = { coordinates: [start, end] };
    if (polygons.length) {
      body.options = { avoid_polygons: { type: 'MultiPolygon', coordinates: polygons } };
    }

    let orsRes;
    try {
      orsRes = await fetch(ORS_URL, {
        method: 'POST',
        headers: {
          'Authorization': env.ORS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/geo+json',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return json({ error: 'No s\'ha pogut contactar amb openrouteservice' }, 502, origin);
    }

    const text = await orsRes.text();
    // Es retorna la resposta d'ORS tal qual (amb els capçalers CORS afegits),
    // sigui una ruta GeoJSON o un error d'ORS, perquè l'app pugui decidir.
    return new Response(text, {
      status: orsRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
