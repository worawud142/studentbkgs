ALTER TABLE "subjects"
ADD COLUMN IF NOT EXISTS "subjectType" varchar(20) NOT NULL DEFAULT 'basic';
