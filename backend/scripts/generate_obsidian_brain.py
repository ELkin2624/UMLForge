import sys
from pathlib import Path

vault_dir = Path(r"C:\Users\apaza\OneDrive\Documentos\Obsidian Vault\Parcial-Software-1")
vault_dir.mkdir(parents=True, exist_ok=True)

# -------------------------------------------------------------------------
# 1. 00 - CEREBRO CENTRAL UMLFORGE.md
# -------------------------------------------------------------------------
cerebro_central_content = """# 🧠 Cerebro Central UMLForge — Map of Content (MOC)

> [!IMPORTANT]
> **Propósito de este Cerebro**: Esta bóveda de Obsidian es la **única fuente de verdad**, memoria persistente y guía arquitectónica del proyecto **UMLForge**. Contiene toda la información técnica, decisiones tomadas, reglas inmutables, memoria de fases y el diseño del futuro sistema de IA local en móvil.

---

## 🎯 1. ¿Qué es UMLForge?

UMLForge no es un simple editor de diagramas. Es una:
> **Herramienta CASE Colaborativa, Basada en Componentes y Orientada a Modelos (MDD/MDA)**, capaz de transformar modelos UML formales en software empresarial funcional (Spring Boot 3 + PostgreSQL), con interoperabilidad XMI 2.5.1, colaboración en tiempo real basada en CRDTs (Yjs) y asistencia mediante IA local offline (Voz, Visión y Asistente Adaptativo).

```mermaid
graph TD
    User([Usuario / Equipo]) -->|Voz Offline| Voice[Whisper ONNX / Mobile]
    User -->|Foto / Boceto| Vision[MediaPipe / Vision Model]
    User -->|Editor Visual| Editor[Editor Web FSD / React Flow]
    
    Voice --> Parser[Extractor de Intenciones]
    Vision --> CVParser[Detector de Formas UML]
    Parser --> CM[(CanonicalModel Invariante)]
    CVParser --> CM
    Editor --> CM
    
    CM --> Validator[UML Validator Semántico]
    Validator --> Generator[Spring Boot 3 Generator]
    Validator --> PostmanGen[Postman & Dataset Generator]
    Validator --> XMIEngine[XMI 2.5.1 Enterprise Architect]
    
    Generator --> JavaApp[Backend Spring Boot CRUD]
    PostmanGen --> PostmanCol[Colección Postman Dinámica]
    PostmanGen --> SQLSeed[data.sql Determinista]
    JavaApp --> Postgres[(PostgreSQL 15+)]
    SQLSeed --> Postgres
```

---

## 🗺️ 2. Mapa de Navegación del Cerebro

| Documento Clave | Descripción |
| :--- | :--- |
| **[[01 - REGLAS Y ESTANDARES DE INGENIERIA]]** | Las 10 reglas de oro, Arquitectura Hexagonal, FSD, estándares PEP8, TypeScript y Java. |
| **[[02 - MEMORIA TECNICA Y HISTORIAL DE FASES]]** | Registro exhaustivo de todo lo implementado desde la Fase 0 hasta la Fase 11 y generador de datos. |
| **[[03 - IA LOCAL MOVIL ADAPTATIVA (FASE 14)]]** | Arquitectura maestra para IA local en dispositivos móviles (profiling, tiering, LiteRT, Llamatik, GGUF). |
| **[[04 - ROADMAP Y PENDIENTES]]** | Estado actual de desarrollo, backlog detallado y tareas pendientes para completar el proyecto. |
| **[[Arquitectura]]** | Estructura general de directorios y modularización del monorepo. |
| **[[Plan y Definicion]]** | Visión original del proyecto, descomposición en 14 fases y asignación de vertical slices. |
| **[[FASE 12]]** | Arquitectura de IA Local Web (Voz, Whisper ONNX en Web Worker). |
| **[[IA local transcripcion]]** | Registro de tareas de Whisper Web Worker, Yjs y FSD en el Frontend. |

---

## 📊 3. Matriz de Estado de las Fases

| Fase | Título | Estado | Módulos Principales |
| :---: | :--- | :---: | :--- |
| **0** | Preparación y Monorepo | ✅ **100%** | Monorepo layout, toolchains, git hooks |
| **1** | Canonical Model & Core UML | ✅ **100%** | `UMLClass`, `UMLRelationship`, `CanonicalModel` |
| **2** | Validador Semántico UML | ✅ **100%** | `GenerationValidator`, reglas de integridad |
| **3** | Generador Spring Boot 3 | ✅ **100%** | Plantillas Jinja2, Entity, DTOs, Service, Controller |
| **4** | PostgreSQL DDL & Seed | ✅ **100%** | `schema.sql`, `data.sql` idempotente, secuencias |
| **5** | OpenAPI 3.0 Generator | ✅ **100%** | `OpenAPIMapper`, especificación YAML |
| **6** | Postman Collection Generator | ✅ **100%** | Postman 2.1, variables Faker, scripts de captura de IDs |
| **6b** | Datos Sintéticos & M:N REST | ✅ **100%** | `DomainAnalyzer`, `DependencyGraph`, N:M en API y SQL |
| **7** | Newman & Orquestador E2E | ✅ **100%** | Ejecución desatendida, verificación de compilación |
| **8** | Frontend Editor Web | ✅ **100%** | React 18, Vite, React Flow / Apollon, Tailwind |
| **9** | Diagramas de Componentes | ✅ **100%** | Metamodelo de componentes, interfaces, puertos |
| **10** | Interoperabilidad XMI 2.5.1 | ✅ **100%** | Perfil Enterprise Architect & StarUML import/export |
| **11** | Colaboración en Tiempo Real | ✅ **100%** | Yjs, WebSockets, Awareness, Rooms, Control de Roles |
| **12** | IA Local Web (Voz / Whisper) | 🔄 **85%** | Whisper ONNX Web Worker montado, falta test con mic |
| **13** | Visión (Boceto / Foto a UML) | ⏳ **Pendiente** | Detección de cajas/relaciones en pizarra/papel |
| **14** | Mobile con IA Local Adaptativa | ⏳ **Diseñada** | App móvil adaptativa (LiteRT/Llamatik, GGUF offline) |

---

## ⚡ 4. Comandos Clave del Sistema

### Backend (Python 3.11 / FastAPI)
* **Activar entorno**: `.\\venv\\Scripts\\Activate.ps1`
* **Correr tests del generador y postman**: `pytest tests/generator tests/postman_generator -v`
* **Correr servidor FastAPI**: `uvicorn app.main:app --reload --port 8000`
* **Script E2E de verificación real**: `python verify_e2e_new_domain.py`

### Frontend (React / Vite / TypeScript)
* **Iniciar servidor de desarrollo**: `npm run dev` (puerto 5173)
* **Compilar producción**: `npm run build`

### Base de Datos & Docker
* **Contenedor PostgreSQL**: `docker start umlforge_postgres` (puerto 5432)
* **Base de datos por defecto**: `conferencebackend_db` / `umlforge`
* **Credenciales**: `postgres / postgres` (o `umlforge / umlforge_password`)

### Backend Generado (Spring Boot 3 / Java 21)
* **Compilar con Maven**: `mvn clean compile`
* **Ejecutar Spring Boot**: `mvn spring-boot:run` (puerto 8080)
"""

