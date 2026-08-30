from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}
