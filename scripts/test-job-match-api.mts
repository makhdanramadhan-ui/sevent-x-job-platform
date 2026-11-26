import assert from 'node:assert/strict';
import { evaluateSingleJobMatch, getMatchTier } from '../lib/job-match';
import type {
  RecommendationJobInputWithContext,
  RecommendationProfileInput,
} from '../lib/recommendation-contract';

const BASE_JOB: RecommendationJobInputWithContext = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Backend Developer',
  company: 'PT Teknologi Nusantara',
  location: 'Indonesia, Jakarta Selatan',
  work_mode: 'hybrid',
  employment_type: 'full_time',
  level: 'junior',
  education: "Minimal S1 / Bachelor's Degree",
  skills: ['TypeScript', 'PostgreSQL', 'Node.js'],
  status: 'open',
  deadline: '2026-12-31',
  description: 'Membangun REST API menggunakan TypeScript, Node.js, dan PostgreSQL.',
};

// 1. Tier label & tone mapping
assert.deepEqual(getMatchTier(85), { label: 'Sangat Cocok', tone: 'high' });
assert.deepEqual(getMatchTier(70), { label: 'Sangat Cocok', tone: 'high' });
assert.deepEqual(getMatchTier(69), { label: 'Cukup Cocok', tone: 'medium' });
assert.deepEqual(getMatchTier(45), { label: 'Cukup Cocok', tone: 'medium' });
assert.deepEqual(getMatchTier(44), { label: 'Perlu Penyesuaian', tone: 'low' });
console.log('PASS tier mapping: high (>=70), medium (45-69), low (<45)');

// 2. Incomplete / empty profile returns ready: false
const emptyResult = evaluateSingleJobMatch(
  {
    skills: [],
    education: [],
    experiences: [],
    projects: [],
    preferences: {
      positions: [],
      locations: [],
      levels: [],
      work_modes: [],
      employment_types: [],
    },
  },
  BASE_JOB,
  { referenceDate: '2026-11-25' },
);
assert.equal(emptyResult.ready, false);
assert.equal(emptyResult.reason, 'profile_incomplete');
console.log('PASS incomplete profile: returns ready=false profile_incomplete');

// 3. Strong matching profile returns high score and detailed matched reasons
const strongProfile: RecommendationProfileInput = {
  skills: ['TypeScript', 'PostgreSQL', 'Node.js'],
  education: [
    {
      institution: 'IPB',
      degree: 'S1',
      field: 'Ilmu Komputer',
      start_date: '2021-08',
      end_date: '2025-07',
      description: null,
    },
  ],
  experiences: [],
  projects: [],
  preferences: {
    country: 'ID',
    positions: ['Backend Developer'],
    locations: ['Jakarta Selatan'],
    levels: ['junior'],
    work_modes: ['hybrid'],
    employment_types: ['full_time'],
  },
};
const strongResult = evaluateSingleJobMatch(strongProfile, BASE_JOB, {
  referenceDate: '2026-11-25',
});
assert.equal(strongResult.ready, true);
if (strongResult.ready) {
  assert.ok(strongResult.score >= 70, `Expected score >= 70, got ${strongResult.score}`);
  assert.equal(strongResult.tier_label, 'Sangat Cocok');
  assert.equal(strongResult.tier_tone, 'high');
  assert.ok(strongResult.matched.length >= 3);
}
console.log('PASS strong profile: high score, tier high, matched reasons populated');

// 4. Mismatched profile shows missing reasons & low score
const weakProfile: RecommendationProfileInput = {
  skills: ['Graphic Design', 'Photoshop'],
  education: [],
  experiences: [],
  projects: [],
  preferences: {
    country: 'ID',
    positions: ['UI/UX Designer'],
    locations: ['Surabaya'],
    levels: ['intern'],
    work_modes: ['remote'],
    employment_types: ['internship'],
  },
};
const weakResult = evaluateSingleJobMatch(weakProfile, BASE_JOB, {
  referenceDate: '2026-11-25',
});
assert.equal(weakResult.ready, true);
if (weakResult.ready) {
  assert.ok(weakResult.score < 45, `Expected score < 45, got ${weakResult.score}`);
  assert.equal(weakResult.tier_label, 'Perlu Penyesuaian');
  assert.equal(weakResult.tier_tone, 'low');
  assert.ok(weakResult.missing.length > 0);
}
console.log('PASS weak profile: low score, tier low, missing reasons populated');

console.log('ALL JOB MATCH API TESTS PASSED');
