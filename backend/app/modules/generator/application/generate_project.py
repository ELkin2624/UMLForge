from pathlib import Path

from app.core.canonical_model.model import UMLModel
from app.core.validators.generation_rules import GenerationValidator
from app.core.validators.validation_result import ValidationResult

from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.exceptions import GenerationError
from app.modules.generator.domain.generated_project import GeneratedFile, GeneratedProject
from app.modules.generator.domain.generation_manifest import GenerationManifest
from app.modules.generator.domain.openapi_mapper import OpenAPIMapper
from app.modules.generator.domain.postman_mapper import PostmanMapper
from app.modules.generator.domain.schema_mapper import SchemaMapper
from app.modules.generator.infrastructure.jinja_renderer import JinjaRenderer


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

        # 2. Mapeos de dominio (Semantics) y Análisis de Dominio
        entities = EntityMapper.map_entities(model)
        from app.modules.generator.domain.domain_analyzer import DomainAnalyzer
        from app.modules.generator.domain.dependency_graph import DependencyGraph
        from app.modules.generator.domain.synthetic_data_generator import SyntheticDataGenerator

        domain = DomainAnalyzer.analyze(model)
        ordered_entities = DependencyGraph.topological_sort(entities)
        dataset = SyntheticDataGenerator.generate(model, ordered_entities, domain)

        schema_info = SchemaMapper.map_schema(ordered_entities)
        openapi_info = OpenAPIMapper.map_openapi(project_name, ordered_entities)
        postman_info = PostmanMapper.map_postman(project_name, ordered_entities)

        has_seed_data = bool(dataset.sql_statements)

        # 3. Contexto base para las plantillas
        context = {
            "app_name": project_name,
            "package_name": package_name,
            "entities": ordered_entities,
            "schema": schema_info,
            "openapi": openapi_info,
            "postman": postman_info,
            "domain": domain.value,
            "has_seed_data": has_seed_data,
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

        # Generar data.sql con seed coherente determinista SOLO si existen sentencias
        if has_seed_data:
            seed_content = "-- Seed data for " + project_name + "\n" + "\n".join(dataset.sql_statements) + "\n"
            files.append(
                GeneratedFile(
                    path="src/main/resources/data.sql",
                    content=seed_content,
                    media_type="application/sql",
                )
            )

        files.append(
            GeneratedFile(
                path="openapi/openapi.yaml",
                content=self.renderer.render("api/openapi.yaml.j2", context),
                media_type="application/x-yaml",
            )
        )

        # 4.1 Postman (programmatic generation)
        from app.modules.postman.generator import (
            generate_postman_collection,
            generate_postman_environment,
        )

        postman_collection = generate_postman_collection(
            model,
            ordered_entities=ordered_entities,
            domain=domain,
            dataset=dataset,
        )
        postman_environment = generate_postman_environment(
            model,
            dataset=dataset,
        )

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

        # Artefactos para el Ecosistema Móvil e IA On-Device
        from app.modules.generator.domain.mobile_schema_mapper import MobileSchemaMapper
        from app.modules.generator.domain.ai_tools_mapper import AIToolsMapper
        from app.modules.generator.domain.manifest_mapper import ManifestMapper

        mobile_schema = MobileSchemaMapper.map_schema(project_name, ordered_entities, domain=domain.value)
        ai_tools = AIToolsMapper.map_tools(project_name, ordered_entities, domain=domain.value)
        ai_context = AIToolsMapper.map_context(project_name, ordered_entities, domain=domain.value)
        mobile_manifest = ManifestMapper.map_manifest(project_name, domain=domain.value)

        files.append(
            GeneratedFile(
                path=f"mobile/{project_name}/manifest.json",
                content=mobile_manifest.model_dump_json(indent=2),
                media_type="application/json",
            )
        )
        files.append(
            GeneratedFile(
                path=f"mobile/{project_name}/schema.json",
                content=mobile_schema.model_dump_json(indent=2),
                media_type="application/json",
            )
        )
        files.append(
            GeneratedFile(
                path=f"mobile/{project_name}/ai-tools.json",
                content=ai_tools.model_dump_json(indent=2),
                media_type="application/json",
            )
        )
        files.append(
            GeneratedFile(
                path=f"mobile/{project_name}/ai-context.json",
                content=ai_context.model_dump_json(indent=2),
                media_type="application/json",
            )
        )
        files.append(
            GeneratedFile(
                path=f"mobile/{project_name}/branding.json",
                content=mobile_manifest.branding.model_dump_json(indent=2),
                media_type="application/json",
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
