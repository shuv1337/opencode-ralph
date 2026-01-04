import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { acquireLock, releaseLock, LOCK_FILE } from "../../src/lock";
import { unlink } from "fs/promises";

async function cleanupLockFile() {
  try {
    await unlink(LOCK_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

describe("lock file", () => {
  beforeEach(async () => {
    // Ensure no lock file exists before each test
    await cleanupLockFile();
  });

  afterEach(async () => {
    // Clean up lock file after each test
    await cleanupLockFile();
  });

  describe("acquireLock()", () => {
    it("should return true when no lock exists", async () => {
      // Ensure no lock file exists
      const file = Bun.file(LOCK_FILE);
      const existsBefore = await file.exists();
      expect(existsBefore).toBe(false);

      // Acquire the lock
      const result = await acquireLock();

      // Should succeed
      expect(result).toBe(true);

      // Should create lock file with current PID
      // Re-create Bun.file reference to avoid caching issues
      const fileAfter = Bun.file(LOCK_FILE);
      const existsAfter = await fileAfter.exists();
      expect(existsAfter).toBe(true);

      const content = await fileAfter.text();
      expect(content).toBe(String(process.pid));
    });

    it("should return false when lock held by current process", async () => {
      // Acquire the lock first
      const firstResult = await acquireLock();
      expect(firstResult).toBe(true);

      // Verify lock file contains current PID
      const file = Bun.file(LOCK_FILE);
      const content = await file.text();
      expect(content).toBe(String(process.pid));

      // Try to acquire again - should fail since current process is still running
      const secondResult = await acquireLock();
      expect(secondResult).toBe(false);

      // Lock file should still contain the original PID
      const fileAfter = Bun.file(LOCK_FILE);
      const contentAfter = await fileAfter.text();
      expect(contentAfter).toBe(String(process.pid));
    });

    it("should return true with stale lock (dead PID)", async () => {
      // Write a lock file with a non-existent PID
      // Use a very high PID that's unlikely to exist (max PID on most systems)
      const stalePid = 999999;
      await Bun.write(LOCK_FILE, String(stalePid));

      // Verify the lock file exists with the stale PID
      const fileBefore = Bun.file(LOCK_FILE);
      const contentBefore = await fileBefore.text();
      expect(contentBefore).toBe(String(stalePid));

      // Acquire the lock - should succeed since the PID is stale
      const result = await acquireLock();
      expect(result).toBe(true);

      // Lock file should now contain our PID
      const fileAfter = Bun.file(LOCK_FILE);
      const contentAfter = await fileAfter.text();
      expect(contentAfter).toBe(String(process.pid));
    });
  });

  describe("releaseLock()", () => {
    it("should remove lock file when it exists", async () => {
      // Acquire the lock first
      const acquired = await acquireLock();
      expect(acquired).toBe(true);

      // Verify lock file exists
      const fileBefore = Bun.file(LOCK_FILE);
      const existsBefore = await fileBefore.exists();
      expect(existsBefore).toBe(true);

      // Release the lock
      await releaseLock();

      // Verify lock file is deleted
      const fileAfter = Bun.file(LOCK_FILE);
      const existsAfter = await fileAfter.exists();
      expect(existsAfter).toBe(false);
    });

    it("should not throw when no lock exists", async () => {
      // Ensure no lock file exists
      const file = Bun.file(LOCK_FILE);
      const existsBefore = await file.exists();
      expect(existsBefore).toBe(false);

      // Release lock should not throw
      await expect(releaseLock()).resolves.toBeUndefined();
    });
  });
});
