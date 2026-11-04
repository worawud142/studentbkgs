DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'submission_status'
      AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE "submission_status" AS ENUM (
      'pending_review',
      'auto_scored',
      'confirmed',
      'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "assignment_answer_keys" (
  "id" serial PRIMARY KEY,
  "assignmentId" integer NOT NULL,
  "categoryId" integer NOT NULL,
  "template" varchar(80) NOT NULL DEFAULT 'network_boarding_pass_t568b',
  "title" varchar(200) NOT NULL,
  "maxScore" numeric(6,2) NOT NULL,
  "answers" jsonb NOT NULL,
  "autoScoreMinConfidence" numeric(4,2) NOT NULL DEFAULT 0.85,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdBy" integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assignment_submissions" (
  "id" serial PRIMARY KEY,
  "assignmentId" integer NOT NULL,
  "categoryId" integer NOT NULL,
  "answerKeyId" integer,
  "studentId" integer,
  "qrRawValue" text,
  "imageDataUrl" text NOT NULL,
  "status" "submission_status" NOT NULL DEFAULT 'pending_review',
  "detectedAnswers" jsonb,
  "matchedAnswers" jsonb,
  "suggestedScore" numeric(6,2),
  "confirmedScore" numeric(6,2),
  "confidence" numeric(4,2),
  "reviewNote" text,
  "aiFeedback" text,
  "reviewedBy" integer,
  "reviewedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
