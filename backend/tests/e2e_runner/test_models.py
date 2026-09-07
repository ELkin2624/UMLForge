from app.modules.e2e.models import (
    E2EResult,
    StageName,
    StageResult,
    StageStatus,
    TestSummary,
)


def test_stage_result_model():
    stage = StageResult(
        name=StageName.VALIDATION,
        status=StageStatus.SUCCESS,
        duration_ms=150,
        logs="All checks passed.",
    )
    assert stage.name == StageName.VALIDATION
    assert stage.status == StageStatus.SUCCESS
    assert stage.duration_ms == 150
    assert stage.error is None
    assert stage.logs == "All checks passed."


def test_e2e_result_serialization():
    result = E2EResult(
        success=True,
        project_name="barberia",
        total_duration_ms=12500,
        stages=[
            StageResult(
                name=StageName.VALIDATION, status=StageStatus.SUCCESS, duration_ms=100
            ),
            StageResult(
                name=StageName.GENERATION, status=StageStatus.SUCCESS, duration_ms=500
            ),
            StageResult(
                name=StageName.NEWMAN, status=StageStatus.SUCCESS, duration_ms=1200
            ),
        ],
        test_summary=TestSummary(total=18, passed=18, failed=0, skipped=0),
        zip_path="barberia.zip",
        report_path="e2e_report_barberia_latest.json",
    )

    data = result.model_dump()
    assert data["success"] is True
    assert data["project_name"] == "barberia"
    assert len(data["stages"]) == 3
    assert data["test_summary"]["passed"] == 18

    # Deserialización
    reconstructed = E2EResult.model_validate(data)
    assert reconstructed.success is True
    assert reconstructed.stages[0].name == StageName.VALIDATION
    assert reconstructed.stages[0].status == StageStatus.SUCCESS
