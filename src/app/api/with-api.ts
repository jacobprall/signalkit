import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export type ApiErrorBody =
  | { error: string; details?: unknown }
  | { error: string; message?: string };

export interface ApiHandlerContext<P> {
  request: NextRequest;
  params: P;
}

// Wraps a route handler with: param-promise resolution, structured Zod
// validation errors, and uniform 500 fallback. Concrete routes only deal
// with happy-path code; thrown errors are rendered automatically.
export function withApi<P extends Record<string, string> = Record<string, string>>(
  handler: (
    ctx: ApiHandlerContext<P> & { request: NextRequest },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    routeCtx: { params?: Promise<P> } = {},
  ): Promise<NextResponse> => {
    try {
      const params = ((await routeCtx.params) ?? ({} as P)) as P;
      return await handler({ request, params });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(err.body, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: err.flatten() },
          { status: 400 },
        );
      }
      console.error(`[api] unhandled error in ${request.nextUrl.pathname}:`, err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(typeof body === 'object' && 'error' in body ? body.error : 'Http error');
  }
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(404, { error: message });
}

export function badRequest(message: string, details?: unknown): never {
  throw new HttpError(400, { error: message, details });
}

export async function parseJson<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<T> {
  const body = await request.json().catch(() => {
    throw new HttpError(400, { error: 'Invalid JSON body' });
  });
  return schema.parse(body);
}

export function parseQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): T {
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const all = request.nextUrl.searchParams.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  return schema.parse(obj);
}

// Escape user input before inserting into an SQL ILIKE pattern. Any literal
// `%` and `_` from the user becomes `\%` / `\_`.
export function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}
