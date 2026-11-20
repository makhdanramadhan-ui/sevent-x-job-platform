"""
Normalisasi data lowongan kerja agar 100% sesuai dengan kontrak RPC public.ingest_job(jsonb)
pada migrasi Supabase (20261117090200_ingest_concurrency.sql) dan lib/contracts.ts.

Aturan ketat kontrak:
- work_mode: 'onsite' | 'hybrid' | 'remote' | 'unknown'
- employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance' | 'temporary' | 'unknown'
- level: 'intern' | 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'unknown'
- status: 'open' | 'closed' | 'unknown'
- source.fetched_at terpisah dari source.published_at; waktu scraper TIDAK pernah dipakai sebagai published_at.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Dict, Iterable, List, Optional, Tuple

VALID_WORK_MODES = frozenset({"onsite", "hybrid", "remote", "unknown"})
VALID_EMPLOYMENT_TYPES = frozenset(
    {"full_time", "part_time", "contract", "internship", "freelance", "temporary", "unknown"}
)
VALID_LEVELS = frozenset({"intern", "entry", "junior", "mid", "senior", "lead", "unknown"})
VALID_STATUSES = frozenset({"open", "closed", "unknown"})

ISO_TIMESTAMP_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$"
)
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://", re.IGNORECASE)
PLACEHOLDER_LOGO_RE = re.compile(
    r"static\.licdn\.com|data:image|ghost|spacer|blank|default-company|entity-ghost",
    re.IGNORECASE,
)


def is_placeholder_logo_url(url: Optional[str]) -> bool:
    if not url or not isinstance(url, str):
        return True
    cleaned = url.strip()
    if not URL_RE.match(cleaned):
        return True
    return bool(PLACEHOLDER_LOGO_RE.search(cleaned))

# Sinonim skill kanonik agar konsisten dengan lib/recommendation/synonyms.ts
SKILL_CANONICAL_DISPLAY: Dict[str, str] = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "py": "Python",
    "python": "Python",
    "python3": "Python",
    "react": "React",
    "reactjs": "React",
    "react.js": "React",
    "next": "Next.js",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "vue": "Vue.js",
    "vuejs": "Vue.js",
    "vue.js": "Vue.js",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "golang": "Go",
    "go": "Go",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "psql": "PostgreSQL",
    "mysql": "MySQL",
    "mongodb": "MongoDB",
    "redis": "Redis",
    "tailwind": "Tailwind CSS",
    "tailwindcss": "Tailwind CSS",
    "tailwind css": "Tailwind CSS",
    "html": "HTML",
    "html5": "HTML",
    "css": "CSS",
    "css3": "CSS",
    "docker": "Docker",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "aws": "AWS",
    "gcp": "GCP",
    "sql": "SQL",
    "git": "Git",
    "rest": "REST API",
    "rest api": "REST API",
    "restful api": "REST API",
    "graphql": "GraphQL",
    "ui/ux": "UI/UX Design",
    "ui/ux design": "UI/UX Design",
    "figma": "Figma",
    # Non-Teknologi
    "akuntansi": "Accounting",
    "accounting": "Accounting",
    "pembukuan": "Accounting",
    "keuangan": "Finance",
    "finance": "Finance",
    "pajak": "Taxation",
    "perpajakan": "Taxation",
    "tax": "Taxation",
    "taxation": "Taxation",
    "brevet pajak": "Taxation",
    "audit": "Audit",
    "auditing": "Audit",
    "pemasaran": "Marketing",
    "marketing": "Marketing",
    "digital marketing": "Digital Marketing",
    "pemasaran digital": "Digital Marketing",
    "seo": "SEO/SEM",
    "sem": "SEO/SEM",
    "social media": "Social Media Management",
    "media sosial": "Social Media Management",
    "copywriting": "Content Writing",
    "content writing": "Content Writing",
    "penulis konten": "Content Writing",
    "penjualan": "Sales",
    "sales": "Sales",
    "business development": "Sales",
    "hr": "Human Resources",
    "hrd": "Human Resources",
    "sdm": "Human Resources",
    "human resources": "Human Resources",
    "rekrutmen": "Recruitment",
    "recruitment": "Recruitment",
    "talent acquisition": "Recruitment",
    "admin": "Administration",
    "administrasi": "Administration",
    "administration": "Administration",
    "data entry": "Administration",
    "customer service": "Customer Service",
    "layanan pelanggan": "Customer Service",
    "operasional": "Operations",
    "operations": "Operations",
    "logistik": "Supply Chain & Logistics",
    "logistics": "Supply Chain & Logistics",
    "supply chain": "Supply Chain & Logistics",
    "project management": "Project Management",
    "manajemen proyek": "Project Management",
    "desain grafis": "Graphic Design",
    "graphic design": "Graphic Design",
    "excel": "Microsoft Excel",
    "ms excel": "Microsoft Excel",
    "microsoft excel": "Microsoft Excel",
    "ms office": "Microsoft Office",
    "microsoft office": "Microsoft Office",
    "komunikasi": "Communication",
    "public speaking": "Communication",
    "communication": "Communication",
    "bahasa inggris": "English",
    "english": "English",
    "hukum": "Legal",
    "legal": "Legal",
}


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: List[str] = []
        self._in_li = False

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if tag == "li":
            self._in_li = True
            self._parts.append("\n• ")
        elif tag in {"p", "h1", "h2", "h3", "h4", "ul", "ol"}:
            if not (self._in_li and tag == "p"):
                self._parts.append("\n\n")
        elif tag in {"br", "div", "tr"}:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "li":
            self._in_li = False
            self._parts.append("\n")
        elif tag in {"p", "h1", "h2", "h3", "h4", "ul", "ol"}:
            if not (self._in_li and tag == "p"):
                self._parts.append("\n\n")
        elif tag in {"div", "tr"}:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        raw = "".join(self._parts)
        normalized_lines: List[str] = []
        for raw_line in raw.splitlines():
            line = re.sub(r"[ \t]+", " ", raw_line).strip()
            line = re.sub(r"^•\s*(?:[•●▪\-*]\s+)+", "• ", line)
            if line == "•":
                continue
            normalized_lines.append(line)
        cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(normalized_lines))
        return cleaned.strip()


def strip_html(raw: Optional[str]) -> Optional[str]:
    if not raw or not isinstance(raw, str):
        return None
    parser = _HTMLTextExtractor()
    parser.feed(raw)
    parser.close()
    text = parser.get_text()
    return text if text else None


def clean_description_whitespace(
    value: Optional[str], max_len: Optional[int] = None
) -> Optional[str]:
    if value is None or not isinstance(value, str):
        return None
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in normalized.split("\n")]
    cleaned = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    if not cleaned:
        return None
    if max_len is not None and len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip()
    return cleaned


def clean_whitespace(value: Optional[str], max_len: Optional[int] = None) -> Optional[str]:
    if value is None or not isinstance(value, str):
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    if not cleaned:
        return None
    if max_len is not None and len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip()
    return cleaned


INDONESIA_CITIES = (
    "jakarta selatan",
    "jakarta pusat",
    "jakarta barat",
    "jakarta timur",
    "jakarta utara",
    "jakarta",
    "dki jakarta",
    "bandung",
    "surabaya",
    "yogyakarta",
    "jogjakarta",
    "jogja",
    "sleman",
    "bantul",
    "semarang",
    "medan",
    "denpasar",
    "bali",
    "badung",
    "tangerang selatan",
    "tangerang",
    "bekasi",
    "cikarang",
    "depok",
    "bogor",
    "malang",
    "makassar",
    "palembang",
    "batam",
    "balikpapan",
    "samarinda",
    "banjarmasin",
    "manado",
    "padang",
    "pekanbaru",
    "pontianak",
    "surakarta",
    "solo",
    "cirebon",
    "lampung",
    "bandar lampung",
    "jabodetabek",
    "bsd",
)

KNOWN_COUNTRIES: Dict[str, str] = {
    "indonesia": "Indonesia",
    "united states": "USA",
    "usa": "USA",
    "us": "USA",
    "united kingdom": "United Kingdom",
    "uk": "United Kingdom",
    "singapore": "Singapore",
    "malaysia": "Malaysia",
    "australia": "Australia",
    "canada": "Canada",
    "germany": "Germany",
    "deutschland": "Germany",
    "france": "France",
    "netherlands": "Netherlands",
    "switzerland": "Switzerland",
    "japan": "Japan",
    "south korea": "South Korea",
    "india": "India",
    "philippines": "Philippines",
    "vietnam": "Vietnam",
    "thailand": "Thailand",
    "sri lanka": "Sri Lanka",
    "ireland": "Ireland",
    "spain": "Spain",
    "italy": "Italy",
    "poland": "Poland",
    "portugal": "Portugal",
    "sweden": "Sweden",
    "brazil": "Brazil",
    "mexico": "Mexico",
    "united arab emirates": "UAE",
    "uae": "UAE",
}


def normalize_location(raw: Optional[str]) -> Optional[str]:
    """
    Menormalisasi teks lokasi ke format standar 'Negara, Kota' (maks 120 karakter).
    Contoh:
      - 'Jakarta, Jakarta, Indonesia' -> 'Indonesia, Jakarta'
      - 'Jakarta Selatan'             -> 'Indonesia, Jakarta Selatan'
      - 'Yogyakarta, Indonesia'       -> 'Indonesia, Yogyakarta'
      - 'London, United Kingdom'      -> 'United Kingdom, London'
      - 'Indonesia'                   -> 'Indonesia'
      - 'Worldwide' / 'Remote'        -> 'Global, Remote'
    """
    cleaned = clean_whitespace(strip_html(raw) if raw else None, max_len=120)
    if not cleaned:
        return None

    lower = cleaned.lower()
    if lower in {"remote", "worldwide", "anywhere", "global", "remote (anywhere)", "anywhere in the world"}:
        return "Global, Remote"

    # Pecah berdasarkan koma dan bersihkan tiap segmen
    parts = [p.strip() for p in cleaned.split(",") if p.strip()]
    if not parts:
        return None

    # 1. Cek jika sudah diawali nama negara yang dikenal (misal 'Indonesia, Jakarta')
    first_lower = parts[0].lower()
    if first_lower in KNOWN_COUNTRIES:
        country = KNOWN_COUNTRIES[first_lower]
        if len(parts) == 1:
            return country
        # Ambil kota pertama yang bukan pengulangan nama negara
        for seg in parts[1:]:
            if seg.lower() != first_lower:
                return clean_whitespace(f"{country}, {seg}", max_len=120)
        return country

    # 2. Cek jika diakhiri nama negara yang dikenal (format umum LinkedIn: 'Kota, Provinsi, Negara' atau 'Kota, Negara')
    last_lower = parts[-1].lower()
    if last_lower in KNOWN_COUNTRIES:
        country = KNOWN_COUNTRIES[last_lower]
        city = parts[0]
        if city.lower() == last_lower or city.lower() == country.lower():
            return country
        return clean_whitespace(f"{country}, {city}", max_len=120)

    # 3. Cek jika menyebut kota Indonesia tanpa menuliskan kata 'Indonesia' (misal 'Jakarta Selatan', 'Bandung')
    for city_kw in INDONESIA_CITIES:
        if re.search(rf"\b{re.escape(city_kw)}\b", lower):
            city_display = parts[0]
            if city_display.lower() == "indonesia":
                return "Indonesia"
            return clean_whitespace(f"Indonesia, {city_display}", max_len=120)

    # 4. Cek jika hanya nama negara tunggal yang ada di KNOWN_COUNTRIES
    if lower in KNOWN_COUNTRIES:
        return KNOWN_COUNTRIES[lower]

    return cleaned


def normalize_work_mode(
    raw: Optional[str],
    location_hint: Optional[str] = None,
    title_hint: Optional[str] = None,
    description_hint: Optional[str] = None,
) -> str:
    raw_lower = (raw or "").strip().lower()
    if raw_lower in VALID_WORK_MODES and raw_lower != "unknown":
        return raw_lower

    primary = " ".join(
        part for part in [raw or "", location_hint or "", title_hint or ""] if part
    ).lower()

    for text_block in (primary, (description_hint or "").lower()):
        if not text_block.strip():
            continue
        if re.search(r"\b(hybrid|campuran|wfo\s*/\s*wfh|kombinasi)\b", text_block):
            return "hybrid"
        if re.search(
            r"\b(remote|wfh|work from home|work from anywhere|wfa|jarak jauh|anywhere)\b",
            text_block,
        ):
            return "remote"
        if re.search(
            r"\b(onsite|on-site|on site|wfo|work from office|tatap muka|di kantor)\b",
            text_block,
        ):
            return "onsite"

    return "unknown"


def normalize_employment_type(raw: Optional[str], title_hint: Optional[str] = None) -> str:
    combined = " ".join(part for part in [raw or "", title_hint or ""] if part).lower()
    if not combined.strip():
        return "unknown"

    raw_lower = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if raw_lower in VALID_EMPLOYMENT_TYPES:
        return raw_lower

    if re.search(r"\b(intern|internship|magang|praktik kerja| apprentice)\b", combined):
        return "internship"
    if re.search(r"\b(freelance|freelancer|lepas|pekerja lepas)\b", combined):
        return "freelance"
    if re.search(r"\b(part[\s_-]?time|paruh waktu)\b", combined):
        return "part_time"
    if re.search(r"\b(temporary|sementara|seasonal|musiman|daily worker|harian)\b", combined):
        return "temporary"
    if re.search(r"\b(contract|kontrak|pkwt|outsourcing|project[\s_-]?based)\b", combined):
        return "contract"
    if re.search(r"\b(full[\s_-]?time|penuh waktu|tetap|pkwtt|permanent)\b", combined):
        return "full_time"

    return "unknown"


def normalize_level(raw: Optional[str], title_hint: Optional[str] = None) -> str:
    raw_lower = (raw or "").strip().lower()
    if raw_lower in VALID_LEVELS and raw_lower != "unknown":
        return raw_lower

    combined = " ".join(part for part in [raw or "", title_hint or ""] if part).lower()
    if not combined.strip():
        return "unknown"

    if re.search(r"\b(intern|internship|magang|student|mahasiswa)\b", combined):
        return "intern"
    if re.search(r"\b(lead|principal|staff engineer|head of|vp|director|manager|manajer|supervisor|kepala)\b", combined):
        return "lead"
    if re.search(r"\b(senior|sr\.?)\b", combined):
        return "senior"
    if re.search(r"\b(mid[\s_-]?level|middle|intermediate|menengah)\b", combined):
        return "mid"
    if re.search(r"\b(junior|jr\.?)\b", combined):
        return "junior"
    if re.search(r"\b(entry[\s_-]?level|fresh\s*graduate|lulusan baru|pemula|graduate|trainee|mt|management trainee)\b", combined):
        return "entry"

    return "unknown"


def normalize_education(raw: Optional[str], description_hint: Optional[str] = None) -> Optional[str]:
    direct = clean_whitespace(raw, max_len=200)
    if direct and direct.lower() not in {"unknown", "-", "n/a", "none"}:
        return direct

    if not description_hint:
        return None

    desc = description_hint
    match = re.search(
        r"\b(minimal\s+(?:pendidikan\s+)?(?:sma|smk|d3|d4|s1|s2|sarjana|diploma)[A-Za-z0-9 /\-,]{0,60})",
        desc,
        re.IGNORECASE,
    )
    if match:
        return clean_whitespace(match.group(1), max_len=200)

    if re.search(r"\b(bachelor'?s?\s+degree|sarjana\s+\(s1\)|minimal\s+s1)\b", desc, re.IGNORECASE):
        return "Minimal S1 / Bachelor's Degree"
    if re.search(r"\b(master'?s?\s+degree|magister\s+\(s2\))\b", desc, re.IGNORECASE):
        return "Minimal S2 / Master's Degree"
    if re.search(r"\b(diploma\s+\(d3\)|minimal\s+d3)\b", desc, re.IGNORECASE):
        return "Minimal D3 / Diploma"

    return None


def normalize_skills(
    raw_skills: Optional[Iterable[Any]],
    title_hint: Optional[str] = None,
    description_hint: Optional[str] = None,
) -> List[str]:
    seen_lower: set[str] = set()
    result: List[str] = []

    def _add(item: str) -> None:
        cleaned = clean_whitespace(item, max_len=80)
        if not cleaned:
            return
        key = cleaned.lower()
        canonical = SKILL_CANONICAL_DISPLAY.get(key, cleaned)
        canonical_key = canonical.lower()
        if canonical_key not in seen_lower and len(result) < 100:
            seen_lower.add(canonical_key)
            result.append(canonical[:80])

    if raw_skills:
        for item in raw_skills:
            if isinstance(item, str):
                for sub in re.split(r"[,;/|]", item):
                    _add(sub)

    # Jika daftar skill dari sumber masih kosong, ekstrak secara konservatif dari judul & deskripsi
    if not result:
        combined_text = f" {title_hint or ''} {description_hint or ''} ".lower()
        for alias, display_name in SKILL_CANONICAL_DISPLAY.items():
            if len(alias) < 2:
                continue
            pattern = rf"(^|[\s,./()\-]){re.escape(alias)}($|[\s,./()\-])"
            if re.search(pattern, combined_text):
                _add(display_name)

    return result


def normalize_iso_timestamp(raw: Any) -> Optional[str]:
    """
    Mengubah timestamp sumber (epoch int, ISO string, atau RFC date) ke ISO-8601 UTC.
    Mengembalikan None jika kosong atau tidak valid.
    TIDAK pernah menggunakan waktu sekarang sebagai fallback (untuk menjaga keaslian published_at).
    """
    if raw is None:
        return None

    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        if raw <= 0:
            return None
        # Deteksi milidetik vs detik
        ts = raw / 1000.0 if raw > 1e11 else float(raw)
        try:
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, OSError, OverflowError):
            return None

    if not isinstance(raw, str):
        return None

    text = raw.strip()
    if not text:
        return None

    if ISO_TIMESTAMP_RE.match(text):
        return text

    # Coba parse format ISO fleksibel Python
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def normalize_deadline(raw: Any) -> Optional[str]:
    """
    Menormalisasi tenggat lamaran ke format YYYY-MM-DD sesuai aturan ingest_job.
    Jika tidak ada tenggat, mengembalikan None (tidak mengarang tanggal).
    """
    if raw is None or not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None

    if ISO_DATE_RE.match(text):
        try:
            datetime.strptime(text, "%Y-%m-%d")
            return text
        except ValueError:
            return None

    # Jika berupa ISO timestamp, ambil bagian tanggalnya jika valid
    ts = normalize_iso_timestamp(text)
    if ts and len(ts) >= 10 and ISO_DATE_RE.match(ts[:10]):
        return ts[:10]

    return None


def normalize_status(
    raw_status: Optional[str],
    deadline_yyyy_mm_dd: Optional[str] = None,
    reference_date_yyyy_mm_dd: Optional[str] = None,
) -> str:
    status_lower = (raw_status or "").strip().lower()
    if status_lower in {"closed", "inactive", "expired", "tutup", "berakhir"}:
        return "closed"

    ref_date = reference_date_yyyy_mm_dd or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if deadline_yyyy_mm_dd and deadline_yyyy_mm_dd < ref_date:
        return "closed"

    if status_lower in {"open", "active", "dibuka", "published"}:
        return "open"
    if status_lower == "unknown":
        return "unknown"

    return "open"


def build_ingest_payload(
    *,
    source_name: str,
    source_job_id: str,
    source_url: str,
    title: str,
    company: str,
    company_logo_url: Optional[str] = None,
    fetched_at: Optional[str] = None,
    published_at: Any = None,
    location: Optional[str] = None,
    work_mode: Optional[str] = None,
    employment_type: Optional[str] = None,
    level: Optional[str] = None,
    education: Optional[str] = None,
    description: Optional[str] = None,
    deadline: Any = None,
    skills: Optional[Iterable[Any]] = None,
    status: Optional[str] = None,
    existing_job_id: Optional[str] = None,
    reference_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Membangun dan memvalidasi payload untuk RPC public.ingest_job(jsonb).
    Menjamin seluruh batasan panjang karakter, format URL, format timestamp,
    dan nilai enum sesuai migrasi 20261117090200_ingest_concurrency.sql.
    """
    norm_source_name = clean_whitespace(source_name, max_len=80)
    if not norm_source_name:
        raise ValueError("source.name wajib diisi (maks 80 karakter)")

    norm_source_job_id = clean_whitespace(str(source_job_id), max_len=200)
    if not norm_source_job_id:
        raise ValueError("source.job_id wajib diisi (maks 200 karakter)")

    norm_source_url = clean_whitespace(source_url, max_len=2048)
    if not norm_source_url or not URL_RE.match(norm_source_url):
        raise ValueError("source.url wajib berupa http(s) URL yang valid (maks 2048 karakter)")

    norm_title = clean_whitespace(strip_html(title) or title, max_len=300)
    if not norm_title:
        raise ValueError("job.title wajib diisi (maks 300 karakter)")

    norm_company = clean_whitespace(strip_html(company) or company, max_len=200)
    if not norm_company:
        raise ValueError("job.company wajib diisi (maks 200 karakter)")

    norm_company_logo_url = clean_whitespace(company_logo_url, max_len=2048)
    if norm_company_logo_url and is_placeholder_logo_url(norm_company_logo_url):
        norm_company_logo_url = None

    # Penting: fetched_at adalah waktu scraper mengambil data;
    # published_at adalah waktu lowongan diterbitkan di sumber (boleh None).
    norm_fetched_at = normalize_iso_timestamp(fetched_at) or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    norm_published_at = normalize_iso_timestamp(published_at)

    norm_description = clean_description_whitespace(strip_html(description), max_len=20000)
    norm_location = normalize_location(location)
    norm_work_mode = normalize_work_mode(
        work_mode,
        location_hint=norm_location,
        title_hint=norm_title,
        description_hint=norm_description,
    )
    norm_employment_type = normalize_employment_type(employment_type, title_hint=norm_title)
    norm_level = normalize_level(level, title_hint=norm_title)
    norm_education = normalize_education(education, description_hint=norm_description)
    norm_deadline = normalize_deadline(deadline)
    norm_skills = normalize_skills(skills, title_hint=norm_title, description_hint=norm_description)
    norm_status = normalize_status(status, deadline_yyyy_mm_dd=norm_deadline, reference_date_yyyy_mm_dd=reference_date)

    source_obj: Dict[str, Any] = {
        "name": norm_source_name,
        "job_id": norm_source_job_id,
        "url": norm_source_url,
        "fetched_at": norm_fetched_at,
    }
    if norm_published_at is not None:
        source_obj["published_at"] = norm_published_at

    job_obj: Dict[str, Any] = {
        "title": norm_title,
        "company": norm_company,
        "location": norm_location,
        "work_mode": norm_work_mode,
        "employment_type": norm_employment_type,
        "level": norm_level,
        "education": norm_education,
        "description": norm_description,
        "deadline": norm_deadline,
        "skills": norm_skills,
        "status": norm_status,
    }
    if norm_company_logo_url:
        job_obj["company_logo_url"] = norm_company_logo_url
    if existing_job_id:
        job_obj["id"] = existing_job_id

    return {
        "source": source_obj,
        "job": job_obj,
    }
