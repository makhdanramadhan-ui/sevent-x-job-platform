"""
Konektor sumber lowongan kerja SEVENT X (Anggota 3).

Sumber Aktif untuk Live Ingest:
1. LinkedIn Public Guest Jobs (linkedin_guest) - Pencarian berdasarkan tag/keyword pekerjaan di Indonesia
2. Himalayas Public Jobs API (himalayas_api) - https://himalayas.app/jobs/api
3. Jobicy Public Remote Jobs API (jobicy_api) - https://jobicy.com/api/v2/remote-jobs
4. Remotive Public Jobs API (remotive_api) - https://remotive.com/api/remote-jobs

Catatan:
- fetch_verified_partner_feed() (scrapers/data/verified_jobs_feed.json) hanya digunakan
  untuk unit test deterministik offline dan TIDAK dikirim ke database pada mode --live.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .normalizer import build_ingest_payload, is_placeholder_logo_url, strip_html

USER_AGENT = "SeventX-JobPlatform-Ingest/1.0 (+https://github.com/makhdanramadhan-ui/sevent-x-job-platform)"
BROWSER_LIKE_ACCEPT_LANGUAGE = "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"


@dataclass
class SourceFetchResult:
    source_name: str
    status: str  # 'OK' | 'BLOCKED' | 'FAILED'
    payloads: List[Dict[str, Any]] = field(default_factory=list)
    reason: Optional[str] = None
    fetched_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )


def _http_get_json(url: str, headers: Optional[Dict[str, str]] = None, timeout: float = 15.0) -> Any:
    req_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    try:
        import httpx  # type: ignore

        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url, headers=req_headers)
            resp.raise_for_status()
            return resp.json()
    except ImportError:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)


def _http_get_text(url: str, headers: Optional[Dict[str, str]] = None, timeout: float = 15.0) -> Tuple[int, str, str]:
    """
    Mengambil teks/HTML dari URL. Mengembalikan (status_code, final_url, body_text).
    """
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": BROWSER_LIKE_ACCEPT_LANGUAGE,
    }
    if headers:
        req_headers.update(headers)

    try:
        import httpx  # type: ignore

        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url, headers=req_headers)
            return resp.status_code, str(resp.url), resp.text
    except ImportError:
        req = urllib.request.Request(url, headers=req_headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status_code = getattr(response, "status", 200)
                final_url = response.geturl()
                body = response.read().decode("utf-8", errors="replace")
                return status_code, final_url, body
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8", errors="replace") if err.fp else ""
            return err.code, url, err_body


def _extract_html_attr(tag: str, attr_name: str) -> Optional[str]:
    pattern = re.compile(rf"\b{re.escape(attr_name)}\s*=\s*(?:\"([^\"]*)\"|'([^']*)')", re.IGNORECASE)
    match = pattern.search(tag)
    if not match:
        return None
    raw_val = match.group(1) if match.group(1) is not None else match.group(2)
    return html.unescape(raw_val).strip() if raw_val else None


def _extract_linkedin_logo_url(raw_html: str) -> Optional[str]:
    if not raw_html or not raw_html.strip():
        return None
    img_tags = re.findall(r"<img\b[^>]*>", raw_html, re.IGNORECASE | re.DOTALL)
    fallback: Optional[str] = None

    for tag in img_tags:
        class_attr = (_extract_html_attr(tag, "class") or "").lower()
        candidates = (
            _extract_html_attr(tag, "data-delayed-url"),
            _extract_html_attr(tag, "src"),
        )
        for raw_url in candidates:
            if not raw_url:
                continue
            cleaned = raw_url.strip()
            if is_placeholder_logo_url(cleaned):
                continue
            is_priority = (
                "media.licdn.com/dms/image/" in cleaned.lower()
                or "artdeco-entity-image" in class_attr
                or "company" in class_attr
            )
            if is_priority:
                return cleaned
            if fallback is None:
                fallback = cleaned

    return fallback


def parse_linkedin_guest_search_html(raw_html: str) -> List[Dict[str, Optional[str]]]:
    """
    Mengekstrak kartu lowongan dari HTML endpoint publik LinkedIn:
    /jobs-guest/jobs/api/seeMoreJobPostings/search
    Menggunakan regex/HTML parser yang deterministik (tidak bergantung pada library eksternal).
    """
    cards: List[Dict[str, Optional[str]]] = []
    if not raw_html or not raw_html.strip():
        return cards

    # Pecah per blok <li> atau <div ... data-entity-urn="urn:li:jobPosting:...">
    blocks = re.split(r"(?=<li\b|<div[^>]+data-entity-urn=\"urn:li:jobPosting:)", raw_html)
    seen_ids: set[str] = set()

    for block in blocks:
        urn_match = re.search(r"urn:li:jobPosting:(\d+)", block)
        if not urn_match:
            continue
        job_id = urn_match.group(1).strip()
        if not job_id or job_id in seen_ids:
            continue

        title_match = re.search(
            r"<h3[^>]*class=\"[^\"]*base-search-card__title[^\"]*\"[^>]*>(.*?)</h3>",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        company_match = re.search(
            r"<h4[^>]*class=\"[^\"]*base-search-card__subtitle[^\"]*\"[^>]*>(.*?)</h4>",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        location_match = re.search(
            r"<span[^>]*class=\"[^\"]*job-search-card__location[^\"]*\"[^>]*>(.*?)</span>",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        url_match = re.search(
            r"<a[^>]*class=\"[^\"]*base-(?:search-)?card__full-link[^\"]*\"[^>]*href=\"([^\"]+)\"",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        time_match = re.search(
            r"<time[^>]*datetime=\"([^\"]+)\"",
            block,
            re.DOTALL | re.IGNORECASE,
        )
        logo_url = _extract_linkedin_logo_url(block)

        title = strip_html(html.unescape(title_match.group(1))) if title_match else None
        company = strip_html(html.unescape(company_match.group(1))) if company_match else None
        location = strip_html(html.unescape(location_match.group(1))) if location_match else None

        if not title or not company:
            continue

        raw_url = html.unescape(url_match.group(1)).strip() if url_match else ""
        # Bersihkan query tracking panjang dari URL LinkedIn agar kanonik
        clean_url = raw_url.split("?")[0] if raw_url.startswith("http") else f"https://www.linkedin.com/jobs/view/{job_id}"
        published_at = time_match.group(1).strip() if time_match else None

        seen_ids.add(job_id)
        cards.append(
            {
                "job_id": job_id,
                "title": title,
                "company": company,
                "location": location,
                "url": clean_url,
                "published_at": published_at,
                "logo_url": logo_url,
            }
        )

    return cards


def _extract_balanced_div_inner(raw_html: str, open_div_pattern: str) -> Optional[str]:
    open_match = re.search(open_div_pattern, raw_html, re.DOTALL | re.IGNORECASE)
    if not open_match:
        return None
    content_start = open_match.end()
    depth = 1
    for tag_match in re.finditer(r"</?div\b[^>]*>", raw_html[content_start:], re.IGNORECASE):
        tag_lower = tag_match.group(0).lower()
        if tag_lower.startswith("</div"):
            depth -= 1
            if depth == 0:
                return raw_html[content_start : content_start + tag_match.start()]
        elif not tag_lower.endswith("/>"):
            depth += 1
    fallback = re.search(r"(.*?)</div>", raw_html[content_start:], re.DOTALL | re.IGNORECASE)
    return fallback.group(1) if fallback else None


def parse_linkedin_guest_detail_html(raw_html: str) -> Dict[str, Optional[str]]:
    """
    Mengekstrak deskripsi, level senioritas, tipe pekerjaan, dan logo dari halaman detail publik LinkedIn:
    /jobs-guest/jobs/api/jobPosting/<job_id>
    """
    result: Dict[str, Optional[str]] = {
        "description": None,
        "level": None,
        "employment_type": None,
        "logo_url": None,
    }
    if not raw_html or not raw_html.strip():
        return result

    result["logo_url"] = _extract_linkedin_logo_url(raw_html)

    desc_inner = _extract_balanced_div_inner(
        raw_html,
        r"<div[^>]*class=\"[^\"]*show-more-less-html__markup[^\"]*\"[^>]*>",
    )
    if desc_inner:
        result["description"] = strip_html(html.unescape(desc_inner))

    criteria_items = re.findall(
        r"<li[^>]*class=\"[^\"]*description__job-criteria-item[^\"]*\"[^>]*>(.*?)</li>",
        raw_html,
        re.DOTALL | re.IGNORECASE,
    )
    for item_html in criteria_items:
        header_m = re.search(
            r"<h3[^>]*class=\"[^\"]*description__job-criteria-subheader[^\"]*\"[^>]*>(.*?)</h3>",
            item_html,
            re.DOTALL | re.IGNORECASE,
        )
        value_m = re.search(
            r"<span[^>]*class=\"[^\"]*description__job-criteria-text[^\"]*\"[^>]*>(.*?)</span>",
            item_html,
            re.DOTALL | re.IGNORECASE,
        )
        if not header_m or not value_m:
            continue
        header_text = (strip_html(html.unescape(header_m.group(1))) or "").lower()
        value_text = strip_html(html.unescape(value_m.group(1)))
        if "seniority" in header_text or "tingkat" in header_text:
            result["level"] = value_text
        elif "employment" in header_text or "jenis pekerjaan" in header_text:
            result["employment_type"] = value_text

    return result


def fetch_linkedin_guest_jobs(
    keywords: Sequence[str] = ("frontend developer", "backend engineer", "akuntansi", "digital marketing"),
    location: str = "Indonesia",
    limit_per_keyword: int = 3,
    fetch_detail: bool = True,
    delay_seconds: float = 1.5,
    reference_date: Optional[str] = None,
) -> SourceFetchResult:
    """
    Mengambil lowongan dari halaman publik LinkedIn berdasarkan tag/keyword pekerjaan tanpa login.
    Jika mendeteksi HTTP 429/999, authwall, atau CAPTCHA, segera berhenti secara sopan
    dan melaporkan status BLOCKED.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payloads: List[Dict[str, Any]] = []
    seen_job_ids: set[str] = set()
    detail_blocked = False

    for idx, kw in enumerate(keywords):
        clean_kw = kw.strip()
        if not clean_kw:
            continue
        if idx > 0 and delay_seconds > 0:
            time.sleep(delay_seconds)

        query_str = urllib.parse.urlencode(
            {
                "keywords": clean_kw,
                "location": location,
                "start": 0,
            }
        )
        search_url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{query_str}"

        try:
            status_code, final_url, body_html = _http_get_text(search_url)
        except Exception as exc:
            return SourceFetchResult(
                source_name="linkedin_guest",
                status="FAILED",
                payloads=payloads,
                fetched_at=now_iso,
                reason=f"Gagal menghubungi endpoint publik LinkedIn untuk tag '{clean_kw}': {exc}",
            )

        if status_code in {429, 999} or "authwall" in final_url.lower():
            return SourceFetchResult(
                source_name="linkedin_guest",
                status="BLOCKED",
                payloads=payloads,
                fetched_at=now_iso,
                reason=(
                    f"LinkedIn membatasi akses otomatis (HTTP {status_code}, url={final_url}). "
                    "Scraper berhenti sesuai pengaman tanpa melakukan bypass."
                ),
            )

        if status_code >= 400:
            return SourceFetchResult(
                source_name="linkedin_guest",
                status="FAILED",
                payloads=payloads,
                fetched_at=now_iso,
                reason=f"HTTP {status_code} saat mengambil pencarian LinkedIn untuk tag '{clean_kw}'",
            )

        cards = parse_linkedin_guest_search_html(body_html)
        if not cards and ("g-recaptcha" in body_html.lower() or "security verification" in body_html.lower()):
            return SourceFetchResult(
                source_name="linkedin_guest",
                status="BLOCKED",
                payloads=payloads,
                fetched_at=now_iso,
                reason="LinkedIn menampilkan halaman verifikasi keamanan/CAPTCHA. Scraper berhenti.",
            )
        for card in cards[: max(1, limit_per_keyword)]:
            job_id = card.get("job_id") or ""
            if not job_id or job_id in seen_job_ids:
                continue
            seen_job_ids.add(job_id)

            detail_info: Dict[str, Optional[str]] = {
                "description": None,
                "level": None,
                "employment_type": None,
                "logo_url": None,
            }
            if fetch_detail and not detail_blocked:
                if delay_seconds > 0:
                    time.sleep(min(1.0, delay_seconds))
                detail_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
                try:
                    d_status, d_url, d_html = _http_get_text(detail_url)
                    if d_status in {429, 999} or "authwall" in d_url.lower():
                        detail_blocked = True
                    elif d_status == 200:
                        detail_info = parse_linkedin_guest_detail_html(d_html)
                except Exception:
                    pass

            raw_desc = detail_info.get("description") or f"Lowongan {card.get('title')} di {card.get('company')} (tag pencarian: {clean_kw})."

            payload = build_ingest_payload(
                source_name="linkedin_guest",
                source_job_id=job_id,
                source_url=card.get("url") or f"https://www.linkedin.com/jobs/view/{job_id}",
                title=card.get("title") or "",
                company=card.get("company") or "",
                company_logo_url=card.get("logo_url") or detail_info.get("logo_url"),
                fetched_at=now_iso,
                published_at=card.get("published_at"),
                location=card.get("location"),
                work_mode=None,
                employment_type=detail_info.get("employment_type") or "full_time",
                level=detail_info.get("level"),
                description=raw_desc,
                skills=[clean_kw],
                status="open",
                reference_date=reference_date,
            )
            payloads.append(payload)

    return SourceFetchResult(
        source_name="linkedin_guest",
        status="OK",
        payloads=payloads,
        fetched_at=now_iso,
    )


