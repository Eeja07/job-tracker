-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "cv_name" VARCHAR(255),
ADD COLUMN     "cv_text" TEXT,
ADD COLUMN     "cv_url" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "notes_content" TEXT,
ADD COLUMN     "notes_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "portfolio_name" VARCHAR(255),
ADD COLUMN     "portfolio_url" TEXT,
ADD COLUMN     "requirements" TEXT;

-- CreateTable
CREATE TABLE "gmail_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_type" VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    "scope" TEXT NOT NULL,
    "expiry_date" TIMESTAMPTZ(6),
    "gmail_email" VARCHAR(255) NOT NULL,
    "history_id" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gmail_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "gmail_message_id" VARCHAR(255) NOT NULL,
    "gmail_thread_id" VARCHAR(255) NOT NULL,
    "subject" TEXT NOT NULL,
    "from_email" VARCHAR(500) NOT NULL,
    "from_name" VARCHAR(255),
    "to_email" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "body_text" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_job_related" BOOLEAN NOT NULL DEFAULT false,
    "detected_type" VARCHAR(50),
    "application_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_tokens_user_id_key" ON "gmail_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_messages_user_id_idx" ON "email_messages"("user_id");

-- CreateIndex
CREATE INDEX "email_messages_user_id_is_job_related_idx" ON "email_messages"("user_id", "is_job_related");

-- CreateIndex
CREATE INDEX "email_messages_received_at_idx" ON "email_messages"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_user_id_gmail_message_id_key" ON "email_messages"("user_id", "gmail_message_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "gmail_tokens" ADD CONSTRAINT "gmail_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
