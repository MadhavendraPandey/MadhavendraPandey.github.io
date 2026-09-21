from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def safe_url(value: str) -> str:
    if value and not (value.startswith("https://") or value.startswith("/static/")):
        raise ValueError("URLs must start with https:// or /static/")
    if "\\" in value or ".." in value.split("/"):
        raise ValueError("URL must not contain path traversal")
    return value


class ProjectImage(BaseModel):
    src: str
    alt: str = Field(min_length=1)
    caption: str = ""

    _url = field_validator("src")(safe_url)


class Metric(BaseModel):
    value: str
    label: str


class Section(BaseModel):
    type: Literal["text", "image", "gallery", "metrics", "architecture"]
    eyebrow: str = ""
    title: str = ""
    content: str = ""
    image: ProjectImage | None = None
    images: list[ProjectImage] = Field(default_factory=list)
    metrics: list[Metric] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_content(self):
        required = {"text": self.content, "image": self.image,
                    "gallery": self.images, "metrics": self.metrics,
                    "architecture": self.steps}
        if not required[self.type]:
            raise ValueError(f"{self.type} section is missing its content")
        return self


class PetDialogue(BaseModel):
    intro: str = Field(default="", max_length=120)
    hover: str = Field(default="", max_length=120)
    github: str = Field(default="", max_length=120)
    detail: str = Field(default="", max_length=120)


class Project(BaseModel):
    title: str = Field(min_length=1)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    year: int = Field(ge=2000, le=2100)
    status: str = Field(min_length=1)
    featured: bool = False
    order: int = 100
    tagline: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    stack: list[str] = Field(default_factory=list)
    github: str = ""
    hero_image: str = ""
    hero_alt: str = ""
    sections: list[Section] = Field(default_factory=list)
    pet: PetDialogue = Field(default_factory=PetDialogue)

    _urls = field_validator("github", "hero_image")(safe_url)

    @model_validator(mode="after")
    def validate_hero(self):
        if self.hero_image and not self.hero_alt:
            raise ValueError("hero_alt is required when hero_image is set")
        return self
