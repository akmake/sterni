"""Read-only audit of the official Sefaria export; writes metadata/statistics only.

Run from the repo: python docs/research/shulchan-arukh-harav-audit.py
Raw source files are cached under the OS temporary directory, never in the repo.
Counts describe this export snapshot, not editorial certification of completeness.
"""

import collections
import datetime
import gzip
import hashlib
from html.parser import HTMLParser
import json
import pathlib
import re
import sqlite3
import sys
import tempfile
import time
import unicodedata
import urllib.parse
import urllib.request

TITLES = (
    "Shulchan Arukh HaRav",
    "Kuntres Acharon on Shulchan Arukh HaRav",
    "Hilkhot Talmud Torah",
    "Piskei HaSiddur",
    "Seder Birkat HaNehenin",
)
CACHE = pathlib.Path(tempfile.gettempdir()) / "sterni-shulchan-arukh-research"
OUTPUT = pathlib.Path(__file__).with_name("shulchan-arukh-harav-audit.json")
BASE = "https://storage.googleapis.com/sefaria-export/"
PREFIX = "json/Halakhah/Shulchan Arukh HaRav/"


def fetch(url, cache_key=None):
    target = None
    if cache_key:
        CACHE.mkdir(parents=True, exist_ok=True)
        target = CACHE / (hashlib.sha256(cache_key.encode()).hexdigest() + ".json")
        if target.exists():
            return target.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "Sterni-TextResearch/1.0"})
    with urllib.request.urlopen(req, timeout=45) as response:
        data = response.read()
    if target:
        target.write_bytes(data)
    return data


def leaves(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from leaves(child, path + (key,))
    elif isinstance(value, list):
        for number, child in enumerate(value, 1):
            yield from leaves(child, path + (number,))
    elif isinstance(value, str) and value.strip():
        yield path, value


def branch_arrays(value, path=()):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from branch_arrays(child, path + (key,))
    elif isinstance(value, list):
        yield path, value


def identifier(path):
    return " / ".join(str(part) if part != "" else "[default]" for part in path)


class MarkupInventory(HTMLParser):
    def __init__(self):
        super().__init__()
        self.commentators = collections.Counter()
        self.image_sources = collections.Counter()
        self.footnote_bodies = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("data-commentator"):
            self.commentators[attributes["data-commentator"]] += 1
        if tag == "i" and "footnote" in attributes.get("class", "").split():
            self.footnote_bodies += 1
        if tag == "img":
            source = attributes.get("src", "")
            kind = source.split(";", 1)[0] if source.startswith("data:") else urllib.parse.urlparse(source).netloc or "relative"
            self.image_sources[kind] += 1


class TextProbe(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "p", "div"):
            self.parts.append(" ")


def search_normalize(value):
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^\u05d0-\u05eaA-Za-z0-9]+", " ", value).strip()


def local_storage_probe(editions):
    """Temporary in-memory feasibility probe, NOT a production/Room content pack."""
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE segments (id TEXT PRIMARY KEY, version TEXT NOT NULL, source_html TEXT NOT NULL)")
    db.execute("CREATE VIRTUAL TABLE segment_search USING fts4(segment_id, search_text, tokenize=unicode61)")
    core = dict(editions[(TITLES[0], "Kehot Publication Society")])
    versions = {path: "Kehot Publication Society" for path in core}
    for path, value in editions[(TITLES[0], "Vocalized Edition - Kehot Publication Society")].items():
        core[path] = value
        versions[path] = "Vocalized Edition - Kehot Publication Society"
    rows = []
    for title, values, edition in (
        (TITLES[0], core, None),
        (TITLES[1], editions[(TITLES[1], "Kehot Publication Society")], "Kehot Publication Society"),
    ):
        for path, value in values.items():
            stable_id = json.dumps([title, *path], ensure_ascii=False, separators=(",", ":"))
            rows.append((stable_id, edition or versions[path], value))
    db.executemany("INSERT INTO segments VALUES (?,?,?)", rows)
    indexed = []
    for stable_id, _, value in rows:
        parser = TextProbe()
        parser.feed(value)
        indexed.append((stable_id, search_normalize("".join(parser.parts))))
    db.executemany("INSERT INTO segment_search VALUES (?,?)", indexed)
    db.commit()
    checks = []
    for term in ("שבת", "שַׁבָּת", "תפילין", "תפלין", "נטילת ידים", "רבית"):
        normalized = search_normalize(term)
        start = time.perf_counter()
        count = db.execute("SELECT COUNT(*) FROM segment_search WHERE search_text MATCH ?", ('"' + normalized + '"',)).fetchone()[0]
        checks.append({"query": term, "normalized": normalized, "matches": count, "elapsed_ms": round((time.perf_counter() - start) * 1000, 3)})
    integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
    raw = db.serialize()
    db.close()
    assert integrity == "ok", integrity
    assert checks[0]["matches"] > 0 and checks[0]["matches"] == checks[1]["matches"]
    return {
        "scope": "Core text (two explicit Kehot editions, vocalized-first address fallback) plus Kuntres Acharon only. Excludes Torah-study chapters, auxiliary works, separate notes, TOC and user data.",
        "warning": "Mechanical feasibility probe in Python/Windows, not a validated edition, Room schema, app feature, Android benchmark or redistributable pack.",
        "sqlite_version": sqlite3.sqlite_version,
        "rows": len(rows), "database_bytes": len(raw),
        "database_gzip_bytes_level_9": len(gzip.compress(raw, compresslevel=9, mtime=0)),
        "integrity_check": integrity,
        "hebrew_search_checks": checks,
    }


