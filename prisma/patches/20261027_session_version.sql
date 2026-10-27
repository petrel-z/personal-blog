-- Apply before deploying session-version-aware authentication code.
-- Existing JWTs without a version will require signing in again.
ALTER TABLE `User` ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;
