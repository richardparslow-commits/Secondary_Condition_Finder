import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_RESPONSE_BYTES,
  readBoundedResponseJson,
  readBoundedResponseText,
  ResponseTooLargeError,
} from "@/lib/bounded-response";

/** A response whose body is a real stream, so the streaming branch is exercised. */
function streamingResponse(
  chunks: string[],
  headers: Record<string, string> = {},
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

/** A response with no stream body, forcing the `response.text()` fallback. */
function bodylessResponse(text: string, headers: Record<string, string> = {}): Response {
  return {
    headers: new Headers(headers),
    body: null,
    text: async () => text,
  } as unknown as Response;
}

describe("readBoundedResponseText", () => {
  it("defaults to a 25 MB cap shared by both outbound stacks", () => {
    expect(DEFAULT_MAX_RESPONSE_BYTES).toBe(25_000_000);
  });

  it("rejects a declared content-length over the cap before reading the body", async () => {
    const response = streamingResponse(["small"], { "content-length": "9999" });

    const error = await readBoundedResponseText(response, {
      url: "https://example.test/data",
      maxBytes: 100,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResponseTooLargeError);
    // Message shape is pinned: the regulatory preflight suite asserts on
    // /declared N bytes/ for this branch.
    expect((error as Error).message).toContain("declared 9999 bytes");
    expect((error as ResponseTooLargeError).declaredBytes).toBe(9999);
  });

  it("cancels the body when refusing a declared content-length over the cap", async () => {
    let cancelReason: unknown;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("small"));
      },
      cancel(reason) {
        cancelReason = reason;
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { "content-length": "9999" },
    });

    await expect(
      readBoundedResponseText(response, {
        url: "https://example.test/data",
        maxBytes: 100,
      }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);

    // Cancellation is deliberately not awaited by the reader, so give the
    // stream algorithm a turn to invoke the source's cancel hook.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelReason).toBe("response-size-limit");
  });

  it("keeps the size refusal when cancelling the body rejects", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("small"));
      },
      cancel() {
        throw new Error("cancel failed");
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { "content-length": "9999" },
    });

    const error = await readBoundedResponseText(response, {
      url: "https://example.test/data",
      maxBytes: 100,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResponseTooLargeError);
    expect((error as Error).message).toContain("declared 9999 bytes");
    expect((error as ResponseTooLargeError).declaredBytes).toBe(9999);
  });

  it("stops a stream that exceeds the cap when content-length under-declares", async () => {
    // The header claims 10 bytes; the stream actually carries 300.
    const response = streamingResponse(["a".repeat(150), "b".repeat(150)], {
      "content-length": "10",
    });

    const error = await readBoundedResponseText(response, {
      url: "https://example.test/data",
      maxBytes: 100,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResponseTooLargeError);
    expect((error as ResponseTooLargeError).maxBytes).toBe(100);
    expect((error as Error).message).toContain("safety limit");
  });

  it("stops a stream that exceeds the cap when content-length is absent", async () => {
    const response = streamingResponse(["a".repeat(101)]);

    await expect(
      readBoundedResponseText(response, { url: "u", maxBytes: 100 }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("accepts a body exactly at the cap", async () => {
    const response = streamingResponse(["x".repeat(100)]);

    await expect(
      readBoundedResponseText(response, { url: "u", maxBytes: 100 }),
    ).resolves.toHaveLength(100);
  });

  it("reassembles multi-chunk bodies in order", async () => {
    const response = streamingResponse(["{\"a\":", "1", "}"]);

    await expect(
      readBoundedResponseText(response, { url: "u", maxBytes: 100 }),
    ).resolves.toBe('{"a":1}');
  });

  it("applies the cap on the text fallback when there is no stream body", async () => {
    await expect(
      readBoundedResponseText(bodylessResponse("hello"), { url: "u", maxBytes: 100 }),
    ).resolves.toBe("hello");

    await expect(
      readBoundedResponseText(bodylessResponse("x".repeat(101)), { url: "u", maxBytes: 100 }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});

describe("readBoundedResponseJson", () => {
  it("parses a bounded body", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });

    await expect(
      readBoundedResponseJson<{ ok: boolean }>(response, { url: "u", maxBytes: 1_000 }),
    ).resolves.toEqual({ ok: true });
  });

  it("propagates the size error rather than attempting to parse", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-length": "5000" },
    });

    await expect(
      readBoundedResponseJson(response, { url: "u", maxBytes: 100 }),
    ).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("still surfaces malformed JSON as a SyntaxError, like response.json()", async () => {
    const response = new Response("{not json", { status: 200 });

    await expect(
      readBoundedResponseJson(response, { url: "u", maxBytes: 1_000 }),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});
