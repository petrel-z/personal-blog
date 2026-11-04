-- CreateTable
CREATE TABLE `ImageUploadTask` (
    `id` CHAR(36) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fileHash` CHAR(64) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `fileType` VARCHAR(32) NOT NULL,
    `partSize` INTEGER NOT NULL,
    `totalParts` INTEGER NOT NULL,
    `partHashes` JSON NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `objectKey` VARCHAR(191) NOT NULL,
    `remoteUploadId` VARCHAR(191) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'UPLOADING',
    `url` TEXT NULL,
    `completeToken` CHAR(36) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ImageUploadTask_userId_fileHash_provider_idx`(`userId`, `fileHash`, `provider`),
    INDEX `ImageUploadTask_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImageUploadPart` (
    `uploadId` CHAR(36) NOT NULL,
    `partNumber` INTEGER NOT NULL,
    `size` INTEGER NOT NULL,
    `hash` CHAR(64) NOT NULL,
    `etag` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`uploadId`, `partNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ImageUploadPart` ADD CONSTRAINT `ImageUploadPart_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `ImageUploadTask`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
