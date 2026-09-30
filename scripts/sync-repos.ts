// Fetch public repos of the GitHub user into src/generated/repos.json.
// Runs before every build; on failure the committed snapshot is kept.
import { writeFileSync } from 'node:fs'

const USER = 'ExLuna-rs'
const EXCLUDE = new Set([`${USER}.github.io`.toLowerCase(), USER.toLowerCase()])
const OUT = new URL('../src/generated/repos.json', import.meta.url)

const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'exluna-portfolio' }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

try {
  const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=created`, { headers })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const repos = (await res.json()) as any[]
  const list = repos
    .filter(r => !r.fork && !r.archived && !r.private && !EXCLUDE.has(r.name.toLowerCase()) && !r.topics?.includes('no-portfolio'))
    .map(r => ({
      name: r.name as string,
      description: (r.description ?? '') as string,
      language: (r.language ?? null) as string | null,
      topics: (r.topics ?? []) as string[],
      url: r.html_url as string,
      homepage: (r.homepage || null) as string | null,
      stars: r.stargazers_count as number,
      created: r.created_at as string,
      pushed: r.pushed_at as string,
    }))
  writeFileSync(OUT, JSON.stringify(list, null, 2) + '\n')
  console.log(`sync-repos: ${list.length} public repos -> src/generated/repos.json`)
} catch (e) {
  console.warn(`sync-repos: ${(e as Error).message}, keeping existing snapshot`)
}