def inspect_export(item):
    url = BASE + urllib.parse.quote(item["name"], safe="/")
    raw = fetch(url, item["name"] + ":" + item["updated"])
    doc = json.loads(raw)
    segments = dict(leaves(doc["text"]))
    branches = []
    for path, value in branch_arrays(doc["text"]):
        populated = [n for n, child in enumerate(value, 1) if any(leaves(child))]
        branches.append({
            "path": identifier(path),
            "address_slots": len(value),
            "populated_addresses": populated,
            "empty_addresses": [n for n in range(1, len(value) + 1) if n not in populated],
            "nonempty_segments": sum(1 for _ in leaves(value)),
        })
    tags = collections.Counter()
    markup = MarkupInventory()
    for value in segments.values():
        tags.update(re.findall(r"<\s*([a-zA-Z][a-zA-Z0-9]*)\b", value))
        markup.feed(value)
    return ({
        "title": doc["title"],
        "he_title": doc.get("heTitle"),
        "version": doc["versionTitle"],
        "language": doc["language"],
        "license": doc.get("license"),
        "version_notes": doc.get("versionNotes"),
        "source": doc.get("versionSource"),
        "url": url,
        "export_updated_utc": item["updated"],
        "bytes": len(raw),
        "gzip_bytes_level_9": len(gzip.compress(raw, compresslevel=9, mtime=0)),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "nonempty_segments": len(segments),
        "html_start_tags": dict(tags),
        "inline_commentator_markers": dict(markup.commentators),
        "embedded_footnote_bodies": markup.footnote_bodies,
        "image_source_types": dict(markup.image_sources),
        "branches": branches,
    }, segments)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    params = {"prefix": PREFIX, "fields": "items(name,size,updated),nextPageToken"}
    items = []
    while True:
        url = "https://storage.googleapis.com/storage/v1/b/sefaria-export/o?" + urllib.parse.urlencode(params)
        listing = json.loads(fetch(url))
        items.extend(listing.get("items", []))
        if not listing.get("nextPageToken"):
            break
        params["pageToken"] = listing["nextPageToken"]
    report = {
        "audited_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "All Hebrew exports in the Shulchan Arukh HaRav category; mechanical coverage, not editorial certification.",
        "exports": [], "live_metadata": [], "comparisons": [],
        "wikisource_talmud_torah_chapters": [],
    }
    for chapter in "אבגד":
        page = "שולחן ערוך הרב הלכות תלמוד תורה פרק " + chapter
        query = urllib.parse.urlencode({
            "action": "parse", "page": page, "prop": "sections|revid|displaytitle",
            "format": "json", "formatversion": 2,
        })
        url = "https://he.wikisource.org/w/api.php?" + query
        parsed = json.loads(fetch(url))["parse"]
        sections = parsed.get("sections", [])
        report["wikisource_talmud_torah_chapters"].append({
            "chapter": chapter, "page": page, "revision_id": parsed["revid"],
            "api_url": url,
            "seif_heading_count": sum("סעיף " in section["line"] for section in sections),
            "has_kuntres_acharon_heading": any("קונטרס אחרון" in section["line"] for section in sections),
            "note": "Heading inventory only; page explicitly marked unreviewed. Direct source has all four chapters unlike the partial Sefaria Wikisource edition.",
        })
    editions = {}
    for title in TITLES:
        slug = urllib.parse.quote(title.replace(" ", "_"))
        versions = json.loads(fetch("https://www.sefaria.org/api/texts/versions/" + slug))
        index = json.loads(fetch("https://www.sefaria.org/api/v2/raw/index/" + slug))
        report["live_metadata"].append({
            "title": title, "authors": index.get("authors"),
            "schema": index.get("schema"), "alternative_structures": index.get("alt_structs", {}),
            "hebrew_versions": [
                {k: version.get(k) for k in ("versionTitle", "license", "versionSource", "versionNotes")}
                for version in versions if version.get("language") == "he"
            ],
        })
    for item in items:
        if "/Hebrew/" not in item["name"]:
            continue
        stats, segments = inspect_export(item)
        report["exports"].append(stats)
        editions[(stats["title"], stats["version"])] = segments
        print(f'{stats["title"]} | {stats["version"]}: {len(segments)} segments, license={stats["license"]!r}', flush=True)
    for title in TITLES:
        merged = editions.get((title, "merged"), {})
        for (book, version), segments in editions.items():
            if book != title or version == "merged":
                continue
            absent = sorted(set(merged) - set(segments), key=lambda path: tuple(str(p) for p in path))
            missing_by_branch = collections.Counter(identifier(tuple(p for p in path if isinstance(p, str))) for path in absent)
            report["comparisons"].append({
                "title": title, "version": version,
                "merged_segments": len(merged), "edition_segments": len(segments),
                "addresses_absent_from_edition_but_present_in_merged": len(absent),
                "absent_by_branch": dict(missing_by_branch),
                "absent_address_examples": [identifier(path) for path in absent[:12]],
                "note": "Address coverage only. A merged file can mix editions and licenses; it is not a publication-ready edition.",
            })
    report["local_storage_probe"] = local_storage_probe(editions)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved metadata-only audit: {OUTPUT}")


if __name__ == "__main__":
    main()
