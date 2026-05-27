-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assetId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "volume" REAL NOT NULL DEFAULT 0,
    "capitalBefore" REAL NOT NULL DEFAULT 0,
    "capitalAfter" REAL NOT NULL DEFAULT 0,
    "pnlRealized" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "assetType" TEXT NOT NULL DEFAULT 'Crypto',
    "transactionType" TEXT NOT NULL DEFAULT 'Spot',
    "platform" TEXT NOT NULL DEFAULT '',
    "entryPrice" REAL NOT NULL DEFAULT 0,
    "takeProfit" REAL,
    "stopLoss" REAL,
    "volume" REAL NOT NULL DEFAULT 0,
    "leverage" REAL NOT NULL DEFAULT 1,
    "capitalUsed" REAL NOT NULL DEFAULT 0,
    "currentCapital" REAL NOT NULL DEFAULT 0,
    "realizedPnl" REAL NOT NULL DEFAULT 0,
    "unrealizedPnl" REAL NOT NULL DEFAULT 0,
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("assetType", "createdAt", "entryDate", "entryPrice", "id", "name", "notes", "status", "stopLoss", "symbol", "takeProfit", "updatedAt", "userId") SELECT "assetType", "createdAt", "entryDate", "entryPrice", "id", "name", "notes", "status", "stopLoss", "symbol", "takeProfit", "updatedAt", "userId" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE TABLE "new_Wallet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main Wallet',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalBalance" REAL NOT NULL DEFAULT 0,
    "tradingBalance" REAL NOT NULL DEFAULT 0,
    "usedCapital" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("createdAt", "currency", "id", "name", "totalBalance", "tradingBalance", "updatedAt", "userId") SELECT "createdAt", "currency", "id", "name", "totalBalance", "tradingBalance", "updatedAt", "userId" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
