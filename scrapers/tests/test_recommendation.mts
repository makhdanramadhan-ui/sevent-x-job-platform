import assert from 'node:assert/strict';
import { rankJobs, applyRecommendationFilters } from '../../lib/recommendation/index';
import { isJobEligibleForLocationPreferences } from '../../lib/recommendation/location-filter';
import type {
  RecommendationJobInput,
  RecommendationProfileInput,
} from '../../lib/recommendation-contract';

const REF_DATE = '2026-11-18';

const BASE_JOBS: RecommendationJobInput[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Frontend Web Developer',
    company: 'PT Nusantara Digital',
    location: 'Jakarta Selatan',
    work_mode: 'hybrid',
    employment_type: 'full_time',
    level: 'junior',
    education: 'Minimal S1 Teknik Informatika / Ilmu Komputer',
    skills: ['React', 'TypeScript', 'Tailwind CSS'],
    status: 'open',
    deadline: '2026-12-15',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    title: 'Senior Backend Engineer',
    company: 'PT Awan Skala Besar',
    location: 'Jakarta Pusat',
    work_mode: 'remote',
    employment_type: 'full_time',
    level: 'senior',
    education: 'S1/S2',
    skills: ['Go', 'PostgreSQL', 'Kubernetes', 'Docker'],
    status: 'open',
    deadline: '2026-12-30',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    title: 'Staf Akuntansi dan Pajak',
    company: 'PT Niaga Sejahtera',
    location: 'Surabaya',
    work_mode: 'onsite',
    employment_type: 'full_time',
    level: 'entry',
    education: 'Minimal D3/S1 Akuntansi',
    skills: ['Accounting', 'Taxation', 'Microsoft Excel'],
    status: 'open',
    deadline: null, // Tanpa tenggat
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    title: 'Frontend Developer (Expired)',
    company: 'PT Masa Lalu',
    location: 'Jakarta',
    work_mode: 'remote',
    employment_type: 'full_time',
    level: 'junior',
    education: 'S1',
    skills: ['React', 'TypeScript'],
    status: 'open',
    deadline: '2026-10-01', // Kedaluwarsa
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    title: 'General Trainee (Minim Info)',
    company: 'PT Misterius',
    location: null,
    work_mode: 'unknown',
    employment_type: 'unknown',
    level: 'unknown',
    education: null,
    skills: [],
    status: 'unknown',
    deadline: null,
  },
];

function testEmptyProfile(): void {
  const resultNull = rankJobs({ profile: null, jobs: BASE_JOBS }, { referenceDate: REF_DATE });
  assert.equal(resultNull.contract_version, 1);
  assert.equal(resultNull.items.length, BASE_JOBS.length);

  for (const item of resultNull.items) {
    assert.equal(item.score, 0, `Profil null harus menghasilkan skor 0 untuk job ${item.job_id}`);
    assert.equal(item.matched.length, 0, 'Profil null tidak boleh memiliki klaim matched');
    assert.ok(
      item.unknown.some((u) => u.includes('profil pengguna masih kosong')),
      'Harus mencantumkan alasan informasi belum cukup pada unknown',
    );
  }

  const emptyProfile: RecommendationProfileInput = {
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
  };
  const resultEmpty = rankJobs(
    { profile: emptyProfile, jobs: BASE_JOBS },
    { referenceDate: REF_DATE },
  );
  for (const item of resultEmpty.items) {
    assert.equal(item.score, 0);
  }
  console.log('PASS 1: Penanganan profil kosong (null & field kosong)');
}

