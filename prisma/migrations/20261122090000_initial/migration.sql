CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "blackhole_state" (
  "id" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "blackhole_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memory_vectors" (
  "memory_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL DEFAULT 'owner',
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "embedding" vector,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memory_vectors_pkey" PRIMARY KEY ("memory_id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memories" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "tags" TEXT[],
  "source" TEXT NOT NULL,
  "source_url" TEXT,
  "project_id" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "embedding" vector,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connections" (
  "id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "automatic" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "project_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "due_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_records" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "imported_count" INTEGER NOT NULL,
  "duplicate_count" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "memory_vectors_owner_id_idx" ON "memory_vectors"("owner_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "memories_owner_id_archived_updated_at_idx" ON "memories"("owner_id", "archived", "updated_at");
CREATE UNIQUE INDEX "connections_source_id_target_id_type_key" ON "connections"("source_id", "target_id", "type");
CREATE INDEX "projects_owner_id_status_idx" ON "projects"("owner_id", "status");
CREATE INDEX "tasks_owner_id_status_idx" ON "tasks"("owner_id", "status");
CREATE INDEX "import_records_owner_id_created_at_idx" ON "import_records"("owner_id", "created_at");

ALTER TABLE "memories" ADD CONSTRAINT "memories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memories" ADD CONSTRAINT "memories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "connections" ADD CONSTRAINT "connections_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connections" ADD CONSTRAINT "connections_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

