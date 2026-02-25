-- Standardize Contact model name from plural to singular
-- This migration is a no-op: the database table name remains "contacts"
-- The change is only in the Prisma schema model name (contacts -> Contact)
-- Table mapping is handled via @@map("contacts") directive
-- No SQL changes required - this documents the schema refactoring

-- Migration: Renamed model 'contacts' to 'Contact' with @@map("contacts")
-- All routes updated to use prisma.contact (singular) instead of prisma.contacts (plural)
-- This aligns with Prisma convention: model names should be singular, table names plural

