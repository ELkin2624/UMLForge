import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

vault_dir = Path(r"C:\Users\apaza\OneDrive\Documentos\Obsidian Vault\Parcial-Software-1")
vault_dir.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------------------
# 1. 00 - AGENT_KNOWLEDGE_GRAPH.md (The High-Density AI Agent Kernel)
# -------------------------------------------------------------------------
agent_kernel = """---
type: agent-kernel
project: UMLForge
version: 2.0.0
last_updated: 2026-09-08
context_window_target: ultra-low-token
status: active
tags:
  - ai-kernel
  - knowledge-graph
  - ontology
  - fast-lookup
aliases:
  - AgentBrain
  - UMLForgeKernel
  - CerebroAI
---

# 🧠 AGENT KNOWLEDGE GRAPH & ONTOLOGY KERNEL (UMLFORGE)

> [!NOTE]
> **AI INGESTION NOTICE**: Este documento es el **núcleo semántico de alta densidad** para que un agente de IA entienda el 100% de UMLForge en una sola lectura sin explorar el código fuente desde cero. Contiene ontología formal, grafo de dependencias, tabla de símbolos y árboles de decisión.

---

## 🌐 1. Grafo Topológico del Sistema (System Topology Graph)

```mermaid
graph TD
    subgraph CoreDomain [Capa Core - Dominio Puro]
        CM[[CanonicalModel]]
        UMLC[UMLClass]
        UMLR[UMLRelationship]
        UMLA[UMLAttribute]
        GV[[GenerationValidator]]
        CM --- UMLC
        CM --- UMLR
        UMLC --- UMLA
        CM --> GV
    end

    subgraph DataAndGraph [Capa Dominio Generador]
        DA[[DomainAnalyzer]]
        DG[[DependencyGraph]]
        SDG[[SyntheticDataGenerator]]
        DP[DataProfile]
        SM[[SchemaMapper]]
        EM[EntityMapper]
        
        CM --> EM
        EM --> DG
        CM --> DA
        DG --> SDG
        DA --> SDG
        DP --> SDG
        DG --> SM
    end

    subgraph Generators [Capa Aplicación & Generación]
        SG[[SpringGenerator]]
        PG[[PostmanGenerator]]
        RM[ResourceMapper]
        XMI[[XMI_Interoperability]]
        
        EM --> SG
        SM --> SG
        SDG --> SG
        EM --> RM
        RM --> PG
        SDG --> PG
        CM <--> XMI
    end

    subgraph ArtifactsProduced [Artefactos Generados]
        JavaCode[Spring Boot 3 App / Java 21]
        SchemaSQL[schema.sql DDL Idempotente]
        DataSQL[data.sql Seed Idempotente]
        PostmanCol[*.postman_collection.json Dinámico]
        PostmanEnv[*.postman_environment.json]
        
        SG --> JavaCode
        SG --> SchemaSQL
        SG --> DataSQL
        PG --> PostmanCol
        PG --> PostmanEnv
    end

    subgraph Runtimes [Ejecución Real]
        DockerPG[(PostgreSQL 15+ Container)]
        SpringRuntime[Tomcat :8080 Spring Boot API]
        NewmanRunner[Newman E2E Test Suite]
        
        SchemaSQL --> DockerPG
        DataSQL --> DockerPG
        JavaCode --> SpringRuntime
        SpringRuntime <--> DockerPG
        PostmanCol --> NewmanRunner
        NewmanRunner --> SpringRuntime
    end

    subgraph CollaborationAndClient [Frontend & Colaboración]
        FSD[[FeatureSlicedDesign]]
        YJS[[Yjs_Collaboration]]
        WS[Node.js WebSocket Server]
        Canvas[React Flow / Apollon Canvas]
        
        Canvas --> FSD
        FSD <--> YJS
        YJS <--> WS
        FSD --> CM
    end

    subgraph LocalAI [Motores de Inteligencia Artificial]
        WWeb[[Local_AI_Whisper]]
        MAI[[Mobile_Local_AI_Engine]]
        
        WWeb -->|Voz Web Worker| CM
        MAI -->|Voz/Visión Offline Móvil| CM
    end
```

---

## 🗂️ 2. Ontología Formal & Tabla de Símbolos (Codebase Registry)

| Módulo Canónico | Ruta Física en Workspace | Clase / Función Principal | Responsabilidad Invariante |
| :--- | :--- | :--- | :--- |
| **[[CanonicalModel]]** | `backend/app/core/canonical_model/model.py` | `UMLModel`, `UMLClass`, `UMLRelationship` | Contrato central único. Define atributos, tipos, visibilidad y multiplicidades. |
| **[[GenerationValidator]]** | `backend/app/core/validators/generation_rules.py` | `GenerationValidator.validate()` | Valida 12+ reglas semánticas previas a la generación. |
| **[[DomainAnalyzer]]** | `backend/app/modules/generator/domain/domain_analyzer.py` | `DomainAnalyzer.analyze()` | Infiere `DomainType` (`E_COMMERCE`, `CLINICAL`, `FINANCIAL`, `EDUCATIONAL`, `LOGISTICS`, `GENERIC`). |
| **[[DependencyGraph]]** | `backend/app/modules/generator/domain/dependency_graph.py` | `DependencyGraph.topological_sort()` | Resuelve orden de inserción. Si detecta ciclo duro irresoluble, lanza `SEED_CYCLE_DETECTED`. |
| **[[SyntheticDataGenerator]]** | `backend/app/modules/generator/domain/synthetic_data_generator.py` | `SyntheticDataGenerator.generate()` | Genera `LogicalDataset`: inserts con `ON CONFLICT DO NOTHING`, `setval` de secuencias y Postman defaults. |
| **DataProfile** | `backend/app/modules/generator/domain/data_profile.py` | `DataProfile.resolve_postman_expression()` | Mapea atributos a Faker Postman (`{{$randomFirstName}}`) o valores SQL deterministas. |
| **SchemaMapper** | `backend/app/modules/generator/domain/schema_mapper.py` | `SchemaMapper.map_schema()` | Genera `TableInfo`. Coloca join tables N:M al final con `PRIMARY KEY (col1, col2)`. |
| **EntityMapper** | `backend/app/modules/generator/domain/entity_mapper.py` | `EntityMapper.map_entities()` | Produce `EntityInfo` con `resource_path` único, tipos Java/SQL y detección de herencia/propietarios. |
| **[[SpringGenerator]]** | `backend/app/modules/generator/application/generate_project.py` | `ProjectGenerator.generate()` | Renderiza plantillas Jinja2 (Entity, DTOs, Service, Controller, Repositories, Pom, Application). |
| **[[PostmanGenerator]]** | `backend/app/modules/postman/generator.py` | `generate_postman_collection()` | Construye JSON v2.1.0 con auto-captura de IDs (`pm.collectionVariables.set`), variables y raw tokens. |
| **ResourceMapper** | `backend/app/modules/postman/resource_mapper.py` | `map_entities_to_resources()` | Única fuente de verdad compartida para rutas REST (`route = entity.resource_path`). |
| **[[XMI_Interoperability]]** | `backend/app/modules/xmi/` | `XMIParser`, `XMIWriter` | Parser y serializador OMG XMI 2.5.1 compatible con Enterprise Architect y StarUML. |
| **[[Yjs_Collaboration]]** | `collaboration-server/` | `server.js`, `y-websocket` | Servidor CRDT en Node.js con rooms, awareness de presencia y control de roles (Viewer, Editor, Owner). |
| **[[Local_AI_Whisper]]** | `frontend/src/features/voice/` | `whisper-worker.ts` | Inferencia de audio cliente en Web Worker mediante Transformers.js + Whisper ONNX INT8. |
| **[[Mobile_Local_AI_Engine]]** | `docs / mobile-spec` | `DeviceHardwareProfiler` | Inferencia adaptativa en móvil según RAM/NPU (Gemma, Qwen, whisper.cpp, llama.cpp). |

---

## 🔄 3. Matriz de Transformación Semántica (End-to-End Mapping)

Para cualquier entidad UML en el modelo canónico, la transformación sigue esta correspondencia biunívoca estricta:

```text
UMLClass (Canonical)
  │
  ├──> Java JPA Entity:       @Entity @Table(name = "entity_names")
  ├──> DDL Table:             CREATE TABLE IF NOT EXISTS entity_names (...)
  ├──> DTO Request:           EntityNameRequest (con parentId o List<Long> targetIds)
  ├──> DTO Response:          EntityNameResponse (con id y targetIds)
  ├──> Spring Data Repo:      public interface EntityNameRepository extends JpaRepository<EntityName, IdType>
  ├──> Service Layer:         EntityNameService (resuelve FKs con findById.orElseThrow y N:M con findAllById)
  ├──> Controller REST:       @RequestMapping("/api/entity_names") (ÚNICA FUENTE DE VERDAD)
  ├──> Postman Folder:        Folder "EntityName" -> POST, GET list, GET by id, PUT, DELETE
  └──> Postman Variable:      {{entityNameId}} (capturada en test script del POST)
```

---

## ⚡ 4. Árboles de Decisión y Reglas de Resolución de Problemas

### 1. Manejo de Relaciones Foráneas (1:N, N:1, 1:1, N:M)
* **¿Es 1:N / N:1?**
  * Persistence Owner: Lado N (tiene `@ManyToOne` y `@JoinColumn(name = "parent_id")`).
  * Inverso: Lado 1 (tiene `@OneToMany(mappedBy = "...", cascade = ...)`).
  * API: DTO Request del lado N recibe `Long parentId`. Service ejecuta `parentRepo.findById(id).orElseThrow(ResourceNotFoundException)`.
* **¿Es N:M?**
  * Schema: Tabla intermedia `entity_a_entity_b` al final de `schema.sql` con `PRIMARY KEY (a_id, b_id)`.
  * Entity: Lado owner tiene `@ManyToMany` con `@JoinTable(name = "...", joinColumns = ..., inverseJoinColumns = ...)`. Lado inverso `@ManyToMany(mappedBy = "...")`.
  * API: DTO Request recibe `List<Long> targetIds`. Service ejecuta:
    ```java
    List<Target> list = targetRepository.findAllById(request.getTargetIds());
    if (list.size() != request.getTargetIds().size()) throw new ResourceNotFoundException(...);
    entity.setTargets(list);
    ```
  * Postman: Cuerpos POST usan `"targetIds": [ {{targetId}} ]`.

### 2. Detección y Resolución de Ciclos en Datos (`DependencyGraph`)
```text
Entrada: Lista de entidades y relaciones
  │
  ├── ¿Existe dependencia A -> B y B -> A?
  │     ├── SI: ¿Ambas claves foráneas son NOT NULL (duras)?
  │     │         └── SÍ  ──> 🛑 Levantar GenerationError("SEED_CYCLE_DETECTED: ciclo irresoluble A <-> B")
  │     │         └── NO  ──> ⚠️ Dependencia blanda: romper ciclo ordenando la que permite NULL primero.
  │     └── NO: Continuar ordenamiento topológico estándar (Kahn's Algorithm).
```

### 3. Evitar Fallos de Postgres / Hibernate Naming
* **Base de datos en `application.properties`**: `jdbc:postgresql://localhost:5432/{{ app_name.lower() }}_db`
* **Naming Strategy**: `spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl` para respetar las columnas de `schema.sql`.
* **Inserciones SQL Idempotentes**: `INSERT INTO tabla (...) VALUES (...) ON CONFLICT (id) DO NOTHING;`

---

## 📱 5. Invariantes del Motor de IA Local Móvil

```text
Arranque App Móvil
  │
  ├──> DeviceHardwareProfiler.detect()
  │      ├── RAM ≤ 3 GB  ──> TIER 1: CPU XNNPACK + Qwen2.5-0.5B Q4 + Whisper-tiny INT8
  │      ├── RAM 4-6 GB  ──> TIER 2: GPU Vulkan/Metal + Gemma 2 2B Q4 + Whisper-base INT8
  │      └── RAM ≥ 8 GB  ──> TIER 3: NPU / ANE + Gemma 2 9B Q4 o Llama-3.2-3B + Whisper-small
  │
  ├──> Entrada por Voz (whisper.cpp C++ bindings) ──> Texto ──> LLM ──> JSON Canonical Action
  └──> Entrada por Cámara (MediaPipe Tasks C++)   ──> Contornos ──> OCR ──> JSON Canonical Action
```
"""

