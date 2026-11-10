"""Preparación compartida de las salidas relacionales."""

from dataclasses import dataclass

from app.core.canonical_model.model import UMLModel
from app.modules.generator.domain.dependency_graph import DependencyGraph
from app.modules.generator.domain.domain_analyzer import DomainAnalyzer, DomainType
from app.modules.generator.domain.entity_info import EntityInfo
from app.modules.generator.domain.entity_mapper import EntityMapper
from app.modules.generator.domain.exceptions import GenerationError
from app.modules.generator.domain.schema_mapper import SchemaInfo, SchemaMapper
from app.modules.generator.domain.synthetic_data_generator import (
    LogicalDataset,
    SyntheticDataGenerator,
)


@dataclass
class RelationalArtifacts:
    entities: list[EntityInfo]
    schema: SchemaInfo
    domain: DomainType
    dataset: LogicalDataset


def prepare_relational(
    model: UMLModel, rows: int = 3, include_data: bool = True
) -> RelationalArtifacts:
    if not model.classes:
        raise GenerationError("El diagrama no contiene clases para generar tablas.")
    if model.components or model.interfaces or model.ports or model.connectors:
        raise GenerationError("La generación SQL solo admite diagramas de clases.")
    entities = EntityMapper.map_entities(model)
    schema = SchemaMapper.map_schema(entities)
    domain = DomainAnalyzer.analyze(model)
    if include_data:
        entities = DependencyGraph.topological_sort(entities)
        dataset = SyntheticDataGenerator.generate(model, entities, domain, rows)
    else:
        dataset = LogicalDataset()
    return RelationalArtifacts(entities, schema, domain, dataset)
