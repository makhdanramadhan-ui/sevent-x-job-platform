"""
CLI utama untuk menjalankan pipeline akuisisi & ingest lowongan kerja SEVENT X (Anggota 3).

Sumber Aktif pada Mode Live / Online:
1. linkedin_guest (Pencarian halaman publik LinkedIn berdasarkan tag pekerjaan di Indonesia)
2. himalayas_api  (Himalayas Public Jobs API)
3. jobicy_api     (Jobicy Public Remote Jobs API)
4. remotive_api   (Remotive Public Jobs API)

Contoh penggunaan:
  1. Mode simulasi offline deterministik (menggunakan test fixture lokal):
     py -3 -m scrapers.run_ingest --dry-run

  2. Mode pengambilan langsung dari LinkedIn + 3 sumber alternatif (dry-run):
     py -3 -m scrapers.run_ingest --dry-run --include-live-apis

  3. Mode penulisan nyata ke Supabase lewat RPC ingest_job(jsonb):
     py -3 -m scrapers.run_ingest --live
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .ingest_client import SupabaseIngestClient, execute_ingest_pipeline
from .logo_resolver import resolve_company_logo_from_internet
from .normalizer import (
    clean_description_whitespace,
    is_placeholder_logo_url,
    normalize_education,
    normalize_level,
    normalize_skills,
)
from .sources import (
    SourceFetchResult,
    _http_get_text,
    fetch_active_live_sources,
    fetch_himalayas_public_api,
    fetch_jobicy_public_api,
    fetch_remotive_public_api,
    fetch_verified_partner_feed,
    parse_linkedin_guest_detail_html,
)


def load_env_file_if_exists(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _collect_api_logos(
    fetch_result: SourceFetchResult,
    known_source_logos: Dict[Tuple[str, str], str],
    api_company_logos: Dict[str, str],
) -> None:
    if fetch_result.status != "OK":
        return
    for payload in fetch_result.payloads:
        src = payload.get("source") or {}
        job = payload.get("job") or {}
        src_name = str(src.get("name") or "").strip()
        src_job_id = str(src.get("job_id") or "").strip()
        company_key = str(job.get("company") or "").strip().lower()
        logo_url = str(job.get("company_logo_url") or "").strip()
        if not logo_url or is_placeholder_logo_url(logo_url):
            continue
        if src_name and src_job_id:
            known_source_logos[(src_name, src_job_id)] = logo_url
        if company_key:
            api_company_logos.setdefault(company_key, logo_url)


def run_logo_backfill(
    client: SupabaseIngestClient,
    *,
    dry_run: bool,
    limit: int = 200,
) -> Dict[str, Any]:
    """
    Mengisi ulang company_logo_url pada lowongan di Supabase yang masih NULL,
    dari API publik (Himalayas, Jobicy, Remotive), perusahaan sama di DB, atau detail LinkedIn,
    lewat RPC public.ingest_job(jsonb) tanpa menimpa field existing (skills, deskripsi, dll).
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    known_logos = client.fetch_existing_company_logo_map()
    missing_jobs = client.fetch_jobs_missing_logo(limit=limit)

    needed_sources: set[str] = set()
    missing_himalayas_ids: set[str] = set()
    for job in missing_jobs:
        if not isinstance(job, dict):
            continue
        sources = job.get("job_sources") or []
        if not isinstance(sources, list):
            continue
        for s in sources:
            if not isinstance(s, dict):
                continue
            s_name = str(s.get("source_name") or "").strip()
            s_id = str(s.get("source_job_id") or "").strip()
            if s_name:
                needed_sources.add(s_name)
            if s_name == "himalayas_api" and s_id:
                missing_himalayas_ids.add(s_id)

    known_source_logos: Dict[Tuple[str, str], str] = {}
    api_company_logos: Dict[str, str] = {}

    if "himalayas_api" in needed_sources:
        remaining_himalayas = set(missing_himalayas_ids)
        for off in range(0, 200, 20):
            res = fetch_himalayas_public_api(limit=20, offset=off)
            if res.status != "OK" or not res.payloads:
                break
            _collect_api_logos(res, known_source_logos, api_company_logos)
            for payload in res.payloads:
                s_id = str((payload.get("source") or {}).get("job_id") or "").strip()
                if s_id:
                    remaining_himalayas.discard(s_id)
            if not remaining_himalayas:
                break

    if "jobicy_api" in needed_sources:
        _collect_api_logos(fetch_jobicy_public_api(limit=50), known_source_logos, api_company_logos)

    if "remotive_api" in needed_sources:
        _collect_api_logos(fetch_remotive_public_api(limit=50), known_source_logos, api_company_logos)

    updated: List[Dict[str, str]] = []
    skipped: List[Dict[str, str]] = []
    still_missing: List[Dict[str, str]] = []
    still_missing_by_source: Dict[str, int] = {}
    errors: List[Dict[str, str]] = []
    public_api_count = 0
    reused_count = 0
    linkedin_fetched_count = 0
    internet_fallback_count = 0
    linkedin_blocked = False
    linkedin_calls = 0
    internet_logo_cache: Dict[str, Optional[str]] = {}

    for job in missing_jobs:
        if not isinstance(job, dict):
            continue
        job_id = str(job.get("id") or "")
        title = str(job.get("title") or "").strip()
        company = str(job.get("company") or "").strip()
        sources = job.get("job_sources") or []
        if not isinstance(sources, list):
            sources = []

        valid_sources = [
            s
            for s in sources
            if isinstance(s, dict)
            and s.get("source_name")
            and s.get("source_job_id")
            and s.get("source_url")
        ]
        if not valid_sources or not title or not company:
            skipped.append({"id": job_id, "title": title, "company": company, "reason": "no_valid_source"})
            continue

        chosen_src = next(
            (
                s
                for s in valid_sources
                if (str(s.get("source_name")), str(s.get("source_job_id"))) in known_source_logos
            ),
            None,
        ) or next(
            (s for s in valid_sources if str(s.get("source_name")) == "linkedin_guest"),
            valid_sources[0],
        )

        src_name = str(chosen_src["source_name"])
        src_job_id = str(chosen_src["source_job_id"])
        company_key = company.lower()

        logo_url = known_source_logos.get((src_name, src_job_id))
        fetched_via = "public_api" if logo_url else None

        if not logo_url:
            logo_url = known_logos.get(company_key)
            if logo_url:
                fetched_via = "same_company"

        if not logo_url:
            logo_url = api_company_logos.get(company_key)
            if logo_url:
                fetched_via = "public_api"

        if not logo_url and src_name == "linkedin_guest" and not linkedin_blocked:
            if linkedin_calls > 0:
                time.sleep(1.2)
            linkedin_calls += 1
            detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{src_job_id}"
            try:
                status_code, final_url, body_html = _http_get_text(detail_url)
                if status_code in {429, 999} or "authwall" in final_url.lower():
                    linkedin_blocked = True
                elif status_code == 200:
                    candidate = parse_linkedin_guest_detail_html(body_html).get("logo_url")
                    if candidate and not is_placeholder_logo_url(candidate):
                        logo_url = candidate
                        fetched_via = "linkedin_detail"
            except Exception as exc:
                errors.append({"id": job_id, "company": company, "error": f"linkedin_fetch: {exc}"})

        if not logo_url:
            try:
                candidate = resolve_company_logo_from_internet(
                    company,
                    source_url=str(chosen_src.get("source_url") or ""),
                    cache=internet_logo_cache,
                )
                if candidate and not is_placeholder_logo_url(candidate):
                    logo_url = candidate
                    fetched_via = "internet_fallback"
            except Exception as exc:
                errors.append({"id": job_id, "company": company, "error": f"internet_fallback: {exc}"})

        if not logo_url or is_placeholder_logo_url(logo_url):
            still_missing.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "source_name": src_name,
                }
            )
            still_missing_by_source[src_name] = still_missing_by_source.get(src_name, 0) + 1
            continue

        known_logos[company_key] = logo_url
        if fetched_via == "public_api":
            public_api_count += 1
        elif fetched_via == "same_company":
            reused_count += 1
        elif fetched_via == "linkedin_detail":
            linkedin_fetched_count += 1
        elif fetched_via == "internet_fallback":
            internet_fallback_count += 1

        patch_payload: Dict[str, Any] = {
            "source": {
                "name": src_name,
                "job_id": src_job_id,
                "url": str(chosen_src["source_url"]),
                "fetched_at": now_iso,
            },
            "job": {
                "title": title,
                "company": company,
                "company_logo_url": logo_url,
            },
        }
        try:
            if not dry_run:
                client.call_ingest_job(patch_payload)
            updated.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "source_name": src_name,
                    "via": fetched_via or "unknown",
                    "company_logo_url": logo_url,
                }
            )
        except Exception as exc:
            errors.append({"id": job_id, "company": company, "error": str(exc)})

    return {
        "started_at": now_iso,
        "dry_run": dry_run,
        "summary": {
            "checked": len(missing_jobs),
            "updated": len(updated),
            "updated_from_public_api": public_api_count,
            "reused_from_same_company": reused_count,
            "fetched_from_linkedin": linkedin_fetched_count,
            "fetched_from_internet_fallback": internet_fallback_count,
            "still_missing": len(still_missing),
            "still_missing_by_source": still_missing_by_source,
            "skipped": len(skipped),
            "linkedin_blocked": linkedin_blocked,
            "errors_count": len(errors),
        },
        "updated": updated,
        "still_missing": still_missing,
        "skipped": skipped,
        "errors": errors,
    }


