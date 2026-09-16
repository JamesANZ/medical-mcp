import superagent from "superagent";
import { MONID_API_BASE, MONID_API_KEY, USER_AGENT } from "../constants.js";
import { resilientCall } from "../resilience/index.js";

export function hasMonidKey(): boolean {
  return Boolean(MONID_API_KEY);
}

type MonidRunResponse = {
  runId?: string;
  status?: string;
  output?: unknown;
  providerResponse?: { httpStatus?: number; error?: unknown };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRun(runId: string): Promise<MonidRunResponse> {
  const res = await superagent
    .get(`${MONID_API_BASE}/v1/runs/${runId}`)
    .set("Authorization", `Bearer ${MONID_API_KEY}`)
    .set("User-Agent", USER_AGENT)
    .timeout({ response: 15_000, deadline: 20_000 });
  return res.body as MonidRunResponse;
}

async function pollRun(runId: string): Promise<MonidRunResponse> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(1000);
    const body = await getRun(runId);
    if (body.status === "COMPLETED" || body.status === "FAILED") {
      return body;
    }
  }
  throw new Error(`Monid run ${runId} timed out`);
}

export async function monidRun(
  provider: string,
  endpoint: string,
  input: Record<string, unknown>,
  sourceName = "Monid",
): Promise<unknown> {
  if (!hasMonidKey()) {
    throw new Error("MONID_API_KEY is not set");
  }

  const started = await resilientCall(sourceName, async () =>
    superagent
      .post(`${MONID_API_BASE}/v1/run`)
      .send({ provider, endpoint, input })
      .set("Authorization", `Bearer ${MONID_API_KEY}`)
      .set("Content-Type", "application/json")
      .set("User-Agent", USER_AGENT)
      .timeout({ response: 30_000, deadline: 45_000 }),
  );

  let body = started.body as MonidRunResponse;
  if (started.status === 202 && body.runId) {
    body = await pollRun(body.runId);
  }

  if (body.status === "FAILED") {
    throw new Error("Monid run failed");
  }
  const httpStatus = body.providerResponse?.httpStatus;
  if (httpStatus && httpStatus >= 400) {
    throw new Error(`Monid provider HTTP ${httpStatus}`);
  }
  return body.output;
}
