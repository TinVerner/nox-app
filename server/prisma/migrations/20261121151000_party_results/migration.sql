ALTER TABLE "parties" ADD COLUMN "winning_side" VARCHAR(20);
ALTER TABLE "party_players" ADD COLUMN "booking_guest_id" INTEGER;
ALTER TABLE "party_players" ADD CONSTRAINT "party_players_booking_guest_id_fkey" FOREIGN KEY ("booking_guest_id") REFERENCES "booking_guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "party_players_booking_guest_id_idx" ON "party_players"("booking_guest_id");
