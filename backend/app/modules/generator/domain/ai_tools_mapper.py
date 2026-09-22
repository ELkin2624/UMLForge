from pydantic import BaseModel, Field
from typing import Any

from .entity_info import EntityInfo


class AIToolParameterSchema(BaseModel):
    type: str = "object"
    properties: dict[str, Any] = Field(default_factory=dict)
    required: list[str] = Field(default_factory=list)


class AIToolHttpConfig(BaseModel):
    method: str
    path: str


class AIToolPermissions(BaseModel):
    required: str


class AIToolPolicy(BaseModel):
    action_type: str  # READ, CREATE, UPDATE, DELETE
    requires_confirmation: bool


class AIToolDefinition(BaseModel):
    name: str
    description: str
    method: str  # Conservado para compatibilidad
    path: str    # Conservado para compatibilidad
    required_permission: str  # Conservado para compatibilidad
    http: AIToolHttpConfig
    permissions: AIToolPermissions
    policy: AIToolPolicy
    parameters: AIToolParameterSchema


class AIToolsManifest(BaseModel):
    schema_version: str = "1.0"
    project_name: str
    domain: str
    tools: list[AIToolDefinition] = Field(default_factory=list)


class AIContextInfo(BaseModel):
    schema_version: str = "1.0"
    project_name: str
    domain: str
    system_prompt: str
    entities_summary: dict[str, str] = Field(default_factory=dict)


