from collections import Counter

from canonical_model.model import UMLModel

from validators.validation_result import ValidationResult


class ComponentValidator:
    """
    Validador semántico y estructural para Diagramas de Componentes UML 2.5.1.
    Aplica las reglas de unicidad, integridad referencial de puertos,
    compatibilidad de conectores y resolución de dependencias.
    """

    def validate(self, model: UMLModel, result: ValidationResult) -> None:
        self.validate_name_uniqueness(model, result)
        self.validate_port_references(model, result)
        self.validate_connectors(model, result)
        self.validate_dependencies(model, result)

    def validate_name_uniqueness(
        self, model: UMLModel, result: ValidationResult
    ) -> None:
        """Verifica que no existan nombres duplicados entre componentes ni entre interfaces."""
        comp_names = [c.name.strip().lower() for c in model.components if c.name]
        for name, count in Counter(comp_names).items():
            if count > 1:
                result.add_error(
                    f"COMP-001: Nombre de componente duplicado: '{name}' aparece {count} veces."
                )

        iface_names = [i.name.strip().lower() for i in model.interfaces if i.name]
        for name, count in Counter(iface_names).items():
            if count > 1:
                result.add_error(
                    f"COMP-002: Nombre de interfaz duplicado: '{name}' aparece {count} veces."
                )

    def validate_port_references(
        self, model: UMLModel, result: ValidationResult
    ) -> None:
        """Verifica que cada puerto referencie un componente y una interfaz existentes."""
        comp_ids = {str(c.id) for c in model.components}
        iface_ids = {str(i.id) for i in model.interfaces}

        for port in model.ports:
            # Componente contenedor
            if str(port.component_id) not in comp_ids:
                result.add_error(
                    f"COMP-003: El puerto '{port.name}' ({port.id}) referencia a un componente inexistente: {port.component_id}"
                )

            # Interfaz obligatoria (provided o required)
            if not port.interface_id or str(port.interface_id) not in iface_ids:
                result.add_error(
                    f"COMP-004: El puerto '{port.name}' ({port.id}) de tipo '{port.kind}' referencia a una interfaz inexistente o nula: {port.interface_id}"
                )

    def validate_connectors(self, model: UMLModel, result: ValidationResult) -> None:
        """
        Verifica que cada conector una dos puertos existentes,
        uno provided y otro required, y que ambos compartan la misma interfaz.
        """
        ports_by_id = {str(p.id): p for p in model.ports}

        for conn in model.connectors:
            s_id = str(conn.source_port_id)
            t_id = str(conn.target_port_id)

            if s_id not in ports_by_id:
                result.add_error(
                    f"COMP-005: El conector ({conn.id}) tiene un puerto origen inexistente: {s_id}"
                )
                continue

            if t_id not in ports_by_id:
                result.add_error(
                    f"COMP-006: El conector ({conn.id}) tiene un puerto destino inexistente: {t_id}"
                )
                continue

            src_port = ports_by_id[s_id]
            tgt_port = ports_by_id[t_id]

            # Conector no puede conectar un puerto consigo mismo
            if s_id == t_id:
                result.add_error(
                    f"COMP-007: El conector ({conn.id}) conecta un puerto consigo mismo: {s_id}"
                )
                continue

            # Regla provided / required
            kinds = {src_port.kind, tgt_port.kind}
            if kinds != {"provided", "required"}:
                result.add_error(
                    f"COMP-008: El conector ({conn.id}) debe unir un puerto 'provided' con un puerto 'required'. Tipos encontrados: '{src_port.kind}' y '{tgt_port.kind}'."
                )

            # Regla de compatibilidad de interfaz
            if src_port.interface_id != tgt_port.interface_id:
                result.add_error(
                    f"COMP-009: El conector ({conn.id}) une puertos con interfaces incompatibles: origen '{src_port.interface_id}' vs destino '{tgt_port.interface_id}'."
                )

    def validate_dependencies(self, model: UMLModel, result: ValidationResult) -> None:
        """Verifica que las dependencias apunten a elementos existentes (clases, componentes o interfaces)."""
        valid_element_ids = set()
        for cls in model.classes:
            valid_element_ids.add(str(cls.id))
        for comp in model.components:
            valid_element_ids.add(str(comp.id))
        for iface in model.interfaces:
            valid_element_ids.add(str(iface.id))

        for dep in model.dependencies:
            s_id = str(dep.source_id)
            t_id = str(dep.target_id)

            if s_id not in valid_element_ids:
                result.add_error(
                    f"COMP-010: La dependencia ({dep.id}) tiene un elemento origen inexistente: {s_id}"
                )
            if t_id not in valid_element_ids:
                result.add_error(
                    f"COMP-011: La dependencia ({dep.id}) tiene un elemento destino inexistente: {t_id}"
                )
