import {
  getUserDatabase,
  insertRequest,
  getRequest,
  updateRequestStatus,
  getOrCreateDefaultProfile,
  getProfileWithFields,
  RequestStatus,
  insertProfileField,
} from "./sql";
import { randomUUIDv7, ServerWebSocket } from "bun";

const JOB_TIMEOUT_MS = 360_000;

// Store active processes
const activeProcesses = new Map<
  string,
  { proc: any; ws: ServerWebSocket<unknown> }
>();

// Handle the browser automation job
async function handleBrowserJob(
  userId: string,
  requestId: string,
  ws: ServerWebSocket<unknown>
) {
  const db = getUserDatabase(userId);

  try {
    // Get the request and profile details
    const request = getRequest(db, requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const profile = getProfileWithFields(db, request.profile_id);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const proc = Bun.spawn(
      [
        "uv",
        "run",
        "../browser/browser.py",
        JSON.stringify(profile),
        request.website_url,
      ],
      {
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    // Store the process reference
    activeProcesses.set(requestId, { proc, ws });

    const decoder = new TextDecoder("utf8", { fatal: false });

    for await (const chunk of proc.stdout) {
      // Convert chunk (which might be a Buffer) to string
      const textChunk = decoder.decode(chunk, { stream: true });
      const lines = textChunk.split("\n");
      for (const lineUntrimmed of lines) {
        const line = lineUntrimmed.trim();
        if (line == "") continue;
        console.log("line", line);
        if (line.startsWith(">>>")) {
          console.log("sending result");
          ws.send(
            JSON.stringify({
              route: "result",
              body: JSON.parse(line.split(">>>")[1]),
            })
          );
        } else {
          ws.send(JSON.stringify({ route: "stdout", body: line }));
        }
      }
    }

    const exitCode = await Promise.race([
      proc.exited,
      new Promise((_, reject) => {
        setTimeout(() => {
          proc.kill();
          reject(new Error("Failed to get required fields: timeout"));
        }, JOB_TIMEOUT_MS);
      }),
    ]);

    // Clean up the process reference
    activeProcesses.delete(requestId);

    if (exitCode !== 0) {
      // parse stderr
      let stderr = "";
      for await (const chunk of proc.stderr) {
        const textChunk = decoder.decode(chunk, { stream: true });
        stderr += textChunk;
      }
      throw new Error(
        `An error occurred when starting the browser job: ${stderr}`
      );
    } else {
      console.log("Browser job completed successfully");
      updateRequestStatus(
        db,
        requestId,
        RequestStatus.COMPLETED,
        null,
        "Browser job completed successfully"
      );
    }
  } catch (err) {
    // Clean up the process reference
    activeProcesses.delete(requestId);

    // Handle any errors in job execution
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    updateRequestStatus(
      db,
      requestId,
      RequestStatus.FAILED,
      null,
      errorMessage
    );
    ws.send(JSON.stringify({ route: "request", error: errorMessage }));
    console.error("Job execution error:", err);
  }
}

const CORS_HEADERS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
};

type WebSocketData = {
  sessionId: string;
};

type WebSocketMessage = {
  route: string;
  body: any;
};

const handlers = {
  request: requestHandler,
  fields: fieldsHandler,
  cancel: cancelHandler,
};

function fieldsHandler(ws: ServerWebSocket<unknown>, body: any) {
  const {
    profile_id: target_profile_id,
    field_key,
    user_id,
    field_value,
  } = body as {
    profile_id: string;
    field_key: string;
    user_id: string;
    field_value: string;
  };
  const db = getUserDatabase(user_id);
  insertProfileField(db, {
    profile_id: target_profile_id,
    field_key,
    field_value,
  });
}

function requestHandler(ws: ServerWebSocket<unknown>, body: any) {
  const { website_url, profile_id, request_id, user_id } = body as {
    website_url: string;
    profile_id?: string | null;
    request_id?: string | null;
    user_id: string;
  };
  const db = getUserDatabase(user_id);

  // Get or create a default profile if none specified
  const final_profile_id = profile_id || getOrCreateDefaultProfile(db);

  console.log("final_profile_id", final_profile_id);

  const request = request_id
    ? getRequest(db, request_id)
    : {
        request_id: randomUUIDv7(),
        website_url,
        profile_id: final_profile_id,
        status: RequestStatus.PENDING,
      };

  if (!request) {
    ws.send(JSON.stringify({ route: "request", error: "Request not found" }));
    return;
  }

  if (!request_id) {
    insertRequest(db, request);
  }

  // Start async job without waiting for it
  handleBrowserJob(user_id, request.request_id, ws).catch((err) => {
    console.error("Failed to handle browser job:", err);
    if (!request_id) {
      ws.send(
        JSON.stringify({
          route: "request",
          error: err.message || "Unknown error occurred",
        })
      );
    }
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    updateRequestStatus(
      db,
      request.request_id,
      RequestStatus.FAILED,
      null,
      errorMessage
    );
  });

  ws.send(
    JSON.stringify({
      route: "request",
      body: {
        request_id: request.request_id,
        profile_id: final_profile_id,
      },
    })
  );
}

function cancelHandler(ws: ServerWebSocket<unknown>, body: any) {
  const { request_id, user_id } = body as {
    request_id: string;
    user_id: string;
  };
  const db = getUserDatabase(user_id);

  const processInfo = activeProcesses.get(request_id);
  if (processInfo) {
    processInfo.proc.kill();
    activeProcesses.delete(request_id);
    updateRequestStatus(
      db,
      request_id,
      RequestStatus.FAILED,
      null,
      "Request cancelled by user"
    );
    processInfo.ws.send(
      JSON.stringify({ route: "request", error: "Request cancelled by user" })
    );
  }
}

Bun.serve({
  port: 3000,
  fetch(req, server) {
    const sessionId = randomUUIDv7();
    if (
      server.upgrade(req, {
        headers: {
          ...CORS_HEADERS.headers,
          "Set-Cookie": `sessionId=${sessionId}`,
        },
        data: { sessionId },
      })
    ) {
      console.log(`upgrade ${req.url}`);
      return;
    }

    return new Response("Error", CORS_HEADERS);
  },
  websocket: {
    message(ws, message) {
      const { sessionId } = ws.data as WebSocketData;
      const { route, body } = JSON.parse(message as string) as WebSocketMessage;
      console.log("message", message, { sessionId, route });
      handlers[route as keyof typeof handlers](ws, body);
    },
    open(ws) {
      console.log("open");
    },
  },
});
