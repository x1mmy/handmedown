export function GET() {
  return new Response("Not found", { status: 404, headers: { "x-content-type-options": "nosniff" } });
}
