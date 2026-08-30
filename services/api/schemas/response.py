from pydantic import BaseModel, Field


class APIErrorDetail(BaseModel):
    code: str = Field(default="unknown")
    message: str
    path: str | None = None
    severity: str = Field(default="error", description="'error' or 'warning'")


class ValidationResultResponse(BaseModel):
    is_valid: bool
    errors: list[APIErrorDetail] = Field(default_factory=list)


class GenerateResponse(BaseModel):
    project_name: str
    download_url: str | None = None
    checksum: str | None = None
    warnings: list[APIErrorDetail] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    status: int
    detail: str
    errors: list[APIErrorDetail] = Field(default_factory=list)