# -------------------------------------------------------------------------
# 2. Concept Nodes for Visual Obsidian Graph
# -------------------------------------------------------------------------
concept_nodes = {
    "CanonicalModel.md": """---
type: concept-node
layer: core-domain
status: completed
tags:
  - canonical-model
  - pydantic
  - uml
---
# 📦 CanonicalModel (Modelo Canónico UML)

El [[CanonicalModel]] es el contrato central e invariante de UMLForge. Definido en `backend/app/core/canonical_model/model.py`.

## Estructuras Principales
* `UMLClass`: Representa una entidad con atributos (`UMLAttribute`), visibilidad, métodos y estereotipos.
* `UMLRelationship`: Modela relaciones ([[ASSOCIATION]], [[COMPOSITION]], [[AGGREGATION]], [[GENERALIZATION]], [[DEPENDENCY]]) y multiplicidades (`1`, `*`, `0..1`, `1..*`).
* `UMLModel`: Contenedor del proyecto.

## Conexiones en el Cerebro
* Validado por: [[GenerationValidator]]
* Mapeado por: [[EntityMapper]] hacia [[SpringGenerator]]
* Analizado por: [[DomainAnalyzer]] y [[DependencyGraph]]
* Exportado/Importado por: [[XMI_Interoperability]]
* Sincronizado por: [[Yjs_Collaboration]]
""",

    "SpringGenerator.md": """---
type: concept-node
layer: generator
status: completed
tags:
  - spring-boot
  - java21
  - jinja2
---
# ⚙️ SpringGenerator (Generador Spring Boot 3)

Motor de generación de código Java 21 y Spring Boot 3. Ubicado en `backend/app/modules/generator/`.

## Características
* Genera proyecto Maven completo (`pom.xml`) listo para `mvn clean compile`.
* Capas: Entity JPA, DTO Request, DTO Response, Repository, Service, Controller, `GlobalExceptionHandler`.
* Soporte para relaciones complejas:
  * Herencia: `@Inheritance(strategy = InheritanceType.JOINED)`
  * Composición: `CascadeType.ALL` y `orphanRemoval = true`
  * Many-to-Many: `@ManyToMany` con `@JoinTable` explícito
* Rutas REST compartidas con [[PostmanGenerator]] mediante `resource_path`.
* Integrado con [[SyntheticDataGenerator]] para `data.sql` y [[SchemaMapper]] para `schema.sql`.
""",

    "PostmanGenerator.md": """---
type: concept-node
layer: testing
status: completed
tags:
  - postman
  - newman
  - api-test
---
# 📮 PostmanGenerator (Generador de Colecciones Dinámicas)

Generador programático de colecciones Postman v2.1.0 en `backend/app/modules/postman/`.

## Características
* Genera un CRUD completo por entidad (`Create`, `List`, `Get`, `Update`, `Delete`).
* **Variables Faker Dinámicas**: `{{$randomFirstName}}`, `{{$randomEmail}}`, `{{$randomInt}}`, etc.
* **Auto-captura de IDs**: Test scripts que ejecutan `pm.collectionVariables.set("entidadId", json.id)`.
* **Encadenamiento**: Entidades dependientes consumen las variables capturadas (`"clienteId": {{clienteId}}`).
* **N:M en API**: Cuerpos POST envían arreglos tipados `[ {{tagId}} ]`.
* Fuente de verdad compartida: Usa exactamente `entity.resource_path` generado para [[SpringGenerator]].
""",

    "SyntheticDataGenerator.md": """---
type: concept-node
layer: generator-data
status: completed
tags:
  - data-sql
  - seed
  - postgresql
---
# 🧬 SyntheticDataGenerator (Generador de Datos Sintéticos)

Generador de datos semilla y coherencia referencial en `backend/app/modules/generator/domain/synthetic_data_generator.py`.

## Capacidades
* Construye un `LogicalDataset` en memoria basado en el dominio inferido por [[DomainAnalyzer]].
* Produce `src/main/resources/data.sql`:
  * Sentencias INSERT con `ON CONFLICT (id) DO NOTHING`.
  * Sincronización de secuencias PostgreSQL con `SELECT setval(...)`.
  * Inserción en tablas intermedias Many-to-Many.
* Alimenta las variables de colección en [[PostmanGenerator]] para que el usuario pueda abrir Postman y presionar SEND de inmediato.
* Respeta el orden topológico de [[DependencyGraph]].
""",

    "DependencyGraph.md": """---
type: concept-node
layer: algorithm
status: completed
tags:
  - topological-sort
  - cycle-detection
  - graph
---
# 🕸️ DependencyGraph (Grafo de Dependencias y Orden Topológico)

Algoritmo de resolución de dependencias relacionales en `backend/app/modules/generator/domain/dependency_graph.py`.

## Lógica
* Utiliza una variante del Algoritmo de Kahn para ordenamiento topológico.
* Distingue dependencias duras (NOT NULL, herencia JOINED, composición) de dependencias blandas (FK nullable).
* **Detección de Ciclos**: Si existe un ciclo cerrado de dependencias duras que no puede satisfacerse en la inserción SQL, interrumpe con `SEED_CYCLE_DETECTED`.
* Garantiza que en [[SchemaMapper]] y `data.sql`, las tablas padre se creen y siembren antes que las tablas hijas.
""",

    "DomainAnalyzer.md": """---
type: concept-node
layer: analysis
status: completed
tags:
  - domain-heuristic
  - semantic
---
# 🔍 DomainAnalyzer (Analizador Semántico de Dominio)

Analizador heurístico de dominio en `backend/app/modules/generator/domain/domain_analyzer.py`.

## Dominios Soportados
* `E_COMMERCE` (cliente, pedido, producto, factura, pago)
* `CLINICAL` (paciente, médico, cita, receta, historia)
* `EDUCATIONAL` (estudiante, curso, profesor, matrícula, nota)
* `FINANCIAL` (cuenta, transacción, banco, balance, tarjeta)
* `LOGISTICS` (envío, paquete, ruta, almacén, flota)
* `GENERIC` (fallback universal determinista)

Permite a [[SyntheticDataGenerator]] y [[PostmanGenerator]] elegir nombres realistas acordes al negocio modelado.
""",

    "XMI_Interoperability.md": """---
type: concept-node
layer: interoperability
status: completed
tags:
  - xmi
  - enterprise-architect
  - staruml
---
# 🔄 XMI_Interoperability (Interoperabilidad XMI 2.5.1)

Módulo bidireccional en `backend/app/modules/xmi/` que traduce entre OMG XMI 2.5.1 y [[CanonicalModel]].

## Capacidades
* Parser para modelos exportados desde **Enterprise Architect** y **StarUML**.
* Escritor XMI conforme con el metamodelo estándar OMG.
* Traduce estereotipos, visibilidad, atributos, tipos y relaciones.
""",

    "Yjs_Collaboration.md": """---
type: concept-node
layer: collaboration
status: completed
tags:
  - yjs
  - crdt
  - websockets
---
# 🤝 Yjs_Collaboration (Colaboración en Tiempo Real)

Infraestructura de colaboración multiusuario en `collaboration-server/` y `frontend/src/features/sharing/`.

## Arquitectura
* Motor CRDT: **Yjs** con sincronización basada en WebSockets (`y-websocket`).
* Protocolo Awareness para presencia de cursores y estado de edición en vivo.
* Salas aisladas por proyecto con roles: `Viewer`, `Editor`, `Owner`.
* Base para la sincronización futura con [[Mobile_Local_AI_Engine]].
""",

    "Local_AI_Whisper.md": """---
type: concept-node
layer: ai-web
status: in-progress
tags:
  - whisper
  - onnx
  - web-worker
---
# 🎙️ Local_AI_Whisper (IA Local Web - Transcripción en Navegador)

Sistema de transcripción de voz local en el cliente web sin conexión externa. Ubicado en `frontend/src/features/voice/`.

## Componentes
* **Web Worker Desacoplado**: `whisper-worker.ts` ejecuta Transformers.js sin bloquear el canvas.
* **Modelo Cuantizado**: Whisper-tiny INT8 (~39 MB en IndexedDB cache).
* **Pipeline**: Micrófono $\to$ Web Worker $\to$ Transcripción $\to$ Extractor de Intenciones $\to$ Mutación en [[CanonicalModel]].
""",

    "Mobile_Local_AI_Engine.md": """---
type: concept-node
layer: ai-mobile
status: designed
tags:
  - mobile-ai
  - litert
  - llamatik
  - gguf
---
# 📱 Mobile_Local_AI_Engine (Motor de IA Local Móvil Adaptativo)

Diseño arquitectónico para la ejecución de IA 100% local en dispositivos móviles. Detallado en [[03 - IA LOCAL MOVIL ADAPTATIVA (FASE 14)]].

## Pilares
* **Device Profiling**: Detección en tiempo de ejecución de RAM, CPU, GPU y NPU.
* **Tiering Adaptativo**:
  * Tier 1 (≤ 3 GB): Qwen2.5-0.5B + Whisper-tiny
  * Tier 2 (4-6 GB): Gemma 2 2B + Whisper-base
  * Tier 3 (≥ 8 GB): Gemma 2 9B / Llama-3.2-3B + Whisper-small
* **Frameworks**: llama.cpp (vía Llamatik KMP o Flutter C++ FFI), whisper.cpp y MediaPipe Tasks.
* **Casos de Uso**: Dictado por voz, Sketch-to-UML por cámara y Asistente RAG offline.
""",

    "HexagonalArchitecture.md": """---
type: concept-node
layer: architecture-pattern
status: active
tags:
  - clean-architecture
  - hexagonal
  - ports-and-adapters
---
# 🏛️ HexagonalArchitecture (Arquitectura Hexagonal en Backend)

Patrón estructural del backend Python (`backend/app/`).

## Capas
* **Core**: [[CanonicalModel]] y validadores puros. Cero dependencias externas.
* **Domain**: Servicios de dominio ([[DomainAnalyzer]], [[DependencyGraph]], [[SchemaMapper]]).
* **Application**: Casos de uso de generación y orquestación.
* **Adapters**: Controladores FastAPI delgados y CLI.
""",

    "FeatureSlicedDesign.md": """---
type: concept-node
layer: architecture-pattern
status: active
tags:
  - fsd
  - frontend
  - react
---
# 🎨 FeatureSlicedDesign (FSD en Frontend)

Arquitectura modular del frontend (`frontend/src/`).

## Capas Jerárquicas
1. `app`: Providers, enrutador, configuración global.
2. `pages`: Vistas enrutables.
3. `widgets`: Bloques compuestos autónomos (Canvas, TopBar).
4. `features`: Interacciones de usuario ([[Yjs_Collaboration]], [[Local_AI_Whisper]]).
5. `entities`: Entidades de dominio ([[CanonicalModel]], Project).
6. `shared`: Componentes UI base, clientes HTTP y utilidades.
"""
}

# -------------------------------------------------------------------------
# Escribir archivos conceptuales y actualizar el cerebro
# -------------------------------------------------------------------------
print("Escribiendo núcleo de IA y nodos conceptuales...")

# Escribir Kernel
(vault_dir / "00 - AGENT_KNOWLEDGE_GRAPH.md").write_text(agent_kernel.strip() + "\n", encoding="utf-8")
print("✅ Escrito 00 - AGENT_KNOWLEDGE_GRAPH.md")

# Escribir nodos conceptuales
for filename, content in concept_nodes.items():
    (vault_dir / filename).write_text(content.strip() + "\n", encoding="utf-8")
    print(f"✅ Escrito nodo conceptual: {filename}")

print("\n¡Grafo de conocimiento completo y nodos semánticos generados exitosamente!")
