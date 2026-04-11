import fs from 'node:fs';
import path from 'node:path';

const rootDir = '/app/dist/control-ui';
const indexPath = path.join(rootDir, 'index.html');
const templatePath = '/opt/openclaw-docker/openclaw-locale-init.template.js';
const dictionaryPath = '/opt/openclaw-docker/openclaw-bilingual-terms.json';
const cssPath = '/opt/openclaw-docker/openclaw-locale-overlay.css';
const outputPath = path.join(rootDir, 'openclaw-locale-init.js');

const validLocales = new Set(['en', 'zh-CN', 'zh-TW']);
const validTextModes = new Set(['zh-only', 'zh-en', 'en-only']);

function normalizeLocale(value) {
  if (typeof value !== 'string') return '';
  if (value === 'zh-TW' || value === 'zh-HK') return 'zh-TW';
  if (value.startsWith('zh')) return 'zh-CN';
  if (value.startsWith('en')) return 'en';
  return validLocales.has(value) ? value : '';
}

function normalizeTextMode(value) {
  if (typeof value !== 'string') return '';
  const mode = value.trim();
  return validTextModes.has(mode) ? mode : '';
}

function parseTextModeList(value) {
  const items = String(value || '')
    .split(',')
    .map((item) => normalizeTextMode(item))
    .filter(Boolean);

  return items.length > 0 ? [...new Set(items)] : ['zh-only', 'zh-en', 'en-only'];
}

function parseLocaleList(value) {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const locales = [];
  for (const item of items) {
    if (item === 'auto') {
      if (!locales.includes('auto')) locales.push('auto');
      continue;
    }
    const locale = normalizeLocale(item);
    if (locale && !locales.includes(locale)) locales.push(locale);
  }
  return locales.length > 0 ? locales : ['auto', 'zh-CN', 'zh-TW', 'en'];
}

const config = {
  defaultLocale: normalizeLocale(process.env.OPENCLAW_CONTROL_UI_DEFAULT_LOCALE || 'zh-CN') || 'zh-CN',
  forceLocale: normalizeLocale(process.env.OPENCLAW_CONTROL_UI_FORCE_LOCALE || ''),
  enabledLocales: parseLocaleList(process.env.OPENCLAW_CONTROL_UI_ENABLED_LOCALES || 'auto,zh-CN,zh-TW,en'),
  showSwitcher: String(process.env.OPENCLAW_CONTROL_UI_SHOW_LOCALE_SWITCHER || 'true').toLowerCase() !== 'false',
  defaultTextMode: normalizeTextMode(process.env.OPENCLAW_CONTROL_UI_TEXT_MODE_DEFAULT || 'zh-en') || 'zh-en',
  enabledTextModes: parseTextModeList(process.env.OPENCLAW_CONTROL_UI_ENABLED_TEXT_MODES || 'zh-only,zh-en,en-only'),
};

const template = fs.readFileSync(templatePath, 'utf8');
const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
const overlayCss = fs.readFileSync(cssPath, 'utf8');
const rendered = template
  .replace('__OPENCLAW_LOCALE_CONFIG__', JSON.stringify(config))
  .replace('__OPENCLAW_BILINGUAL_TERMS__', JSON.stringify(dictionary))
  .replace('__OPENCLAW_OVERLAY_CSS__', JSON.stringify(overlayCss));
fs.writeFileSync(outputPath, rendered, 'utf8');

let indexHtml = fs.readFileSync(indexPath, 'utf8');
const snippet = '    <script src="./openclaw-locale-init.js"></script>\n';
if (!indexHtml.includes('./openclaw-locale-init.js')) {
  indexHtml = indexHtml.replace(/\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+\.js"><\/script>\n/, (match) => `${snippet}${match}`);
}
fs.writeFileSync(indexPath, indexHtml, 'utf8');
