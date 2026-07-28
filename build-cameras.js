// Regenera cameras.json a partir del mapa públic de Google My Maps "Mapa de
// Cámaras ZBE Barcelona 2025", mantingut per zbe-barcelona.com:
// https://zbe-barcelona.com/faqs/mapa-camaras-zbe/
//
// Segueix sense ser una font oficial (l'Ajuntament/AMB no publiquen
// coordenades de càmeres), però és un mapa comunitari amb punts reals situats
// a mà, molt més complet que geocodificar adreces de premsa. Cobreix
// Barcelona i també municipis veïns (l'Hospitalet, Esplugues, Santa Coloma,
// Badalona...) afectats per la ZBE metropolitana.
//
// Torna a executar aquest script (i després embed-data.js) quan vulguis
// actualitzar les dades.

const MAP_ID = '1dPShhaccAB3Vrj2qSCF6MoJRrR65kBI';
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`;
const FONT = 'Mapa comunitari "Cámaras ZBE Barcelona" (zbe-barcelona.com, Google My Maps) — no oficial';

function stripCdata(s) {
  const m = s.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return (m ? m[1] : s).trim();
}

function parseKml(kml) {
  const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  const points = [];
  let m;
  while ((m = placemarkRe.exec(kml))) {
    const block = m[1];
    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/);
    const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordMatch) continue; // descarta el tram de línia del perímetre, si n'hi ha
    const [lon, lat] = coordMatch[1].trim().split(',').map(Number);
    const name = nameMatch ? stripCdata(nameMatch[1]) : null;
    points.push({ name: name || 'Punt sense nom', lat, lon });
  }
  return points;
}

async function main() {
  const res = await fetch(KML_URL, { headers: { 'User-Agent': 'BarcelonaZBERouteChecker/1.0 (us personal, no comercial)' } });
  if (!res.ok) throw new Error(`No s'ha pogut descarregar el mapa (HTTP ${res.status})`);
  const kml = await res.text();
  const points = parseKml(kml);
  if (!points.length) throw new Error('No s\'ha trobat cap punt al KML — potser el mapa ha canviat d\'estructura.');

  // Desambigua noms repetits ("ZBE 2023" x30, "ZBE Badalona" x3...) afegint
  // un índex, perquè es puguin distingir a la llista de "càmeres properes".
  const seen = new Map();
  for (const p of points) {
    const n = (seen.get(p.name) || 0) + 1;
    seen.set(p.name, n);
  }
  const counters = new Map();
  const cameres = points.map((p) => {
    const total = seen.get(p.name);
    let name = p.name;
    if (total > 1) {
      const i = (counters.get(p.name) || 0) + 1;
      counters.set(p.name, i);
      name = `${p.name} (${i}/${total})`;
    }
    return { name, lat: p.lat, lon: p.lon, font: FONT };
  });

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, 'cameras.json');
  const payload = {
    _avis: 'Llista NO oficial. Cap font oficial (Ajuntament/AMB) publica coordenades de càmeres ZBE. Aquests punts venen d\'un mapa comunitari (zbe-barcelona.com, Google My Maps) — poden estar desactualitzats, incomplets o no correspondre exactament a la ubicació real del pal de la càmera.',
    font: FONT,
    generat: new Date().toISOString().slice(0, 10),
    cameres,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Fet: ${cameres.length} punts escrits a cameras.json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
