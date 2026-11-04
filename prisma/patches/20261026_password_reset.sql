-- Additive patch for installations without a Prisma migration baseline.
CREATE TABLE `PasswordResetChallenge` (
    `emailKey` CHAR(64) NOT NULL,
    `challengeId` CHAR(36) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `codeHash` CHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL,
    `failedAttempts` INTEGER NOT NULL DEFAULT 0,
    `consumedAt` DATETIME(3) NULL,
    `deliveryStatus` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    INDEX `PasswordResetChallenge_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`emailKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
