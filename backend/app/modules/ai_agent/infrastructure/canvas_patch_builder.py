import uuid
from typing import List, Dict, Any
from ..schemas import CanvasPatchOperation


class CanvasPatchBuilder:
    @staticmethod
    def build_yjs_ready_patches(
        patches: List[CanvasPatchOperation], author_name: str
    ) -> List[Dict[str, Any]]:
        canonical_ops = []
        for patch in patches:
            canonical_ops.append({
                "patch_id": f"patch_{uuid.uuid4().hex[:8]}",
                "operation": patch.op,
                "target": patch.target_name,
                "data": patch.payload,
                "reason": patch.reason,
                "requested_by": author_name,
                "status": "pending_approval",  # Para el modo Sugerencias (aprobación/rechazo)
            })
        return canonical_ops
