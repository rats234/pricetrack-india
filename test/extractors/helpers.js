import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

export function runExtractor({ fixture, url, scripts }) {
  const html = readFileSync(path.join(root, 'test', 'fixtures', fixture), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'dangerously' });
  for (const scriptPath of scripts) {
    dom.window.eval(readFileSync(path.join(root, scriptPath), 'utf8'));
  }
  return dom.window.__priceTrackExtract();
}
