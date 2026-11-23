import { guard } from "@/lib/http";
import { subscribeToSkillActivity } from "@/lib/activity-events";
import { withoutEmbedding } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  const encoder = new TextEncoder();
  let cleanup = () => undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (
        memories: Parameters<Parameters<typeof subscribeToSkillActivity>[0]>[0],
      ) =>
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(memories.map(withoutEmbedding))}\n\n`,
          ),
        );
      const unsubscribe = subscribeToSkillActivity(send);
      const heartbeat = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        20_000,
      );
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* Already closed. */
        }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
