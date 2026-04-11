import assert from 'node:assert/strict';
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/verify-control-ui-bilingual-overlay-smoke.mjs <file>');
  process.exit(1);
}

const js = fs.readFileSync(input, 'utf8');

assert.match(js, /openclaw\.docker\.i18n\.textMode/, 'missing textMode storage key');
assert.match(js, /setTextMode/, 'missing setTextMode API');
assert.match(js, /getTextMode/, 'missing getTextMode API');
assert.match(js, /enabledTextModes/, 'missing enabledTextModes config');
assert.match(js, /field\.agentDefaults/, 'missing field.agentDefaults dictionary entry');
assert.match(js, /代理默认项/, 'missing zh label for Agent Defaults');
assert.match(js, /openclaw-bilingual-inline/, 'missing bilingual inline CSS hook');
assert.match(js, /openclaw-bilingual-stacked/, 'missing bilingual stacked CSS hook');
assert.match(js, /TEXT_MODE_KEY/, 'missing text mode storage key constant');
assert.match(js, /function resolveActiveTextMode/, 'missing resolveActiveTextMode');
assert.match(js, /openclaw-text-mode-select/, 'missing text mode switcher control');
assert.match(js, /openclaw-locale-overlay-style/, 'missing overlay style injector');
assert.match(js, /openclaw-search-hidden/, 'missing search hidden css hook');
assert.match(js, /handleSearchInputCapture/, 'missing chinese search bridge');
assert.match(js, /openclaw-search-bridge-tip/, 'missing search bridge hint hook');

console.log('bilingual overlay smoke ok');
