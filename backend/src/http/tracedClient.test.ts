import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { RecordStepInput } from "@playground/shared";
import {
  createTracedClient,
  HTTP_TIMEOUT_MS,
  METADATA_MAX_RESPONSE_BYTES,
  REQUEST_MAX_BODY_BYTES,
  tracedRequestWith,
} from "./tracedClient";

const trace = {
  runId: "run-test",
  name: "issuer_metadata" as const,
  stage: "issuance" as const,
  from: "playground",
  to: "inji-certify",
};

test("records redacted request and response data through the real interceptor path", async () => {
  const steps: RecordStepInput[] = [];
  const client = createTracedClient(async (_runId: string, input: RecordStepInput) => {
    steps.push(input);
  });

  await tracedRequestWith(client, trace, {
    method: "POST",
    url: "https://certify.test/metadata",
    headers: { Authorization: "authorization-sentinel", Cookie: "cookie-sentinel" },
    data: { client_secret: "client-secret-sentinel", keep: "safe" },
    adapter: async (requestConfig) => ({
      data: { access_token: "token-sentinel", keep: "safe-response" },
      status: 200,
      statusText: "OK",
      headers: { "set-cookie": ["cookie-sentinel"] },
      config: requestConfig,
    }),
  });

  const serialized = JSON.stringify(steps);
  assert.equal(steps.length, 1);
  assert.equal(serialized.includes("authorization-sentinel"), false);
  assert.equal(serialized.includes("cookie-sentinel"), false);
  assert.equal(serialized.includes("client-secret-sentinel"), false);
  assert.equal(serialized.includes("token-sentinel"), false);
  assert.equal(serialized.includes("safe"), true);
});

test("records only a stable category for network errors", async () => {
  const steps: RecordStepInput[] = [];
  const client = createTracedClient(async (_runId: string, input: RecordStepInput) => {
    steps.push(input);
  });

  await assert.rejects(tracedRequestWith(client, trace, {
    method: "GET",
    url: "https://certify.test/metadata",
    adapter: async (requestConfig) => {
      const error = new Error("secret-token-sentinel");
      Object.assign(error, { code: "ECONNRESET", config: requestConfig });
      throw error;
    },
  }));

  const serialized = JSON.stringify(steps);
  assert.equal((steps[0]?.response as { errorCode?: string } | undefined)?.errorCode, "network_error");
  assert.equal(serialized.includes("secret-token-sentinel"), false);
  assert.equal(serialized.includes("network_error"), true);
});

test("does not rethrow unexpected adapter exceptions or their contents", async () => {
  const client = createTracedClient(async () => undefined);

  await assert.rejects(
    tracedRequestWith(client, trace, {
      method: "GET",
      url: "https://certify.test/metadata",
      adapter: async () => {
        throw "unexpected-secret-sentinel";
      },
    }),
    (error: Error) => error.message === "Traced HTTP request failed"
      && !error.message.includes("unexpected-secret-sentinel"),
  );
});

test("recording failure is surfaced generically without leaking its error", async () => {
  const client = createTracedClient(async () => {
    throw new Error("recording secret-token-sentinel");
  });

  await assert.rejects(
    tracedRequestWith(client, trace, {
      method: "GET",
      url: "https://certify.test/metadata",
      adapter: async (requestConfig) => ({
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config: requestConfig,
      }),
    }),
    (error: Error) => error.message === "Protocol trace persistence failed"
      && !error.message.includes("secret-token-sentinel"),
  );
});

test("request and recording failures expose only the persistence error", async () => {
  const client = createTracedClient(async () => {
    throw new Error("recorder-secret-sentinel");
  });

  await assert.rejects(
    tracedRequestWith(client, trace, {
      method: "GET",
      url: "https://certify.test/metadata?token=request-secret-sentinel",
      adapter: async (requestConfig) => {
        const error = new Error("network-secret-sentinel");
        Object.assign(error, {
          code: "ECONNRESET",
          config: requestConfig,
        });
        throw error;
      },
    }),
    (error: Error) => error.message === "Protocol trace persistence failed"
      && !error.message.includes("request-secret-sentinel")
      && !error.message.includes("network-secret-sentinel")
      && !error.message.includes("recorder-secret-sentinel"),
  );
});

test("production adapter enforces size limits and does not follow redirects", async () => {
  let destinationRequests = 0;
  let server: http.Server | undefined;

  try {
    server = http.createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "/destination" }).end();
        return;
      }
      if (request.url === "/destination") {
        destinationRequests += 1;
        response.writeHead(200).end("unexpected");
        return;
      }
      response.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({ data: "x".repeat(METADATA_MAX_RESPONSE_BYTES + 1) }),
      );
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const steps: RecordStepInput[] = [];
    const client = createTracedClient(async (_runId: string, input: RecordStepInput) => {
      steps.push(input);
    });

    await assert.rejects(tracedRequestWith(client, trace, {
      method: "GET",
      url: `${baseUrl}/metadata`,
    }));
    const redirect = await tracedRequestWith(client, trace, {
      method: "GET",
      url: `${baseUrl}/redirect`,
    });
    assert.equal(redirect.status, 302);
    assert.equal(destinationRequests, 0);
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => error ? reject(error) : resolve());
      });
    }
  }

  const client = createTracedClient();
  assert.equal(client.defaults.timeout, HTTP_TIMEOUT_MS);
  assert.equal(client.defaults.maxContentLength, METADATA_MAX_RESPONSE_BYTES);
  assert.equal(client.defaults.maxBodyLength, REQUEST_MAX_BODY_BYTES);
});
