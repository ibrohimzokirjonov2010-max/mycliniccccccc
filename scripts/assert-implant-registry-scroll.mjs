#!/usr/bin/env node
/**
 * Guard: implant registry table stays horizontally scrollable on notebooks (~1280).
 * Run: node scripts/assert-implant-registry-scroll.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const page = read('src/pages/Implants.jsx');
const css = read('src/index.css');

assert(page.includes('data-implant-registry="notebook-scroll-v1"'), 'registry page marker');
assert(page.includes('data-implant-registry-scroll="v1"'), 'scroll container marker');
assert(page.includes('implant-registry-scroll'), 'scroll class on wrapper');
assert(page.includes('min-w-[1080px]'), 'table has min-width so notebook panels scroll');
assert(page.includes('min-w-0 max-w-full'), 'page/shell constrain width');
assert(page.includes('implant-registry-actions'), 'actions column class for sticky');
assert(!page.includes('min-w-[210px]'), 'actions column not forcing 210px min on header');

assert(css.includes('implant-registry-notebook-scroll-v1'), 'css marker');
assert(css.includes('.implant-registry-scroll'), 'scroll styles');
assert(css.includes('position: sticky'), 'sticky actions');
assert(css.includes('th.implant-registry-actions'), 'sticky th');
assert(css.includes('td.implant-registry-actions'), 'sticky td');
assert(css.includes('scrollbar-gutter: stable'), 'visible scrollbar gutter');

console.log('assert-implant-registry-scroll: ok');
