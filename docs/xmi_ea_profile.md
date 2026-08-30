# Especificación de Perfil XMI 2.5.1 — Enterprise Architect (EA)

> **AVISO DE METADATOS DE INTEROPERABILIDAD:**
> Este documento describe el perfil de serialización XMI 2.5.1 utilizado por Sparx Systems Enterprise Architect (EA) y el subconjunto práctico soportado por **UMLForge**.
> Al no disponer de un archivo binario nativo exportado por una licencia instalada de EA en el entorno de desarrollo, las pruebas se basan en **fixtures sintéticos conformes a la especificación OMG UML 2.5.1 / XMI 2.5.1 y la documentación técnica de Sparx Systems EA**, explícitamente rotulados como **"NO REAL / PROFILE SIMULADO"**.

---

## 1. Contexto y Versiones

- **Estándar Metamodelo:** OMG UML® 2.5.1 (Formal/2017-12-05)
- **Estándar Intercambio:** OMG XMI® 2.5.1 (Formal/2015-06-01 / MOF 2.5.1)
- **Dialecto/Perfil:** Sparx Systems Enterprise Architect (v15/v16) XMI 2.5.1 Export Profile
- **Esquema de Adaptador:** UMLForge XMI Service (`services/xmi`)

---

## 2. Namespaces y Estructura Raíz

### 2.1 Tabla de Namespaces

| Prefijo | URI Namespace | Propósito |
| :--- | :--- | :--- |
| `xmi` | `http://www.omg.org/spec/XMI/20131001` | Metadatos y tipos XMI (IDs, tipos, versiones) |
| `uml` | `http://www.omg.org/spec/UML/20131001` | Metamodelo UML 2.5.1 (Clases, Componentes, etc.) |
| `ea` (opcional) | `http://www.sparxsystems.com/profiles/ea` | Extensiones propietarias de Enterprise Architect |

### 2.2 Estructura Raíz

El documento raíz siempre es `<xmi:XMI>`, conteniendo como elemento principal un `<uml:Model>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001"
         xmlns:uml="http://www.omg.org/spec/UML/20131001"
         xmi:version="2.5">
  <uml:Model xmi:type="uml:Model" xmi:id="EAID_Model_1" name="UMLForge_Model">
    <!-- Elementos del modelo aquí -->
  </uml:Model>
</xmi:XMI>
```

---

## 3. Subconjunto Soportado por UMLForge

UMLForge implementa un **subconjunto práctico** de elementos OMG UML 2.5.1 para garantizar round-trip fiel con su `CanonicalModel`:

```text
SUPPORTED XMI 2.5.1 PROFILE
✅ Model              (<uml:Model>)
✅ Class              (<packagedElement xmi:type="uml:Class">)
✅ Property           (<ownedAttribute xmi:type="uml:Property">)
✅ Operation          (<ownedOperation xmi:type="uml:Operation">)
✅ Association        (<packagedElement xmi:type="uml:Association">)
✅ Generalization     (<generalization xmi:type="uml:Generalization">)
✅ Component          (<packagedElement xmi:type="uml:Component">)
✅ Interface          (<packagedElement xmi:type="uml:Interface">)
✅ Port               (<ownedPort xmi:type="uml:Port">)
✅ Connector          (<ownedConnector xmi:type="uml:Connector">)
✅ Dependency         (<packagedElement xmi:type="uml:Dependency">)
```

Cualquier otro elemento (ej. `uml:Activity`, `uml:UseCase`, `uml:State`, `uml:Node`) es ignorado con un registro de advertencia (`warning`) estructurado en el `ImportReport`.

---

## 4. Mapeo de Elementos EA XMI ↔ CanonicalModel

### 4.1 Clases (`uml:Class`)
- **Etiqueta:** `<packagedElement xmi:type="uml:Class" xmi:id="..." name="..." visibility="..." isAbstract="...">`
- **Atributos mapeados:**
  - `name`: Nombre de la clase.
  - `isAbstract` (bool): Mapeado a `is_abstract`.
  - `visibility`: Mapeado a `VisibilityKind` (public, private, protected, package).
- **Contenido interno:**
  - `<ownedAttribute>` → Atributos.
  - `<ownedOperation>` → Operaciones.
  - `<generalization>` → Herencia.

### 4.2 Atributos / Propiedades (`uml:Property`)
- **Etiqueta:** `<ownedAttribute xmi:type="uml:Property" xmi:id="..." name="..." visibility="..." isStatic="...">`
- **Tipo de dato (`type`):**
  - Si es primitivo: `<type xmi:type="uml:PrimitiveType" href=".../PrimitiveTypes.xmi#String"/>` o atributo `type="String"`.
  - Si es referencia a clase: `type="EAID_TargetClassId"` o `<type xmi:idref="..."/>`.
