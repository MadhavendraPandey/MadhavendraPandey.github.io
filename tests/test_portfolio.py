import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml
from fastapi.testclient import TestClient

from app.main import app
from app.services.projects import find_project, load_projects


def sample(slug="new-project", **changes):
    return {"title": "New project", "slug": slug, "year": 2026,
            "status": "Research", "tagline": "A useful system.",
            "summary": "Project summary.", **changes}


def write_project(root, name, data):
    directory = Path(root) / name
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "project.yaml").write_text(yaml.safe_dump(data), encoding="utf-8")


class PortfolioTests(unittest.TestCase):
    def test_routes(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/about").status_code, 200)
            self.assertEqual(client.get("/work").status_code, 200)
            self.assertEqual(client.get("/contact").status_code, 200)
            for project in load_projects():
                response = client.get(f"/projects/{project.slug}")
                self.assertEqual(response.status_code, 200)
                self.assertIn(project.title, response.text)
            missing = client.get("/projects/not-a-project")
            self.assertEqual(missing.status_code, 404)
            self.assertIn("Nothing here", missing.text)
            self.assertEqual(client.get("/missing").status_code, 404)
            self.assertEqual(client.get("/health").json(), {"status": "ok"})

    def test_loader_discovers_and_looks_up(self):
        projects = load_projects()
        self.assertGreaterEqual(len(projects), 3)
        self.assertIsNotNone(find_project(projects, "academic-inbox"))
        self.assertIsNone(find_project(projects, "missing"))

    def test_pet_can_be_disabled_without_affecting_pages(self):
        with TestClient(app) as client:
            app.state.pet_enabled = False
            for path in ["/", "/about", "/projects/academic-inbox"]:
                response = client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertNotIn('src="/static/js/pet.js', response.text)
                self.assertNotIn('data-pet-anchor=', response.text)

    def test_bad_content_identifies_file(self):
        for content in ["title: [unclosed", "title: Missing fields", "- not a mapping", ""]:
            with self.subTest(content=content), tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "broken"
                path.mkdir()
                (path / "project.yaml").write_text(content, encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "broken.*project.yaml"):
                    load_projects(Path(folder))

    def test_sorting_featured_order_and_slug(self):
        with tempfile.TemporaryDirectory() as folder:
            for slug, featured, order in [("z", False, 0), ("b", True, 2), ("a", True, 2), ("c", True, 1)]:
                write_project(folder, slug, sample(slug, featured=featured, order=order))
            self.assertEqual([p.slug for p in load_projects(Path(folder))], ["c", "a", "b", "z"])

    def test_duplicate_slugs_fail(self):
        with tempfile.TemporaryDirectory() as folder:
            write_project(folder, "first", sample())
            write_project(folder, "second", sample())
            with self.assertRaisesRegex(ValueError, "Duplicate slug"):
                load_projects(Path(folder))

    def test_content_only_addition_renders_every_section(self):
        sections = [
            {"type": "text", "content": "Plain text <script>bad()</script>"},
            {"type": "image", "image": {"src": "/static/example.svg", "alt": "System diagram"}},
            {"type": "gallery", "images": [{"src": "/static/example.svg", "alt": "A second diagram"}]},
            {"type": "metrics", "metrics": [{"value": "3", "label": "Example stages"}]},
            {"type": "architecture", "steps": ["Collect", "Review"]},
        ]
        with tempfile.TemporaryDirectory() as folder:
            write_project(folder, "new-project", sample(featured=True, sections=sections,
                pet={"hover": "custom project observation", "detail": "custom project detail"},
                optional_future_field="ignored"))
            with patch("app.main.load_projects", return_value=load_projects(Path(folder))):
                with TestClient(app) as client:
                    self.assertIn('/projects/new-project', client.get("/").text)
                    self.assertIn('custom project observation', client.get("/").text)
                    response = client.get("/projects/new-project")
                    self.assertEqual(response.status_code, 200)
                    for text in ["System diagram", "A second diagram", "Example stages", "Collect", "&lt;script&gt;"]:
                        self.assertIn(text, response.text)
                    self.assertNotIn("<script>bad()", response.text)
                    self.assertIn('custom project detail', response.text)

    def test_unsafe_urls_and_missing_alt_fail(self):
        for changes in [{"github": "javascript:alert(1)"}, {"hero_image": "/static/a.webp"},
                        {"sections": [{"type": "gallery", "images": [{"src": "/static/a.webp", "alt": ""}]}]},
                        {"sections": [{"type": "text"}]}]:
            with self.subTest(changes=changes), tempfile.TemporaryDirectory() as folder:
                write_project(folder, "bad", sample(**changes))
                with self.assertRaises(ValueError):
                    load_projects(Path(folder))


if __name__ == "__main__":
    unittest.main()
