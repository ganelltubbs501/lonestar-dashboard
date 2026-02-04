import { NextResponse } from 'next/server';
import { auth } from './auth';
import { ZodError } from 'zod';
import logger from './logger';
import { apiRateLimiter } from './rate-limit';

export type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
};

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function validationErrorResponse(error: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = [];
    errors[path].push(issue.message);
  }
  return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
}

export async function withAuth<T>(
  handler: (userId: string) => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401) as NextResponse<ApiResponse<T>>;
    }

    // Rate limiting: 100 requests per minute per user
    const rateLimit = apiRateLimiter.check(session.user.id);
    if (!rateLimit.success) {
      logger.warn({ userId: session.user.id, remaining: 0 }, 'API rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      ) as NextResponse<ApiResponse<T>>;
    }

    return handler(session.user.id);
  } catch (error) {
    logger.error({ error }, 'API error');
    return errorResponse('Internal server error', 500) as NextResponse<ApiResponse<T>>;
  }
}

export async function withAdminAuth<T>(
  handler: (userId: string) => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse('Unauthorized', 401) as NextResponse<ApiResponse<T>>;
    }
    if (session.user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Admin access required', 403) as NextResponse<ApiResponse<T>>;
    }

    // Rate limiting: 100 requests per minute per user
    const rateLimit = apiRateLimiter.check(session.user.id);
    if (!rateLimit.success) {
      logger.warn({ userId: session.user.id, remaining: 0 }, 'API rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.reset),
          },
        }
      ) as NextResponse<ApiResponse<T>>;
    }

    return handler(session.user.id);
  } catch (error) {
    logger.error({ error }, 'API error');
    return errorResponse('Internal server error', 500) as NextResponse<ApiResponse<T>>;
  }
}
