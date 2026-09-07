"""
Router API para importación y exportación de modelos XMI 2.5.1.
"""

from typing import Any

from app.core.canonical_model.model import UMLModel
from fastapi import APIRouter, File, HTTPException, Response, UploadFile

from app.modules.xmi.core.parser import (
    MAX_XMI_SIZE_BYTES,
    XMIParserException,
    parse_xmi_to_intermediate,
)
from app.modules.xmi.core.writer import intermediate_to_xmi_xml
from app.modules.xmi.profiles.ea import (
    XMIReferenceNotFoundError,
    canonical_to_ea_intermediate,
    map_intermediate_to_canonical,
)

router = APIRouter(prefix="/api/v1/models", tags=["xmi"])


@router.post("/import/xmi", response_model=dict[str, Any])
async def import_xmi_model(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Importa un archivo XMI 2.5.1 (perfil Enterprise Architect) y lo transforma
    en un UMLModel canónico con un reporte de elementos no soportados (warnings).
    """
    # Validar tamaño
    content = await file.read()
    if len(content) > MAX_XMI_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "XMI_INVALID_XML",
                "message": f"El archivo supera el tamaño máximo permitido de {MAX_XMI_SIZE_BYTES // (1024 * 1024)} MB.",
            },
        )

    try:
        doc = parse_xmi_to_intermediate(content)
        model, warnings = map_intermediate_to_canonical(doc)
    except XMIParserException as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except XMIReferenceNotFoundError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "XMI_IMPORT_ERROR",
                "message": f"Error procesando modelo XMI: {exc}",
            },
        ) from exc

    return {
        "model": model.model_dump(mode="json"),
        "warnings": warnings,
    }


@router.post("/export/xmi")
async def export_xmi_model(model: UMLModel) -> Response:
    """
    Exporta un UMLModel canónico a un archivo XML conforme al perfil XMI 2.5.1 de Enterprise Architect.
    """
    try:
        doc = canonical_to_ea_intermediate(model)
        xml_str = intermediate_to_xmi_xml(doc)
    except Exception as exc:
        import traceback
        with open("xmi_error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={
                "code": "XMI_EXPORT_ERROR",
                "message": f"Error generando documento XMI: {exc}",
            },
        ) from exc

    filename = f"{getattr(model, 'name', None) or model.id or 'model'}.xmi"
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
