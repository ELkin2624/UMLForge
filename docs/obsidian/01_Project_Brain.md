# Project Brain - UMLForge / Parcial Software 1

## Estado Actual del Proyecto
El proyecto consiste en una plataforma que genera backends (Spring Boot/PostgreSQL) a partir de diagramas UML. 
Hemos alcanzado una arquitectura completa (`CanonicalModel → Domain Analyzer → Dependency Graph → Synthetic Data Generator → [data.sql, Postman]`).

### Lo que hemos logrado:
1. **Generador de Datos de Prueba (Seed) Inteligente**:
   - Soporte para relaciones complejas: 1:1, 1:N, N:1, N:M (con y sin tabla join explícita), composición, agregación, generalización/herencia.
   - Datos dinámicos usando Faker (`{{$randomFirstName}}`, etc.) para Postman y datos relacionales en `data.sql`.
   - Se mantiene la integridad referencial en `data.sql` (reutilización de IDs lógicos sin inventar valores sueltos).

2. **Sincronización y Colaboración en Tiempo Real (Google Docs Style)**:
   - Implementado en el Frontend (React + Apollon Editor).
   - Modal de Compartir (`ShareDialog.tsx`) que permite asignar roles (`EDITOR`, `READER`).
   - Los enlaces de invitación tienen permisos específicos. 
   - Modo `readonly` reactivo en ApollonEditor cuando el usuario entra como Lector.

3. **Correcciones en Backend (FastAPI / PostgreSQL)**:
   - Se resolvió un conflicto de puertos donde `psycopg2.OperationalError` fallaba porque Docker publicaba en el puerto 5432 y colisionaba con una instalación local de PostgreSQL en Windows.
   - Solución: Se actualizó el puerto en `.env` y el mapeo en `docker-compose.yml` al puerto `5437`.

### Lo que nos falta (Próximos Pasos):
1. **Verificación Manual del Frontend**:
   - Pruebas E2E del Modal de Compartir y comportamiento de edición concurrente (realizado por el usuario).
2. **IA Local en Móvil (AURA)**:
   - Asistente de belleza y moda con IA local, integrado y adaptativo.
   - (Ver documento `03_Estrategia_IA_Local_AURA.md`).

## Tecnologías Principales
- **Backend Principal**: FastAPI (Python), PostgreSQL, SQLAlchemy.
- **Frontend**: React, Vite, TailwindCSS/CSS vainilla, Apollon (UML Editor).
- **Generador UML a Código**: Lógica basada en AST / CanonicalModel que exporta a Spring Boot + JPA + OpenAPI (Postman Collections).