# -------------------------------------------------------------------------
# 2. 01 - REGLAS Y ESTANDARES DE INGENIERIA.md
# -------------------------------------------------------------------------
reglas_content = """# 📜 01 - Reglas y Estándares de Ingeniería del Proyecto UMLForge

Este documento define la ley fundamental del código en UMLForge. Cualquier cambio, refactorización o nueva característica debe someterse estrictamente a estas pautas.

---

## 🏛️ 1. Las 10 Reglas de Oro Inmutables

1. **El Modelo Canónico es el Contrato Central**:
   Ningún módulo (generador, visualizador, importador XMI, motor de IA) se comunica directamente con otro mediante estructuras propietarias. Toda transformación pasa obligatoriamente por `CanonicalModel`.
2. **Los Adapters Traducen; NO Contienen Lógica de Negocio**:
   Los endpoints FastAPI, controladores HTTP o importadores XMI son adaptadores puros. Reciben datos, los transforman al modelo de dominio y delegan al caso de uso.
3. **La IA NO Genera Código Fuente Arbitrario**:
   La IA (sea local o nube) nunca emite cadenas de texto Java/SQL directamente sin control. La IA genera intenciones, parámetros o mutaciones estructuradas sobre el `CanonicalModel`. El código lo produce el generador determinista.
4. **El Generador es Estrictamente Determinista**:
   A idéntico `CanonicalModel`, el generador produce exactamente los mismos archivos, los mismos DDLs, las mismas sentencias SQL y la misma colección Postman. No depende de llamadas estocásticas a LLMs en tiempo de generación.
5. **Toda Entrada Externa es No Confiable**:
   Tanto los diagramas dibujados en el frontend como los XMLs de Enterprise Architect o StarUML pasan por validación semántica exhaustiva (`GenerationValidator`) antes de ingresar al pipeline.
6. **Ruta REST con Fuente Única de Verdad (`resource_path`)**:
   El generador Spring Boot (`@RequestMapping`) y el generador Postman (`{{baseUrl}}/api/...`) consumen exactamente el mismo metadato (`entity.resource_path`). Queda terminantemente prohibido duplicar transformaciones o acoplar Postman a nombres de tabla.
7. **Resolución Controlada de Relaciones en Backend Generado**:
   No se usa `EntityManager.getReference()`. Toda relación se resuelve mediante `repository.findById(...).orElseThrow(() -> new ResourceNotFoundException(...))` y `findAllById(...)` en N:M validando que todos los IDs existan.
8. **Diferenciación entre Persistencia y API en N:M**:
   - Persistencia: `data.sql` siembra la tabla intermedia con inserciones idempotentes (`ON CONFLICT DO NOTHING`).
   - API: El DTO Request expone arreglos de IDs (ej. `List<Long> tagIds`) y Postman envía `[ {{tagId}} ]` contra el endpoint REST real.
9. **Idempotencia Absoluta en Scripts SQL**:
   Todos los scripts `schema.sql` usan `CREATE TABLE IF NOT EXISTS` y orden topológico estricto (tablas intermedias ManyToMany al final con `PRIMARY KEY (col1, col2)`). Los `data.sql` usan `ON CONFLICT (id) DO NOTHING` y sincronizan secuencias con `setval`.
10. **Modularidad y Reemplazabilidad de Componentes**:
    El editor visual (React Flow/Apollon), el motor de inferencia local o el servidor WebSocket pueden reemplazarse sin tocar el núcleo canónico ni los generadores.

---

## 📐 2. Arquitectura Hexagonal (Backend Python / FastAPI)

El backend sigue los principios de Arquitectura Limpia y Puertos y Adaptadores (Hexagonal):

```text
backend/app/
├── core/                         # 🟢 NÚCLEO / DOMINIO PURO
│   ├── canonical_model/          # Modelos canónicos Pydantic v2 (Clases, Relaciones, Componentes)
│   └── validators/               # Validadores semánticos y reglas de negocio UML
├── modules/                      # 🔵 CASOS DE USO Y MÓDULOS DE APLICACIÓN
│   ├── generator/
│   │   ├── application/          # Use Cases (GenerateProjectUseCase, ExportZip)
│   │   ├── domain/               # Domain Services (DomainAnalyzer, DependencyGraph, SchemaMapper)
│   │   ├── infrastructure/       # Plantillas Jinja2, Renderizadores
│   │   └── templates/            # Plantillas Spring Boot, PostgreSQL, Docker
│   ├── postman/                  # Postman Generator (Domain, ResourceMapper, Examples)
│   ├── xmi/                      # XMI Engine (Parser, Writer, EA Profile, StarUML Profile)
│   ├── auth/                     # Autenticación JWT y usuarios
│   └── voice/                    # Endpoints de asistencia por voz
└── api/                          # 🟡 ADAPTADORES PRIMARIOS (ENTRADA)
    ├── routers/                  # Controladores FastAPI delgados
    └── dependencies/             # Inyección de dependencias
```

### Reglas de Capas
* **Core** no tiene dependencias de FastAPI, Jinja2 ni librerías de infraestructura.
* **Domain** contiene lógica pura del generador (mapeo de tipos, resolución de grafos, orden topológico).
* **Application** orquesta el flujo de generación invocando validadores, analizadores y renderizadores.
* **Routers** son controladores de menos de 50 líneas por endpoint; no contienen lógica de transformación.

---

## 🎨 3. Feature-Sliced Design (Frontend React / Vite / TypeScript)

El frontend está estructurado bajo **FSD (Feature-Sliced Design)** para garantizar escalabilidad y evitar dependencias circulares:

```text
frontend/src/
├── app/                          # Proveedores globales, enrutador, estilos globales
├── pages/                        # Páginas enrutables completas (EditorPage, ProjectsPage)
├── widgets/                      # Componentes autónomos complejos (TopBar, DiagramCanvas, Sidebar)
├── features/                     # Interacciones de usuario con impacto de negocio:
│   ├── auth/                     # Login, registro, token refresh
│   ├── sharing/                  # Compartir proyectos, control de roles (Viewer, Editor, Owner)
│   ├── voice/                    # Grabación de audio, transcripción local
│   ├── generator-dialog/         # Modal de generación local / descarga ZIP
│   └── export-xmi/               # Diálogo de exportación XMI
├── entities/                     # Lógica de dominio del frontend:
│   ├── uml-model/                # Estado del diagrama, nodos, aristas, sincronización Yjs
│   ├── project/                  # Metadatos del proyecto
│   └── user/                     # Perfil de usuario y sesión
└── shared/                       # Código agnóstico al dominio:
    ├── api/                      # Clientes Axios / Fetch tipados
    ├── ui/                       # Botones, modales, tooltips, inputs (Design System)
    └── lib/                      # Utilidades de fecha, storage, helpers matemáticos
```

### Reglas FSD Estrictas
* **Dirección de importación descendente**: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.
* **Prohibido importar horizontalmente**: Una `feature` NO puede importar directamente de otra `feature`. Si comparten lógica, se promueve a `entities` o `shared`.
* **Public API**: Todo módulo expone su interfaz mediante un archivo `index.ts`. No se importan archivos internos directamente.

---

## 💻 4. Estándares de Codificación por Lenguaje

### Python
* **PEP 8 & PEP 484**: Tipado estático completo en todos los argumentos y retornos (`def process(model: UMLModel) -> ValidationResult:`).
* **Pydantic v2**: Uso estricto de `BaseModel`, `Field(...)`, validadores `@field_validator` y configuración vía `ConfigDict`.
* **Manejo de Excepciones**: Excepciones de dominio personalizadas (`GenerationError`, `ModelValidationError`, `SeedCycleError`). Prohibido capturar `Exception` genérico sin relanzar o registrar con traza.
* **Nombres**: `snake_case` para variables y funciones, `PascalCase` para clases y modelos Pydantic, `UPPER_SNAKE_CASE` para constantes.

### TypeScript / React
* **Strict Mode**: `"strict": true` en `tsconfig.json`. Prohibido el uso de `any` (usar `unknown` con type guards si el tipo es indeterminado).
* **Inmutabilidad**: Manejo de estado inmutable en Zustand / React State. Para mutaciones complejas en canvas, usar Immer o copias estructurales.
* **Componentes Funcionales**: Uso de hooks estándar (`useCallback`, `useMemo` en cálculos pesados de renderizado de nodos).

### Java (Código Generado)
* **Arquitectura de 4 Capas**: Controller (`@RestController`) → Service (`@Service` con `@Transactional`) → Repository (`JpaRepository`) → Entity (`@Entity`).
* **DTO Separation**: Request DTO para mutaciones, Response DTO para salidas. Jamás exponer entidades JPA crudas en controladores REST.
* **Manejo de Errores**: `@ControllerAdvice` (`GlobalExceptionHandler`) traduciendo `ResourceNotFoundException` a JSON con status 404 estandarizado.
"""

