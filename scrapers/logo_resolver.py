"""4-tier internet company logo resolver using public company domains, Wikidata P856, and Google Favicons."""

from __future__ import annotations

import json
import re
import struct
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

try:
    import httpx
except ImportError:  # pragma: no cover - optional fallback environment
    httpx = None  # type: ignore[assignment]

from .normalizer import is_placeholder_logo_url

RESOLVER_USER_AGENT = "SeventX-JobPlatform-Ingest/1.0 (https://rakitkarier.vercel.app)"
DEFAULT_TIMEOUT_SECONDS = 4.0

STRIP_SUBDOMAINS = ("www.", "jobs.", "careers.", "career.", "apply.")

# Job boards, ATS platforms, and generic social sites whose hostnames must never
# be mistaken for an employer's own domain.
EXCLUDED_HOST_SUFFIXES = (
    "linkedin.com",
    "himalayas.app",
    "jobicy.com",
    "remotive.com",
    "glints.com",
    "kalibrr.com",
    "jobstreet.com",
    "indeed.com",
    "glassdoor.com",
    "greenhouse.io",
    "lever.co",
    "workable.com",
    "ashbyhq.com",
    "breezy.hr",
    "smartrecruiters.com",
    "icims.com",
    "myworkdayjobs.com",
    "taleo.net",
    "bamboohr.com",
    "recruitee.com",
    "wellfound.com",
    "angel.co",
    "ziprecruiter.com",
    "monster.com",
    "simplyhired.com",
    "remoteok.com",
    "weworkremotely.com",
    "wikidata.org",
    "wikipedia.org",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
)

# Curated fallback domains for Indonesian & global companies frequently seen
# in job feeds without an embedded logo URL.
CURATED_COMPANY_DOMAINS: Dict[str, str] = {
    "traveloka": "traveloka.com",
    "grab": "grab.com",
    "bibit": "bibit.id",
    "bibit.id": "bibit.id",
    "gojek": "gojek.com",
    "goto": "gotocompany.com",
    "tokopedia": "tokopedia.com",
    "shopee": "shopee.co.id",
    "bukalapak": "bukalapak.com",
    "blibli": "blibli.com",
    "tiket.com": "tiket.com",
    "tiket": "tiket.com",
    "ajaib": "ajaib.co.id",
    "kredivo": "kredivo.com",
    "kredivo group": "kredivo.com",
    "xendit": "xendit.co",
    "midtrans": "midtrans.com",
    "dana": "dana.id",
    "ovo": "ovo.id",
    "bca": "bca.co.id",
    "bank bca": "bca.co.id",
    "pt bank central asia": "bca.co.id",
    "pt bank digital bca": "blubybcadigital.id",
    "bca digital": "blubybcadigital.id",
    "blu by bca digital": "blubybcadigital.id",
    "bank mandiri": "bankmandiri.co.id",
    "mandiri": "bankmandiri.co.id",
    "bri": "bri.co.id",
    "bank rakyat indonesia": "bri.co.id",
    "telkom indonesia": "telkom.co.id",
    "telkomsel": "telkomsel.com",
    "ruangguru": "ruangguru.com",
    "halodoc": "halodoc.com",
    "mekari": "mekari.com",
    "dealls": "dealls.com",
    "softwareseni": "softwareseni.co.id",
    "covergo": "covergo.com",
    "halojasa": "halojasa.id",
    "halojasa indonesia": "halojasa.id",
    "edb": "enterprisedb.com",
    "grafana labs": "grafana.com",
    "grafana": "grafana.com",
    "verisk": "verisk.com",
    "bjak": "bjak.com",
    "bcd travel": "bcdtravel.com",
    "alice + olivia": "aliceandolivia.com",
    "alice & olivia": "aliceandolivia.com",
    "altera digital health": "alterahealth.com",
    "vidispine": "vidispine.com",
    "cambium learning group": "cambiumlearning.com",
    "iren": "iren.com",
    "amerit fleet solutions": "ameritfleetsolutions.com",
    "ghost sherpa": "ghostsherpa.com",
    "jpm unternehmensgruppe": "jpm-gruppe.de",
    "xcelirate": "xcelirate.com",
    "optimal growth technologies": "optimalgrowthtech.com",
}

