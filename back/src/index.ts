import cors from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import {
  getUserDatabase,
  insertRequest,
  getRequest,
  updateRequestStatus,
  getOrCreateDefaultProfile,
  getProfileWithFields,
  getAllProfilesWithFields,
  RequestStatus,
} from "./sql";
import { randomUUID } from "crypto";

const JOB_TIMEOUT_MS = 60000; // 60 seconds

interface ProcessOutput {
  requiredFields: string[];
  error?: string;
}

// Handle the browser automation job
async function handleBrowserJob(userId: string, requestId: string) {
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
        stdout: "pipe",
        stderr: "pipe",
      }
    );

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

const app = new Elysia()
  .use(cors())
  .get("/", () => "Hello Elysia")

  // Submit a new request
  .post(
    "/request",
    async ({ body }) => {
      const { website_url, profile_id, user_id } = body as {
        website_url: string;
        profile_id?: string | null;
        user_id: string;
      };
      console.log("body", body);
      const request_id = randomUUID();

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
      handleBrowserJob(user_id, request_id).catch((err) => {
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

      return { request_id, profile_id: final_profile_id };
    },
    {
      body: t.Object({
        website_url: t.String(),
        profile_id: t.Optional(t.String()),
        user_id: t.String(),
      }),
    }
  )

  // Get request status
  .get("/request/:requestId", ({ params, query }) => {
    const { requestId } = params;
    const { user_id } = query;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    const db = getUserDatabase(user_id as string);
    const request = getRequest(db, requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    return request;
  })

  // Upsert profile fields
  .post("/profile/:profileId/fields", async ({ params, body }) => {
    const { profileId } = params;
    const { user_id, fields } = body as {
      user_id: string;
      fields: Array<{ key: string; value: string }>;
    };

    if (!user_id) {
      throw new Error("user_id is required");
    }

    if (!Array.isArray(fields)) {
      throw new Error("fields must be an array of {key, value} objects");
    }

    const db = getUserDatabase(user_id);

    // Verify profile exists
    const profile = getProfileWithFields(db, profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    // Upsert each field
    for (const field of fields) {
      if (!field.key || !field.value) {
        throw new Error("Each field must have both key and value");
      }

      // Try to update first, if no rows affected then insert
      const result = db.run(
        "UPDATE profile_fields SET field_value = ? WHERE profile_id = ? AND field_key = ?",
        [field.value, profileId, field.key]
      );

      if (result.changes === 0) {
        db.run(
          "INSERT INTO profile_fields (profile_id, field_key, field_value) VALUES (?, ?, ?)",
          [profileId, field.key, field.value]
        );
      }
    }

    // Return updated profile with fields
    return getProfileWithFields(db, profileId);
  })

  // Get all profiles for a user
  .get("/profiles", ({ query }) => {
    const { user_id } = query;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    const db = getUserDatabase(user_id as string);
    return getAllProfilesWithFields(db);
  })

  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
