# API de citas PE y CL

Servicio para registrar citas y consultar su estado. El registro responde `202 pending`; el procesamiento por país guarda la cita en MySQL y una confirmación asíncrona cambia su estado a `completed` en DynamoDB.

La [documentación técnica](docs/documentacion-tecnica.md) describe la arquitectura, los diagramas, los patrones, las decisiones de diseño, la configuración y las pruebas realizadas.

## Stack

Node.js 24 y TypeScript, Zod, AWS SDK v3, MySQL con `mysql2`, Serverless Framework v4 y esbuild. En AWS se usan API Gateway HTTP API, Lambda, DynamoDB, SNS, SQS, EventBridge, Secrets Manager y CloudWatch. Las pruebas utilizan Jest, DynamoDB Local y MySQL en Docker; GitHub Actions ejecuta CI, SonarQube Cloud y Snyk.

Las versiones están fijadas en [package.json](package.json), [pnpm-lock.yaml](pnpm-lock.yaml) y [mise.toml](mise.toml).

## Preparar el proyecto

Requisitos: Node.js `24.19.0`, pnpm `11.21.0` y Docker con Compose para las pruebas de integración. `mise install` instala la versión de Node definida en el repositorio; pnpm se puede instalar con `npm install --global pnpm@11.21.0`.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm format
```

Si utilizas mise sin activarlo en tu terminal, antepone `mise exec --` a los comandos de pnpm.

Para probar los adaptadores de persistencia:

```sh
docker compose up -d --wait
pnpm local:dynamo
pnpm integration
pnpm coverage
docker compose down
```

Compose inicia DynamoDB Local y MySQL. Las pruebas locales no requieren credenciales de AWS ni un archivo `.env`. La configuración de una MySQL externa se explica en la [documentación técnica](docs/documentacion-tecnica.md#configuración-y-despliegue).

## Usar la API

Entorno de prueba: `https://orey9x9kr4.execute-api.us-east-1.amazonaws.com`. Utilizar únicamente datos ficticios. Los endpoints de citas no tienen autenticación de usuarios.

Registrar una cita:

```sh
curl -i -X POST 'https://orey9x9kr4.execute-api.us-east-1.amazonaws.com/appointments' \
  -H 'Content-Type: application/json' \
  -d '{"insuredId":"00123","scheduleId":100,"countryISO":"PE"}'
```

`insuredId` es un texto de cinco dígitos, `scheduleId` un entero positivo y `countryISO` admite `PE` o `CL`. El servicio recibe el identificador del horario; no comprueba su disponibilidad.

Consultar el estado, comenzando por las citas más recientes:

```sh
curl 'https://orey9x9kr4.execute-api.us-east-1.amazonaws.com/appointments/00123?limit=20'
```

La respuesta contiene `items` y puede incluir `cursor`. Para continuar, envía ese cursor en la siguiente consulta al mismo asegurado. El límite por defecto es 20 y el máximo es 100. El listado usa consistencia eventual: una cita o actualización reciente puede tardar en aparecer.

Repetir la misma reserva conserva su ID y fecha. Si sigue pendiente responde `202`; cuando está confirmada responde `200 completed`.

## Swagger

Swagger se publica en `/swagger/index.html` del entorno de prueba. Utiliza Basic Auth con credenciales almacenadas en Secrets Manager y compartidas por separado.

Para generar OpenAPI y consultar la documentación local:

```sh
pnpm openapi
pnpm swagger:local
```

La vista local está en `http://127.0.0.1:8080/swagger`. Sirve la documentación con la ejecución de solicitudes deshabilitada; no inicia una API local.

## Verificación y despliegue

Cada push ejecuta [Checks](.github/workflows/ci.yml); los cambios en `main` también ejecutan [Dependency security](.github/workflows/security.yml). El despliegue se inicia manualmente con [Deploy learning](.github/workflows/deploy.yml), después de que ambos controles pasen para el mismo commit.

El entorno AWS usa una MySQL externa en Aiven. La infraestructura del repositorio no crea RDS ni Aurora. Consulta los [requisitos de despliegue](docs/documentacion-tecnica.md#configuración-y-despliegue) y las [pruebas por entorno](docs/documentacion-tecnica.md#verificación) antes de reproducir el entorno.
