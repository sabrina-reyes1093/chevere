import { config } from "@/lib/config";
import { renderPostPage } from "@/lib/post-template";
import { upsertCard, removeCard } from "@/lib/publish-post";
import type { PostInput } from "@/lib/post-schema";

/** Commits post files straight to the site repo. Used when the admin app runs
 *  somewhere with a read-only filesystem, which is every serverless host. Both
 *  files land in a single commit so the blog never links to a page that is not
 *  there yet. */

const API = "https://api.github.com";

async function gh(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("GitHub rejected the access token. Check that GITHUB_TOKEN is valid and can write to the repository.");
    }
    if (response.status === 404) {
      throw new Error(`GitHub could not find ${config.githubRepo}. Check GITHUB_REPO is in owner/name form and the token can see it.`);
    }
    throw new Error(`GitHub request failed (${response.status}). ${detail.slice(0, 200)}`);
  }
  return response.json();
}

const repo = () => `/repos/${config.githubRepo}`;
const encode = (text: string) => Buffer.from(text, "utf8").toString("base64");

export async function readFileFromRepo(path: string) {
  const response = await fetch(`${API}${repo()}/contents/${path}?ref=${config.githubBranch}`, {
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${path} from GitHub (${response.status}).`);
  const body = await response.json();
  return Buffer.from(body.content, "base64").toString("utf8");
}

/** Writes several files in one commit via the git data API. */
export async function commitFiles(files: { path: string; content: string | null }[], message: string) {
  const ref = await gh(`${repo()}/git/ref/heads/${config.githubBranch}`);
  const headSha = ref.object.sha;
  const headCommit = await gh(`${repo()}/git/commits/${headSha}`);

  const tree = [];
  for (const file of files) {
    if (file.content === null) {
      // A null sha removes the path in the new tree.
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await gh(`${repo()}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: encode(file.content), encoding: "base64" }),
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh(`${repo()}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });
  const commit = await gh(`${repo()}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });
  await gh(`${repo()}/git/refs/heads/${config.githubBranch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit as { sha: string; html_url: string };
}

export async function publishPostToGitHub(post: PostInput) {
  const blogHtml = await readFileFromRepo("blog.html");
  if (blogHtml === null) throw new Error("blog.html was not found in the repository.");

  const { html, action } = upsertCard(blogHtml, post);
  const commit = await commitFiles(
    [
      { path: `posts/${post.slug}.html`, content: renderPostPage(post) },
      { path: "blog.html", content: html },
    ],
    `Publish blog post: ${post.title}`
  );

  return {
    postFile: `posts/${post.slug}.html`,
    cardAction: action,
    commitUrl: commit.html_url,
    commitSha: commit.sha.slice(0, 7),
  };
}

export async function unpublishPostFromGitHub(slug: string, title = slug) {
  const blogHtml = await readFileFromRepo("blog.html");
  if (blogHtml === null) throw new Error("blog.html was not found in the repository.");

  const commit = await commitFiles(
    [
      { path: `posts/${slug}.html`, content: null },
      { path: "blog.html", content: removeCard(blogHtml, slug) },
    ],
    `Unpublish blog post: ${title}`
  );
  return { commitUrl: commit.html_url, commitSha: commit.sha.slice(0, 7) };
}