- **Multiplicidad:**
  - `<lowerValue xmi:type="uml:LiteralInteger" value="1"/>`
  - `<upperValue xmi:type="uml:LiteralUnlimitedNatural" value="1"/>` (o `*`)
- **Valor Inicial:**
  - `<defaultValue xmi:type="uml:LiteralString" value="..."/>`

### 4.3 Operaciones y Parámetros (`uml:Operation`, `uml:Parameter`)
- **Etiqueta:** `<ownedOperation xmi:type="uml:Operation" xmi:id="..." name="..." visibility="..." isStatic="..." isAbstract="...">`
- **Parámetros de entrada:**
  - `<ownedParameter xmi:type="uml:Parameter" xmi:id="..." name="..." direction="in">`
- **Tipo de retorno:**
  - `<ownedParameter xmi:type="uml:Parameter" xmi:id="..." direction="return">` con tipo asociado.

### 4.4 Asociaciones (`uml:Association`)
- **Etiqueta:** `<packagedElement xmi:type="uml:Association" xmi:id="..." name="...">`
- **Extremos de Asociación:**
  - `<memberEnd xmi:idref="EAID_Prop1"/>` / `<ownedEnd xmi:type="uml:Property" xmi:id="..." type="EAID_Class1" aggregation="none|shared|composite">`
  - `aggregation="none"` → Asociación simple.
  - `aggregation="shared"` → Agregación.
  - `aggregation="composite"` → Composición.

### 4.5 Generalizaciones / Herencia (`uml:Generalization`)
- **Etiqueta:** `<generalization xmi:type="uml:Generalization" xmi:id="..." general="EAID_SuperClassId"/>`
- **Mapeo:** Crea un `UMLRelationship` con `type="inheritance"`, `source=SubClassId`, `target=SuperClassId`.

### 4.6 Componentes (`uml:Component`)
- **Etiqueta:** `<packagedElement xmi:type="uml:Component" xmi:id="..." name="...">`
- **Puertos:** `<ownedPort xmi:type="uml:Port" xmi:id="..." name="..." type="EAID_InterfaceId"/>`

### 4.7 Interfaces (`uml:Interface`)
- **Etiqueta:** `<packagedElement xmi:type="uml:Interface" xmi:id="..." name="...">`
- Contiene `<ownedOperation>` con las firmas de métodos requeridos/provistos.

### 4.8 Puertos y Conectores (`uml:Port`, `uml:Connector`)
- **Port:**
  - En UMLForge, cada puerto tiene `kind="provided"` o `kind="required"` y se vincula a una `interface_id`.
  - En XMI EA, se serializa como `<ownedPort>` y se vincula a la interfaz a través de `type` o dependencias de interfaz.
- **Connector:**
  - `<ownedConnector xmi:type="uml:Connector" xmi:id="..." name="...">`
    - `<end xmi:type="uml:ConnectorEnd" role="EAID_Port1"/>`
    - `<end xmi:type="uml:ConnectorEnd" role="EAID_Port2"/>`

### 4.9 Dependencias (`uml:Dependency`)
- **Etiqueta:** `<packagedElement xmi:type="uml:Dependency" xmi:id="..." client="EAID_Source" supplier="EAID_Target"/>`
- Mapeado a `UMLDependency(source_id=SourceUUID, target_id=TargetUUID, type="dependency")`.

---

## 5. Estrategia de Mapeo de Identificadores (`IDMapper`)

Enterprise Architect genera IDs alfanuméricos con prefijo `EAID_` (ej. `EAID_7B2D3F4A_1234_5678_...`), los cuales no son UUID RFC 4122 válidos.

1. **Si el `xmi:id` es un UUID válido:** Se utiliza directamente.
2. **Si no es UUID (ej. `EAID_...`):** Se deriva un `UUIDv5` determinista utilizando:
   - Namespace UUID base: `uuid5(NAMESPACE_URL, f"umlforge:xmi:{doc_fingerprint}:{xmi_id}")`
   - `doc_fingerprint`: SHA-256 (primeros 16 caracteres) del contenido XMI para evitar colisiones inter-documento.
3. **Preservación Bidireccional:** El mapper guarda la tabla de traducción `xmi:id ↔ UUID` para reconstruir los identificadores originales en la exportación.

---

## 6. Seguridad del Parser XML

Para mitigar ataques **XXE (XML External Entity)**, **Billion Laughs (XML Bomb)** y denegación de servicio (DoS):
1. **Librería:** `lxml.etree`
2. **Configuración de Parser Seguro:**
   ```python
   parser = etree.XMLParser(
       resolve_entities=False,
       no_network=True,
       remove_comments=False,
       load_dtd=False,
       huge_tree=False
   )
   ```
3. **Límite de Tamaño de Archivo:** Máximo 10 MB (validado antes de procesar el stream XML).
4. **DOCTYPE Prohibido:** Si el payload incluye definiciones DTD externas sospechosas, la resolución es bloqueada y se levanta `XMI_INVALID_XML`.