# -------------------------------------------------------------------------
# 3. 02 - MEMORIA TECNICA Y HISTORIAL DE FASES.md
# -------------------------------------------------------------------------
memoria_content = """# 🏛️ 02 - Memoria Técnica e Historial de Fases de UMLForge

Este documento recopila el conocimiento acumulado, las decisiones de ingeniería y el estado de implementación detallado de cada una de las fases ejecutadas en el proyecto.

---

## 📌 Fase 0: Arquitectura Base y Monorepo
* Creación de la estructura unificada del monorepo con `backend/`, `frontend/`, `collaboration-server/` y `backend-springboot/`.
* Configuración de entornos virtuales Python 3.11, dependencias en `pyproject.toml` y empaquetado Node.js en frontend.

---

## 📌 Fase 1: Metamodelo Canónico UML (`CanonicalModel`)
* **Ubicación**: `backend/app/core/canonical_model/`
* Implementación de estructuras inmutables en Pydantic v2:
  * `UMLClass`: nombre, atributos (`UMLAttribute`), visibilidad, métodos, estereotipos.
  * `UMLRelationship`: origen, destino, tipo (`ASSOCIATION`, `AGGREGATION`, `COMPOSITION`, `GENERALIZATION`, `DEPENDENCY`), multiplicidades (`1`, `*`, `0..1`, `1..*`), roles.
  * `UMLModel`: contenedor raíz del diagrama con validación de identificadores únicos UUID.

---

## 📌 Fase 2: Motor de Validación Semántica
* **Ubicación**: `backend/app/core/validators/`
* `GenerationValidator` implementa 12+ reglas semánticas previas a la generación:
  1. No existencia de clases con nombres duplicados.
  2. Cada clase debe tener exactamente una clave primaria (PK).
  3. No ciclos cerrados en generalizaciones (herencia circular prohibida).
  4. Los extremos de relaciones deben apuntar a clases existentes en el modelo.
  5. Multiplicidades válidas de acuerdo con la especificación OMG UML 2.5.1.

---

## 📌 Fases 3 y 4: Generador Spring Boot 3 & PostgreSQL DDL
* **Ubicación**: `backend/app/modules/generator/`
* Motor de plantillas Jinja2 que genera un proyecto Maven completo y ejecutable:
  * `pom.xml`: Spring Boot 3.2.3, Spring Data JPA, PostgreSQL Driver, Spring Validation, Lombok, SpringDoc OpenAPI.
  * **Entidades JPA**: Mapeo de atributos con validaciones (`@NotNull`, `@Size`, `@DecimalMin`), `@Id`, `@GeneratedValue`.
  * **Estrategias de Relación**:
    * 1:N / N:1: `@ManyToOne` con `@JoinColumn` en el propietario, `@OneToMany` inverso.
    * 1:1: `@OneToOne` con persistencia en el lado owner.
    * Herencia: `@Inheritance(strategy = InheritanceType.JOINED)`.
    * Composición: `CascadeType.ALL` y `orphanRemoval = true`.
  * **DDL Relacional (`schema.sql`)**: Creación de tablas, columnas, tipos acordes a PostgreSQL (`BIGSERIAL`, `UUID`, `VARCHAR`, `TIMESTAMP`), foreign keys y claves primarias.

---

## 📌 Fases 5, 6 y 7: OpenAPI, Postman Dinámico y Automatización Newman
* **Ubicación**: `backend/app/modules/postman/`
* Generación programática de la colección Postman (formato v2.1.0):
  * **Organización en carpetas**: Una carpeta por entidad, conteniendo los 5 endpoints CRUD (`Create`, `List`, `Get`, `Update`, `Delete`).
  * **Faker Variables**: Cuerpos POST con variables nativas de Postman (`{{$randomFirstName}}`, `{{$randomEmail}}`, `{{$randomPrice}}`, `{{$randomInt}}`).
  * **Test Scripts de Auto-captura**:
    ```javascript
    pm.test("Status code is 201", function () { pm.response.to.have.status(201); });
    if (pm.response.code === 201) {
        const json = pm.response.json();
        pm.collectionVariables.set("clienteId", json.id);
    }
    ```
  * **Encadenamiento Inteligente**: Las entidades hijas reutilizan la variable capturada: `"clienteId": {{clienteId}}`.
  * **Entorno Postman**: Generación de `*.postman_environment.json` con `baseUrl: http://localhost:8080`.

---

## 📌 Fases 8, 9 y 10: Frontend, Componentes y XMI 2.5.1
* **Frontend**: Editor visual con soporte de creación de clases, atributos, métodos y dibujo de relaciones con snap magnético.
* **Componentes**: Soporte de diagramas de componentes (Componentes, Interfaces proporcionadas/requeridas, Puertos y Conectores de delegación/ensamble).
* **XMI Interoperability**: `backend/app/modules/xmi/` con capacidad bidireccional:
  * Importa archivos `.xmi` generados por Enterprise Architect y StarUML al `CanonicalModel`.
  * Exporta el `CanonicalModel` a XMI 2.5.1 estándar OMG.

---

## 📌 Fase 11: Colaboración en Tiempo Real
* **Ubicación**: `collaboration-server/` y `frontend/src/features/sharing/`
* Servidor WebSocket Node.js con CRDTs Yjs.
* Protocolo Awareness para presencia de cursores en tiempo real.
* Salas por proyecto (`room: project-{id}`) con control de permisos y roles: `Viewer`, `Editor`, `Owner`.

---

## 📌 Hito Especial: Generación Inteligente de Datos Sintéticos & Relaciones Many-to-Many en REST

Este hito refinó la arquitectura del generador para eliminar modelos vacíos y soportar Many-to-Many completo:

### 1. `DomainAnalyzer`
Analiza los nombres de clases y campos mediante puntuación semántica para clasificar el proyecto en:
* `E_COMMERCE`, `EDUCATIONAL`, `CLINICAL`, `FINANCIAL`, `LOGISTICS` o `GENERIC`.

### 2. `DependencyGraph` y Orden Topológico
* Resuelve el orden de inserción SQL y de generación de carpetas en Postman.
* Distingue dependencias duras de dependencias blandas (FKs nullables).
* Ante ciclos duros cerrados (ej. A depende obligatoriamente de B y B de A con NOT NULL), interrumpe limpiamente levantando `SEED_CYCLE_DETECTED`.

### 3. `SyntheticDataGenerator`
* Genera registros deterministas coherentes para `data.sql`.
* **Idempotencia**: Todas las sentencias INSERT incluyen `ON CONFLICT (id) DO NOTHING` o `ON CONFLICT DO NOTHING` en join tables.
* **Sincronización de Secuencias**: Incluye `SELECT setval(pg_get_serial_sequence('tabla', 'id'), coalesce(max(id), 1)) FROM tabla;` para evitar colisiones de IDs al crear registros nuevos por REST.
* **Alineación de Postman**: Pre-inicializa las variables de colección (`clienteId`, `productoId`, etc.) con exactamente los IDs sembrados en `data.sql`.

### 4. Soporte Integral Many-to-Many en Persistencia y API REST
* **Persistencia**: `@ManyToMany` con `@JoinTable` explícito en la entidad propietaria, tabla intermedia al final de `schema.sql` con `PRIMARY KEY (col1, col2)` y FKs hacia ambas tablas.
* **DTO Request**: Expone la lista de IDs relacionados (ej. `List<Long> topicTrackIds`).
* **Service**: Inyecta el repositorio destino y resuelve la colección con:
  ```java
  List<TopicTrack> targets = topicTrackRepository.findAllById(request.getTopicTrackIds());
  if (targets.size() != request.getTopicTrackIds().size()) {
      throw new ResourceNotFoundException("One or more TopicTrack entities not found with provided IDs");
  }
  entity.setTopicTracks(targets);
  ```
* **Postman**: El cuerpo de la petición POST incluye el arreglo tipado dinámico:
  ```json
  "topicTrackIds": [
    {{topicTrackId}}
  ]
  ```
* **Fuente Única de Verdad para Rutas**: Controller `@RequestMapping("/api/{{ entity.resource_path }}")` y Postman `{{baseUrl}}/api/{{ entity.resource_path }}` comparten la misma propiedad `resource_path`.
"""

