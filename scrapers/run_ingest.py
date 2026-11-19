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
from pathlib import Path
from typing import List

from .ingest_client import SupabaseIngestClient, execute_ingest_pipeline
from .sources import (
    SourceFetchResult,
    fetch_active_live_sources,
    fetch_verified_partner_feed,
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
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parent.parent
    load_env_file_if_exists(repo_root / ".env.local")

    is_dry_run = True if not args.live else args.dry_run
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

    client = SupabaseIngestClient()
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
