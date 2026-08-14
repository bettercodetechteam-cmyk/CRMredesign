-- AlterTable
ALTER TABLE "students" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "crm_fee_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID NOT NULL,
    "student_id" UUID,
    "sr_no" INTEGER,
    "contact_number" VARCHAR(20),
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_fee_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_gst_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID NOT NULL,
    "student_id" UUID,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_gst_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_custom_courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_id" UUID,
    "course_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_custom_courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_fee_records_centre_id_updated_at_idx" ON "crm_fee_records"("centre_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "crm_fee_records_student_id_idx" ON "crm_fee_records"("student_id");

-- CreateIndex
CREATE INDEX "crm_fee_records_contact_number_idx" ON "crm_fee_records"("contact_number");

-- CreateIndex
CREATE INDEX "crm_gst_records_centre_id_updated_at_idx" ON "crm_gst_records"("centre_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "crm_gst_records_student_id_idx" ON "crm_gst_records"("student_id");

-- CreateIndex
CREATE INDEX "crm_custom_courses_centre_id_course_name_idx" ON "crm_custom_courses"("centre_id", "course_name");

-- AddForeignKey
ALTER TABLE "crm_fee_records" ADD CONSTRAINT "crm_fee_records_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_gst_records" ADD CONSTRAINT "crm_gst_records_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
