# Reglas, Principios y Arquitectura

## Principios de Programación
1. **Clean Code & DRY**: Evitar la duplicación de código. Nombres de variables y funciones descriptivos.
2. **KISS (Keep It Simple, Stupid)**: Mantener las soluciones lo más simples posible. No sobre-ingeniar a menos que el requerimiento explícitamente lo demande.
3. **SOLID**:
   - **S**ingle Responsibility: Cada módulo/clase debe tener una única razón para cambiar.
   - **O**pen/Closed: Abierto a la extensión, cerrado a la modificación.
   - **L**iskov Substitution: Las clases derivadas deben poder sustituir a sus clases base.
   - **I**nterface Segregation: Es mejor tener muchas interfaces específicas que una general.
   - **D**ependency Inversion: Depender de abstracciones, no de concreciones.

## Estándares de Codificación
- **Python (Backend)**: 
  - Seguir estrictamente **PEP 8**.
  - Uso intensivo de Type Hints (`typing`) para todos los parámetros de función y retornos.
  - Formateadores automáticos como `black` y `isort`.
  - Linter: `flake8` o `ruff`.
- **TypeScript/React (Frontend)**:
  - Strict mode habilitado en `tsconfig.json`.
  - Interfaces para todos los modelos de dominio.
  - Componentes funcionales usando Hooks. No usar componentes de clase.
  - Estilos centralizados y modulares.

## Arquitecturas y Patrones
1. **Clean Architecture / Arquitectura Hexagonal**:
   - El núcleo (Dominio) no tiene dependencias externas (bases de datos, frameworks, UI).
   - Los adaptadores (Controllers, Repositories) actúan como puentes entre las capas de infraestructura y la lógica de negocio (Use Cases).
   - *Backend*: Separación en `/routers` (API), `/services` (Lógica), `/models` (DB), `/schemas` (DTOs/Pydantic).
2. **Feature-Sliced Design (FSD)** (En el Frontend):
   - Dividir la aplicación por características (Features) en lugar de por tipos técnicos.
   - Estructura: `app/` (config global), `pages/` (rutas), `widgets/` (bloques funcionales compuestos), `features/` (lógica de negocio como autenticación, compartir), `entities/` (datos de dominio puro), `shared/` (UI kit vainilla, utils compartidos).

## Reglas del Dominio UMLForge
- **NO reconstruir semántica**: Las relaciones se deben derivar de la estrategia real de persistencia generada por UMLForge, utilizando `CanonicalModel`.
- **Generación de IDs (Synthetic Data)**: Los IDs en Postman y `data.sql` deben ser trazables lógicamente (ej. ID autoincrementales manejados por un graph analyzer). No inyectar `id = 1` arbitrario si rompe la integridad referencial de los datasets sintéticos generados.
