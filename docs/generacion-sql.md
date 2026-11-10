# Generación independiente de SQL

Archivo → Generar SQL PostgreSQL exporta el modelo lógico del diagrama actual sin crear un proyecto Spring Boot. Permite descargar estructura, datos o un ZIP con ambos e instrucciones. La cantidad es de 1 a 1.000 filas por entidad (3 por defecto).

API: `POST /api/v1/models/generate-sql`, cuerpo `{ "model_data": <CanonicalModel>, "mode": "schema" | "data" | "both", "rows_per_entity": 3 }`. Devuelve un archivo SQL o ZIP. Los modelos incompatibles y límites inválidos devuelven 422.

Ejecutar primero `schema.sql` y luego `data.sql` sobre una base PostgreSQL vacía con `psql -v ON_ERROR_STOP=1`. La exportación no conecta con bases externas ni elimina tablas. Solo datos requiere un esquema compatible y vacío; no constituye una migración ni una herramienta para poblar bases existentes.

Los datos son deterministas: reglas por tipo, nombre y dominio, referencias válidas, tablas intermedias y claves compartidas en herencia. Las FK opcionales circulares se completan tras las inserciones; ciclos obligatorios entre tablas no soportados devuelven un error. No se infieren reglas comerciales ausentes ni se aplican descomposiciones de normalización propuestas.

## Estado de generación móvil

El generador Spring Boot produce `manifest.json`, `schema.json`, `ai-tools.json`, `ai-context.json` y `branding.json`. Son metadatos del antiguo runtime móvil, no una aplicación compilable por modelo. La app Expo actual es un visor de UMLForge y no consume esos archivos. La generación de aplicaciones móviles queda fuera de esta funcionalidad.

## Pruebas

En `backend`, ejecutar `pytest tests/generator/test_sql_export.py`. Para incluir la ejecución real de los scripts, definir `UMLFORGE_TEST_POSTGRES_DSN` con la conexión a PostgreSQL de pruebas. Cada caso crea y elimina un esquema exclusivo; no usar una conexión de producción. Sin esa variable, solo se omiten las pruebas de integración con PostgreSQL.

Las claves compuestas de tablas intermedias N:M están soportadas. Varias claves primarias declaradas en una clase se rechazan explícitamente; no se exporta silenciosamente una parte de la clave.