def _is_placeholder_description(desc: Optional[str]) -> bool:
    if not desc or not isinstance(desc, str):
        return True
    cleaned = desc.strip()
    if not cleaned:
        return True
    return cleaned.startswith("Lowongan ") and "(tag pencarian:" in cleaned


def run_detail_and_skill_backfill(
    client: SupabaseIngestClient,
    *,
    dry_run: bool = True,
    limit: int = 200,
) -> Dict[str, Any]:
    """
    Memperbarui lowongan di Supabase yang:
    1. Deskripsinya masih berupa placeholder pencarian ('Lowongan ... (tag pencarian: ...)') atau kosong,
       dengan mengambil ulang detail halaman publik LinkedIn.
    2. Daftar keahlian (skills)-nya belum lengkap karena bug normalizer lama, dengan mengekstrak ulang
       hingga maksimal 10 skill dari raw_skills + title + description.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    jobs = client.fetch_jobs_for_detail_backfill(limit=limit)

    updated: List[Dict[str, Any]] = []
    unchanged_count = 0
    skipped: List[Dict[str, str]] = []
    errors: List[Dict[str, str]] = []
    descriptions_fetched_from_linkedin = 0
    still_placeholder_count = 0
    skills_expanded_count = 0
    linkedin_blocked = False
    linkedin_calls = 0
    consecutive_blocked = 0

    # Urutkan agar lowongan dengan deskripsi placeholder diproses lebih dulu sebelum kuota request LinkedIn terkena 429
    sorted_jobs = sorted(
        [j for j in jobs if isinstance(j, dict)],
        key=lambda j: 0 if _is_placeholder_description(j.get("description")) else 1,
    )

    for job in sorted_jobs:
        job_id = str(job.get("id") or "")
        title = str(job.get("title") or "").strip()
        company = str(job.get("company") or "").strip()
        current_desc = str(job.get("description") or "").strip() or None
        current_level = str(job.get("level") or "unknown").strip()
        current_education = job.get("education")
        current_logo = str(job.get("company_logo_url") or "").strip() or None
        raw_existing_skills = job.get("skills")
        existing_skills: List[str] = (
            [str(s).strip() for s in raw_existing_skills if isinstance(s, str) and str(s).strip()]
            if isinstance(raw_existing_skills, list)
            else []
        )

        sources = job.get("job_sources") or []
        if not isinstance(sources, list):
            sources = []
        valid_sources = [
            s
            for s in sources
            if isinstance(s, dict)
            and s.get("source_name")
            and s.get("source_job_id")
            and s.get("source_url")
        ]
        if not valid_sources or not title or not company:
            skipped.append({"id": job_id, "title": title, "company": company, "reason": "no_valid_source"})
            continue

        chosen_src = next(
            (s for s in valid_sources if str(s.get("source_name")) == "linkedin_guest"),
            valid_sources[0],
        )
        src_name = str(chosen_src["source_name"])
        src_job_id = str(chosen_src["source_job_id"])

        effective_desc = current_desc
        description_updated = False
        new_level: Optional[str] = None
        new_education: Optional[str] = None
        new_logo: Optional[str] = None

        if _is_placeholder_description(current_desc) and src_name == "linkedin_guest" and not linkedin_blocked:
            if linkedin_calls > 0:
                time.sleep(2.0)
            linkedin_calls += 1
            detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{src_job_id}"
            try:
                status_code, final_url, body_html = _http_get_text(detail_url)
                if status_code == 429:
                    time.sleep(4.0)
                    linkedin_calls += 1
                    status_code, final_url, body_html = _http_get_text(detail_url)

                if status_code in {429, 999} or "authwall" in final_url.lower():
                    consecutive_blocked += 1
                    if consecutive_blocked >= 3:
                        linkedin_blocked = True
                elif status_code == 200:
                    consecutive_blocked = 0
                    detail = parse_linkedin_guest_detail_html(body_html)
                    fetched_desc = clean_description_whitespace(detail.get("description"), max_len=20000)
                    if fetched_desc and not _is_placeholder_description(fetched_desc):
                        effective_desc = fetched_desc
                        description_updated = True
                        descriptions_fetched_from_linkedin += 1
                    if current_level in {"", "unknown"} and detail.get("level"):
                        cand_level = normalize_level(detail.get("level"), title_hint=title)
                        if cand_level != "unknown":
                            new_level = cand_level
                    if not current_logo and detail.get("logo_url") and not is_placeholder_logo_url(detail.get("logo_url")):
                        new_logo = str(detail.get("logo_url"))
            except Exception as exc:
                errors.append({"id": job_id, "company": company, "error": f"linkedin_detail: {exc}"})

        if _is_placeholder_description(effective_desc):
            still_placeholder_count += 1

        if not current_education and effective_desc and not _is_placeholder_description(effective_desc):
            cand_edu = normalize_education(None, description_hint=effective_desc)
            if cand_edu:
                new_education = cand_edu

        desc_for_skills = None if _is_placeholder_description(effective_desc) else effective_desc
        combined_lower = f"{title} {desc_for_skills or ''}".lower()
        cleaned_existing_skills = [
            s
            for s in existing_skills
            if not (s == "Express.js" and "express.js" not in combined_lower and "expressjs" not in combined_lower)
        ]
        new_skills = normalize_skills(
            cleaned_existing_skills,
            title_hint=title,
            description_hint=desc_for_skills,
        )
        skills_changed = new_skills != existing_skills

        if not description_updated and not skills_changed and not new_level and not new_education and not new_logo:
            unchanged_count += 1
            continue

        if skills_changed:
            skills_expanded_count += 1

        patch_job: Dict[str, Any] = {
            "title": title,
            "company": company,
            "skills": new_skills,
        }
        if description_updated and effective_desc:
            patch_job["description"] = effective_desc
        if new_level:
            patch_job["level"] = new_level
        if new_education:
            patch_job["education"] = new_education
        if new_logo:
            patch_job["company_logo_url"] = new_logo

        patch_payload: Dict[str, Any] = {
            "source": {
                "name": src_name,
                "job_id": src_job_id,
                "url": str(chosen_src["source_url"]),
                "fetched_at": now_iso,
            },
            "job": patch_job,
        }

        try:
            if not dry_run:
                client.call_ingest_job(patch_payload)
            updated.append(
                {
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "source_name": src_name,
                    "description_updated": description_updated,
                    "old_skills": existing_skills,
                    "new_skills": new_skills,
                }
            )
        except Exception as exc:
            errors.append({"id": job_id, "company": company, "error": str(exc)})

    return {
        "started_at": now_iso,
        "dry_run": dry_run,
        "summary": {
            "checked": len(sorted_jobs),
            "updated": len(updated),
            "descriptions_fetched_from_linkedin": descriptions_fetched_from_linkedin,
            "still_placeholder_descriptions": still_placeholder_count,
            "skills_expanded": skills_expanded_count,
            "unchanged": unchanged_count,
            "skipped": len(skipped),
            "linkedin_calls": linkedin_calls,
            "linkedin_blocked": linkedin_blocked,
            "errors_count": len(errors),
        },
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pipeline akuisisi, normalisasi, deduplikasi, dan ingest lowongan kerja SEVENT X"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Jalankan normalisasi & validasi kontrak tanpa memanggil RPC Supabase",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        default=False,
        help="Ambil lowongan nyata dari LinkedIn + 3 sumber alternatif dan kirim ke Supabase via RPC ingest_job(jsonb)",
    )
    parser.add_argument(
        "--include-live-apis",
        action="store_true",
        default=False,
        help="Ambil data langsung dari LinkedIn + 3 sumber alternatif (Himalayas, Jobicy, Remotive)",
    )
    parser.add_argument(
        "--skip-linkedin",
        action="store_true",
        default=False,
        help="Lewati pengambilan dari halaman publik LinkedIn (hanya ambil dari 3 sumber alternatif)",
    )
    parser.add_argument(
        "--linkedin-keywords",
        type=str,
        default="frontend developer,backend developer,akuntansi,digital marketing,human resources",
        help="Daftar tag/keyword pekerjaan untuk pencarian LinkedIn, dipisahkan koma",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=4,
        help="Batas jumlah lowongan per sumber / per tag (default: 4)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Path file opsional untuk menyimpan laporan JSON hasil eksekusi",
    )
    parser.add_argument(
        "--backfill-logos",
        action="store_true",
        default=False,
        help="Isi ulang company_logo_url pada lowongan di Supabase yang masih kosong lewat RPC ingest_job",
    )
    parser.add_argument(
        "--backfill-details",
        action="store_true",
        default=False,
        help="Isi ulang deskripsi LinkedIn yang masih placeholder dan ekstrak ulang skills (maks 10) lewat RPC ingest_job",
    )
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent
    load_env_file_if_exists(repo_root / ".env.local")

    is_dry_run = True if not args.live else args.dry_run
    client = SupabaseIngestClient()

    if args.backfill_details:
        if not client.is_configured():
            print(
                "ERROR: Mode --backfill-details membutuhkan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY "
                "yang valid di environment atau .env.local.",
                file=sys.stderr,
            )
            return 1
        detail_report = run_detail_and_skill_backfill(
            client,
            dry_run=is_dry_run,
            limit=max(1, min(args.limit if args.limit != 4 else 200, 500)),
        )
        formatted_json = json.dumps(detail_report, indent=2, ensure_ascii=False)
        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(formatted_json, encoding="utf-8")
        print(formatted_json)
        return 0 if len(detail_report.get("errors") or []) == 0 else 1

    if args.backfill_logos:
        if not client.is_configured():
            print(
                "ERROR: Mode --backfill-logos membutuhkan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY "
                "yang valid di environment atau .env.local.",
                file=sys.stderr,
            )
            return 1
        backfill_report = run_logo_backfill(
            client,
            dry_run=is_dry_run,
            limit=max(1, min(args.limit if args.limit != 4 else 200, 500)),
        )
        formatted_json = json.dumps(backfill_report, indent=2, ensure_ascii=False)
        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(formatted_json, encoding="utf-8")
        print(formatted_json)
        return 0 if len(backfill_report.get("errors") or []) == 0 else 1

    use_online_sources = args.live or args.include_live_apis

    keywords = [k.strip() for k in args.linkedin_keywords.split(",") if k.strip()]

    if use_online_sources:
        # Mode --live atau --include-live-apis: HANYA gunakan data nyata dari internet
        # (tidak memasukkan data contoh lokal ke database Supabase).
        results: List[SourceFetchResult] = fetch_active_live_sources(
            limit_per_source=args.limit,
            linkedin_keywords=keywords,
            include_linkedin=not args.skip_linkedin,
        )
    else:
        # Mode --dry-run offline murni (untuk test tanpa internet)
        results = [fetch_verified_partner_feed()]

    if not is_dry_run and not client.is_configured():
        print(
            "ERROR: Mode --live membutuhkan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY "
            "yang valid di environment atau .env.local.",
            file=sys.stderr,
        )
        return 1

    report = execute_ingest_pipeline(results, client=client, dry_run=is_dry_run)
    report_dict = report.to_dict()
    formatted_json = json.dumps(report_dict, indent=2, ensure_ascii=False)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(formatted_json, encoding="utf-8")

    print(formatted_json)
    return 0 if len(report.ingest_errors) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
