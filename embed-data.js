// Incrusta zbe_ambit.geojson i cameras.json directament dins ZBE_CRE.html
// (dins el <script id="embedded-data">), perquè la pàgina sigui un fitxer
// autònom que funcioni obrint-lo directament (mòbil, file://, etc.) sense
// necessitat de server.js. Torna a executar aquest script cada cop que
// canviïn zbe_ambit.geojson o cameras.json (p.ex. després de build-cameras.js).

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlPath = path.join(dir, 'ZBE_CRE.html');
const zbe = fs.readFileSync(path.join(dir, 'zbe_ambit.geojson'), 'utf8');
const cameras = fs.readFileSync(path.join(dir, 'cameras.json'), 'utf8');

// JSON.parse + re-stringify per validar que tots dos fitxers són JSON vàlid
// abans d'incrustar-los.
JSON.parse(zbe);
JSON.parse(cameras);

const html = fs.readFileSync(htmlPath, 'utf8');
const marker = /<script id="embedded-data">[\s\S]*?<\/script>/;
if (!marker.test(html)) {
  throw new Error('No s\'ha trobat el <script id="embedded-data"> dins ZBE_CRE.html');
}

const replacement = `<script id="embedded-data">\nwindow.EMBEDDED_ZBE = ${zbe};\nwindow.EMBEDDED_CAMERAS = ${cameras};\n</script>`;
const updated = html.replace(marker, replacement);
fs.writeFileSync(htmlPath, updated, 'utf8');

console.log(`Fet: dades incrustades a ZBE_CRE.html (${(replacement.length / 1024).toFixed(0)} KB de dades).`);
