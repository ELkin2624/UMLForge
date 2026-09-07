from app.core.canonical_model.relationship_model import UMLRelationship

from .relation_info import RelationInfo


class RelationshipMapper:
    """
    Mapea relaciones UML a estrategias JPA (owner, inverse, etc).
    """

    @classmethod
    def map_relationship(
        cls, rel: UMLRelationship, is_source: bool, target_class_name: str
    ) -> RelationInfo:
        # Determinar estrategia
        strategy = cls._determine_strategy(
            rel.source_multiplicity, rel.target_multiplicity
        )

        # Determinar si esta clase es el persistence_owner
        persistence_owner = cls._determine_ownership(rel, is_source, strategy)

        # Nombre del campo
        # (Si es_source, apunta al target, el target_role o el nombre de la clase objetivo en camelCase)
        # Por simplicidad, tomamos el nombre del target_class_name en minúscula, pluralizando si la mult es N
        their_mult = rel.target_multiplicity if is_source else rel.source_multiplicity

        is_collection = their_mult in ("*", "0..*", "1..*")

        field_name = target_class_name[0].lower() + target_class_name[1:]
        if is_collection:
            field_name += "s"  # Simple pluralization

        join_column = None

        # La estrategia efectiva desde el punto de vista de ESTA entidad
        # (ya invertida si is_source=False)
        effective_strategy = strategy if is_source else cls._invert_strategy(strategy)

        if persistence_owner:
            if effective_strategy in ("MANY_TO_ONE", "ONE_TO_ONE"):
                join_column = f"{target_class_name.lower()}_id"
            elif effective_strategy == "MANY_TO_MANY":
                # Tabla intermedia implícita en JPA si es owner
                pass

        # Cascade y composición
        cascade = None
        is_composition = rel.type == "composition"
        
        # En composición, si esta entidad tiene el lado '1', debe aplicar cascada hacia los 'muchos'
        # o hacia el '1' dependiente
        if is_composition and not is_source and effective_strategy in ("ONE_TO_MANY", "ONE_TO_ONE"):
            cascade = "CascadeType.ALL"
        elif is_composition and is_source and effective_strategy in ("ONE_TO_MANY", "ONE_TO_ONE"):
             cascade = "CascadeType.ALL"

        return RelationInfo(
            name=field_name,
            target_entity=target_class_name,
            relation_kind=effective_strategy,
            persistence_owner=persistence_owner,
            mapped_by=None,  # Lo rellenaremos en el EntityMapper con el contexto completo
            join_column=join_column,
            is_collection=is_collection,
            cascade=cascade,
            is_composition=is_composition,
        )

    @classmethod
    def _determine_strategy(cls, src_mult: str, tgt_mult: str) -> str:
        src_n = src_mult in ("*", "0..*", "1..*")
        tgt_n = tgt_mult in ("*", "0..*", "1..*")

        if not src_n and tgt_n:
            return "ONE_TO_MANY"
        elif src_n and not tgt_n:
            return "MANY_TO_ONE"
        elif src_n and tgt_n:
            return "MANY_TO_MANY"
        else:
            return "ONE_TO_ONE"

    @classmethod
    def _invert_strategy(cls, strategy: str) -> str:
        if strategy == "ONE_TO_MANY":
            return "MANY_TO_ONE"
        if strategy == "MANY_TO_ONE":
            return "ONE_TO_MANY"
        return strategy

    @classmethod
    def _determine_ownership(
        cls, rel: UMLRelationship, is_source: bool, strategy: str
    ) -> bool:
        # Heurísticas de Fase 2:
        # 1..* a 1 -> El lado * (Many) es siempre el propietario (MANY_TO_ONE con @JoinColumn)
        # ONE_TO_MANY desde source significa que target es MANY_TO_ONE. Así que target es owner.
        if strategy == "ONE_TO_MANY":
            return not is_source
        elif strategy == "MANY_TO_ONE":
            return is_source

        # *..* a *..* -> Se asume source es el propietario por defecto (con warning en validador)
        if strategy == "MANY_TO_MANY":
            return is_source

        # 1..1 a 1..1 -> El source es el propietario
        if strategy == "ONE_TO_ONE":
            return is_source

        return is_source
