export interface AIPatch {
  patch_id: string;
  operation:
    | "ADD_CLASS"
    | "UPDATE_CLASS"
    | "DELETE_CLASS"
    | "ADD_RELATION"
    | "UPDATE_RELATION"
    | "DELETE_RELATION";
  target: string;
  data: Record<string, any>;
  reason: string;
  requested_by: string;
  status: "pending_approval" | "approved" | "rejected" | "stale";
  timestamp?: string | number;
  /** Huellas (id -> huella) de los elementos que toca, capturadas al recibir la sugerencia. */
  base?: Record<string, string>;
  /** Por qué quedó obsoleta (solo con status 'stale'). */
  stale_reason?: string;
}
