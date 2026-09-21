import tempfile
import unittest
from pathlib import Path

from app.services.projects import ROOT, load_projects
from build_static import build, normalize_base_path, static_url


class StaticBuildTests(unittest.TestCase):
    def test_user_site_export(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            output = build(Path(folder) / "site", "/")
            pages = [output / path for path in ["index.html", "about/index.html",
                     "work/index.html", "contact/index.html", "404.html"]]
            pages.extend(output / "projects" / project.slug / "index.html"
                         for project in load_projects())
            self.assertTrue(all(page.is_file() for page in pages))
            self.assertTrue((output / ".nojekyll").is_file())
            self.assertTrue((output / "static/js/pet.js").is_file())
            self.assertTrue((output / "static/js/keycap.js").is_file())
            self.assertTrue((output / "static/css/pages/home.css").is_file())
            home = (output / "index.html").read_text(encoding="utf-8")
            self.assertIn('src="/static/js/pet.js', home)
            self.assertIn('href="/about/"', home)
            self.assertIn('href="/work/"', home)
            self.assertIn('href="/projects/academic-inbox/"', home)
            self.assertIn('id="work"', (output / "work/index.html").read_text(encoding="utf-8"))

    def test_url_prefix_and_root_site(self):
        self.assertEqual(static_url("/#work", "/"), "/work/")
        self.assertEqual(static_url("/static/favicon.svg", "/"), "/static/favicon.svg")
        self.assertEqual(static_url("//cdn.example.com/file.js", "/"),
                         "//cdn.example.com/file.js")
        with self.assertRaises(ValueError):
            normalize_base_path("/../bad/")


if __name__ == "__main__":
    unittest.main()
