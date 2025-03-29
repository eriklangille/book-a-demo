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

const JOB_TIMEOUT_MS = 60000; // 60 seconds

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
      ["python3", "../browser/browser.py", JSON.stringify(profile)],
      {
        env: { ...process.env },
        stdout: "pipe", // JSON output
        stderr: "pipe", // Log output
      }
    );

    let buffer = "";
    // Iterate over the stdout stream
    for await (const chunk of proc.stdout) {
      // Convert chunk (which might be a Buffer) to string
      buffer += chunk.toString();
      console.log("buffer", buffer);

      // Split the buffered data by newlines
      let lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      // Send each complete line
      for (const line of lines) {
        if (line.trim()) {
          ws.send(JSON.stringify({ route: "stdout", body: line }));
        }
      }
    }

    const result = (await Promise.race([
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]),
      new Promise((_, reject) => {
        setTimeout(() => {
          proc.kill();
          reject(new Error("Failed to get required fields: timeout"));
        }, JOB_TIMEOUT_MS);
      }),
    ])) as [string, string, number];

    const [output, error, exitCode] = result;

    if (exitCode !== 0) {
      throw new Error(`Failed to get required fields: ${error}`);
    }

    let requiredFields: string[];
    try {
      const parsedOutput = JSON.parse(output);
      if (!parsedOutput.requiredFields) {
        throw new Error("requiredFields not found in output");
      }
      requiredFields = parsedOutput.requiredFields;
    } catch (err) {
      throw new Error(`Invalid required fields JSON: ${output}`);
    }

    // Check if required fields are present
    const missingFields = requiredFields.filter(
      (field) => !profile.fields[field]
    );

    if (missingFields.length > 0) {
      updateRequestStatus(
        db,
        requestId,
        RequestStatus.BLOCKED,
        null,
        `Missing required profile fields: ${missingFields.join(", ")}`
      );
      return;
    }
  } catch (err) {
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
  const { website_url, profile_id, user_id } = body as {
    website_url: string;
    profile_id?: string | null;
    user_id: string;
  };
  const request_id = randomUUIDv7();
  const db = getUserDatabase(user_id);

  // Get or create a default profile if none specified
  const final_profile_id = profile_id || getOrCreateDefaultProfile(db);

  console.log("final_profile_id", final_profile_id);

  const request = {
    request_id,
    website_url,
    profile_id: final_profile_id,
    status: RequestStatus.PENDING,
  };

  insertRequest(db, request);

  // Start async job without waiting for it
  handleBrowserJob(user_id, request_id, ws).catch((err) => {
    console.error("Failed to handle browser job:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    updateRequestStatus(
      db,
      request_id,
      RequestStatus.FAILED,
      null,
      errorMessage
    );
  });

  ws.send(JSON.stringify({ route: "request", body: { request_id } }));
}

Bun.serve({
  port: 3000,
  fetch(req, server) {
    const sessionId = randomUUIDv7();
    const cookies = req.cookies;
    cookies.set("sessionId", sessionId);
    if (
      server.upgrade(req, {
        headers: { ...CORS_HEADERS.headers },
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
