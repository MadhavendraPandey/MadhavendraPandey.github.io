from pathlib import Path

import yaml
from pydantic import ValidationError

from app.models.project import Project

ROOT = Path(__file__).resolve().parents[2]
CONTENT_DIR = ROOT / "content" / "projects"


def load_projects(directory: Path = CONTENT_DIR) -> list[Project]:
    """Read once at startup; report the exact file if authoring fails."""
    projects = []
    slugs = set()
    for path in sorted(directory.glob("*/project.yaml")):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            project = Project.model_validate(data)
            if project.slug in slugs:
                raise ValueError(f"Duplicate slug: {project.slug}")
            slugs.add(project.slug)
            projects.append(project)
        except (OSError, yaml.YAMLError, ValidationError, ValueError) as exc:
            raise ValueError(f"Invalid project content in {path}: {exc}") from exc
    return sorted(projects, key=lambda p: (not p.featured, p.order, p.slug))


def find_project(projects: list[Project], slug: str) -> Project | None:
    return next((project for project in projects if project.slug == slug), None)
