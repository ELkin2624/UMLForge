from collections import defaultdict, deque
from typing import Any

from .entity_info import EntityInfo
from .exceptions import GenerationError


class DependencyGraph:
    """
    Construye el grafo de dependencias de persistencia entre entidades.
    Permite obtener el ordenamiento topológico (padres primero, hijos después)
    y detectar ciclos de dependencia duros (irresolubles) o blandos (resolubles).
    """

    @classmethod
    def topological_sort(cls, entities: list[EntityInfo]) -> list[EntityInfo]:
        if not entities:
            return []

        entity_by_name = {e.class_name: e for e in entities}
        entity_names = set(entity_by_name.keys())

        # edges: target -> list of entities that depend on target (target must be created BEFORE owner)
        hard_adj: dict[str, set[str]] = defaultdict(set)
        soft_adj: dict[str, set[str]] = defaultdict(set)
        hard_in_degree: dict[str, int] = {name: 0 for name in entity_names}
        full_in_degree: dict[str, int] = {name: 0 for name in entity_names}

        for entity in entities:
            owner_name = entity.class_name

            # 1. Herencia: hijo depende del padre (hard)
            if entity.parent_class and entity.parent_class in entity_names:
                parent_name = entity.parent_class
                if parent_name != owner_name:
                    hard_adj[parent_name].add(owner_name)
                    hard_in_degree[owner_name] += 1
                    full_in_degree[owner_name] += 1

            # 2. Relaciones de persistencia
            for rel in entity.relations:
                # Solo el persistence_owner crea la dependencia hacia el target
                if not rel.persistence_owner:
                    continue

                target_name = rel.target_entity
                if target_name not in entity_names:
                    continue

                # Auto-referencia siempre es soft
                if target_name == owner_name:
                    soft_adj[target_name].add(owner_name)
                    continue

                # Composición o multiplicidad estricta es hard
                # Si es una relación ManyToOne o OneToOne estándar:
                # Comprobamos si el campo correspondiente o relación es obligatoria
                is_hard = rel.is_composition
                
                # Buscar si hay campo con el mismo nombre o join_column marcado como no nullable
                matching_field = next(
                    (f for f in entity.fields if f.name == rel.name or f.name == rel.join_column),
                    None
                )
                if matching_field and not matching_field.is_nullable:
                    is_hard = True

                if is_hard:
                    if owner_name not in hard_adj[target_name]:
                        hard_adj[target_name].add(owner_name)
                        hard_in_degree[owner_name] += 1
                        full_in_degree[owner_name] += 1
                else:
                    if owner_name not in soft_adj[target_name] and owner_name not in hard_adj[target_name]:
                        soft_adj[target_name].add(owner_name)
                        full_in_degree[owner_name] += 1

        # Intentar ordenamiento topológico completo (Hard + Soft) con Kahn
        full_adj: dict[str, set[str]] = defaultdict(set)
        for u in entity_names:
            full_adj[u] = hard_adj[u] | soft_adj[u]

        queue = deque([name for name in entity_names if full_in_degree[name] == 0])
        sorted_names: list[str] = []

        in_deg_copy = dict(full_in_degree)
        while queue:
            node = queue.popleft()
            sorted_names.append(node)
            for neighbor in full_adj[node]:
                in_deg_copy[neighbor] -= 1
                if in_deg_copy[neighbor] == 0:
                    queue.append(neighbor)

        if len(sorted_names) == len(entity_names):
            return [entity_by_name[name] for name in sorted_names]

        # Si hubo ciclo en el grafo completo, verificar si es ciclo DURO (solo hard_adj)
        hard_queue = deque([name for name in entity_names if hard_in_degree[name] == 0])
        hard_sorted: list[str] = []
        hard_deg_copy = dict(hard_in_degree)

        while hard_queue:
            node = hard_queue.popleft()
            hard_sorted.append(node)
            for neighbor in hard_adj[node]:
                hard_deg_copy[neighbor] -= 1
                if hard_deg_copy[neighbor] == 0:
                    hard_queue.append(neighbor)

        if len(hard_sorted) < len(entity_names):
            # Ciclo duro irresoluble!
            unresolved = [name for name in entity_names if hard_deg_copy[name] > 0]
            raise GenerationError(
                f"SEED_CYCLE_DETECTED: Ciclo de dependencias no resoluble detectado entre las entidades: {', '.join(unresolved)}"
            )

        # Si el ciclo se rompe al ignorar las aristas blandas (soft), es resoluble
        # Completamos el orden con los nodos que faltaban respetando el orden hard
        remaining = [name for name in hard_sorted if name not in sorted_names]
        final_names = sorted_names + remaining
        return [entity_by_name[name] for name in final_names]
