// Reads the labeled calibration CSV (label column: good | bad, unlabeled
// rows ignored) and reports precision/recall/F1 across thresholds plus the
// max-F1 recommendation (gate per PROPOSALS §5 node 4).
// Usage: node eval/recommend-threshold.js out/calibration.csv
import { readFileSync } from 'node:fs';

// Minimal RFC-4180 CSV parser (quoted fields may contain commas/newlines)
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function evaluateThresholds(samples) {
  const results = [];
  for (let t = 0.2; t <= 0.85; t += 0.05) {
    const threshold = +t.toFixed(2);
    let tp = 0, fp = 0, fn = 0;
    for (const { score, label } of samples) {
      const predicted = score >= threshold;
      if (predicted && label === 'good') tp++;
      else if (predicted && label === 'bad') fp++;
      else if (!predicted && label === 'good') fn++;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    results.push({ threshold, tp, fp, fn, precision, recall, f1 });
  }
  return results;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node eval/recommend-threshold.js <calibration.csv>'); process.exit(1); }
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const header = rows[0];
  const scoreIdx = header.indexOf('score');
  const labelIdx = header.indexOf('label');
  const samples = rows.slice(1)
    .map((r) => ({ score: parseFloat(r[scoreIdx]), label: r[labelIdx]?.trim().toLowerCase() }))
    .filter((s) => s.label === 'good' || s.label === 'bad');
  if (samples.length < 10) {
    console.error(`only ${samples.length} labeled rows — label at least 10 (ideally 20-50)`);
    process.exit(1);
  }
  const results = evaluateThresholds(samples);
  console.log(`labeled: ${samples.length} (${samples.filter((s) => s.label === 'good').length} good)`);
  console.log('thr   prec  rec   f1');
  for (const r of results) {
    console.log(`${r.threshold.toFixed(2)}  ${r.precision.toFixed(2)}  ${r.recall.toFixed(2)}  ${r.f1.toFixed(2)}`);
  }
  const best = results.reduce((a, b) => (b.f1 > a.f1 ? b : a));
  console.log(`\nrecommended SCORE_THRESHOLD=${best.threshold} (F1=${best.f1.toFixed(2)})`);
}