EXPLICIT_DOMAIN_RE = re.compile(
    r"(?<![@/\w])([a-z0-9-]{2,}(?:\.[a-z0-9-]+)*\.[a-z]{2,12})(?![/\w-])",
    re.IGNORECASE,
)
LEGAL_PREFIX_RE = re.compile(r"^(?:pt\.?|cv\.?|yayasan)\s+", re.IGNORECASE)
LEGAL_SUFFIX_RE = re.compile(
    r",?\s*\b(?:pte\.?\s*ltd\.?|co\.?,?\s*ltd\.?|llc|inc\.?|ltd\.?|tbk\.?|gmbh|corp\.?)\b\.?$",
    re.IGNORECASE,
)
WIKIDATA_SKIP_DESC_RE = re.compile(
    r"\b(?:person|human|city|town|village|municipality|country|film|movie|song|album|"
    r"musical\s+group|band|river|mountain|species|taxon|book|novel|television\s+series|"
    r"video\s+game|athlete|politician|actor|actress|singer|writer|footballer)\b",
    re.IGNORECASE,
)
WIKIDATA_COMPANY_HINT_RE = re.compile(
    r"\b(?:company|corporation|bank|startup|enterprise|software|platform|firm|group|"
    r"organization|organisation|airline|hospital|insurer|fintech|e-commerce|technology|"
    r"retailer|developer|agency|business|financial)\b",
    re.IGNORECASE,
)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _strip_subdomains(host: str) -> str:
    cleaned = host.strip().lower().rstrip(".")
    changed = True
    while changed and cleaned:
        changed = False
        for prefix in STRIP_SUBDOMAINS:
            if cleaned.startswith(prefix) and len(cleaned) > len(prefix):
                cleaned = cleaned[len(prefix) :]
                changed = True
                break
    return cleaned


def _is_excluded_domain(host: str) -> bool:
    normalized = _strip_subdomains(host)
    if not normalized or "." not in normalized:
        return True
    return any(
        normalized == suffix or normalized.endswith(f".{suffix}")
        for suffix in EXCLUDED_HOST_SUFFIXES
    )


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def clean_company_name_for_lookup(company: str) -> str:
    """Strip corporate noise, pipe suffixes, and legal forms before public lookup."""
    text = _collapse_ws(company)
    if not text:
        return ""
    if "|" in text:
        text = text.split("|", 1)[0].strip()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = _collapse_ws(text)
    text = LEGAL_PREFIX_RE.sub("", text).strip()
    prev = None
    while text != prev:
        prev = text
        text = LEGAL_SUFFIX_RE.sub("", text).strip(" ,.-")
    return _collapse_ws(text)


def _candidate_curated_keys(company: str) -> list[str]:
    raw = _collapse_ws(company)
    if not raw:
        return []
    candidates: list[str] = [raw]
    if "|" in raw:
        candidates.append(raw.split("|", 1)[0].strip())
    paren_matches = re.findall(r"\(([^)]+)\)", raw)
    no_paren = _collapse_ws(re.sub(r"\([^)]*\)", " ", raw))
    if no_paren:
        candidates.append(no_paren)
    candidates.extend(_collapse_ws(item) for item in paren_matches if _collapse_ws(item))
    cleaned = clean_company_name_for_lookup(raw)
    if cleaned:
        candidates.append(cleaned)

    seen: set[str] = set()
    ordered: list[str] = []
    for item in candidates:
        key = _collapse_ws(item).lower()
        if key and key not in seen:
            seen.add(key)
            ordered.append(key)
    return ordered


def extract_domain_from_company_or_url(
    company: str,
    source_url: Optional[str] = None,
) -> Optional[str]:
    """Tier 1 & Tier 2: derive an employer domain from company text, direct source URL, or curated map."""
    raw_company = _collapse_ws(company)

    # Tier 1a: Explicit domain inside the company name (e.g. Bibit.id, Booking.com).
    for match in EXPLICIT_DOMAIN_RE.finditer(raw_company):
        candidate = _strip_subdomains(match.group(1))
        if not _is_excluded_domain(candidate):
            return candidate

    # Tier 1b: Direct employer source_url (ignoring job boards & hosted ATS providers).
    if source_url:
        try:
            parsed = urlparse(source_url.strip())
            if parsed.scheme in {"http", "https"} and parsed.hostname:
                host = _strip_subdomains(parsed.hostname)
                if not _is_excluded_domain(host):
                    return host
        except ValueError:
            pass

    # Tier 2: Curated Indonesian & global company domain table.
    for key in _candidate_curated_keys(raw_company):
        domain = CURATED_COMPANY_DOMAINS.get(key)
        if domain and not _is_excluded_domain(domain):
            return domain

    return None


def _http_get_bytes(
    url: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    headers: Optional[Dict[str, str]] = None,
) -> tuple[int, Optional[str], bytes]:
    req_headers = {"User-Agent": RESOLVER_USER_AGENT}
    if headers:
        req_headers.update(headers)

    if httpx is not None:
        with httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers=req_headers,
        ) as client:
            response = client.get(url)
            return (
                response.status_code,
                response.headers.get("content-type"),
                response.content,
            )

    req = Request(url, headers=req_headers)
    with urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return (
            resp.getcode() or 200,
            resp.headers.get("Content-Type"),
            resp.read(),
        )


def _extract_wikidata_website_domain(claims: Dict[str, Any]) -> Optional[str]:
    p856_claims = claims.get("P856")
    if not isinstance(p856_claims, list):
        return None
    for claim in p856_claims:
        if not isinstance(claim, dict):
            continue
        mainsnak = claim.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        raw_url = datavalue.get("value")
        if not isinstance(raw_url, str) or not raw_url.strip():
            continue
        parsed = urlparse(raw_url.strip())
        if parsed.scheme in {"http", "https"} and parsed.hostname:
            domain = _strip_subdomains(parsed.hostname)
            if not _is_excluded_domain(domain):
                return domain
    return None


