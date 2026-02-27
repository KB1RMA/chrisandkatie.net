import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // RSC pathname workaround. Currently pathname is not accessible within server components directly.
  // This workaround sets a header which can then be accessed via `const headersList = headers();` in
  // server components. This workaround is currently used in the `<LayoutRequireAuth>` component to
  // "properly" redirect to the login page and preserve a `callBackUrl` to forward on to Entra.
  //
  // Discussion: https://github.com/vercel/next.js/discussions/71720
  const requestHeaders = new Headers(request.headers);
  const path = request.nextUrl.pathname + request.nextUrl.search;

  requestHeaders.set('x-pathname', path);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
