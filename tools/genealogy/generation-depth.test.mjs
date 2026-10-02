import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generationStats, depths } from './model.mjs';

test('44+ generations are not capped by a short selected spine, viewport or cycle', () => {
  const model = { root: 'p0', persons: {}, edges: {}, spine: ['p0', 'p1'] };
  for (let i = 0; i <= 70; i++) {
    model.persons['p' + i] = { living: i < 2 };
    model.edges['p' + i] = i < 70 ? ['p' + (i + 1)] : ['p10', 'unpublished'];
  }
  assert.equal(generationStats(model).maxGenerations, 70);
  assert.equal(depths(model).p44, 44);
  assert.equal(depths(model).unpublished, undefined);
});

test('published depth metadata and profile agree with the entire corpus', () => {
  const corpus = JSON.parse(readFileSync(new URL('../../assets/profile-archive/lineage/remington-bloodline.json', import.meta.url)));
  const stats = generationStats(corpus);
  assert.ok(stats.maxGenerations >= 44);
  assert.equal(corpus.meta.stats.maxGenerations, stats.maxGenerations);
  const profile = readFileSync(new URL('../../surfaces/profile.html', import.meta.url), 'utf8');
  const data = JSON.parse(profile.match(/id="blood-data">(.*?)<\/script>/s)[1]);
  assert.equal(data.stats.maxGenerations, stats.maxGenerations);
  const blood = readFileSync(new URL('../../surfaces/blood.html', import.meta.url), 'utf8');
  assert.doesNotMatch(blood, /S\.stats\.spineGenerations|stats&&S\.stats\.spineGenerations/);
  assert.doesNotMatch(profile, /replace\('\{g\}',s\.spineGenerations\)/);
});
