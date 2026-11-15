-- CreateTable
CREATE TABLE "PlayerStat" (
    "id" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "games" INTEGER NOT NULL,

    CONSTRAINT "PlayerStat_pkey" PRIMARY KEY ("id")
);
