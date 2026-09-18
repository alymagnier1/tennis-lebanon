// Metro configuration for the pnpm workspace.
//
// Exists because Expo's default watches the whole workspace root, and this
// repository has more than source beside the app. `.claude/worktrees` holds
// throwaway git worktrees created by Claude Code, and one of those carries a
// complete second `node_modules` -- 78,000 files and 1.1 GB. Two symptoms, both
// seen here:
//
//   * `expo start` hangs between `metro:config` and `metro:instantiate` -- the
//     file crawl never finishes, so the dev server never binds port 8081 and
//     the app sits on its splash screen until it is killed;
//   * when a crawl does complete, two copies of every package confuse the haste
//     map into `Cannot read properties of undefined (reading 'get')` inside
//     `metro/src/node-haste/DependencyGraph.js`, which reads as a Metro bug and
//     is really duplicate modules.
//
// Scoped rather than deleted. A worktree can hold uncommitted work, so removing
// one to make the bundler start is the wrong trade -- and this has to keep
// working for whoever creates the next one. The same narrowing also keeps
// design folders, audits and build output out of the crawl.

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Only what the app can actually import: the workspace's hoisted modules and
// the shared packages. Everything else at the root is not Metro's business.
config.watchFolders = [
  path.join(workspaceRoot, "node_modules"),
  path.join(workspaceRoot, "packages"),
];

// Defence in depth: `watchFolders` decides what is crawled, this decides what
// may resolve. A nested worktree reachable some other way still must not
// provide a second copy of a module.
const blockedPaths = /[\\/]\.claude[\\/]worktrees[\\/].*/;

config.resolver.blockList = config.resolver.blockList
  ? [config.resolver.blockList, blockedPaths].flat()
  : blockedPaths;

module.exports = config;