function testSkillSynonymsAndFrontendMatch(): void {
  const feProfile: RecommendationProfileInput = {
    // Menggunakan sinonim: React.js -> React, TS -> TypeScript, Tailwind -> Tailwind CSS
    skills: ['React.js', 'TS', 'Tailwind'],
    education: [
      {
        institution: 'Universitas Indonesia',
        degree: 'S1',
        field: 'Ilmu Komputer',
        start_date: '2022-08',
        end_date: '2026-07',
        description: null,
      },
    ],
    experiences: [
      {
        company: 'Startup Kampus',
        title: 'Front-End Intern',
        location: 'Depok',
        start_date: '2025-06',
        end_date: '2025-12',
        current: false,
        description: 'Membangun aplikasi web dengan NextJS',
      },
    ],
    projects: [],
    preferences: {
      positions: ['Front End Developer'],
      locations: ['DKI Jakarta'],
      levels: ['junior'],
      work_modes: ['hybrid', 'remote'],
      employment_types: ['full_time'],
    },
  };

  const output = rankJobs({ profile: feProfile, jobs: BASE_JOBS }, { referenceDate: REF_DATE });
  const top = output.items[0];
  assert.equal(
    top.job_id,
    '10000000-0000-4000-8000-000000000001',
    'Lowongan Frontend Web Developer harus berada di peringkat 1',
  );
  assert.ok(top.score >= 85, `Skor kecocokan penuh harus tinggi (dapat: ${top.score})`);
  assert.ok(
    top.matched.some((m) => m.includes('React') && m.includes('TypeScript')),
    'Sinonim React.js dan TS harus dikenali cocok dengan React dan TypeScript',
  );
  console.log('PASS 2: Pencocokan sinonim skill & peringkat utama Frontend');
}

function testExpiredAndNoDeadline(): void {
  const feProfile: RecommendationProfileInput = {
    skills: ['React', 'TypeScript', 'Tailwind CSS'],
    education: [
      {
        institution: 'ITB',
        degree: 'S1',
        field: 'Informatika',
        start_date: '2021-08',
        end_date: '2025-07',
        description: null,
      },
    ],
    experiences: [],
    projects: [],
    preferences: {
      positions: ['Frontend Developer'],
      locations: ['Jakarta'],
      levels: ['junior'],
      work_modes: ['remote', 'hybrid'],
      employment_types: ['full_time'],
    },
  };

  const output = rankJobs({ profile: feProfile, jobs: BASE_JOBS }, { referenceDate: REF_DATE });
  const expiredItem = output.items.find(
    (i) => i.job_id === '10000000-0000-4000-8000-000000000004',
  )!;
  assert.equal(expiredItem.score, 0, 'Lowongan kedaluwarsa wajib memiliki skor 0');
  assert.ok(
    expiredItem.missing.some((m) => m.includes('Tenggat lamaran sudah lewat')),
    'Lowongan kedaluwarsa wajib mencatat alasan tenggat lewat di missing',
  );
  assert.equal(
    output.items[output.items.length - 1].job_id,
    '10000000-0000-4000-8000-000000000004',
    'Lowongan kedaluwarsa harus ditempatkan di urutan paling bawah',
  );

  const noDeadlineItem = output.items.find(
    (i) => i.job_id === '10000000-0000-4000-8000-000000000003',
  )!;
  assert.ok(
    noDeadlineItem.unknown.some((u) => u.includes('Tenggat lamaran tidak dicantumkan')),
    'Lowongan tanpa deadline wajib mencantumkan info di unknown',
  );
  console.log('PASS 3: Penanganan lowongan kedaluwarsa dan lowongan tanpa tenggat');
}

function testSeniorLevelAndUnknownRequirements(): void {
  const juniorProfile: RecommendationProfileInput = {
    skills: ['Golang', 'Postgres'],
    education: [
      {
        institution: 'UGM',
        degree: 'S1',
        field: 'Ilmu Komputer',
        start_date: '2022-08',
        end_date: '2026-06',
        description: null,
      },
    ],
    experiences: [],
    projects: [],
    preferences: {
      positions: ['Backend Engineer'],
      locations: ['Jakarta'],
      levels: ['junior'],
      work_modes: ['remote'],
      employment_types: ['full_time'],
    },
  };

  const output = rankJobs(
    { profile: juniorProfile, jobs: BASE_JOBS },
    { referenceDate: REF_DATE },
  );

  const seniorJob = output.items.find(
    (i) => i.job_id === '10000000-0000-4000-8000-000000000002',
  )!;
  assert.ok(
    seniorJob.missing.some((m) => m.includes('butuh senior (profil: junior)')),
    'Lowongan senior harus mencatat ketidaksesuaian level untuk profil junior',
  );
  assert.ok(
    seniorJob.matched.some((m) => m.includes('Go') && m.includes('PostgreSQL')),
    'Sinonim Golang -> Go dan Postgres -> PostgreSQL harus tetap tercatat di matched',
  );
  assert.ok(
    seniorJob.missing.some((m) => m.includes('Kubernetes') && m.includes('Docker')),
    'Skill yang belum dimiliki harus tercatat di missing',
  );

  const unknownJob = output.items.find(
    (i) => i.job_id === '10000000-0000-4000-8000-000000000005',
  )!;
  assert.equal(
    unknownJob.score,
    0,
    'Lowongan dengan hampir semua field unknown tidak boleh menghasilkan angka presisi palsu',
  );
  assert.ok(
    unknownJob.unknown.some((u) => u.includes('Informasi belum cukup')),
    'Wajib menampilkan informasi belum cukup pada unknown',
  );
  console.log('PASS 4: Pemeriksaan level senior dan persyaratan tidak diketahui (unknown)');
}

