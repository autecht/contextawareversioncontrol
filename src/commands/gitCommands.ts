import CommandExecutor from "./CommandExecutor";

async function getLog(hash?:string): Promise<string> {
    return await CommandExecutor.executeCommand(
    hash === undefined
      ? 'git log --pretty="%h "%s'
      : `git log -n 1 --pretty="%h "%s ${hash}`
    );
}

async function getBlame(filePath: string): Promise<string> {
  return await CommandExecutor.executeCommand(`git blame ${filePath}`);
}

async function getRepositoryPath(): Promise<string> {
  return await CommandExecutor.executeCommand("git rev-parse --show-toplevel");
}

async function getCommitDate(hash: string): Promise<string> {
  return await CommandExecutor.executeCommand(`git log -1 --format=%ci ${hash}`);
}

async function getFirstCommitDate(): Promise<string> {
  return await CommandExecutor.executeCommand(`git log --max-parents=0 --format=%ci`);
}

async function getCommitMessage(hash: string) {
  return await CommandExecutor.executeCommand(
      `git log --format=%B -n 1 ${hash}`
    );
}

async function getFilesChangedSinceCommit(hash: string) {
  return await CommandExecutor.executeCommand(
        `git diff --name-only ${hash}`
      );
}
async function getFilesChangedByCommit(hash: string) {
  return await CommandExecutor.executeCommand(
    `git diff-tree --no-commit-id --name-only -r ${hash}`
  );
}
async function getDiff(hash: string) {
  return await CommandExecutor.executeCommand(
      `git diff --no-color --unified=0 ${hash}`
    );
}

async function getTrackedFiles() {
  return await CommandExecutor.executeCommand(
    `git ls-files`
  );
}

async function stashChanges() {
  await CommandExecutor.executeCommand("git stash");
}

async function checkoutCommit(hash: string) {
  await CommandExecutor.executeCommand(`git checkout ${hash}`);
}

async function getDate(hash: string): Promise<string> {
  return await CommandExecutor.executeCommand(`git show -s --format=%ci ${hash}`);
}

export { getLog, getBlame, getRepositoryPath, getCommitDate, getFirstCommitDate, getCommitMessage, getFilesChangedSinceCommit, getDiff, getTrackedFiles, stashChanges, checkoutCommit, getFilesChangedByCommit, getDate };