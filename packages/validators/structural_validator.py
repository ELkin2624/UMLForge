from canonical_model.model import UMLModel

from .validation_result import ValidationResult


class StructuralValidator:
    """
    Valida la integridad estructural del modelo UML.
    Por ejemplo, se asegura de que las relaciones (source y target) referencien a IDs existentes.
    """

    def validate(self, model: UMLModel, result: ValidationResult) -> None:
        # Recopilar todos los IDs de elementos que pueden ser referenciados
        valid_ids = set()

        for cls in model.classes:
            valid_ids.add(str(cls.id))
            for attr in cls.attributes:
                valid_ids.add(str(attr.id))
            for op in cls.operations:
                valid_ids.add(str(op.id))

        for comp in model.components:
            valid_ids.add(str(comp.id))

        for port in model.ports:
            valid_ids.add(str(port.id))

        for interface in model.interfaces:
            valid_ids.add(str(interface.id))
            for op in interface.operations:
                valid_ids.add(str(op.id))

        for conn in model.connectors:
            valid_ids.add(str(conn.id))

        for dep in model.dependencies:
            valid_ids.add(str(dep.id))

        for rel in model.relationships:
            valid_ids.add(str(rel.id))

        # Validar las relaciones
        for rel in model.relationships:
            if rel.source not in valid_ids:
                result.add_error(
                    f"UML-001: La relación '{rel.name}' ({rel.id}) tiene un origen inexistente: {rel.source}"
                )
            if rel.target not in valid_ids:
                result.add_error(
                    f"UML-002: La relación '{rel.name}' ({rel.id}) tiene un destino inexistente: {rel.target}"
                )

        # Validar diagramas
        for diagram in model.diagrams:
            for elem_id in diagram.element_ids:
                if elem_id not in valid_ids:
                    result.add_error(
                        f"UML-003: El diagrama '{diagram.name}' ({diagram.id}) hace referencia al elemento '{elem_id}' que no existe en el modelo."
                    )