function testNonTechCategoryAndDeterministicShift(): void {
  // Awalnya profil adalah akuntan entry-level di Surabaya
  const accountingProfile: RecommendationProfileInput = {
    skills: ['Akuntansi', 'Brevet Pajak', 'Ms Excel'],
    education: [
      {
        institution: 'Universitas Airlangga',
        degree: 'D3',
        field: 'Akuntansi',
        start_date: '2022-08',
        end_date: '2025-07',
        description: null,
      },
    ],
    experiences: [],
    projects: [],
    preferences: {
      positions: ['Staf Akuntansi'],
      locations: ['Surabaya'],
      levels: ['entry'],
      work_modes: ['onsite'],
      employment_types: ['full_time'],
    },
  };

  const beforeShift = rankJobs(
    { profile: accountingProfile, jobs: BASE_JOBS },
    { referenceDate: REF_DATE },
  );
  assert.equal(
    beforeShift.items[0].job_id,
    '10000000-0000-4000-8000-000000000003',
    'Profil akuntansi harus menempatkan lowongan Staf Akuntansi dan Pajak di peringkat 1',
  );
  assert.ok(
    beforeShift.items[0].score >= 85,
    `Skor lowongan non-teknologi harus tinggi (dapat: ${beforeShift.items[0].score})`,
  );

  // Sekarang ubah skill & preferensi pengguna menjadi Frontend Developer di Jakarta
  const shiftedProfile: RecommendationProfileInput = {
    ...accountingProfile,
    skills: ['React', 'TypeScript', 'Tailwind CSS'],
    education: [
      {
        institution: 'Universitas Airlangga',
        degree: 'S1',
        field: 'Sistem Informasi',
        start_date: '2021-08',
        end_date: '2025-07',
        description: null,
      },
    ],
    preferences: {
      positions: ['Frontend Developer'],
      locations: ['Jakarta'],
      levels: ['junior'],
      work_modes: ['hybrid'],
      employment_types: ['full_time'],
    },
  };

  const afterShift = rankJobs(
    { profile: shiftedProfile, jobs: BASE_JOBS },
    { referenceDate: REF_DATE },
  );
  assert.equal(
    afterShift.items[0].job_id,
    '10000000-0000-4000-8000-000000000001',
    'Perubahan skill & preferensi harus menggeser peringkat 1 secara deterministik ke Frontend Web Developer',
  );
  console.log('PASS 5: Kategori non-teknologi & perubahan deterministik saat skill/preferensi berubah');
}

