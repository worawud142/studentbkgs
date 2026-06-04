import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const dbSchema = process.env.DB_SCHEMA ?? "studentbkgs";
const connectionUrl = new URL(connectionString);
const shouldRelaxSsl = /supabase\.co|pooler\.supabase\.com/i.test(connectionString);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: [dbSchema],
  tablesFilter: [
    "users",
    "teacher_profiles",
    "academic_years",
    "classrooms",
    "students",
    "subjects",
    "teaching_assignments",
    "teaching_schedule_slots",
    "attendance",
    "qr_scan_devices",
    "qr_scan_logs",
    "qr_scan_sessions",
    "score_categories",
    "scores",
    "grade_results",
    "exported_documents",
  ],
  dbCredentials: {
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || "5432"),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, "") || "postgres",
    ssl: shouldRelaxSsl ? { rejectUnauthorized: false } : undefined,
  },
});
