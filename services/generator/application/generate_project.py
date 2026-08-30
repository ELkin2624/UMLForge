from pathlib import Path

from canonical_model.model import UMLModel
from validators.generation_rules import GenerationValidator
from validators.validation_result import ValidationResult

from services.generator.domain.entity_mapper import EntityMapper
from services.generator.domain.exceptions import GenerationError
from services.generator.domain.generated_project import GeneratedFile, GeneratedProject
from services.generator.domain.generation_manifest import GenerationManifest
from services.generator.domain.openapi_mapper import OpenAPIMapper
from services.generator.domain.postman_mapper import PostmanMapper
from services.generator.domain.schema_mapper import SchemaMapper
from services.generator.infrastructure.jinja_renderer import JinjaRenderer


class ProjectGenerator:
    def __init__(self, templates_dir: str | Path):
        self.renderer = JinjaRenderer(templates_dir)

    def generate(
        self, model: UMLModel, project_name: str, package_name: str
    ) -> GeneratedProject:
        # 1. Validar para generación
        validation_result = ValidationResult()
        GenerationValidator().validate(model, validation_result)

        if not validation_result.valid:
            errors_str = "\n".join(validation_result.errors)
            raise GenerationError(
                f"El modelo no es válido para generación:\n{errors_str}"
            )

        # 2. Mapeos de dominio (Semantics)
        entities = EntityMapper.map_entities(model)
        schema_info = SchemaMapper.map_schema(entities)
        openapi_info = OpenAPIMapper.map_openapi(project_name, entities)
        postman_info = PostmanMapper.map_postman(project_name, entities)

        # 3. Contexto base para las plantillas
        context = {
            "app_name": project_name,
            "package_name": package_name,
            "entities": entities,
            "schema": schema_info,
            "openapi": openapi_info,
            "postman": postman_info,
        }

        files = []

        # 4. Renderizar plantillas estáticas/globales
        # Pom, Application, Configs
        files.append(
            GeneratedFile(
                path="pom.xml",
                content=self.renderer.render("spring/pom.xml.j2", context),
                media_type="application/xml",
            )
        )

        base_pkg_path = f"src/main/java/{package_name.replace('.', '/')}"

        files.append(
            GeneratedFile(
                path=f"{base_pkg_path}/Application.java",
                content=self.renderer.render("spring/Application.java.j2", context),
                media_type="text/x-java-source",
            )
        )

        files.append(
            GeneratedFile(
                path=f"{base_pkg_path}/exception/GlobalExceptionHandler.java",
                content=self.renderer.render("spring/exception.java.j2", context),
                media_type="text/x-java-source",
            )
        )

        files.append(
            GeneratedFile(
                path=f"{base_pkg_path}/exception/ResourceNotFoundException.java",
                content=self.renderer.render(
                    "spring/ResourceNotFoundException.java.j2", context
                ),
                media_type="text/x-java-source",
            )
        )

        files.append(
            GeneratedFile(
                path="src/main/resources/application.properties",
                content=self.renderer.render(
                    "spring/application.properties.j2", context
                ),
                media_type="text/plain",
            )
        )

        files.append(
            GeneratedFile(
                path="docker-compose.yml",
                content=self.renderer.render("database/docker-compose.yml.j2", context),
                media_type="application/x-yaml",
            )
        )

        files.append(
            GeneratedFile(
                path="src/main/resources/schema.sql",
                content=self.renderer.render("database/schema.sql.j2", context),
                media_type="application/sql",
            )
        )

        # Evitar generar data.sql vacío porque Spring Boot 2.5+ lanza error si está vacío.
        # files.append(
        #     GeneratedFile(
        #         path="src/main/resources/data.sql",
        #         content=self.renderer.render("database/data.sql.j2", context),
        #         media_type="application/sql",
        #     )
        # )

        files.append(
            GeneratedFile(
                path="openapi/openapi.yaml",
                content=self.renderer.render("api/openapi.yaml.j2", context),
                media_type="application/x-yaml",
            )
        )

        # 4.1 Postman (programmatic generation)
        from postman_generator.generator import (
            generate_postman_collection,
            generate_postman_environment,
        )

        postman_collection = generate_postman_collection(model)
        postman_environment = generate_postman_environment(model)

        # OLD JINJA TEMPLATE (OBSOLETE)
        # files.append(GeneratedFile(
        #     path="postman/collection.json",
        #     content=self.renderer.render("api/postman_collection.json.j2", context),
        #     media_type="application/json"
        # ))

        files.append(
            GeneratedFile(
                path=f"postman/{project_name}.postman_collection.json",
                content=postman_collection.model_dump_json(
                    by_alias=True, indent=2, exclude_none=True
                ),
                media_type="application/json",
            )
        )

        files.append(
            GeneratedFile(
                path=f"postman/{project_name}.postman_environment.json",
                content=postman_environment.model_dump_json(
                    by_alias=True, indent=2, exclude_none=True
                ),
                media_type="application/json",
            )
        )

        files.append(
            GeneratedFile(
                path="README.md",
                content=self.renderer.render("README.md.j2", context),
                media_type="text/markdown",
            )
        )

        # 5. Renderizar plantillas por entidad
        for entity in entities:
            entity_ctx = {**context, "entity": entity}

            # Entity
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/entity/{entity.class_name}.java",
                    content=self.renderer.render("spring/entity.java.j2", entity_ctx),
                    media_type="text/x-java-source",
                )
            )

            # DTOs
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/dto/request/{entity.class_name}Request.java",
                    content=self.renderer.render(
                        "spring/dto_request.java.j2", entity_ctx
                    ),
                    media_type="text/x-java-source",
                )
            )
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/dto/response/{entity.class_name}Response.java",
                    content=self.renderer.render(
                        "spring/dto_response.java.j2", entity_ctx
                    ),
                    media_type="text/x-java-source",
                )
            )

            # Repository
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/repository/{entity.class_name}Repository.java",
                    content=self.renderer.render(
                        "spring/repository.java.j2", entity_ctx
                    ),
                    media_type="text/x-java-source",
                )
            )

            # Service
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/service/{entity.class_name}Service.java",
                    content=self.renderer.render("spring/service.java.j2", entity_ctx),
                    media_type="text/x-java-source",
                )
            )

            # Controller
            files.append(
                GeneratedFile(
                    path=f"{base_pkg_path}/controller/{entity.class_name}Controller.java",
                    content=self.renderer.render(
                        "spring/controller.java.j2", entity_ctx
                    ),
                    media_type="text/x-java-source",
                )
            )

            # Test
            test_pkg_path = f"src/test/java/{package_name.replace('.', '/')}"
            files.append(
                GeneratedFile(
                    path=f"{test_pkg_path}/controller/{entity.class_name}ControllerTest.java",
                    content=self.renderer.render(
                        "spring/controller_test.java.j2", entity_ctx
                    ),
                    media_type="text/x-java-source",
                )
            )

        # 6. Generar manifiesto
        manifest = GenerationManifest(
            project_name=project_name,
            total_files=len(files),
            total_entities=len(entities),
            total_relationships=len(model.relationships),
            total_endpoints=len(openapi_info.endpoints),
        )

        return GeneratedProject(name=project_name, files=files, manifest=manifest)