function testDuplicateJobsAndFilters(): void {
  const duplicateJob: RecommendationJobInput = {
    ...BASE_JOBS[0],
    id: '10000000-0000-4000-8000-000000000099',
  };

  const profile: RecommendationProfileInput = {
    skills: ['React', 'TypeScript'],
    education: [],
    experiences: [],
    projects: [],
    preferences: {
      positions: ['Frontend Developer'],
      locations: ['Jakarta'],
      levels: ['junior'],
      work_modes: ['hybrid'],
      employment_types: ['full_time'],
    },
  };

  const output = rankJobs(
    { profile, jobs: [BASE_JOBS[0], duplicateJob] },
    { referenceDate: REF_DATE },
  );

  assert.equal(output.items.length, 2);
  assert.ok(
    output.items[1].unknown.some((u) => u.includes('indikasi duplikat')),
    'Entri duplikat kedua harus memiliki penanda duplikat pada unknown',
  );

  const filtered = applyRecommendationFilters(BASE_JOBS, {
    work_modes: ['remote'],
    employment_types: ['full_time'],
    levels: ['senior'],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '10000000-0000-4000-8000-000000000002');
  console.log('PASS 6: Deteksi duplikat konservatif & penyaringan RecommendationFilters');
}

function main(): void {
  testEmptyProfile();
  testSkillSynonymsAndFrontendMatch();
  testExpiredAndNoDeadline();
  testSeniorLevelAndUnknownRequirements();
  testNonTechCategoryAndDeterministicShift();
  testDuplicateJobsAndFilters();
  testRoleMatchingStrictness();
  testLocationHardFilter();
  console.log('ALL RECOMMENDATION DETERMINISTIC TESTS PASSED');
}


function testRoleMatchingStrictness(): void {
  const iotProfile: RecommendationProfileInput = {
    skills: ['Internet of Things', 'Firmware Development', 'C++'],
    education: [],
    experiences: [],
    projects: [],
    preferences: {
      country: 'ID',
      positions: ['IoT Engineer'],
      locations: ['Bogor'],
      levels: [],
      work_modes: [],
      employment_types: [],
    },
  };
  const unrealJob: RecommendationJobInput = {
    id: '20000000-0000-4000-8000-000000000001',
    title: 'Unreal Engine Developer, Remote - Contract',
    company: 'Xperteez Technology',
    location: 'United States',
    work_mode: 'remote',
    employment_type: 'contract',
    level: 'mid',
    education: null,
    skills: ['Unreal Engine Developer', 'Game Developer', 'C++ Developer'],
    status: 'open',
    deadline: null,
  };
  const iotJob: RecommendationJobInput = {
    ...unrealJob,
    id: '20000000-0000-4000-8000-000000000002',
    title: 'IoT Firmware Engineer',
    company: 'PT Contoh IoT',
    location: 'Bogor',
    work_mode: 'onsite',
    employment_type: 'full_time',
    skills: [],
  };

  const output = rankJobs({ profile: iotProfile, jobs: [unrealJob, iotJob] }, { referenceDate: REF_DATE });
  const unrealScore = output.items.find((item) => item.job_id === unrealJob.id)!;
  const iotScore = output.items.find((item) => item.job_id === iotJob.id)!;

  assert.ok(unrealScore.score < 50, `Unreal tidak boleh mencapai ~50% (dapat ${unrealScore.score})`);
  assert.ok(
    !unrealScore.matched.some((m) => m.includes('Posisi sesuai bidang/preferensi')),
    'Unreal Engine Developer tidak boleh cocok dengan IoT Engineer',
  );
  assert.ok(
    iotScore.matched.some((m) => m.includes('Posisi sesuai bidang/preferensi')),
    'IoT Firmware Engineer harus cocok dengan IoT Engineer',
  );
  console.log('PASS 7: Pencocokan posisi ketat (Unreal ditolak, IoT Firmware diterima)');
}

function testLocationHardFilter(): void {
  const jakartaOnsite = { work_mode: 'onsite', location: 'Jakarta Pusat' };
  const bogorOnsite = { work_mode: 'onsite', location: 'Bogor' };
  const remoteBrazil = { work_mode: 'remote', location: 'Remote - Brazil' };
  const remoteWorldwide = { work_mode: 'remote', location: 'Remote - Worldwide' };
  const remoteUsaOnly = { work_mode: 'remote', location: 'USA only' };

  const bogorPrefs = { country: 'ID', locations: ['Bogor'] };
  assert.equal(isJobEligibleForLocationPreferences(jakartaOnsite, bogorPrefs).eligible, false);
  assert.equal(isJobEligibleForLocationPreferences(bogorOnsite, bogorPrefs).eligible, true);
  assert.equal(isJobEligibleForLocationPreferences(remoteBrazil, bogorPrefs).eligible, false);

  const remotePrefs = { country: 'ID', locations: ['Remote'] };
  assert.equal(isJobEligibleForLocationPreferences(remoteWorldwide, remotePrefs).eligible, true);
  assert.equal(isJobEligibleForLocationPreferences(remoteUsaOnly, remotePrefs).eligible, false);

  const provincePrefs = { country: 'ID', locations: ['Jawa Barat'] };
  assert.equal(isJobEligibleForLocationPreferences(bogorOnsite, provincePrefs).eligible, true);
  console.log('PASS 8: Filter keras negara & lokasi preferensi');
}
main();
