// biome-ignore-all lint/suspicious/noConsole: CLI スクリプトのため
/**
 * ブログ記事の雛形を作成する（GitHub Actions の new-blog.yml からも実行される）
 *
 * 使い方:
 *   pnpm blog:new --title "記事タイトル" [--slug my-post] [--category 技術] [--tags "Astro,Cloudflare"]
 *
 * - src/content/blogs/<slug>/index.md を作成する（下書きは PR ブランチ上で管理するため draft フィールドは持たない）
 * - slug を省略すると既存記事と同じ形式のランダムな短い ID（英小文字 + 数字）を生成する
 * - publishedAt は日本時間の今日の日付になる
 * - GitHub Actions 上では作成した slug とパスを $GITHUB_OUTPUT に書き出す
 */
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { BLOG_CONTENT_DIR } from "../src/libs/blogImage.ts";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 12;

const { values } = parseArgs({
	options: {
		title: { type: "string" },
		slug: { type: "string" },
		category: { type: "string" },
		tags: { type: "string" },
	},
});

const fail = (message) => {
	console.error(`error: ${message}`);
	process.exit(1);
};

/** 既存記事（microCMS の ID）と同じような英小文字 + 数字の短い ID */
const generateId = () =>
	Array.from({ length: ID_LENGTH }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join("");

/** 日本時間の今日（YYYY-MM-DD） */
const todayInJst = () =>
	new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

/** YAML のダブルクォート文字列（JSON の文字列表現は YAML としても有効） */
const yamlString = (value) => JSON.stringify(value);

const title = values.title?.trim();
if (!title) fail("--title を指定してください");

const slug = values.slug?.trim() || generateId();
if (!SLUG_PATTERN.test(slug)) {
	fail(`slug "${slug}" は英小文字・数字・-・_ のみ使用できます（先頭は英小文字か数字）`);
}

const blogDir = path.join(process.cwd(), BLOG_CONTENT_DIR);
const postDir = path.join(blogDir, slug);
if (existsSync(postDir) || existsSync(path.join(blogDir, `${slug}.md`))) {
	fail(`slug "${slug}" の記事は既に存在します`);
}

const category = values.category?.trim();
const tags = (values.tags ?? "")
	.split(/[,、]/)
	.map((tag) => tag.trim())
	.filter(Boolean);

const content = [
	"---",
	`title: ${yamlString(title)}`,
	'description: ""',
	`publishedAt: ${todayInJst()}`,
	"# eyecatch: ./eyecatch.png",
	category ? `category: ${yamlString(category)}` : "# category: 技術",
	`tags: [${tags.map(yamlString).join(", ")}]`,
	"---",
	"",
	"ここに本文を書きます。",
	"",
].join("\n");

await mkdir(postDir, { recursive: true });
const filePath = path.join(postDir, "index.md");
await writeFile(filePath, content);

const relativePath = path.relative(process.cwd(), filePath);
console.log(`created ${relativePath}`);

if (process.env.GITHUB_OUTPUT) {
	await appendFile(process.env.GITHUB_OUTPUT, `slug=${slug}\npath=${relativePath}\n`);
}