def lookup_domain_via_wikidata(
    company: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Optional[str]:
    """Tier 3: resolve an employer's official website domain via Wikidata P856."""
    query = clean_company_name_for_lookup(company)
    if len(query) < 2:
        return None

    try:
        search_params = urlencode(
            {
                "action": "wbsearchentities",
                "search": query,
                "language": "en",
                "format": "json",
                "limit": "5",
            }
        )
        status, _, body = _http_get_bytes(
            f"https://www.wikidata.org/w/api.php?{search_params}",
            timeout=timeout,
            headers={"Accept": "application/json"},
        )
        if status != 200:
            return None
        search_data = json.loads(body.decode("utf-8"))
        results = search_data.get("search") or []
    except Exception:
        return None

    preferred_ids: list[str] = []
    fallback_ids: list[str] = []
    for item in results:
        if not isinstance(item, dict):
            continue
        qid = item.get("id")
        if not isinstance(qid, str) or not qid.startswith("Q"):
            continue
        desc = str(item.get("description") or "")
        if desc and WIKIDATA_SKIP_DESC_RE.search(desc):
            continue
        if desc and WIKIDATA_COMPANY_HINT_RE.search(desc):
            preferred_ids.append(qid)
        else:
            fallback_ids.append(qid)

    ordered_ids = (preferred_ids + fallback_ids)[:3]
    if not ordered_ids:
        return None

    try:
        entity_params = urlencode(
            {
                "action": "wbgetentities",
                "ids": "|".join(ordered_ids),
                "props": "claims",
                "format": "json",
            }
        )
        status, _, body = _http_get_bytes(
            f"https://www.wikidata.org/w/api.php?{entity_params}",
            timeout=timeout,
            headers={"Accept": "application/json"},
        )
        if status != 200:
            return None
        entities_data = json.loads(body.decode("utf-8"))
        entities = entities_data.get("entities") or {}
    except Exception:
        return None

    for qid in ordered_ids:
        entity = entities.get(qid)
        if not isinstance(entity, dict):
            continue
        claims = entity.get("claims") or {}
        domain = _extract_wikidata_website_domain(claims)
        if domain:
            return domain

    return None


def _is_valid_favicon_bytes(data: bytes, content_type: Optional[str] = None) -> bool:
    """Reject empty/HTML responses and Google S2's 16x16 default globe PNG fallback."""
    if not data:
        return False

    if content_type is not None:
        media_type = content_type.split(";", 1)[0].strip().lower()
        if not media_type.startswith("image/"):
            return False

    prefix = data.lstrip()[:15].lower()
    if prefix.startswith((b"<!doctype", b"<html")):
        return False

    if data[:8] == PNG_SIGNATURE:
        if len(data) < 24:
            return False
        width, height = struct.unpack(">II", data[16:24])
        return width >= 32 and height >= 32

    return len(data) >= 400


def verify_google_favicon_url(
    domain: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Optional[str]:
    """Tier 4: build and verify a Google S2 high-res favicon URL for a domain."""
    cleaned_domain = _strip_subdomains(domain)
    if _is_excluded_domain(cleaned_domain):
        return None

    favicon_url = f"https://www.google.com/s2/favicons?domain={cleaned_domain}&sz=128"
    if len(favicon_url) > 2048 or is_placeholder_logo_url(favicon_url):
        return None

    try:
        status, content_type, body = _http_get_bytes(favicon_url, timeout=timeout)
        if status != 200:
            return None
        if not _is_valid_favicon_bytes(body, content_type):
            return None
        return favicon_url
    except Exception:
        return None


def resolve_company_logo_from_internet(
    company: str,
    source_url: Optional[str] = None,
    cache: Optional[Dict[str, Optional[str]]] = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Optional[str]:
    """Resolve a real company logo URL across curated/direct domains, Wikidata, and Google S2."""
    raw_company = _collapse_ws(company)
    if not raw_company:
        return None

    domain = extract_domain_from_company_or_url(raw_company, source_url=source_url)

    domain_cache_key = f"wikidata:{clean_company_name_for_lookup(raw_company).lower()}"
    if not domain:
        if cache is not None and domain_cache_key in cache:
            domain = cache[domain_cache_key]
        else:
            domain = lookup_domain_via_wikidata(raw_company, timeout=timeout)
            if cache is not None:
                cache[domain_cache_key] = domain

    if not domain:
        return None

    logo_cache_key = f"logo:{domain}"
    if cache is not None and logo_cache_key in cache:
        return cache[logo_cache_key]

    resolved_url = verify_google_favicon_url(domain, timeout=timeout)
    if cache is not None:
        cache[logo_cache_key] = resolved_url
    return resolved_url