# -------------------------------------------------------------------------
# 4. FASE 12.md
# -------------------------------------------------------------------------
fase12_content = """# 🎙️ FASE 12 — IA Local en Web (Voz, Transcripción y Mutación de Modelos)

## 🎯 Objetivo
Permitir al usuario dictar comandos de voz en el navegador (ej. *"Crea una clase Cliente con atributo email de tipo String y relación de uno a muchos con Pedido"*), transcribir el audio **localmente en el cliente sin enviar audio a servidores externos** mediante Whisper ONNX, extraer la intención estructurada y aplicar la mutación directamente sobre el `CanonicalModel` / Yjs canvas.

---

## 🏗️ Arquitectura de Ejecución Local en Navegador

```mermaid
graph TD
    Mic[Micrófono del Usuario] -->|MediaRecorder API| AudioBuffer[Audio WAV / PCM 16kHz]
    AudioBuffer -->|postMessage| Worker[Web Worker: whisper-worker.ts]
    
    subgraph "Navegador (Client-side / Sandbox)"
        Worker -->|ONNX Runtime Web| WEngine[Transformers.js / Whisper ONNX]
        WEngine -->|Descarga / Cache Local| ModelFiles[whisper-tiny-quantized.onnx]
        WEngine -->|Transcripción| RawText[Texto: 'Crea una clase Factura con total Double']
    end
    
    RawText --> IntentParser[Extractor de Intenciones UML]
    IntentParser -->|Validación| CandidateAction[Acción Canónica: AddClassAction]
    CandidateAction -->|Yjs Transaction| Canvas[Canvas UMLForge]
```

---

## 🧩 Componentes Técnicas

### 1. Web Worker Desacoplado (`whisper-worker.ts`)
* Para evitar congelar el hilo principal de renderizado de React/Canvas durante la inferencia, Transformers.js corre en un Web Worker dedicado.
* Formato cuantizado: `dtype: "q8"` o `_quantized.onnx` para reducir el tamaño de descarga de ~150MB a ~39MB.
* Archivos requeridos cacheados vía CacheStorage / IndexedDB:
  * `config.json`
  * `tokenizer.json`
  * `tokenizer_config.json`
  * `generation_config.json`
  * `model_quantized.onnx`

### 2. Extractor de Intenciones Determinista + LLM Local
El texto transcrito se procesa mediante dos capas:
1. **Reglas Heurísticas Regex / Gramática** (Ultra rápido, 0 tokens):
   * `crea(r)? clase (?P<name>\\w+)`
   * `atributo (?P<attr>\\w+) de tipo (?P<type>\\w+)`
   * `relaci[oó]n de (?P<src_m>\\w+) a (?P<tgt_m>\\w+) con (?P<target>\\w+)`
2. **Fallback a LLM Local en Web / Backend**:
   * Si el comando es ambiguo, se usa un LLM pequeño (ej. Qwen2.5-0.5B vía WebGPU / Transformers.js o endpoint local) con salida estructurada en JSON Schema.

---

## 📋 Checklist de Finalización de Fase 12
- [x] Modelo Whisper cuantizado alojado en `/models/whisper-tiny`
- [x] Web Worker configurado con comunicación por mensajes (`START`, `PROGRESS`, `TRANSCRIPT`)
- [x] Integración en el componente `VoiceInputWidget` en el frontend FSD
- [ ] Prueba de micrófono en entorno real con confirmación del usuario
- [ ] Generación de comandos de mutación sobre el store de Yjs
"""

