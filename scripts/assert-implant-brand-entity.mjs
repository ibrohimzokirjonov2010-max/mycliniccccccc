#!/usr/bin/env node
/**
 * Guard: ImplantBrand is registered on base44.entities so brands.list works.
 * Run: node scripts/assert-implant-brand-entity.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const client = read('src/api/base44Client.jsx');
const brands = read('src/components/implants/ImplantBrandsModal.jsx');

assert(
  /ImplantBrand:\s*new HybridEntityLoader\(['"]ImplantBrand['"]\)/.test(client),
  'ImplantBrand must be registered on base44.entities'
);
assert(client.includes("'ImplantBrand': 'implant_brands'"), 'ImplantBrand maps to implant_brands table');
assert(client.includes("'ImplantBrand': 'implants'"), 'ImplantBrand feature gate stays under implants');

assert(brands.includes('base44.entities?.ImplantBrand'), 'getOrSeed guards missing entity');
assert(brands.includes("typeof brandApi.list !== 'function'"), 'getOrSeed checks list exists');
assert(brands.includes('brandApi.list('), 'getOrSeed calls brandApi.list');
assert(!/base44\.entities\.ImplantBrand\.list\(/.test(brands), 'must not call undefined.list bare');

console.log('assert-implant-brand-entity: ok');
