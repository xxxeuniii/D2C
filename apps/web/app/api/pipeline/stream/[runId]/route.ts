export async function GET(
  req: Request,
  { params }: { params: { runId: string } }
) {
  const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
  const response = await fetch(
    `${backendUrl}/api/pipeline/stream/${params.runId}`
  );
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
