import json
import tempfile
from pathlib import Path

from e2e_runner.models import (
    E2EResult,
    StageName,
    StageResult,
    StageStatus,
    TestSummary,
)
from e2e_runner.report import save_report


def test_save_report():
    with tempfile.TemporaryDirectory() as tmp_dir:
        output_dir = Path(tmp_dir)
        result = E2EResult(
            success=True,
            project_name="barberia",
            total_duration_ms=5000,
            stages=[
                StageResult(
                    name=StageName.VALIDATION,
                    status=StageStatus.SUCCESS,
                    duration_ms=50,
                ),
            ],
            test_summary=TestSummary(total=5, passed=5, failed=0, skipped=0),
        )

        report_path, latest_path = save_report(result, output_dir)

        assert report_path.exists()
        assert latest_path.exists()
        assert report_path.name.startswith("e2e_report_barberia_")
        assert latest_path.name == "latest_report.json"

        # Verificar contenido JSON
        data = json.loads(latest_path.read_text(encoding="utf-8"))
        assert data["project_name"] == "barberia"
        assert data["success"] is True
        assert data["test_summary"]["total"] == 5