# -------------------------------------------------------------------------
# 5. 03 - IA LOCAL MOVIL ADAPTATIVA (FASE 14).md
# -------------------------------------------------------------------------
ia_movil_content = """# 📱 03 - IA Local Móvil Adaptativa (Fase 14)

Este documento condensa la visión de ingeniería, decisiones técnicas y hoja de ruta para implementar la versión **móvil de UMLForge** con **Inteligencia Artificial 100% Local y Adaptativa**.

---

## 💡 1. Filosofía y Reto: "IA que se Adapta a Cualquier Móvil"

Un teléfono móvil presenta restricciones drásticas de **RAM, temperatura, estrangulamiento térmico (thermal throttling), consumo de batería y heterogeneidad de chips (Qualcomm, MediaTek, Apple Silicon, Exynos, Tensor)**.

> **Principio Clave**: La aplicación móvil evalúa las capacidades físicas del dispositivo en tiempo de arranque y ajusta dinámicamente el tamaño del modelo, el motor de inferencia y los delegados de aceleración hardware (NPU/GPU/CPU).

---

## 🧠 2. Matriz de Niveles de Hardware (Device Tiering)

Al iniciar la app, un detector de hardware lee:
* RAM física total y disponible (`ActivityManager.MemoryInfo` en Android / `ProcessInfo.physicalMemory` en iOS).
* Número de núcleos de CPU y arquitectura (ARMv8, ARMv9).
* Presencia de aceleración NPU/NNAPI o GPU Vulkan/Metal.
* Almacenamiento libre disponible para descarga de pesos.

| Nivel | RAM Típica | Aceleración Principal | Modelo LLM Local | Modelo de Visión (Sketch-to-UML) | Audio (Voz) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Bajo (Tier 1)** | ≤ 3 GB | Solo CPU (XNNPACK / NEON) | **Qwen2.5-0.5B** Q4_K_M (~350 MB) | MobileNetV3-Small + Contornos OpenCV | Whisper-tiny INT8 |
| **Medio (Tier 2)** | 4 a 6 GB | GPU básica (OpenCL / Vulkan / Metal) | **Gemma 2 2B** Q4_K_M o **Qwen2.5-1.5B** (~1.2 GB) | YOLOv8n-pose / EfficientNet-Lite | Whisper-base INT8 |
| **Alto (Tier 3)** | ≥ 8 GB | NPU dedicada (Qualcomm QNN / MediaTek NeuroPilot / Apple ANE) | **Gemma 2 9B** Q4 o **Llama-3.2-3B** INT4 (~2.1 GB) | ViT-Base / YOLOv8s / Gemma Vision | Whisper-small NPU |

---

## 🛠️ 3. Selección del Stack Tecnológico y Frameworks

Tras evaluar las opciones open source y los estándares de la industria, definimos la arquitectura del stack:

```mermaid
graph TD
    App[UMLForge Mobile App: Flutter o Kotlin Multiplatform] --> Profiler[Device Hardware Profiler]
    
    Profiler --> TierDecision{Nivel de Hardware}
    TierDecision -->|Tier 1| EngineLow[CPU XNNPACK + 0.5B Model]
    TierDecision -->|Tier 2| EngineMed[GPU Vulkan/Metal + 2B Model]
    TierDecision -->|Tier 3| EngineHigh[NPU + 3B-7B Model]
    
    subgraph "Motores de Inferencia Nativos (C++ Core)"
        EngineLow --> LlamaCPP[llama.cpp / LiteRT C++ Engine]
        EngineMed --> LlamaCPP
        EngineHigh --> LlamaCPP
        LlamaCPP --> WhisperCPP[whisper.cpp Audio Engine]
        LlamaCPP --> MediaPipeTasks[MediaPipe Tasks Vision Engine]
    end
    
    MediaPipeTasks --> CM[CanonicalModel Engine Local]
    WhisperCPP --> CM
    LlamaCPP --> CM
    CM --> LocalDB[(SQLite Local / Offline Yjs)]
```

### Frameworks Evaluados y Decisión:

1. **LiteRT (ex TensorFlow Lite)**:
   * **Ventajas**: Respaldado por Google, soporte maduro de delegados GPU y NPU (NNAPI), modelos oficiales de Gemma optimizados.
   * **Uso**: Excelente para tareas de visión por computadora y clasificación rápida de formas UML.
2. **llama.cpp (via Llamatik o bindings nativos JNI/CGO)**:
   * **Ventajas**: El estándar absoluto para inferencia de LLMs en CPU/GPU móvil con cuantización extrema (Q2_K a Q8_0 en formato GGUF).
   * **Uso**: Motor principal para el razonamiento de diseño UML, corrección de errores y traducción de lenguaje natural a intenciones canónicas.
3. **MediaPipe Tasks**:
   * **Uso**: Procesamiento en tiempo real de la cámara para reconocer rectángulos de clases, rombos de rombos de agregación/composición y flechas en bocetos de papel o pizarra.
4. **whisper.cpp**:
   * **Uso**: Motor ultraliviano C++ para transcripción de notas de voz en menos de 100ms por frase.

---

## 🎯 4. Los Tres Superpoderes de UMLForge Móvil

### 1. Asistente de Voz y Modelado Manos Libres
* El usuario presiona el botón flotante y dice: *"Agrega una clase Empleado con salario BigDecimal y relación de herencia hacia Persona"*.
* `whisper.cpp` transcribe en milisegundos en el dispositivo.
* El LLM cuantizado (Gemma 2B o Qwen 0.5B) emite un JSON estructurado de mutación canónica:
  ```json
  {
    "action": "ADD_CLASS",
    "class_name": "Empleado",
    "parent": "Persona",
    "attributes": [{"name": "salario", "type": "BigDecimal"}]
  }
  ```
* Se actualiza la base de datos local y se sincroniza con los compañeros vía CRDT Yjs cuando haya red.

### 2. Sketch-to-UML (Visión por Cámara)
* El usuario apunta la cámara a un diagrama dibujado en una servilleta o pizarra.
* MediaPipe / OpenCV móvil detecta cajas rectangulares, líneas y texto mediante OCR local (ML Kit).
* Se reconstruye el diagrama en el canvas móvil como un modelo canónico editable y listo para compilar a Spring Boot.

### 3. Asistente RAG Offline de Ingeniería de Software
* Base vectorial embebida en SQLite (sqlite-vss o sqlite-vec).
* Contiene: Reglas de diseño UML OMG, patrones GoF (Factory, Singleton, Observer), buenas prácticas Spring Boot 3 y esquemas relacionales.
* El usuario puede consultar: *"¿Cómo modelo una relación de muchos a muchos bidireccional evitando ciclos infinitos en JPA?"* y la IA responde 100% offline con ejemplos directos adaptados a su modelo actual.

---

## 🔋 5. Estrategias Críticas de Producción (Batería y Memoria)

* **Descarga de Modelos Modular (On-Demand)**: El APK inicial pesa ~40 MB. Los pesos GGUF se descargan bajo demanda según el tier del teléfono y se guardan en el almacenamiento interno.
* **Ciclo de Vida de Memoria (Unload on Background)**: Si la app pasa a segundo plano, el modelo LLM se descarga de la RAM liberando hasta 2 GB de memoria para no ser cerrado por el sistema operativo (Evitar `OOM Killer`).
* **Inferencia por Lotes y Enfriamiento**: Se limita la generación a respuestas cortas (máximo 256-512 tokens) para evitar sobrecalentar el procesador y drenar la batería.
"""

