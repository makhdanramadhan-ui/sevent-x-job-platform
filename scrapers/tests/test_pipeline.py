"""
Pemeriksaan deterministik untuk pipeline normalisasi, deduplikasi konservatif,
pemisahan timestamp published_at vs fetched_at, dan ketahanan kegagalan sumber (Anggota 3).

Dapat dijalankan langsung dengan:
  py -3 -m unittest scrapers/tests/test_pipeline.py -v
"""

from __future__ import annotations

import struct
import unittest
from typing import Any, Dict

from scrapers.dedup import (
    build_conservative_cross_source_key,
)
from scrapers.ingest_client import SupabaseIngestClient, execute_ingest_pipeline
from scrapers.logo_resolver import (
    _is_valid_favicon_bytes,
    clean_company_name_for_lookup,
    extract_domain_from_company_or_url,
)
from scrapers.normalizer import (
    VALID_EMPLOYMENT_TYPES,
    VALID_LEVELS,
    VALID_STATUSES,
    VALID_WORK_MODES,
    build_ingest_payload,
    normalize_education,
    normalize_employment_type,
    normalize_level,
    normalize_location,
    normalize_skills,
    normalize_work_mode,
)
from scrapers.sources import (
    SourceFetchResult,
    fetch_verified_partner_feed,
    parse_linkedin_guest_detail_html,
    parse_linkedin_guest_search_html,
)


