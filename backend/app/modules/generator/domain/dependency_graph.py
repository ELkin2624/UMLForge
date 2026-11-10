"""Orden estable de inserción según las dependencias reales de persistencia."""

from .entity_info import EntityInfo
from .exceptions import GenerationError


class DependencyGraph:
    @classmethod
    def topological_sort(cls, entities: list[EntityInfo]) -> list[EntityInfo]:
        by_name = {e.class_name: e for e in entities}
        hard: dict[str, set[str]] = {}
        full: dict[str, set[str]] = {}
        for entity in entities:
            required = {entity.parent_class} if entity.parent_class else set()
            optional: set[str] = set()
            for rel in entity.relations:
                if not rel.persistence_owner or rel.relation_kind not in (
                    "ONE_TO_ONE",
                    "MANY_TO_ONE",
                ):
                    continue
                if rel.target_entity == entity.class_name:
                    continue
                if rel.is_composition or not rel.is_nullable:
                    required.add(rel.target_entity)
                else:
                    optional.add(rel.target_entity)
            hard[entity.class_name] = required & by_name.keys()
            full[entity.class_name] = (required | optional) & by_name.keys()

        def sort(dependencies: dict[str, set[str]]) -> list[EntityInfo]:
            result: list[EntityInfo] = []
            done: set[str] = set()
            while len(result) < len(entities):
                ready = next(
                    (
                        e
                        for e in entities
                        if e.class_name not in done
                        and dependencies[e.class_name] <= done
                    ),
                    None,
                )
                if ready is None:
                    break
                result.append(ready)
                done.add(ready.class_name)
            return result

        ordered = sort(full)
        if len(ordered) == len(entities):
            return ordered
        ordered = sort(hard)
        if len(ordered) != len(entities):
            raise GenerationError(
                "SEED_CYCLE_DETECTED: ciclo de dependencias obligatorias no soportado."
            )
        return ordered
