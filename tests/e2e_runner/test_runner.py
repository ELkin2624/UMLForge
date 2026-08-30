import tempfile
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from canonical_model.class_model import UMLAttribute, UMLClass
from canonical_model.model import UMLModel
from canonical_model.relationship_model import UMLRelationship
from e2e_runner.config import E2EConfig
from e2e_runner.models import StageName, StageStatus
from e2e_runner.runner import E2ERunner


@pytest.fixture
def sample_uml_model():
    return UMLModel(
        id=str(uuid.uuid4()),
        uml_version="2.5.1",
        classes=[
            UMLClass(
                id=str(uuid.uuid4()),
                name="Cliente",
                attributes=[
                    UMLAttribute(id=str(uuid.uuid4()), name="nombre", type="String")
                ],
            )
        ],
        relationships=[],
        components=[],
        interfaces=[],
        diagrams=[],
    )


@patch("e2e_runner.runner.check_docker_available", return_value=True)
@patch("e2e_runner.runner.check_newman_available", return_value=True)
@patch("e2e_runner.runner.docker_compose_up", return_value=(True, "docker up ok"))
@patch("e2e_runner.runner.wait_for_postgres", return_value=True)
@patch("e2e_runner.runner.maven_verify", return_value=(True, "build success"))
@patch("e2e_runner.runner.find_jar")
@patch("e2e_runner.runner.start_spring_boot")
@patch("e2e_runner.runner.wait_for_spring_health", return_value=True)
@patch("e2e_runner.runner.run_newman")
@patch("e2e_runner.runner.docker_compose_down", return_value=(True, "docker down ok"))
def test_runner_success_flow(
    mock_down,
    mock_newman,
    mock_health,
    mock_start_spring,
    mock_find_jar,
    mock_mvn,
    mock_wait_pg,
    mock_docker_up,
    mock_chk_newman,
    mock_chk_docker,
    sample_uml_model,
):
    with tempfile.TemporaryDirectory() as tmp_dir:
        fake_jar = Path(tmp_dir) / "app.jar"
        fake_jar.write_text("fake jar")
        mock_find_jar.return_value = fake_jar

        mock_spring_proc = MagicMock()
        mock_start_spring.return_value = mock_spring_proc

        mock_newman.return_value = (
            True,
            {"total": 18, "passed": 18, "failed": 0, "skipped": 0},
            "newman ok",
        )

        config = E2EConfig(output_dir=Path(tmp_dir) / "reports")
        runner = E2ERunner(config=config)

        result = runner.run(
            uml_model=sample_uml_model,
            project_name="barberia",
            package_name="com.example.barberia",
        )

        assert result.success is True
        assert result.project_name == "barberia"
        assert result.test_summary is not None
        assert result.test_summary.passed == 18
        assert len(result.stages) == 8

        # Verificar que todas las etapas pasaron
        for stage in result.stages:
            assert stage.status == StageStatus.SUCCESS

        # Verificar que se invocó la limpieza
        assert mock_down.called


@patch("e2e_runner.runner.check_docker_available", return_value=True)
@patch("e2e_runner.runner.check_newman_available", return_value=True)
def test_runner_validation_failure(mock_newman, mock_docker):
    # Modelo con error estructural (referencia rota a target inexistente)
    c1_id = str(uuid.uuid4())
    non_existent = str(uuid.uuid4())
    invalid_model = UMLModel(
        id=str(uuid.uuid4()),
        uml_version="2.5.1",
        classes=[UMLClass(id=c1_id, name="Cliente", attributes=[])],
        relationships=[
            UMLRelationship(
                id=str(uuid.uuid4()),
                name="Rel",
                type="association",
                source=c1_id,
                target=non_existent,
            )
        ],
    )

    runner = E2ERunner()
    result = runner.run(uml_model=invalid_model, project_name="broken")

    assert result.success is False
    val_stage = next(s for s in result.stages if s.name == StageName.VALIDATION)
    assert val_stage.status == StageStatus.FAILURE
    # Las siguientes etapas deben figurar como SKIPPED
    gen_stage = next(s for s in result.stages if s.name == StageName.GENERATION)
    assert gen_stage.status == StageStatus.SKIPPED


@patch("e2e_runner.runner.check_docker_available", return_value=True)
@patch("e2e_runner.runner.check_newman_available", return_value=True)
@patch("e2e_runner.runner.docker_compose_up", return_value=(True, "docker up"))
@patch("e2e_runner.runner.wait_for_postgres", return_value=True)
@patch("e2e_runner.runner.maven_verify", return_value=(False, "COMPILATION ERROR"))
@patch("e2e_runner.runner.docker_compose_down", return_value=(True, "down ok"))
def test_runner_maven_failure_cleanup(
    mock_down,
    mock_mvn,
    mock_wait_pg,
    mock_up,
    mock_chk_newman,
    mock_chk_docker,
    sample_uml_model,
):
    runner = E2ERunner()
    result = runner.run(uml_model=sample_uml_model, project_name="barberia")

    assert result.success is False
    mvn_stage = next(s for s in result.stages if s.name == StageName.MAVEN)
    assert mvn_stage.status == StageStatus.FAILURE
    assert "Fallo en maven verify" in (mvn_stage.error or "")

    # Limpieza de docker siempre se ejecuta
    assert mock_down.called
