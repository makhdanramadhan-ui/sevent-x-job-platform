"""
Klien RPC Supabase untuk memanggil public.ingest_job(payload jsonb) menggunakan service_role.

Aturan kontrak:
- Jangan insert langsung ke tabel jobs atau job_sources; seluruh penulisan wajib lewat RPC ingest_job.
- Sumber yang gagal dicatat terpisah dan TIDAK menyebabkan lowongan valid dihapus
  atau ditandai closed.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .dedup import ConservativeDeduplicator, deduplicate_batch_in_memory
from .normalizer import is_placeholder_logo_url
from .sources import SourceFetchResult


@dataclass
class IngestedRecord:
    source_name: str
    source_job_id: str
    job_uuid: str
    title: str
    company: str
    linked_existing_job: bool = False


@dataclass
class IngestRunReport:
    started_at: str
    finished_at: str
    dry_run: bool
    sources_succeeded: List[str] = field(default_factory=list)
    sources_failed: List[Dict[str, Optional[str]]] = field(default_factory=list)
    ingested_records: List[IngestedRecord] = field(default_factory=list)
    skipped_same_source_duplicates: int = 0
    ingest_errors: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "dry_run": self.dry_run,
            "summary": {
                "sources_succeeded_count": len(self.sources_succeeded),
                "sources_failed_count": len(self.sources_failed),
                "jobs_ingested_count": len(self.ingested_records),
                "skipped_same_source_duplicates": self.skipped_same_source_duplicates,
                "ingest_errors_count": len(self.ingest_errors),
            },
            "sources_succeeded": self.sources_succeeded,
            "sources_failed": self.sources_failed,
            "ingested_records": [
                {
                    "source_name": r.source_name,
                    "source_job_id": r.source_job_id,
                    "job_uuid": r.job_uuid,
                    "title": r.title,
                    "company": r.company,
                    "linked_existing_job": r.linked_existing_job,
                }
                for r in self.ingested_records
            ],
            "ingest_errors": self.ingest_errors,
        }


class SupabaseIngestClient:
    """
    Memanggil RPC public.ingest_job(payload jsonb) via PostgREST endpoint:
    POST {supabase_url}/rest/v1/rpc/ingest_job
    """

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        timeout: float = 15.0,
        rpc_Transport: Optional[Callable[[Dict[str, Any]], str]] = None,
    ) -> None:
        self.supabase_url = (
            supabase_url
            or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
            or os.environ.get("SUPABASE_URL")
            or ""
        ).rstrip("/")
        self.service_role_key = (
            service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        ).strip()
        self.timeout = timeout
        self._custom_transport = rpc_Transport

    def is_configured(self) -> bool:
        if self._custom_transport is not None:
            return True
        return bool(
            self.supabase_url
            and self.service_role_key
            and "your-project-ref" not in self.supabase_url
            and "replace-with" not in self.service_role_key
        )

    def call_ingest_job(self, payload: Dict[str, Any]) -> str:
        """
        Memanggil RPC ingest_job(payload) dan mengembalikan UUID lowongan (string).
        """
        if self._custom_transport is not None:
            return self._custom_transport(payload)

        if not self.is_configured():
            raise RuntimeError(
                "Konfigurasi Supabase service_role belum lengkap. "
                "Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia."
            )

        endpoint = f"{self.supabase_url}/rest/v1/rpc/ingest_job"
        body_bytes = json.dumps({"payload": payload}).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

        try:
            import httpx  # type: ignore

            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(endpoint, content=body_bytes, headers=headers)
                if resp.status_code >= 400:
                    raise RuntimeError(
                        f"RPC ingest_job gagal (HTTP {resp.status_code}): {resp.text}"
                    )
                result = resp.json()
        except ImportError:
            req = urllib.request.Request(endpoint, data=body_bytes, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    raw = response.read().decode("utf-8")
                    result = json.loads(raw)
            except urllib.error.HTTPError as err:
                err_body = err.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"RPC ingest_job gagal (HTTP {err.code}): {err_body}") from err

        if isinstance(result, str) and result.strip():
            return result.strip()
        raise RuntimeError(f"Respons RPC ingest_job tidak mengembalikan UUID valid: {result!r}")

    def _rest_get_json(self, path_and_query: str) -> Any:
        if not self.is_configured():
            raise RuntimeError(
                "Konfigurasi Supabase service_role belum lengkap. "
                "Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia."
            )

        endpoint = f"{self.supabase_url}/rest/v1/{path_and_query.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

        try:
            import httpx  # type: ignore

            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(endpoint, headers=headers)
                if resp.status_code >= 400:
                    raise RuntimeError(f"GET {path_and_query} gagal (HTTP {resp.status_code}): {resp.text}")
                return resp.json()
        except ImportError:
            req = urllib.request.Request(endpoint, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    raw = response.read().decode("utf-8")
                    return json.loads(raw)
            except urllib.error.HTTPError as err:
                err_body = err.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"GET {path_and_query} gagal (HTTP {err.code}): {err_body}") from err

    def fetch_existing_company_logo_map(self) -> Dict[str, str]:
        rows = self._rest_get_json(
            "jobs?company_logo_url=not.is.null&select=company,company_logo_url&limit=500"
        )
        logo_map: Dict[str, str] = {}
        if not isinstance(rows, list):
            return logo_map
        for row in rows:
            if not isinstance(row, dict):
                continue
            company = str(row.get("company") or "").strip().lower()
            logo_url = str(row.get("company_logo_url") or "").strip()
            if company and logo_url and not is_placeholder_logo_url(logo_url):
                logo_map.setdefault(company, logo_url)
        return logo_map

    def fetch_jobs_missing_logo(self, limit: int = 200) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(limit, 500))
        rows = self._rest_get_json(
            f"jobs?company_logo_url=is.null&select=id,title,company,job_sources(source_name,source_job_id,source_url,published_at)&order=last_fetched_at.desc.nullslast&limit={safe_limit}"
        )
        return rows if isinstance(rows, list) else []

    def fetch_jobs_for_detail_backfill(self, limit: int = 200) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(limit, 500))
        rows = self._rest_get_json(
            f"jobs?select=id,title,company,company_logo_url,location,work_mode,level,education,description,skills,job_sources(source_name,source_job_id,source_url,published_at)&order=last_fetched_at.desc.nullslast&limit={safe_limit}"
        )
        return rows if isinstance(rows, list) else []


def execute_ingest_pipeline(
    source_results: List[SourceFetchResult],
    *,
    client: Optional[SupabaseIngestClient] = None,
    dry_run: bool = True,
) -> IngestRunReport:
    """
    Menjalankan proses deduplikasi konservatif dan pengiriman ke RPC ingest_job
    untuk daftar hasil pengambilan sumber (SourceFetchResult).
    Sumber yang berstatus FAILED dicatat secara transparan tanpa menghapus atau
    menutup lowongan yang sudah ada.
    """
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    report = IngestRunReport(
        started_at=started_at,
        finished_at=started_at,
        dry_run=dry_run,
    )

    deduplicator = ConservativeDeduplicator()
    all_raw_payloads: List[Dict[str, Any]] = []

    for res in source_results:
        if res.payloads:
            all_raw_payloads.extend(res.payloads)
            report.sources_succeeded.append(res.source_name)
        if res.status in {"FAILED", "BLOCKED"}:
            report.sources_failed.append(
                {
                    "source_name": res.source_name,
                    "status": res.status,
                    "reason": res.reason,
                    "failed_at": res.fetched_at,
                }
            )

    unique_payloads, skipped_dups = deduplicate_batch_in_memory(all_raw_payloads)
    report.skipped_same_source_duplicates = len(skipped_dups)

    deterministic_counter = 1
    for item in unique_payloads:
        src = item.get("source") or {}
        job = item.get("job") or {}
        source_name = str(src.get("name") or "")
        source_job_id = str(src.get("job_id") or "")

        existing_uuid = deduplicator.resolve_existing_job_id(item)
        linked_existing = False
        payload_to_send = {
            "source": dict(src),
            "job": dict(job),
        }
        if existing_uuid:
            payload_to_send["job"]["id"] = existing_uuid
            linked_existing = True

        try:
            if dry_run:
                assigned_uuid = (
                    existing_uuid
                    or f"00000000-0000-4000-8000-{deterministic_counter:012d}"
                )
                if not existing_uuid:
                    deterministic_counter += 1
            else:
                if client is None:
                    client = SupabaseIngestClient()
                assigned_uuid = client.call_ingest_job(payload_to_send)

            deduplicator.register_ingested(payload_to_send, assigned_uuid)
            report.ingested_records.append(
                IngestedRecord(
                    source_name=source_name,
                    source_job_id=source_job_id,
                    job_uuid=assigned_uuid,
                    title=str(job.get("title") or ""),
                    company=str(job.get("company") or ""),
                    linked_existing_job=linked_existing,
                )
            )
        except Exception as exc:
            report.ingest_errors.append(
                {
                    "source_name": source_name,
                    "source_job_id": source_job_id,
                    "error": str(exc),
                }
            )

    report.finished_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return report
