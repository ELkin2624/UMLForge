from enum import Enum

from pydantic import BaseModel, Field


class StageName(str, Enum):
    VALIDATION = "validation"
    GENERATION = "generation"
    EXTRACTION = "extraction"
    POSTGRES = "postgres"
    MAVEN = "maven"
    SPRING = "spring"
    HEALTH = "health"
    NEWMAN = "newman"


class StageStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    SKIPPED = "skipped"


class StageResult(BaseModel):
    name: StageName
    status: StageStatus
    duration_ms: int
    error: str | None = None
    logs: str | None = None


class TestSummary(BaseModel):
    __test__ = False
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0


class E2EResult(BaseModel):
    success: bool
    project_name: str
    total_duration_ms: int
    stages: list[StageResult] = Field(default_factory=list)
    test_summary: TestSummary | None = None
    zip_path: str | None = None
    report_path: str | None = None
    error: str | None = None