class TestNormalizerAndContract(unittest.TestCase):
    def test_enum_normalization_strictly_matches_db_contract(self) -> None:
        self.assertEqual(normalize_work_mode("WFH / Remote"), "remote")
        self.assertEqual(normalize_work_mode("Hybrid (2 hari WFO)"), "hybrid")
        self.assertEqual(normalize_work_mode("WFO / Tatap Muka"), "onsite")
        self.assertEqual(normalize_work_mode(""), "unknown")
        self.assertIn(normalize_work_mode("random-text"), VALID_WORK_MODES)

        self.assertEqual(normalize_employment_type("Penuh Waktu (PKWTT)"), "full_time")
        self.assertEqual(normalize_employment_type("Program Magang"), "internship")
        self.assertEqual(normalize_employment_type("Kontrak PKWT"), "contract")
        self.assertEqual(normalize_employment_type("Paruh Waktu"), "part_time")
        self.assertEqual(normalize_employment_type("Pekerja Lepas / Freelancer"), "freelance")
        self.assertIn(normalize_employment_type("tidak jelas"), VALID_EMPLOYMENT_TYPES)

        self.assertEqual(normalize_level("Fresh Graduate / Entry Level"), "entry")
        self.assertEqual(normalize_level("Sr. Backend Developer"), "senior")
        self.assertEqual(normalize_level("Engineering Manager"), "lead")
        self.assertEqual(normalize_level("Mahasiswa Magang"), "intern")
        self.assertIn(normalize_level("lainnya"), VALID_LEVELS)

    def test_published_at_is_strictly_separated_from_fetched_at(self) -> None:
        payload_no_pub = build_ingest_payload(
            source_name="themuse_api",
            source_job_id="job-1",
            source_url="https://example.com/jobs/1",
            title="Staf Administrasi",
            company="PT Contoh",
            fetched_at="2026-11-18T10:00:00Z",
            published_at=None,
        )
        self.assertEqual(payload_no_pub["source"]["fetched_at"], "2026-11-18T10:00:00Z")
        self.assertNotIn(
            "published_at",
            payload_no_pub["source"],
            "Waktu scraper tidak boleh dipakai sebagai published_at ketika waktu terbit tidak diketahui",
        )

        payload_with_pub = build_ingest_payload(
            source_name="themuse_api",
            source_job_id="job-2",
            source_url="https://example.com/jobs/2",
            title="Staf Akuntansi",
            company="PT Contoh",
            fetched_at="2026-11-18T10:00:00Z",
            published_at="2026-11-10T08:00:00Z",
        )
        self.assertEqual(payload_with_pub["source"]["published_at"], "2026-11-10T08:00:00Z")
        self.assertEqual(payload_with_pub["source"]["fetched_at"], "2026-11-18T10:00:00Z")

    def test_expired_deadline_sets_status_closed_and_no_deadline_stays_open(self) -> None:
        expired_payload = build_ingest_payload(
            source_name="jobicy_api",
            source_job_id="job-expired",
            source_url="https://example.com/jobs/expired",
            title="Junior Developer",
            company="PT Lama",
            deadline="2026-10-01",
            status="open",
            reference_date="2026-11-18",
        )
        self.assertEqual(expired_payload["job"]["status"], "closed")
        self.assertEqual(expired_payload["job"]["deadline"], "2026-10-01")

        no_deadline_payload = build_ingest_payload(
            source_name="remotive_api",
            source_job_id="job-nodeadline",
            source_url="https://example.com/jobs/nodeadline",
            title="Marketing Executive",
            company="PT Baru",
            deadline=None,
            status="open",
            reference_date="2026-11-18",
        )
        self.assertEqual(no_deadline_payload["job"]["status"], "open")
        self.assertIsNone(no_deadline_payload["job"]["deadline"])

    def test_cross_domain_skill_synonym_normalization(self) -> None:
        skills = normalize_skills(["React.js", "TS", "Akuntansi", "Brevet Pajak", "Ms Excel"])
        self.assertIn("React", skills)
        self.assertIn("TypeScript", skills)
        self.assertIn("Accounting", skills)
        self.assertIn("Taxation", skills)
        self.assertIn("Microsoft Excel", skills)

    def test_location_normalization_country_city_format(self) -> None:
        self.assertEqual(normalize_location("Jakarta, Jakarta, Indonesia"), "Indonesia, Jakarta")
        self.assertEqual(normalize_location("Jakarta Selatan"), "Indonesia, Jakarta Selatan")
        self.assertEqual(normalize_location("Yogyakarta, Indonesia"), "Indonesia, Yogyakarta")
        self.assertEqual(normalize_location("Bandung"), "Indonesia, Bandung")
        self.assertEqual(normalize_location("London, United Kingdom"), "United Kingdom, London")
        self.assertEqual(normalize_location("Indonesia, Surabaya"), "Indonesia, Surabaya")
        self.assertEqual(normalize_location("Worldwide"), "Global, Remote")
        self.assertIsNone(normalize_location(""))

    def test_linkedin_guest_html_parser_deterministic(self) -> None:
        sample_search_html = """
        <li>
          <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4098765432">
            <a class="base-card__full-link" href="https://id.linkedin.com/jobs/view/frontend-developer-at-pt-maju-4098765432?trk=public_jobs_topcard-title">
              <span class="sr-only">Frontend Developer</span>
            </a>
            <div class="base-search-card__info">
              <h3 class="base-search-card__title">Frontend Developer (React)</h3>
              <h4 class="base-search-card__subtitle">
                <a class="hidden-nested-link">PT Maju Bersama</a>
              </h4>
              <div class="base-search-card__metadata">
                <span class="job-search-card__location">Jakarta, Indonesia</span>
                <time class="job-search-card__listdate" datetime="2026-11-15">3 days ago</time>
              </div>
            </div>
          </div>
        </li>
        """
        cards = parse_linkedin_guest_search_html(sample_search_html)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["job_id"], "4098765432")
        self.assertEqual(cards[0]["title"], "Frontend Developer (React)")
        self.assertEqual(cards[0]["company"], "PT Maju Bersama")
        self.assertEqual(cards[0]["location"], "Jakarta, Indonesia")
        self.assertEqual(cards[0]["published_at"], "2026-11-15")
        self.assertEqual(
            cards[0]["url"],
            "https://id.linkedin.com/jobs/view/frontend-developer-at-pt-maju-4098765432",
        )

        sample_detail_html = """
        <div class="show-more-less-html__markup">
          <p>Kami membutuhkan Frontend Developer yang menguasai React dan TypeScript.</p>
        </div>
        <ul class="description__job-criteria-list">
          <li class="description__job-criteria-item">
            <h3 class="description__job-criteria-subheader">Seniority level</h3>
            <span class="description__job-criteria-text">Entry level</span>
          </li>
          <li class="description__job-criteria-item">
            <h3 class="description__job-criteria-subheader">Employment type</h3>
            <span class="description__job-criteria-text">Full-time</span>
          </li>
        </ul>
        """
        detail = parse_linkedin_guest_detail_html(sample_detail_html)
        self.assertEqual(detail["level"], "Entry level")
        self.assertEqual(detail["employment_type"], "Full-time")
        self.assertIn("React", detail["description"] or "")

    def test_linkedin_logo_extraction_handles_attribute_order_and_rejects_ghosts(self) -> None:
        search_html = """
        <li>
          <div data-entity-urn="urn:li:jobPosting:1001">
            <img data-delayed-url="https://media.licdn.com/dms/image/C4D0BAQ/logo?e=123&amp;t=abc" class="artdeco-entity-image" alt="Ajaib">
            <a class="base-card__full-link" href="https://id.linkedin.com/jobs/view/1001"></a>
            <h3 class="base-search-card__title">Backend Engineer</h3>
            <h4 class="base-search-card__subtitle">Ajaib</h4>
          </div>
        </li>
        <li>
          <div data-entity-urn="urn:li:jobPosting:1002">
            <img class="artdeco-entity-image" src="https://static.licdn.com/aero-v1/sc/h/ghost" data-delayed-url="https://media.licdn.com/dms/image/real">
            <a class="base-card__full-link" href="https://id.linkedin.com/jobs/view/1002"></a>
            <h3 class="base-search-card__title">QA Engineer</h3>
            <h4 class="base-search-card__subtitle">CoverGo | Insurtech</h4>
          </div>
        </li>
        <li>
          <div data-entity-urn="urn:li:jobPosting:1003">
            <img class="artdeco-entity-image" src="https://static.licdn.com/aero-v1/sc/h/ghost" data-ghost-url="https://static.licdn.com/aero-v1/sc/h/ghost2">
            <a class="base-card__full-link" href="https://id.linkedin.com/jobs/view/1003"></a>
            <h3 class="base-search-card__title">Product Manager</h3>
            <h4 class="base-search-card__subtitle">PT Kosong</h4>
          </div>
        </li>
        """
        cards = parse_linkedin_guest_search_html(search_html)
        self.assertEqual(len(cards), 3)
        self.assertEqual(
            cards[0]["logo_url"],
            "https://media.licdn.com/dms/image/C4D0BAQ/logo?e=123&t=abc",
        )
        self.assertEqual(cards[1]["logo_url"], "https://media.licdn.com/dms/image/real")
        self.assertIsNone(cards[2]["logo_url"])

        detail_html = """
        <img data-delayed-url="https://media.licdn.com/dms/image/detail-logo" class="artdeco-entity-image">
        <div class="show-more-less-html__markup"><p>Deskripsi</p></div>
        """
        detail = parse_linkedin_guest_detail_html(detail_html)
        self.assertEqual(detail["logo_url"], "https://media.licdn.com/dms/image/detail-logo")

    def test_normalizer_rejects_placeholder_logo_url(self) -> None:
        payload = build_ingest_payload(
            source_name="linkedin_guest",
            source_job_id="999",
            source_url="https://www.linkedin.com/jobs/view/999",
            title="QA Engineer",
            company="CoverGo | Insurtech",
            company_logo_url="https://static.licdn.com/aero-v1/sc/h/ghost",
        )
        self.assertNotIn("company_logo_url", payload["job"])

    def test_logo_resolver_domain_extraction_and_ats_filtering(self) -> None:
        self.assertEqual(extract_domain_from_company_or_url("Bibit.id"), "bibit.id")
        self.assertEqual(extract_domain_from_company_or_url("Traveloka"), "traveloka.com")
        self.assertEqual(extract_domain_from_company_or_url("Grab"), "grab.com")
        self.assertEqual(extract_domain_from_company_or_url("CoverGo | Insurtech"), "covergo.com")
        self.assertEqual(
            extract_domain_from_company_or_url("PT Bank Digital BCA (BCA Digital)"),
            "blubybcadigital.id",
        )
        self.assertEqual(
            extract_domain_from_company_or_url(
                "Acme Unknown Corp",
                source_url="https://careers.acme-example.com/jobs/42",
            ),
            "acme-example.com",
        )
        self.assertIsNone(
            extract_domain_from_company_or_url(
                "Unknown NonCurated Co.",
                source_url="https://www.linkedin.com/jobs/view/123",
            )
        )
        self.assertIsNone(
            extract_domain_from_company_or_url(
                "Unknown ATS Co",
                source_url="https://boards.greenhouse.io/unknown/jobs/777",
            )
        )
        self.assertEqual(clean_company_name_for_lookup("Credit Wellness, LLC"), "Credit Wellness")

    def test_logo_resolver_rejects_16x16_favicon_and_accepts_large_png(self) -> None:
        def make_png(width: int, height: int) -> bytes:
            return (
                b"\x89PNG\r\n\x1a\n"
                + struct.pack(">I", 13)
                + b"IHDR"
                + struct.pack(">II", width, height)
                + b"\x08\x06\x00\x00\x00"
                + b"\x00" * 4
            )

        self.assertFalse(_is_valid_favicon_bytes(make_png(16, 16), "image/png"))
        self.assertTrue(_is_valid_favicon_bytes(make_png(64, 64), "image/png"))
        self.assertTrue(_is_valid_favicon_bytes(make_png(128, 128), "image/png"))
        self.assertFalse(_is_valid_favicon_bytes(b"<!DOCTYPE html><html></html>", "text/html"))
        self.assertFalse(_is_valid_favicon_bytes(b"small", "image/x-icon"))

    def test_description_preserves_paragraphs_and_bullet_lines(self) -> None:
        html_desc = (
            "<p>Kami membangun layanan finansial digital.</p>"
            "<h3>Kualifikasi</h3>"
            "<ul><li><p>Menguasai Python dan SQL.</p></li><li>• Pengalaman REST API.</li></ul>"
        )
        payload = build_ingest_payload(
            source_name="linkedin_guest",
            source_job_id="1001",
            source_url="https://www.linkedin.com/jobs/view/1001",
            title="Backend Engineer",
            company="Traveloka",
            description=html_desc,
        )
        desc = payload["job"]["description"]
        self.assertIn("Kami membangun layanan finansial digital.\n\nKualifikasi", desc)
        self.assertIn("• Menguasai Python dan SQL.", desc)
        self.assertIn("• Pengalaman REST API.", desc)
        self.assertNotIn("• •", desc)

    def test_normalize_skills_always_extracts_from_title_and_description_up_to_10(self) -> None:
        moneta_desc = (
            "Requirements:\n"
            "4. Proficient in JavaScript/TypeScript, HTML, CSS, and modern frontend frameworks (React.js, Angular, or Vue.js).\n"
            "5. Strong backend development experience (Node.js, Java, Python, PHP, or equivalent).\n"
            "6. Experienced in RESTful APIs, database management (SQL/NoSQL), and system integration.\n"
            "7. Familiar with cloud platforms, Docker, CI/CD, and Git."
        )
        skills = normalize_skills(
            ["SQL"],
            title_hint="Senior Full Stack Developer",
            description_hint=moneta_desc,
        )
        self.assertEqual(skills[0], "SQL")
        self.assertEqual(len(skills), 10)
        for expected in ["JavaScript", "TypeScript", "HTML", "CSS", "React", "Angular", "Vue.js", "Node.js", "Java"]:
            self.assertIn(expected, skills)

        # Pastikan kata bahasa Inggris umum ('next', 'go', 'rest') tidak memicu false-positive
        prose_only = normalize_skills(
            ["Software Engineering"],
            title_hint="Staff Engineer",
            description_hint="In the next step, you will go through the rest of the onboarding process with RESTful APIs and CI/CD.",
        )
        self.assertIn("Software Engineering", prose_only)
        self.assertIn("REST API", prose_only)
        self.assertIn("CI/CD", prose_only)
        self.assertNotIn("Next.js", prose_only)
        self.assertNotIn("Go", prose_only)

    def test_linkedin_detail_nested_div_does_not_truncate_requirements(self) -> None:
        nested_html = """
        <div class="show-more-less-html__markup">
          <div><p>Job overview section.</p></div>
          <div><p>Requirements: Proficient in Angular, PHP, NoSQL, and CI/CD.</p></div>
        </div>
        """
        parsed = parse_linkedin_guest_detail_html(nested_html)
        self.assertIn("Requirements: Proficient in Angular, PHP, NoSQL, and CI/CD.", parsed["description"] or "")

    def test_audit_metadata_and_false_positive_skill_fixes(self) -> None:
        # 1. work_mode dari deskripsi dan tanpa false-positive 'anywhere'
        self.assertEqual(
            normalize_work_mode(None, description_hint="Role ini menerapkan skema kerja Hybrid (3 hari WFO)."),
            "hybrid",
        )
        self.assertEqual(
            normalize_work_mode(None, description_hint="Kandidat bersedia bekerja on-site di Surabaya."),
            "onsite",
        )
        self.assertEqual(
            normalize_work_mode(None, description_hint="Collaborate with stakeholders anywhere in the region."),
            "unknown",
        )

        # 2. Variasi education Indonesia & Inggris
        self.assertEqual(
            normalize_education(None, "Qualification: Bachelor in Computer Science or related field."),
            "Minimal S1 / Bachelor's Degree",
        )
        self.assertEqual(
            normalize_education(None, "Kualifikasi: Sarjana Teknik Informatika / Sistem Informasi."),
            "Minimal S1 / Bachelor's Degree",
        )
        self.assertEqual(
            normalize_education(None, "Pendidikan D3/S1 Akuntansi."),
            "Minimal D3 / Diploma",
        )
        self.assertEqual(
            normalize_education(None, "Master in Data Science preferred."),
            "Minimal S2 / Master's Degree",
        )

        # 3. 'East Java' tidak dianggap bahasa pemrograman Java
        ninja_skills = normalize_skills(
            [],
            title_hint="Business Development Executive (Surabaya)",
            description_hint="Covering East Java and West Java merchant acquisition and Sales growth.",
        )
        self.assertNotIn("Java", ninja_skills)
        self.assertIn("Sales", ninja_skills)

        # 4. Tag 1 huruf 'C' ditolak pada peran non-teknis, tetapi dipertahankan pada peran teknis
        non_tech_skills = normalize_skills(
            ["C"],
            title_hint="Account Executive - Splunk",
            description_hint="Responsible for enterprise sales pipeline and client relationships.",
        )
        self.assertNotIn("C", non_tech_skills)
        tech_skills = normalize_skills(
            ["C"],
            title_hint="Embedded Software Engineer",
            description_hint="Develop low-level firmware and embedded systems.",
        )
        self.assertIn("C", tech_skills)