def fetch_himalayas_public_api(
    limit: int = 10,
    offset: int = 0,
    reference_date: Optional[str] = None,
) -> SourceFetchResult:
    """
    Sumber Alternatif 1: Himalayas Public Jobs API (https://himalayas.app/jobs/api)
    Mencakup lowongan lintas bidang (Design, Marketing, Sales, Finance, Operations,
    Customer Support, HR, Engineering) lengkap dengan level, lokasi, dan kategori.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    count = max(1, min(limit, 50))
    safe_offset = max(0, offset)
    url = (
        f"https://himalayas.app/jobs/api?limit={count}&offset={safe_offset}"
        if safe_offset > 0
        else f"https://himalayas.app/jobs/api?limit={count}"
    )

    try:
        data = _http_get_json(url)
        jobs_raw = data.get("jobs", []) if isinstance(data, dict) else []
        payloads: List[Dict[str, Any]] = []

        for item in jobs_raw[:limit]:
            if not isinstance(item, dict):
                continue
            source_url = str(item.get("applicationLink") or item.get("guid") or "").strip()
            title = str(item.get("title") or "").strip()
            company = str(item.get("companyName") or "").strip()
            if not (source_url and title and company):
                continue

            job_id = str(
                item.get("guid")
                or hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:24]
            ).strip()[-200:]

            loc_restrictions = item.get("locationRestrictions")
            if isinstance(loc_restrictions, list) and loc_restrictions:
                location_str = ", ".join(str(x) for x in loc_restrictions if x)[:120]
            else:
                location_str = "Remote"

            seniority = item.get("seniority")
            if isinstance(seniority, list) and seniority:
                level_raw = str(seniority[0])
            elif isinstance(seniority, str):
                level_raw = seniority
            else:
                level_raw = None

            categories = item.get("categories") if isinstance(item.get("categories"), list) else []
            cat_skills = [str(c).replace("-", " ").strip() for c in categories if c]
            logo_url = str(item.get("companyLogo") or "").strip()

            payload = build_ingest_payload(
                source_name="himalayas_api",
                source_job_id=job_id,
                source_url=source_url,
                title=title,
                company=company,
                company_logo_url=logo_url or None,
                fetched_at=now_iso,
                published_at=item.get("pubDate"),
                location=location_str,
                work_mode="remote",
                employment_type=str(item.get("employmentType") or "full_time"),
                level=level_raw,
                description=str(item.get("description") or item.get("excerpt") or ""),
                skills=cat_skills,
                status="open",
                reference_date=reference_date,
            )
            payloads.append(payload)

        return SourceFetchResult(
            source_name="himalayas_api",
            status="OK",
            payloads=payloads,
            fetched_at=now_iso,
        )
    except Exception as exc:
        return SourceFetchResult(
            source_name="himalayas_api",
            status="FAILED",
            payloads=[],
            fetched_at=now_iso,
            reason=f"Gagal mengambil dari Himalayas Public API: {exc}",
        )


def fetch_jobicy_public_api(
    limit: int = 10,
    reference_date: Optional[str] = None,
) -> SourceFetchResult:
    """
    Sumber Alternatif 2: Jobicy Public Remote Jobs API (https://jobicy.com/api/v2/remote-jobs)
    Mencakup lowongan Marketing, Copywriting, Business/Finance, HR, Customer Support,
    Design, Engineering, dan Data Science.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    count = max(1, min(limit, 50))
    url = f"https://jobicy.com/api/v2/remote-jobs?count={count}"

    try:
        data = _http_get_json(url)
        jobs_raw = data.get("jobs", []) if isinstance(data, dict) else []
        payloads: List[Dict[str, Any]] = []

        for item in jobs_raw[:limit]:
            if not isinstance(item, dict):
                continue
            job_id = str(item.get("id") or "").strip()
            title = str(item.get("jobTitle") or "").strip()
            company = str(item.get("companyName") or "").strip()
            source_url = str(item.get("url") or "").strip()
            if not (job_id and title and company and source_url):
                continue

            job_types = item.get("jobType")
            if isinstance(job_types, list) and job_types:
                emp_raw = str(job_types[0])
            elif isinstance(job_types, str):
                emp_raw = job_types
            else:
                emp_raw = None

            industries = item.get("jobIndustry")
            skills_hint: List[str] = []
            if isinstance(industries, list):
                skills_hint.extend(str(x) for x in industries if x)
            elif isinstance(industries, str) and industries:
                skills_hint.append(industries)
            logo_url = str(item.get("companyLogo") or "").strip()

            payload = build_ingest_payload(
                source_name="jobicy_api",
                source_job_id=job_id,
                source_url=source_url,
                title=title,
                company=company,
                company_logo_url=logo_url or None,
                fetched_at=now_iso,
                published_at=item.get("pubDate"),
                location=str(item.get("jobGeo") or "Remote"),
                work_mode="remote",
                employment_type=emp_raw,
                level=str(item.get("jobLevel") or ""),
                description=str(item.get("jobDescription") or item.get("jobExcerpt") or ""),
                skills=skills_hint,
                status="open",
                reference_date=reference_date,
            )
            payloads.append(payload)

        return SourceFetchResult(
            source_name="jobicy_api",
            status="OK",
            payloads=payloads,
            fetched_at=now_iso,
        )
    except Exception as exc:
        return SourceFetchResult(
            source_name="jobicy_api",
            status="FAILED",
            payloads=[],
            fetched_at=now_iso,
            reason=f"Gagal mengambil dari Jobicy Public API: {exc}",
        )


def fetch_remotive_public_api(
    limit: int = 10,
    reference_date: Optional[str] = None,
) -> SourceFetchResult:
    """
    Sumber Alternatif 3: Remotive Public API (https://remotive.com/api/remote-jobs)
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    url = f"https://remotive.com/api/remote-jobs?limit={max(1, min(limit, 50))}"

    try:
        data = _http_get_json(url)
        jobs_raw = data.get("jobs", []) if isinstance(data, dict) else []
        payloads: List[Dict[str, Any]] = []

        for item in jobs_raw[:limit]:
            if not isinstance(item, dict):
                continue
            job_id = str(item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            company = str(item.get("company_name") or "").strip()
            source_url = str(item.get("url") or "").strip()
            if not (job_id and title and company and source_url):
                continue

            tags = item.get("tags") if isinstance(item.get("tags"), list) else []
            candidate_loc = str(item.get("candidate_required_location") or "Remote").strip()
            logo_url = str(item.get("company_logo_url") or item.get("company_logo") or "").strip()

            payload = build_ingest_payload(
                source_name="remotive_api",
                source_job_id=job_id,
                source_url=source_url,
                title=title,
                company=company,
                company_logo_url=logo_url or None,
                fetched_at=now_iso,
                published_at=item.get("publication_date"),
                location=candidate_loc,
                work_mode="remote",
                employment_type=str(item.get("job_type") or ""),
                level=None,
                description=str(item.get("description") or ""),
                skills=tags,
                status="open",
                reference_date=reference_date,
            )
            payloads.append(payload)

        return SourceFetchResult(
            source_name="remotive_api",
            status="OK",
            payloads=payloads,
            fetched_at=now_iso,
        )
    except Exception as exc:
        return SourceFetchResult(
            source_name="remotive_api",
            status="FAILED",
            payloads=[],
            fetched_at=now_iso,
            reason=f"Gagal mengambil dari Remotive Public API: {exc}",
        )


def fetch_verified_partner_feed(
    feed_path: Optional[Path] = None,
    reference_date: Optional[str] = None,
) -> SourceFetchResult:
    """
    Fixture lowongan terstruktur lokal (scrapers/data/verified_jobs_feed.json)
    KHUSUS untuk unit test deterministik offline. Tidak dipakai pada mode --live.
    """
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    default_path = Path(__file__).resolve().parent / "data" / "verified_jobs_feed.json"
    target_path = feed_path or default_path

    if not target_path.exists():
        return SourceFetchResult(
            source_name="test_fixture_feed",
            status="FAILED",
            payloads=[],
            fetched_at=now_iso,
            reason=f"File fixture tidak ditemukan: {target_path}",
        )

    try:
        raw_items = json.loads(target_path.read_text(encoding="utf-8"))
        if not isinstance(raw_items, list):
            raise ValueError("Isi file fixture harus berupa JSON array")

        payloads: List[Dict[str, Any]] = []
        for entry in raw_items:
            if not isinstance(entry, dict):
                continue
            payload = build_ingest_payload(
                source_name=str(entry.get("source_name") or "test_fixture_feed"),
                source_job_id=str(entry.get("source_job_id") or ""),
                source_url=str(entry.get("source_url") or ""),
                title=str(entry.get("title") or ""),
                company=str(entry.get("company") or ""),
                fetched_at=now_iso,
                published_at=entry.get("published_at"),
                location=entry.get("location"),
                work_mode=entry.get("work_mode"),
                employment_type=entry.get("employment_type"),
                level=entry.get("level"),
                education=entry.get("education"),
                description=entry.get("description"),
                deadline=entry.get("deadline"),
                skills=entry.get("skills"),
                status=entry.get("status"),
                reference_date=reference_date,
            )
            payloads.append(payload)

        return SourceFetchResult(
            source_name="test_fixture_feed",
            status="OK",
            payloads=payloads,
            fetched_at=now_iso,
        )
    except Exception as exc:
        return SourceFetchResult(
            source_name="test_fixture_feed",
            status="FAILED",
            payloads=[],
            fetched_at=now_iso,
            reason=f"Gagal memproses test fixture feed: {exc}",
        )


def fetch_active_live_sources(
    limit_per_source: int = 5,
    linkedin_keywords: Sequence[str] = (
        "frontend developer",
        "backend developer",
        "akuntansi",
        "digital marketing",
        "human resources",
    ),
    include_linkedin: bool = True,
    reference_date: Optional[str] = None,
) -> List[SourceFetchResult]:
    """
    Mengambil data dari sumber utama yang disepakati:
    1. LinkedIn Public Guest Search berdasarkan tag pekerjaan (opsional/aktif)
    2. 3 Sumber Alternatif Utama: Himalayas, Jobicy, dan Remotive.
    """
    results: List[SourceFetchResult] = []
    if include_linkedin:
        results.append(
            fetch_linkedin_guest_jobs(
                keywords=linkedin_keywords,
                limit_per_keyword=max(1, min(limit_per_source, 5)),
                reference_date=reference_date,
            )
        )
    results.extend(
        [
            fetch_himalayas_public_api(limit=limit_per_source, reference_date=reference_date),
            fetch_jobicy_public_api(limit=limit_per_source, reference_date=reference_date),
            fetch_remotive_public_api(limit=limit_per_source, reference_date=reference_date),
        ]
    )
    return results