class AIToolsMapper:
    @classmethod
    def map_tools(
        cls, project_name: str, entities: list[EntityInfo], domain: str = "general"
    ) -> AIToolsManifest:
        manifest = AIToolsManifest(
            schema_version="1.0",
            project_name=project_name,
            domain=domain,
        )

        for entity in entities:
            e_lower = entity.class_name.lower()
            e_upper = entity.class_name.upper()
            table = entity.table_name

            # 1. list_{entity}s (READ - Sin confirmación humana requerida)
            list_props: dict[str, Any] = {
                "limit": {
                    "type": "integer",
                    "description": "Número máximo de registros a retornar",
                },
                "search": {
                    "type": "string",
                    "description": "Término de búsqueda textual",
                },
            }
            for f in entity.fields[:3]:
                list_props[f.name] = {
                    "type": cls._map_json_type(f.java_type),
                    "description": f"Filtrar por {f.name}",
                }

            manifest.tools.append(
                AIToolDefinition(
                    name=f"list_{e_lower}s",
                    description=f"Obtiene la lista de {entity.class_name}s registrados con filtros opcionales.",
                    method="GET",
                    path=f"/api/{table}",
                    required_permission=f"READ_{e_upper}",
                    http=AIToolHttpConfig(method="GET", path=f"/api/{table}"),
                    permissions=AIToolPermissions(required=f"READ_{e_upper}"),
                    policy=AIToolPolicy(action_type="READ", requires_confirmation=False),
                    parameters=AIToolParameterSchema(
                        type="object",
                        properties=list_props,
                        required=[],
                    ),
                )
            )

            # 2. get_{entity}_by_id (READ - Sin confirmación humana requerida)
            manifest.tools.append(
                AIToolDefinition(
                    name=f"get_{e_lower}_by_id",
                    description=f"Obtiene los detalles de un/a {entity.class_name} por su identificador único (ID).",
                    method="GET",
                    path=f"/api/{table}/{{id}}",
                    required_permission=f"READ_{e_upper}",
                    http=AIToolHttpConfig(method="GET", path=f"/api/{table}/{{id}}"),
                    permissions=AIToolPermissions(required=f"READ_{e_upper}"),
                    policy=AIToolPolicy(action_type="READ", requires_confirmation=False),
                    parameters=AIToolParameterSchema(
                        type="object",
                        properties={
                            "id": {
                                "type": "integer" if entity.id_field.java_type in ("Long", "Integer", "int", "long") else "string",
                                "description": f"Identificador de {entity.class_name}",
                            }
                        },
                        required=["id"],
                    ),
                )
            )

            # 3. create_{entity} (CREATE - Requiere confirmación humana)
            create_props: dict[str, Any] = {}
            create_req: list[str] = []
            for f in entity.fields:
                create_props[f.name] = {
                    "type": cls._map_json_type(f.java_type),
                    "description": f"Valor para {f.name}",
                }
                if not f.is_nullable:
                    create_req.append(f.name)

            manifest.tools.append(
                AIToolDefinition(
                    name=f"create_{e_lower}",
                    description=f"Crea un/a nuevo/a {entity.class_name} en el sistema.",
                    method="POST",
                    path=f"/api/{table}",
                    required_permission=f"CREATE_{e_upper}",
                    http=AIToolHttpConfig(method="POST", path=f"/api/{table}"),
                    permissions=AIToolPermissions(required=f"CREATE_{e_upper}"),
                    policy=AIToolPolicy(action_type="CREATE", requires_confirmation=True),
                    parameters=AIToolParameterSchema(
                        type="object",
                        properties=create_props,
                        required=create_req,
                    ),
                )
            )

            # 4. update_{entity} (UPDATE - Requiere confirmación humana)
            update_props = dict(create_props)
            update_props["id"] = {
                "type": "integer" if entity.id_field.java_type in ("Long", "Integer", "int", "long") else "string",
                "description": f"ID del/la {entity.class_name} a actualizar",
            }
            manifest.tools.append(
                AIToolDefinition(
                    name=f"update_{e_lower}",
                    description=f"Actualiza los datos de un/a {entity.class_name} existente.",
                    method="PUT",
                    path=f"/api/{table}/{{id}}",
                    required_permission=f"UPDATE_{e_upper}",
                    http=AIToolHttpConfig(method="PUT", path=f"/api/{table}/{{id}}"),
                    permissions=AIToolPermissions(required=f"UPDATE_{e_upper}"),
                    policy=AIToolPolicy(action_type="UPDATE", requires_confirmation=True),
                    parameters=AIToolParameterSchema(
                        type="object",
                        properties=update_props,
                        required=["id"],
                    ),
                )
            )

            # 5. delete_{entity} (DELETE - Confirmación obligatoria y estricta)
            manifest.tools.append(
                AIToolDefinition(
                    name=f"delete_{e_lower}",
                    description=f"Elimina un/a {entity.class_name} por su ID.",
                    method="DELETE",
                    path=f"/api/{table}/{{id}}",
                    required_permission=f"DELETE_{e_upper}",
                    http=AIToolHttpConfig(method="DELETE", path=f"/api/{table}/{{id}}"),
                    permissions=AIToolPermissions(required=f"DELETE_{e_upper}"),
                    policy=AIToolPolicy(action_type="DELETE", requires_confirmation=True),
                    parameters=AIToolParameterSchema(
                        type="object",
                        properties={
                            "id": {
                                "type": "integer" if entity.id_field.java_type in ("Long", "Integer", "int", "long") else "string",
                                "description": f"ID del/la {entity.class_name} a eliminar",
                            }
                        },
                        required=["id"],
                    ),
                )
            )

        return manifest

    @classmethod
    def map_context(
        cls, project_name: str, entities: list[EntityInfo], domain: str = "general"
    ) -> AIContextInfo:
        entities_summary = {}
        entities_list_str = []

        for e in entities:
            field_names = [f.name for f in e.fields]
            summary = f"Entidad {e.class_name} con atributos: {', '.join(field_names)}"
            entities_summary[e.class_name] = summary
            entities_list_str.append(f"- {e.class_name}: {', '.join(field_names)}")

        entities_desc = "\n".join(entities_list_str)

        system_prompt = f"""Eres el asistente inteligente de la aplicación {project_name.title()} (Dominio: {domain}).
Tu objetivo es responder de manera útil, concisa y amigable a las preguntas del usuario sobre el negocio.

Tienes acceso a herramientas estructuradas (Tools) para consultar y manipular la información del negocio:
{entities_desc}

Reglas importantes de arquitectura y seguridad:
1. NUNCA inventes información si no la has consultado con las herramientas.
2. La inferencia ocurre localmente en el dispositivo, pero la información de negocio proviene de las operaciones del backend.
3. Las operaciones de lectura (ej. list_cortes, list_citas) se ejecutan para responder tus consultas.
4. Las operaciones de mutación (create, update, delete) requerirán confirmación explícita del usuario en pantalla antes de enviarse al backend.
5. Formula respuestas finales en lenguaje natural, claras y en español."""

        return AIContextInfo(
            schema_version="1.0",
            project_name=project_name,
            domain=domain,
            system_prompt=system_prompt,
            entities_summary=entities_summary,
        )

    @staticmethod
    def _map_json_type(java_type: str) -> str:
        if java_type in ("Integer", "int", "Long", "long"):
            return "integer"
        if java_type in ("Double", "double", "Float", "float", "BigDecimal"):
            return "number"
        if java_type in ("Boolean", "boolean"):
            return "boolean"
        return "string"
