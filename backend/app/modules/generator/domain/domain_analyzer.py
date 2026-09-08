import re
import unicodedata
from enum import Enum

from app.core.canonical_model.model import UMLModel


class DomainType(str, Enum):
    CLINICAL = "CLINICAL"
    E_COMMERCE = "E_COMMERCE"
    EDUCATIONAL = "EDUCATIONAL"
    FINANCIAL = "FINANCIAL"
    HR = "HR"
    LOGISTICS = "LOGISTICS"
    HOTEL = "HOTEL"
    RESTAURANT = "RESTAURANT"
    GENERIC = "GENERIC"


class DomainAnalyzer:
    """
    Analiza semánticamente el modelo UML (nombres de clases y atributos)
    para inferir el rubro o dominio de negocio.
    Garantiza fallback universal a GENERIC si no hay suficiente coincidencia.
    """

    _DOMAIN_KEYWORDS: dict[DomainType, set[str]] = {
        DomainType.CLINICAL: {
            "paciente", "medico", "doctor", "consulta", "cita", "clinica", "hospital",
            "diagnostico", "tratamiento", "medicamento", "receta", "historia", "enfermero",
            "especialidad", "sintoma", "triage", "historiaclinica", "atencion", "cirugia",
            "laboratorio", "anamnesis", "dosis", "farmacia"
        },
        DomainType.E_COMMERCE: {
            "producto", "categoria", "articulo", "pedido", "orden", "compra", "venta",
            "cliente", "carrito", "item", "detalle", "factura", "pago", "proveedor",
            "descuento", "envio", "cupon", "stock", "precio", "detallepedido", "marca",
            "inventario", "comprobante"
        },
        DomainType.EDUCATIONAL: {
            "alumno", "estudiante", "profesor", "docente", "maestro", "curso", "materia",
            "asignatura", "carrera", "inscripcion", "matricula", "calificacion", "nota",
            "examen", "aula", "facultad", "universidad", "colegio", "periodo", "semestre",
            "parcial", "evaluacion", "tutoria"
        },
        DomainType.FINANCIAL: {
            "cuenta", "transaccion", "tarjeta", "banco", "prestamo", "credito", "debito",
            "saldo", "deposito", "retiro", "transferencia", "interes", "titular",
            "sucursal", "inversion", "cajero", "moneda", "bancario", "balance"
        },
        DomainType.HR: {
            "empleado", "trabajador", "funcionario", "departamento", "puesto", "cargo",
            "contrato", "nomina", "salario", "sueldo", "vacacion", "asistencia", "beneficio",
            "reclutamiento", "candidato", "area", "planilla"
        },
        DomainType.LOGISTICS: {
            "envio", "vehiculo", "camion", "ruta", "almacen", "paquete", "conductor",
            "chofer", "entrega", "transporte", "seguimiento", "guia", "despacho", "carga",
            "bodega", "tracking", "distribucion", "flete"
        },
        DomainType.HOTEL: {
            "habitacion", "reserva", "huesped", "hotel", "recepcion", "checkin", "checkout",
            "tarifa", "piso", "cama", "estancia", "servicio", "alojamiento", "suite"
        },
        DomainType.RESTAURANT: {
            "plato", "comida", "mesa", "mesero", "mozo", "comanda", "menu", "ingrediente",
            "chef", "cocina", "bebida", "receta", "restaurante", "bar", "pedido"
        },
    }

    @classmethod
    def analyze(cls, model: UMLModel) -> DomainType:
        scores: dict[DomainType, float] = {d: 0.0 for d in DomainType if d != DomainType.GENERIC}

        # Extraer tokens de nombres de clases (peso alto: 3.0)
        for uml_class in model.classes:
            tokens = cls._tokenize(uml_class.name)
            for token in tokens:
                for domain, keywords in cls._DOMAIN_KEYWORDS.items():
                    if token in keywords:
                        scores[domain] += 3.0

            # Extraer tokens de atributos (peso medio: 1.0)
            for attr in uml_class.attributes:
                attr_tokens = cls._tokenize(attr.name)
                for atok in attr_tokens:
                    for domain, keywords in cls._DOMAIN_KEYWORDS.items():
                        if atok in keywords:
                            scores[domain] += 1.0

        if not scores:
            return DomainType.GENERIC

        best_domain = max(scores, key=scores.get)  # type: ignore[arg-type]
        best_score = scores[best_domain]

        # Umbral mínimo de confianza para evitar falsos positivos
        if best_score < 3.0:
            return DomainType.GENERIC

        return best_domain

    @staticmethod
    def _normalize(text: str) -> str:
        text = unicodedata.normalize("NFD", text)
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        return text.lower()

    @classmethod
    def _tokenize(cls, name: str) -> list[str]:
        cleaned = cls._normalize(name)
        # Separar camelCase y snake_case
        parts = re.findall(r"[a-z0-9]+", cleaned)
        return parts
