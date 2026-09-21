from contextlib import asynccontextmanager

import yaml
from pydantic import TypeAdapter

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.projects import ROOT, find_project, load_projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.projects = load_projects()
    pet_path = ROOT / "content" / "pet.yaml"
    pet = yaml.safe_load(pet_path.read_text(encoding="utf-8"))
    app.state.pet_enabled = pet.get("enabled", True) is True
    app.state.pet_dialogue = TypeAdapter(dict[str, list[str]]).validate_python(pet["dialogue"])
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
templates = Jinja2Templates(directory=ROOT / "templates", context_processors=[
    lambda request: {"pet_enabled": request.app.state.pet_enabled,
                     "pet_dialogue": request.app.state.pet_dialogue}
])


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html", context={
        "projects": [p for p in request.app.state.projects if p.featured],
    })


@app.get("/about")
def about(request: Request):
    return templates.TemplateResponse(request=request, name="about.html")


@app.get("/work")
def work(request: Request):
    return templates.TemplateResponse(request=request, name="work.html", context={
        "projects": request.app.state.projects,
    })


@app.get("/contact")
def contact(request: Request):
    return templates.TemplateResponse(request=request, name="contact.html")


@app.get("/projects/{slug}")
def project_detail(request: Request, slug: str):
    project = find_project(request.app.state.projects, slug)
    if project is None:
        raise HTTPException(404)
    return templates.TemplateResponse(request=request, name="project.html", context={"project": project})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return templates.TemplateResponse(request=request, name="404.html", status_code=404)
    return templates.TemplateResponse(request=request, name="404.html", status_code=exc.status_code,
                                      context={"error_code": exc.status_code})
