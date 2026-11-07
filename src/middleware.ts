import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|seed/).*)"],
};
