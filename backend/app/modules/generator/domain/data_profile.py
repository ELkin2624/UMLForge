import re
from typing import Any

from .domain_analyzer import DomainType
from .field_info import FieldInfo


class DataProfile:
    """
    Estrategia centralizada para generar datos sintéticos (Postman dinámico y SQL determinista).
    Resuelve el rol semántico del atributo según su nombre, tipo UML, nombre de clase y dominio detectado.
    """

    # Diccionarios de datos deterministas por dominio (Español / realistas)
    _DOMAIN_SAMPLES: dict[DomainType, dict[str, list[Any]]] = {
        DomainType.CLINICAL: {
            "diagnostico": [
                "Hipertensión arterial leve",
                "Faringoamigdalitis aguda",
                "Gastritis erosiva superficial",
                "Control preventivo anual",
                "Rinitis alérgica estacional",
            ],
            "medicamento": [
                "Amoxicilina 500mg",
                "Ibuprofeno 400mg",
                "Paracetamol 1g",
                "Omeprazol 20mg",
                "Losartán 50mg",
            ],
            "especialidad": [
                "Cardiología",
                "Pediatría",
                "Medicina General",
                "Traumatología",
                "Dermatología",
            ],
            "motivo": [
                "Chequeo general de rutina",
                "Dolor abdominal persistente",
                "Cefalea y fiebre leve",
                "Control post-operatorio",
            ],
            "alergias": ["Penicilina", "Ninguna conocida", "AINEs", "Polen y ácaros"],
            "gruposanguineo": ["O+", "A+", "B+", "AB+", "O-"],
        },
        DomainType.E_COMMERCE: {
            "producto": [
                "Laptop Lenovo ThinkPad 14",
                "Monitor LG UltraGear 27",
                "Teclado Mecánico RGB",
                "Mouse Inalámbrico Logitech",
                "Auriculares Sony WH-1000XM4",
            ],
            "categoria": [
                "Electrónica",
                "Computación",
                "Accesorios",
                "Audio y Video",
                "Oficina",
            ],
            "metodopago": [
                "Tarjeta de Crédito",
                "Transferencia Bancaria",
                "Efectivo",
                "QR Simple",
            ],
            "estado": ["PENDIENTE", "PAGADO", "ENVIADO", "ENTREGADO"],
        },
        DomainType.EDUCATIONAL: {
            "materia": [
                "Ingeniería de Software I",
                "Bases de Datos Avanzadas",
                "Estructuras de Datos",
                "Sistemas Operativos",
                "Redes de Computadoras",
            ],
            "curso": [
                "Ingeniería de Software I",
                "Bases de Datos Avanzadas",
                "Estructuras de Datos",
                "Sistemas Operativos",
                "Redes de Computadoras",
            ],
            "carrera": [
                "Ingeniería de Sistemas",
                "Ingeniería Informática",
                "Ciencias de la Computación",
                "Telecomunicaciones",
            ],
            "semestre": ["2025-1", "2025-2", "2024-2"],
            "aula": ["Aula 101", "Lab Cómputo B", "Aula Magna", "Lab Redes"],
        },
        DomainType.RESTAURANT: {
            "plato": [
                "Lomo Saltado Clásico",
                "Pique Macho Especial",
                "Pasta Carbonara Gourmet",
                "Hamburguesa Artesanal Doble",
                "Ensalada César con Pollo",
            ],
            "categoria": ["Platos Fuertes", "Entradas", "Bebidas", "Postres"],
        },
        DomainType.HOTEL: {
            "tipohabitacion": ["INDIVIDUAL", "DOBLE_ESTANDAR", "SUITE_MATRIMONIAL", "FAMILIAR"],
            "estado": ["DISPONIBLE", "OCUPADA", "RESERVADA", "MANTENIMIENTO"],
        },
        DomainType.FINANCIAL: {
            "tipocuenta": ["AHORROS", "CORRIENTE", "PLAZO_FIJO"],
            "moneda": ["USD", "BOB", "EUR"],
        },
    }

    _GENERIC_FIRST_NAMES = [
        "María", "Carlos", "Ana", "Juan", "Lucía",
        "Roberto", "Elena", "Diego", "Sofía", "Javier",
    ]
    _GENERIC_LAST_NAMES = [
        "González", "Rodríguez", "Pérez", "Fernández", "López",
        "Martínez", "Sánchez", "Torres", "Ramírez", "Flores",
    ]

    @classmethod
    def resolve_postman_expression(
        cls, field: FieldInfo, class_name: str, domain: DomainType
    ) -> tuple[str, bool]:
        """
        Retorna (expresión_postman, is_raw).
        Si is_raw es True, el valor NO debe envolverse en comillas dobles en JSON (ej. números, booleans).
        """
        name_lower = field.name.lower()
        java_type = field.java_type

        # 1. Tipos primitivos numéricos o booleanos (siempre is_raw=True)
        if java_type in ("Integer", "Long"):
            if "edad" in name_lower or "age" in name_lower:
                return "{{$randomInt}}", True
            if "cantidad" in name_lower or "stock" in name_lower or "unidades" in name_lower:
                return "{{$randomInt}}", True
            return "{{$randomInt}}", True

        if java_type in ("Double", "BigDecimal"):
            if any(k in name_lower for k in ("precio", "price", "total", "monto", "importe", "costo", "salario", "sueldo")):
                return "{{$randomPrice}}", True
            return "{{$randomPrice}}", True

        if java_type == "Boolean":
            return "true", True

        # 2. Heurísticas semánticas para Strings/Fechas/UUIDs
        if "email" in name_lower or "correo" in name_lower:
            # Faker dinámico para evitar colisiones UNIQUE en ejecuciones consecutivas
            return "{{$randomEmail}}", False

        if any(k in name_lower for k in ("telefono", "phone", "celular", "movil")):
            return "{{$randomPhoneNumber}}", False

        if any(k in name_lower for k in ("firstname", "primer_nombre", "nombres")) or name_lower in ("nombre", "name"):
            return "{{$randomFirstName}}", False

        if any(k in name_lower for k in ("lastname", "apellido", "apellidos")):
            return "{{$randomLastName}}", False

        if any(k in name_lower for k in ("fullname", "nombrecompleto")):
            return "{{$randomFullName}}", False

        if any(k in name_lower for k in ("ci", "dni", "cedula", "identificacion", "documento")):
            # Dinámico para no colisionar si es UNIQUE
            return "{{$randomInt}}", False

        if any(k in name_lower for k in ("codigo", "code", "sku", "uuid")) or java_type == "UUID":
            return "{{$randomUUID}}", False

        if any(k in name_lower for k in ("direccion", "address", "domicilio")):
            return "{{$randomStreetAddress}}", False

        if any(k in name_lower for k in ("ciudad", "city")):
            return "{{$randomCity}}", False

        if any(k in name_lower for k in ("pais", "country")):
            return "{{$randomCountry}}", False

        if "producto" in name_lower or (name_lower == "nombre" and "producto" in class_name.lower()):
            return "{{$randomProductName}}", False

        if any(k in name_lower for k in ("descripcion", "observacion", "comentario", "nota", "notas", "detalle")):
            return "{{$randomLoremSentence}}", False

        if java_type in ("LocalDate", "Date") or "fecha" in name_lower:
            return "2025-01-15", False

        if java_type in ("LocalDateTime", "Instant"):
            return "2025-01-15T10:30:00", False

        # 3. Mapeo específico por dominio
        if domain in cls._DOMAIN_SAMPLES:
            samples_dict = cls._DOMAIN_SAMPLES[domain]
            for key, val_list in samples_dict.items():
                if key in name_lower:
                    return str(val_list[0]), False

        # Fallback genérico realista
        return f"{field.name}_val", False

    @classmethod
    def resolve_sql_deterministic_value(
        cls, field: FieldInfo, class_name: str, domain: DomainType, index: int = 0
    ) -> str:
        """
        Retorna el literal SQL formateado (incluyendo comillas si es String/Fecha) para INSERT determinista.
        """
        name_lower = field.name.lower()
        java_type = field.java_type

        # 1. Numéricos y Booleans
        if java_type in ("Integer", "Long"):
            if "edad" in name_lower:
                return str(20 + (index * 5) % 40)
            if any(k in name_lower for k in ("cantidad", "stock")):
                return str(10 + (index * 15) % 100)
            return str(index + 1)

        if java_type in ("Double", "BigDecimal"):
            if any(k in name_lower for k in ("precio", "total", "monto", "importe", "costo")):
                base_price = 49.90 + (index * 35.50)
                return f"{base_price:.2f}"
            return f"{(index + 1) * 10.5:.2f}"

        if java_type == "Boolean":
            return "true" if index % 2 == 0 else "false"

        # 2. Fechas
        if java_type in ("LocalDate", "Date") or "fecha" in name_lower:
            day = (index % 25) + 1
            return f"'2025-01-{day:02d}'"

        if java_type in ("LocalDateTime", "Instant"):
            day = (index % 25) + 1
            return f"'2025-01-{day:02d} 10:30:00'"

        # 3. UUID
        if java_type == "UUID" or "uuid" in name_lower:
            return f"'00000000-0000-0000-0000-{index + 1:012d}'"

        # 4. Strings semánticos
        fn_idx = index % len(cls._GENERIC_FIRST_NAMES)
        ln_idx = index % len(cls._GENERIC_LAST_NAMES)
        first_name = cls._GENERIC_FIRST_NAMES[fn_idx]
        last_name = cls._GENERIC_LAST_NAMES[ln_idx]

        if "email" in name_lower or "correo" in name_lower:
            # Determinista y único por índice
            slug = f"{cls._slugify(first_name)}.{cls._slugify(last_name)}{index + 1}"
            return f"'{slug}@example.com'"

        if any(k in name_lower for k in ("telefono", "phone", "celular", "movil")):
            phone_num = 70000000 + (index * 12345) % 9000000
            return f"'+591 {phone_num}'"

        if any(k in name_lower for k in ("ci", "dni", "cedula", "identificacion", "documento")):
            id_num = 5000000 + (index * 34211) % 4000000
            return f"'{id_num}'"

        if any(k in name_lower for k in ("firstname", "primer_nombre", "nombres")) or name_lower in ("nombre", "name"):
            return f"'{first_name}'"

        if any(k in name_lower for k in ("lastname", "apellido", "apellidos")):
            return f"'{last_name}'"

        if any(k in name_lower for k in ("fullname", "nombrecompleto")):
            return f"'{first_name} {last_name}'"

        if any(k in name_lower for k in ("direccion", "address", "domicilio")):
            return f"'Av. Principal #{100 + index * 10}'"

        if any(k in name_lower for k in ("ciudad", "city")):
            cities = ["La Paz", "Cochabamba", "Santa Cruz", "Sucre", "Tarija"]
            return f"'{cities[index % len(cities)]}'"

        if any(k in name_lower for k in ("pais", "country")):
            return "'Bolivia'"

        # 5. Mapeo específico por dominio
        if domain in cls._DOMAIN_SAMPLES:
            samples_dict = cls._DOMAIN_SAMPLES[domain]
            for key, val_list in samples_dict.items():
                if key in name_lower:
                    val = val_list[index % len(val_list)]
                    return f"'{val}'"

        if any(k in name_lower for k in ("descripcion", "observacion", "comentario")):
            return f"'Registro de prueba {index + 1} para {class_name}'"

        return f"'{class_name} {field.name} {index + 1}'"

    @staticmethod
    def _slugify(text: str) -> str:
        import unicodedata
        text = unicodedata.normalize("NFD", text)
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        return re.sub(r"[^a-zA-Z0-9]", "", text).lower()
