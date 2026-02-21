import { NextResponse, type NextRequest } from 'next/server'

function resolveRedirectPath(rawPath: string | null): string {
    if (rawPath && rawPath.startsWith('/') && !rawPath.startsWith('//')) {
        return rawPath
    }

    return '/dashboard'
}

export function proxy(request: NextRequest) {
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
    const localSessionMarker = 'tm_auth'
    const appwriteSessionCookie = projectId ? `a_session_${projectId}` : null
    const hasSession = Boolean(
        request.cookies.get(localSessionMarker)?.value ||
            (appwriteSessionCookie &&
                (request.cookies.get(appwriteSessionCookie)?.value ||
                    request.cookies.get(`${appwriteSessionCookie}_legacy`)?.value))
    )

    const isProtectedRoute =
        request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/workspaces') ||
        request.nextUrl.pathname.startsWith('/projects') ||
        request.nextUrl.pathname.startsWith('/tasks') ||
        request.nextUrl.pathname.startsWith('/ideas') ||
        request.nextUrl.pathname.startsWith('/analytics') ||
        request.nextUrl.pathname.startsWith('/planning') ||
        request.nextUrl.pathname.startsWith('/transactions') ||
        request.nextUrl.pathname.startsWith('/documents') ||
        request.nextUrl.pathname.startsWith('/wiki') ||
        request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/manager')

    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

    if (isProtectedRoute && !hasSession) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/auth'
        redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
    }

    if (isAuthRoute && hasSession) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = resolveRedirectPath(request.nextUrl.searchParams.get('redirectTo'))
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.next({
        request: {
            headers: request.headers,
        },
    })
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