class TestConservativeDeduplication(unittest.TestCase):
    def test_same_title_and_company_with_different_or_unknown_attributes_are_not_merged(self) -> None:
        job_jakarta = build_ingest_payload(
            source_name="themuse_api",
            source_job_id="a-1",
            source_url="https://example.com/a/1",
            title="Software Engineer",
            company="PT Nusantara",
            location="Jakarta",
            work_mode="onsite",
            employment_type="full_time",
            level="junior",
        )
        job_bandung = build_ingest_payload(
            source_name="arbeitnow_api",
            source_job_id="b-1",
            source_url="https://example.com/b/1",
            title="Software Engineer",
            company="PT Nusantara",
            location="Bandung",
            work_mode="onsite",
            employment_type="full_time",
            level="junior",
        )
        job_unknown_level = build_ingest_payload(
            source_name="remotive_api",
            source_job_id="c-1",
            source_url="https://example.com/c/1",
            title="Software Engineer",
            company="PT Nusantara",
            location="Jakarta",
            work_mode="onsite",
            employment_type="full_time",
            level="unknown",
        )

        key_jkt = build_conservative_cross_source_key(job_jakarta)
        key_bdg = build_conservative_cross_source_key(job_bandung)
        key_unk = build_conservative_cross_source_key(job_unknown_level)

        self.assertIsNotNone(key_jkt)
        self.assertIsNotNone(key_bdg)
        self.assertNotEqual(key_jkt, key_bdg)
        self.assertIsNone(
            key_unk,
            "Lowongan dengan atribut level/mode kerja unknown tidak boleh digabung lintas sumber secara spekulatif",
        )

    def test_cross_source_exact_match_preserves_both_sources_under_same_job_uuid(self) -> None:
        job_src1 = build_ingest_payload(
            source_name="themuse_api",
            source_job_id="a-100",
            source_url="https://example.com/a/100",
            title="Staf Akuntansi",
            company="PT Niaga",
            location="Surabaya",
            work_mode="onsite",
            employment_type="full_time",
            level="entry",
            deadline="2026-12-15",
        )
        job_src2 = build_ingest_payload(
            source_name="jobicy_api",
            source_job_id="b-200",
            source_url="https://example.org/b/200",
            title="Staf Akuntansi",
            company="PT Niaga",
            location="Surabaya",
            work_mode="onsite",
            employment_type="full_time",
            level="entry",
            deadline="2026-12-15",
        )

        res1 = SourceFetchResult(source_name="themuse_api", status="OK", payloads=[job_src1])
        res2 = SourceFetchResult(source_name="jobicy_api", status="OK", payloads=[job_src2])

        report = execute_ingest_pipeline([res1, res2], dry_run=True)
        self.assertEqual(len(report.ingested_records), 2)
        self.assertEqual(
            report.ingested_records[0].job_uuid,
            report.ingested_records[1].job_uuid,
            "Lowongan lintas sumber yang 100% terverifikasi identik harus ditautkan ke job_uuid yang sama",
        )
        self.assertTrue(report.ingested_records[1].linked_existing_job)


