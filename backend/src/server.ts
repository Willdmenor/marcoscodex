import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { env, corsOrigins } from './config/env.js';
import { adminRoutes } from './routes/admin.routes.js';
import { contactRoutes } from './routes/contact.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { newsletterRoutes } from './routes/newsletter.routes.js';
import { orderRoutes } from './routes/orders.routes.js';
import { productRoutes } from './routes/products.routes.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn'
    }
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    }
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute'
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        issues: error.issues
      });
    }

    const maybeHttpError = error as { statusCode?: unknown; message?: unknown };

    if (typeof maybeHttpError.statusCode === 'number') {
      return reply.code(maybeHttpError.statusCode).send({
        error: typeof maybeHttpError.message === 'string' ? maybeHttpError.message : 'request_error'
      });
    }

    request.log.error(error);
    return reply.code(500).send({ error: 'internal_server_error' });
  });

  await app.register(healthRoutes);
  await app.register(productRoutes);
  await app.register(adminRoutes);
  await app.register(newsletterRoutes);
  await app.register(contactRoutes);
  await app.register(orderRoutes);

  app.get('/', async () => ({
    ok: true,
    name: 'Marcos Calçados API',
    docs: {
      health: '/health',
      categories: '/api/categories',
      products: '/api/products',
      admin: '/api/admin/overview'
    }
  }));

  return app;
}

const app = await buildServer();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