# -------------------------------------------------------------------------
# 6. 04 - ROADMAP Y PENDIENTES.md
# -------------------------------------------------------------------------
roadmap_content = """# 🗺️ 04 - Roadmap y Tareas Pendientes de UMLForge

Este documento es el tablero de control de lo que falta para completar el 100% del proyecto y las pautas para continuar el desarrollo.

---

## ✅ Lo que ya está 100% Completado y Validado

1. **Core Canónico Invariante (`CanonicalModel`)**:
   * Clases, Atributos, Métodos, Relaciones, Multiplicidades, Restricciones.
2. **Motor de Validación Semántica (`GenerationValidator`)**:
   * Reglas de integridad estructural previas a la generación.
3. **Generador de Backend Spring Boot 3 + PostgreSQL**:
   * Entity JPA, DTO Request, DTO Response, Repository, Service, Controller, GlobalExceptionHandler.
   * Manejo robusto de 1:1, 1:N, N:1, N:M con `@JoinTable` explícito, Composición con cascada y Herencia JOINED.
4. **Generación Inteligente de Datos Sintéticos & Semillas Coherentes**:
   * `DomainAnalyzer`: Heurística semántica determinista de dominios de negocio.
   * `DependencyGraph`: Ordenamiento topológico con detección de ciclos irresolubles (`SEED_CYCLE_DETECTED`).
   * `SyntheticDataGenerator`: Inserciones SQL idempotentes (`ON CONFLICT DO NOTHING`) y sincronización `setval`.
   * Manejo integral Many-to-Many a nivel de API REST con `findAllById` y validación de cardinalidad.
5. **Generador de Colecciones Postman Dinámicas**:
   * Cuerpos POST con variables Faker nativas (`{{$randomFirstName}}`, etc.) y tipos no entrecomillados para números.
   * Scripts de prueba con captura y propagación de IDs.
   * Sincronización con la ruta canónica `resource_path`.
6. **Interoperabilidad XMI 2.5.1**:
   * Importación y exportación compatible con Enterprise Architect y StarUML.
7. **Colaboración en Tiempo Real**:
   * Servidor WebSocket Node.js + Yjs, Awareness y roles de usuario.
8. **Frontend Web Editor**:
   * Canvas interactivo en React 18 / Vite con arquitectura Feature-Sliced Design (FSD).

---

## ⏳ Tareas Pendientes para el Cierre Total

### 1. Afinamiento Final de Fase 12 (IA Local Web)
- [ ] Conectar el widget de grabación de voz con el Web Worker de Whisper en el navegador.
- [ ] Probar transcripción en vivo con micrófono del usuario.
- [ ] Vincular el extractor de intenciones con el store de mutación de clases en el canvas.

### 2. Fase 13: Visión por Computadora (Sketch-to-UML)
- [ ] Implementar pipeline de detección de rectángulos y texto en imágenes (dibujos en pizarra / papel).
- [ ] Convertir la detección visual en entidades y relaciones de `CanonicalModel`.
- [ ] Permitir al usuario previsualizar y confirmar el modelo reconocido antes de insertarlo al canvas.

### 3. Fase 14: Aplicación Móvil con IA Local Adaptativa
- [ ] Inicializar proyecto móvil (Flutter o Kotlin Multiplatform).
- [ ] Implementar el módulo de perfilado de hardware (`DeviceHardwareProfiler`).
- [ ] Integrar motor nativo `llama.cpp` / `whisper.cpp` para inferencia local offline según el tier detectado.
- [ ] Implementar el cliente Yjs móvil para sincronización bidireccional con la versión Web.

---

## 📌 Pauta Obligatoria para Nuevas Tareas
> [!IMPORTANT]
> A partir de este momento, todos los planes de implementación, walkthroughs, análisis técnicos y decisiones de diseño **deben escribirse directamente en esta bóveda de Obsidian** (`C:\\Users\\apaza\\OneDrive\\Documentos\\Obsidian Vault\\Parcial-Software-1`), manteniendo los enlaces internos tipo `[[Nombre Documento]]` y las 10 Reglas de Oro.
"""

# -------------------------------------------------------------------------
# Escritura de archivos en la Bóveda de Obsidian
# -------------------------------------------------------------------------
files_to_write = {
    "00 - CEREBRO CENTRAL UMLFORGE.md": cerebro_central_content,
    "01 - REGLAS Y ESTANDARES DE INGENIERIA.md": reglas_content,
    "02 - MEMORIA TECNICA Y HISTORIAL DE FASES.md": memoria_content,
    "FASE 12.md": fase12_content,
    "03 - IA LOCAL MOVIL ADAPTATIVA (FASE 14).md": ia_movil_content,
    "04 - ROADMAP Y PENDIENTES.md": roadmap_content,
}

for filename, content in files_to_write.items():
    target_path = vault_dir / filename
    target_path.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"Escrito exitosamente: {filename} ({len(content)} caracteres)")

print("\n¡Cerebro en Obsidian generado con éxito!")
