-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'NOX',
    "bookingOpen" BOOLEAN NOT NULL DEFAULT true,
    "waitlistSize" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);
