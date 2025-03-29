import { Database } from "bun:sqlite";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";

// Ensure the dbs directory exists
const DB_DIR = "./dbs";
await mkdir(DB_DIR, { recursive: true });

// Types for our data structures
export enum RequestStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  BLOCKED = "blocked",
}

export interface Profile {
  id: string;
  name: string;
  created_at?: string;
}

export interface ProfileField {
  profile_id: string;
  field_key: string;
  field_value: string;
  created_at?: string;
}

export interface Request {
  request_id: string;
  website_url: string;
  profile_id: string;
  status: RequestStatus;
  output?: string;
  error?: string;
  created_at?: string;
}

export interface ProfileWithFields extends Profile {
  fields: Record<string, string>;
}

export function getUserDatabase(userId: string): Database {
  const dbPath = `${DB_DIR}/${userId}.sqlite`;
  const db = new Database(dbPath, { create: true });

  // Create tables if they don't exist
  db.run(`
        CREATE TABLE IF NOT EXISTS requests (
            request_id TEXT PRIMARY KEY,
            website_url TEXT NOT NULL,
            profile_id TEXT NOT NULL,
            status TEXT NOT NULL,
            output TEXT,
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (profile_id) REFERENCES profile(id)
        )
    `);

  db.run(`
        CREATE TABLE IF NOT EXISTS profile (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  db.run(`
        CREATE TABLE IF NOT EXISTS profile_fields (
            profile_id TEXT NOT NULL,
            field_key TEXT NOT NULL,
            field_value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (profile_id, field_key),
            FOREIGN KEY (profile_id) REFERENCES profile(id)
        )
    `);

  return db;
}

// Profile methods
export function insertProfile(db: Database, profile: Profile): void {
  db.run("INSERT INTO profile (id, name) VALUES (?, ?)", [
    profile.id,
    profile.name,
  ]);
}

export function getProfile(db: Database, profileId: string): Profile | null {
  return db
    .query("SELECT * FROM profile WHERE id = ?")
    .get(profileId) as Profile | null;
}

// Profile fields methods
export function insertProfileField(db: Database, field: ProfileField): void {
  db.run(
    "INSERT INTO profile_fields (profile_id, field_key, field_value) VALUES (?, ?, ?)",
    [field.profile_id, field.field_key, field.field_value]
  );
}

export function getProfileWithFields(
  db: Database,
  profileId: string
): ProfileWithFields | null {
  // Get the base profile
  const profile = getProfile(db, profileId);
  if (!profile) return null;

  // Get all fields for this profile
  const fields = db
    .query(
      "SELECT field_key, field_value FROM profile_fields WHERE profile_id = ?"
    )
    .all(profileId) as ProfileField[];

  // Convert fields array to object
  const fieldsObject = fields.reduce((acc, field) => {
    acc[field.field_key] = field.field_value;
    return acc;
  }, {} as Record<string, string>);

  return {
    ...profile,
    fields: fieldsObject,
  };
}

// Request methods
export function insertRequest(db: Database, request: Request): void {
  db.run(
    "INSERT INTO requests (request_id, website_url, profile_id, status, output, error) VALUES (?, ?, ?, ?, ?, ?)",
    [
      request.request_id,
      request.website_url,
      request.profile_id,
      request.status,
      request.output || null,
      request.error || null,
    ]
  );
}

export function updateRequestStatus(
  db: Database,
  requestId: string,
  status: RequestStatus,
  output?: string | null,
  error?: string | null
): void {
  db.run(
    "UPDATE requests SET status = ?, output = ?, error = ? WHERE request_id = ?",
    [status, output || null, error || null, requestId]
  );
}

export function getRequest(db: Database, requestId: string): Request | null {
  return db
    .query("SELECT * FROM requests WHERE request_id = ?")
    .get(requestId) as Request | null;
}

export function getOrCreateDefaultProfile(db: Database): string {
  // Try to get the first profile
  const firstProfile = db
    .query("SELECT id FROM profile LIMIT 1")
    .get() as Profile | null;

  if (firstProfile) {
    return firstProfile.id;
  }

  // If no profile exists, create a new one
  const defaultProfile: Profile = {
    id: randomUUID(),
    name: "Default Profile",
  };

  insertProfile(db, defaultProfile);
  return defaultProfile.id;
}

export function getAllProfilesWithFields(
  db: Database
): Array<Profile & { fields: ProfileField[] }> {
  // Get all profiles
  const profiles = db.query("SELECT * FROM profile").all() as Profile[];

  // Get fields for each profile
  return profiles.map((profile) => ({
    ...profile,
    fields: db
      .query("SELECT * FROM profile_fields WHERE profile_id = ?")
      .all(profile.id) as ProfileField[],
  }));
}

// Example usage:
/*
const db = getUserDatabase("user123");

// Create a profile
const profile: Profile = { id: "profile1", name: "Test Profile" };
insertProfile(db, profile);

// Add fields to the profile
insertProfileField(db, { profile_id: "profile1", field_key: "email", field_value: "test@example.com" });
insertProfileField(db, { profile_id: "profile1", field_key: "phone", field_value: "+1234567890" });

// Create a request
const request: Request = { 
  request_id: "req1", 
  website_url: "https://example.com", 
  profile_id: "profile1",
  status: "pending"
};
insertRequest(db, request);

// Get profile with all fields
const profileWithFields = getProfileWithFields(db, "profile1");
console.log(profileWithFields);
// Output: {
//   id: "profile1",
//   name: "Test Profile",
//   created_at: "2024-03-24T...",
//   fields: {
//     email: "test@example.com",
//     phone: "+1234567890"
//   }
// }
*/
