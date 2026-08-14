import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI mount point — intentionally `/api`, outside the versioned prefix. */
export const SWAGGER_PATH = 'api';

/** All application routes live under this prefix, e.g. `/api/v1/health`. */
export const GLOBAL_PREFIX = 'api/v1';

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Zica-Zima CRM API')
      .setDescription(
        'PostgreSQL-backed CRM API. This service is independent of the legacy Express/Firebase app.',
      )
      .setVersion('0.1.0')
      .addServer(`/${GLOBAL_PREFIX}`)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
          description: 'Firebase ID token from the client SDK (Authorization: Bearer <token>).',
        },
        'firebase',
      )
      .addTag('health', 'Liveness and readiness probes')
      .addTag('auth', 'Firebase authentication and current user')
      .addTag('leads', 'Lead capture, filters, status, activities and conversion')
      .addTag('students', 'Students created from converted leads')
      .addTag('batches', 'Course batches at a centre')
      .addTag('fees', 'Fee plans, payments and receipts')
      .addTag('dashboard', 'Director and centre analytics')
      .addTag('courses', 'Course catalogue and roll prefixes')
      .addTag('users', 'Staff access, approvals and assignees')
      .addTag('tasks', 'Director-assigned work and follow-up')
      .build(),
  );

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'Zica-Zima CRM API',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
