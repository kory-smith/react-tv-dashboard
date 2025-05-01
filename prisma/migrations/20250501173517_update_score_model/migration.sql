/*
  Warnings:

  - You are about to drop the column `day` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `month` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `week` on the `Score` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Score" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 75,
    CONSTRAINT "Score_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Score" ("employeeId", "id") SELECT "employeeId", "id" FROM "Score";
DROP TABLE "Score";
ALTER TABLE "new_Score" RENAME TO "Score";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
