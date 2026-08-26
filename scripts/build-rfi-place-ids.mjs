import { writeFile } from 'node:fs/promises';

const VT = 'https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';
const RFI = 'https://iechub.rfi.it/ArriviPartenze';
const MIN_CONFIDENCE = 0.6;

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/['.]/g, '').replace(/\s+/g, ' ').trim();
}

function trigrams(value) {
  const padded = `  ${value} `;
  return new Set(Array.from({ length: Math.max(0, padded.length - 2) }, (_, index) => padded.slice(index, index + 3)));
}

function similarity(left, right) {
  let common = 0;
  for (const item of left) if (right.has(item)) common++;
  return common / Math.max(1, left.size + right.size - common);
}

const regionLists = await Promise.all(
  Array.from({ length: 23 }, (_, region) =>
    fetch(`${VT}/elencoStazioni/${region}`).then((response) => {
      if (!response.ok) throw new Error(`ViaggiaTreno region ${region}: HTTP ${response.status}`);
      return response.json();
    }),
  ),
);
const stations = new Map();
for (const row of regionLists.flat()) {
  if (!row.codiceStazione || row.esterno) continue;
  const name = row.localita?.nomeLungo || row.localita?.nomeBreve || row.localita?.label || row.nomeCitta;
  if (!name || normalize(name) === 'ND' || row.tipoStazione === 4) continue;
  stations.set(row.codiceStazione, name.trim());
}

const rfiResponse = await fetch(RFI);
if (!rfiResponse.ok) throw new Error(`RFI catalog: HTTP ${rfiResponse.status}`);
const html = await rfiResponse.text();
const select = /<select[^>]*id=["']ElencoLocalita["'][^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1];
if (!select) throw new Error('RFI station select not found');
const places = [];
for (const match of select.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([^<]*)<\/option>/gi)) {
  const name = match[2].replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();
  if (name) places.push({ id: match[1], name, normalized: normalize(name) });
}
const exact = new Map();
for (const place of places) {
  const values = exact.get(place.normalized) ?? [];
  values.push(place);
  exact.set(place.normalized, values);
}
const indexed = places.map((place) => ({ ...place, grams: trigrams(place.normalized) }));
const output = {};
for (const [code, stationName] of [...stations].sort(([a], [b]) => a.localeCompare(b))) {
  const normalized = normalize(stationName);
  const exactMatches = exact.get(normalized);
  if (exactMatches?.length === 1) {
    output[code] = exactMatches[0].id;
    continue;
  }
  const grams = trigrams(normalized);
  let best;
  let score = 0;
  for (const place of indexed) {
    const candidate = similarity(grams, place.grams);
    if (candidate > score) ({ best, score } = { best: place, score: candidate });
  }
  if (best && score >= MIN_CONFIDENCE) output[code] = best.id;
}

await writeFile('rfi-place-ids.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Mapped ${Object.keys(output).length}/${stations.size} ViaggiaTreno stations to ${places.length} RFI places.`);
