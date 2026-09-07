from pydantic import BaseModel


class ServiceStatus(BaseModel):
    name: str
    status: str  # "up", "down", "error"
    detail: str | None = None


class TestSummary(BaseModel):
    __test__ = False
    total: int
    passed: int
    failed: int
    skipped: int


class DeploymentResult(BaseModel):
    success: bool
    project_name: str
    duration_ms: int
    postgres_status: ServiceStatus
    spring_boot_status: ServiceStatus
    test_summary: TestSummary | None = None
    error: str | None = None
    logs: dict[str, str]  # claves: "docker", "maven", "spring", "newman"
