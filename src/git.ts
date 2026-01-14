/**
 * Git utilities for openralph
 */

/**
 * Get the current HEAD commit hash
 */
export async function getHeadHash(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    stdout: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  return stdout.trim();
}

/**
 * Get the number of commits since a given hash
 */
export async function getCommitsSince(hash: string): Promise<number> {
  const proc = Bun.spawn(["git", "rev-list", "--count", `${hash}..HEAD`], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  const count = parseInt(stdout.trim(), 10);
  return isNaN(count) ? 0 : count;
}

/**
 * Get diff stats (lines added/removed) since a given hash
 */
export async function getDiffStats(
  sinceHash: string
): Promise<{ added: number; removed: number }> {
  const proc = Bun.spawn(["git", "diff", "--numstat", `${sinceHash}..HEAD`], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  let added = 0;
  let removed = 0;

  for (const line of stdout.trim().split("\n")) {
    if (!line) continue;
    const [add, rem] = line.split("\t");
    // Binary files show "-" for add/rem
    if (add !== "-") added += parseInt(add, 10) || 0;
    if (rem !== "-") removed += parseInt(rem, 10) || 0;
  }

  return { added, removed };
}
