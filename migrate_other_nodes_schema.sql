-- Migration script to add Info and Image columns to other_nodes table
-- This script can be run on existing databases to add the new columns

-- Add the new columns to the other_nodes table
ALTER TABLE other_nodes ADD COLUMN info TEXT;
ALTER TABLE other_nodes ADD COLUMN image TEXT;

-- The columns are nullable by default, so existing data will have NULL values
-- This is the expected behaviour as these are optional fields

