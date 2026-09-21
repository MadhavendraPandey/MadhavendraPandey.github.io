"""Render the existing FastAPI/Jinja portfolio for static hosting."""

import argparse
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from fastapi.testclient import TestClient

from app.main import app
from app.services.projects import ROOT, load_projects


LOCAL_URL = re.compile(r'(?P<attribute>\b(?:href|src)\s*=\s*)(?P<quote>["\'])(?P<url>/[^"\']*)(?P=quote)', re.IGNORECASE)


def normalize_base_path(value: str) -> str:
    """Accept a root site or a single GitHub Pages repository prefix."""
    if value == "/":
        return value
    segment = value.strip("/")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", segment) or segment in {".", ".."}:
        raise ValueError("base path must be / or /repository-name/")
    return f"/{segment}/"


def static_url(url: str, base_path: str) -> str:
    if url.startswith("//"):
        return url
    parts = urlsplit(url)
    path = parts.path
    if path == "/" and parts.fragment == "work":
        path = "/work/"
        fragment = ""
    else:
        fragment = parts.fragment
    if path in {"/about", "/contact", "/work"}:
        path += "/"
    elif path.startswith("/projects/") and not path.endswith("/"):
        path += "/"
    return urlunsplit(("", "", base_path + path.lstrip("/"), parts.query, fragment))


def rewrite_local_urls(html: str, base_path: str) -> str:
    def replace(match: re.Match[str]) -> str:
        url = static_url(match.group("url"), base_path)
        return f'{match.group("attribute")}{match.group("quote")}{url}{match.group("quote")}'

    return LOCAL_URL.sub(replace, html)


class LocalLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.urls.extend(value for name, value in attrs if name in {"href", "src"} and value)


def verify_output(output: Path, base_path: str) -> None:
    """Catch missing assets and links that would escape the Pages site prefix."""
    for page in output.rglob("*.html"):
        links = LocalLinks()
        links.feed(page.read_text(encoding="utf-8"))
        for url in links.urls:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc:
                continue
            path = parts.path
            if not path.startswith("/") or path.startswith("//"):
                continue
            if not path.startswith(base_path):
                raise ValueError(f"{page}: URL escapes base path: {url}")
            relative = path[len(base_path):]
            target = output / relative
            if not target.is_file() and not (target / "index.html").is_file():
                raise ValueError(f"{page}: missing local target: {url}")


def build(output: Path = ROOT / "dist", base_path: str = "/") -> Path:
    base_path = normalize_base_path(base_path)
    output = output.resolve()
    # Never clear a symlink or an arbitrary directory supplied by a caller.
    if output == ROOT or ROOT not in output.parents:
        raise ValueError("output must be inside the portfolio directory")
    if output.exists():
        if output != (ROOT / "dist").resolve():
            raise FileExistsError(f"refusing to replace existing directory: {output}")
        shutil.rmtree(output)
    output.mkdir(parents=True)

    pages = [("/", Path("index.html")), ("/about", Path("about/index.html")),
             ("/work", Path("work/index.html")), ("/contact", Path("contact/index.html"))]
    pages.extend((f"/projects/{project.slug}", Path("projects") / project.slug / "index.html")
                 for project in load_projects())
    pages.append(("/__static_build_missing__", Path("404.html")))

    with TestClient(app) as client:
        for route, relative in pages:
            response = client.get(route)
            expected = 404 if relative.name == "404.html" else 200
            if response.status_code != expected:
                raise RuntimeError(f"{route}: expected {expected}, got {response.status_code}")
            destination = output / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(rewrite_local_urls(response.text, base_path), encoding="utf-8")

    shutil.copytree(ROOT / "static", output / "static")
    (output / ".nojekyll").touch()
    verify_output(output, base_path)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-path", default="/", help="/ for a user site, /repository-name/ for a project site")
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(f"Built {build(args.output, args.base_path)} for {normalize_base_path(args.base_path)}")