class TestFailedSourceResilienceAndIdempotency(unittest.TestCase):
    def test_failed_source_does_not_corrupt_or_drop_valid_sources(self) -> None:
        valid_feed = fetch_verified_partner_feed(reference_date="2026-11-18")
        self.assertEqual(valid_feed.status, "OK")
        self.assertGreaterEqual(len(valid_feed.payloads), 5)

        failed_source = SourceFetchResult(
            source_name="workingnomads_api",
            status="FAILED",
            payloads=[],
            reason="HTTP 503 Service Unavailable",
        )

        rpc_db_store: Dict[str, str] = {}

        def mock_rpc_transport(payload: Dict[str, Any]) -> str:
            src = payload["source"]
            job = payload["job"]
            self.assertIn(job["work_mode"], VALID_WORK_MODES)
            self.assertIn(job["employment_type"], VALID_EMPLOYMENT_TYPES)
            self.assertIn(job["level"], VALID_LEVELS)
            self.assertIn(job["status"], VALID_STATUSES)

            identity_key = f"{src['name']}::{src['job_id']}"
            if identity_key not in rpc_db_store:
                rpc_db_store[identity_key] = (
                    job.get("id") or f"00000000-0000-4000-8000-{len(rpc_db_store) + 1:012d}"
                )
            return rpc_db_store[identity_key]

        client = SupabaseIngestClient(rpc_Transport=mock_rpc_transport)

        # Run pertama
        report1 = execute_ingest_pipeline(
            [failed_source, valid_feed],
            client=client,
            dry_run=False,
        )
        self.assertEqual(len(report1.sources_failed), 1)
        self.assertEqual(len(report1.sources_succeeded), 1)
        count_after_first_run = len(rpc_db_store)
        self.assertEqual(count_after_first_run, len(valid_feed.payloads))

        # Run kedua (menguji idempotensi: menjalankan ulang tidak menggandakan data di DB)
        report2 = execute_ingest_pipeline(
            [failed_source, valid_feed],
            client=client,
            dry_run=False,
        )
        self.assertEqual(
            len(rpc_db_store),
            count_after_first_run,
            "Menjalankan ulang ingest dengan sumber yang sama tidak boleh menggandakan lowongan",
        )
        self.assertEqual(
            [r.job_uuid for r in report1.ingested_records],
            [r.job_uuid for r in report2.ingested_records],
        )


if __name__ == "__main__":
    unittest.main()
