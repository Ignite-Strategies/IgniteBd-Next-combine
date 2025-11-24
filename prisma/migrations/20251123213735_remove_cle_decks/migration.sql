-- Drop cle_decks table
-- This migration removes the CleDeck model from the database

-- Drop the table (CASCADE will automatically drop any foreign key constraints)
DROP TABLE IF EXISTS "cle_decks" CASCADE;

