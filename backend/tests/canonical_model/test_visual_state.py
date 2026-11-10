from app.core.canonical_model.model import UMLModel


def test_visual_state_round_trip() -> None:
    model = UMLModel.model_validate(
        {"id": "shared", "visual_state": {"class-1": {"x": 420, "y": 180}}}
    )

    restored = UMLModel.model_validate_json(model.model_dump_json())

    assert restored.visual_state == {"class-1": {"x": 420.0, "y": 180.0}}
