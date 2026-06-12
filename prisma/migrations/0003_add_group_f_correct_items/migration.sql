-- Tiebreak 2 cache: how many of a participant's 14 Poule F items scored points.
ALTER TABLE "scores" ADD COLUMN "group_f_correct_items" INTEGER NOT NULL DEFAULT 0;
