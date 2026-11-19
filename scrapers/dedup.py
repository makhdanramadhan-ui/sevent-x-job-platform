"""
Deduplikasi konservatif untuk pipeline lowongan kerja SEVENT X.

Prinsip:
1. Idempotensi per sumber dijaga oleh pasangan (source.name, source.job_id).
2. Deduplikasi lintas sumber bersifat KONSERVATIF:
   - Posisi sama di perusahaan sama BELUM TENTU satu lowongan (bisa berbeda cabang/lokasi,
     berbeda level, berbeda tipe kontrak, atau salah satu atributnya belum diketahui).
   - Dua entri dari sumber berbeda hanya ditautkan ke satu job_id yang sama jika
     seluruh atribut pembeda utama (title, company, location, work_mode,
     employment_type, level) diketahui (bukan unknown/kosong) dan identik,
     dan keduanya tetap dikirim ke ingest_job(jsonb) dengan job.id yang sama
     agar semua rujukan sumber di tabel job_sources tetap dipertahankan.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


def _canon_text(value: Optional[str]) -> str:
    if not value or not isinstance(value, str):
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", value.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def build_conservative_cross_source_key(payload: Dict[str, Any]) -> Optional[str]:
    """
    Menghasilkan kunci deduplikasi lintas sumber HANYA JIKA informasi pembeda lengkap.
    Mengembalikan None apabila lokasi, mode kerja, tipe kontrak, atau level masih 'unknown'/kosong,
    sehingga lowongan tidak digabung secara spekulatif.
    """
    job = payload.get("job") or {}
    title = _canon_text(job.get("title"))
    company = _canon_text(job.get("company"))
    location = _canon_text(job.get("location"))
    work_mode = (job.get("work_mode") or "unknown").strip().lower()
    employment_type = (job.get("employment_type") or "unknown").strip().lower()
    level = (job.get("level") or "unknown").strip().lower()
    deadline = (job.get("deadline") or "").strip()

    if not title or not company:
        return None

    # Konservatif: jangan gabungkan lintas sumber jika atribut krusial tidak diketahui
    if work_mode == "unknown" or employment_type == "unknown" or level == "unknown":
        return None

    if not location and work_mode != "remote":
        return None

    loc_part = location if location else "remote_unrestricted"
    return f"{title}|{company}|{loc_part}|{work_mode}|{employment_type}|{level}|{deadline}"


class ConservativeDeduplicator:
    """
    Melacak identitas sumber (source.name, source.job_id) dan kunci lintas sumber konservatif
    selama satu siklus ingest agar:
    - Entri duplikat persis dari sumber yang sama dalam satu batch tidak dikirim berulang,
    - Entri lintas sumber yang terverifikasi merujuk lowongan yang sama dapat ditautkan
      ke UUID lowongan pertama (job.id) sehingga RPC ingest_job tetap mencatat semua job_sources.
    """

    def __init__(self) -> None:
        self._source_identity_to_uuid: Dict[Tuple[str, str], Optional[str]] = {}
        self._cross_source_to_uuid: Dict[str, str] = {}
        self._cross_source_first_source: Dict[str, Tuple[str, str]] = {}

    def has_seen_source_identity(self, source_name: str, source_job_id: str) -> bool:
        key = (source_name.strip(), source_job_id.strip())
        return key in self._source_identity_to_uuid

    def resolve_existing_job_id(self, payload: Dict[str, Any]) -> Optional[str]:
        src = payload.get("source") or {}
        source_name = (src.get("name") or "").strip()
        source_job_id = (src.get("job_id") or "").strip()
        src_key = (source_name, source_job_id)

        if src_key in self._source_identity_to_uuid:
            return self._source_identity_to_uuid[src_key]

        cross_key = build_conservative_cross_source_key(payload)
        if cross_key and cross_key in self._cross_source_to_uuid:
            return self._cross_source_to_uuid[cross_key]

        return None

    def register_ingested(self, payload: Dict[str, Any], job_uuid: Optional[str]) -> None:
        src = payload.get("source") or {}
        source_name = (src.get("name") or "").strip()
        source_job_id = (src.get("job_id") or "").strip()
        src_key = (source_name, source_job_id)

        self._source_identity_to_uuid[src_key] = job_uuid

        if job_uuid:
            cross_key = build_conservative_cross_source_key(payload)
            if cross_key and cross_key not in self._cross_source_to_uuid:
                self._cross_source_to_uuid[cross_key] = job_uuid
                self._cross_source_first_source[cross_key] = src_key


def deduplicate_batch_in_memory(payloads: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Memisahkan batch payload sebelum ingest:
    - Mengeliminasi duplikat identik dari sumber yang sama (source.name + source.job_id sama persis dalam 1 batch).
    - Mempertahankan lowongan lintas sumber (karena semua rujukan sumber harus tetap disimpan di job_sources).
    Mengembalikan (unique_payloads, skipped_same_source_duplicates).
    """
    seen_identities: set[Tuple[str, str]] = set()
    accepted: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []

    for item in payloads:
        src = item.get("source") or {}
        identity = ((src.get("name") or "").strip(), (src.get("job_id") or "").strip())
        if identity in seen_identities:
            skipped.append(item)
            continue
        seen_identities.add(identity)
        accepted.append(item)

    return accepted, skipped
