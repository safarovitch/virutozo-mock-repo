// TECH-12 / TECH-13: the skills and subagents SPEC.md §11.2–11.3 list exist, are well-formed, use the
// tool limits §11.3 sets, and every skill is exercised by at least one eval fixture.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(path.join(REPO, p), 'utf8');
const front = (text: string) => Object.fromEntries([...(/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '').matchAll(/^(\w+):\s*(.*)$/gm)].map((m) => [m[1], m[2]?.trim()]));

const SKILLS = ['add-table-page', 'add-wizard', 'contract-change', 'write-e2e', 'reproduce-bug', 'long-running-task'];
// §11.3 tool limits: read-only, read specs + write tests, read-only, shell (Playwright CLI, D9-02).
const AGENTS: Record<string, string[]> = {
  'spec-reviewer': ['Read', 'Grep', 'Glob'],
  'test-writer': ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
  'code-reviewer': ['Read', 'Grep', 'Glob'],
  'bug-reproducer': ['Read', 'Grep', 'Glob', 'Bash'],
};

describe('agent harness', () => {
  it('TECH-12: every §11.2 skill exists with a name, a description and instructions', () => {
    for (const skill of SKILLS) {
      const file = `.claude/skills/${skill}/SKILL.md`;
      expect(existsSync(path.join(REPO, file)), file).toBe(true);
      const text = read(file);
      expect(front(text)).toMatchObject({ name: skill, description: expect.stringMatching(/.{40,}/) });
      expect(text.split('\n---\n')[1]?.length ?? 0).toBeGreaterThan(400);
    }
  });

  it('TECH-12: every skill is covered by at least one eval fixture', () => {
    const fixtures = readdirSync(path.join(REPO, 'tools/evals/fixtures')).map((f) => JSON.parse(read(`tools/evals/fixtures/${f}/fixture.json`)) as { skill: string; name: string });
    expect(fixtures.every((f) => SKILLS.includes(f.skill))).toBe(true);
    expect(SKILLS.filter((s) => !fixtures.some((f) => f.skill === s))).toEqual([]);
  });

  it('TECH-13: every §11.3 subagent exists with exactly the tools its role allows', () => {
    const files = readdirSync(path.join(REPO, '.claude/agents')).filter((f) => f.endsWith('.md'));
    expect(files.map((f) => f.replace('.md', '')).sort()).toEqual(Object.keys(AGENTS).sort());
    for (const [name, tools] of Object.entries(AGENTS)) {
      const meta = front(read(`.claude/agents/${name}.md`));
      expect(meta.name).toBe(name);
      expect(meta.description?.length ?? 0).toBeGreaterThan(40);
      expect((meta.tools ?? '').split(',').map((t) => t.trim()).sort()).toEqual([...tools].sort());
    }
  });

  it('TECH-13: read-only reviewers can neither write nor run commands', () => {
    for (const name of ['spec-reviewer', 'code-reviewer']) expect(front(read(`.claude/agents/${name}.md`)).tools).not.toMatch(/Write|Edit|Bash/);
    expect(read('.claude/agents/test-writer.md')).toMatch(/Don't read implementation files/);
  });
});
