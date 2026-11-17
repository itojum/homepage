// biome-ignore-all lint/suspicious/noConsole: CLI スクリプトのため
/**
 * microCMS から記事・アクティビティを取り出し、リポジトリ管理の形式に変換する一度きりの移行スクリプト
 *
 * 使い方:
 *   MICROCMS_SERVICE_DOMAIN=xxx MICROCMS_API_KEY=yyy pnpm migrate:microcms [--force]
 *
 * 出力:
 *   - src/content/blogs/<id>/index.md   記事本文（HTML を Markdown に変換）
 *   - src/content/blogs/<id>/*          microCMS にアップロードされていた画像
 *   - src/content/activities.yaml       About ページのアクティビティ
 *
 * --force を付けると既存の記事フォルダ / activities.yaml を上書きする。
 * 公開中のコンテンツのみが対象（下書きは API から取得できないため手動で移行する）。
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_DOMAIN;
const API_KEY = process.env.MICROCMS_API_KEY;
const FORCE = process.argv.includes("--force");

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "src/content/blogs");
const ACTIVITIES_FILE = path.join(ROOT, "src/content/activities.yaml");
const ACTIVITY_TYPES = ["project", "event", "work", "examination", "other"];
/** ダウンロードしてリポジトリに取り込む画像のホスト */
const MICROCMS_ASSET_HOSTS = ["images.microcms-assets.io", "files.microcms-assets.io"];

if (!SERVICE_DOMAIN || !API_KEY) {
	console.error("MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY を環境変数で指定してください。");
	process.exit(1);
}

/** microCMS のリスト API から全件取得 */
const fetchAll = async (endpoint, params = {}) => {
	const limit = 100;
	const contents = [];
	for (let offset = 0; ; offset += limit) {
		const url = new URL(`https://${SERVICE_DOMAIN}.microcms.io/api/v1/${endpoint}`);
		for (const [key, value] of Object.entries({ ...params, limit, offset })) {
			url.searchParams.set(key, String(value));
		}
		const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": API_KEY } });
		if (!res.ok) {
			throw new Error(`${endpoint} の取得に失敗しました: ${res.status} ${await res.text()}`);
		}
		const json = await res.json();
		contents.push(...json.contents);
		if (contents.length >= json.totalCount) return contents;
	}
};

/** YAML のスカラー値（JSON 文字列は YAML のダブルクォート文字列としても有効） */
const yamlString = (value) => JSON.stringify(value);

const isMicroCMSAsset = (src) => {
	try {
		return MICROCMS_ASSET_HOSTS.includes(new URL(src).hostname);
	} catch {
		return false;
	}
};

/** URL から保存用のファイル名を作る（クエリは除去、重複時は連番） */
const createFileNamer = () => {
	const used = new Set();
	return (src, preferredBaseName) => {
		const { pathname } = new URL(src);
		const original = decodeURIComponent(path.posix.basename(pathname));
		const ext = path.posix.extname(original).toLowerCase() || ".png";
		const base = (preferredBaseName ?? path.posix.basename(original, path.posix.extname(original)))
			.replace(/[\\/:*?"<>|#%\s]+/g, "-")
			.replace(/^-+|-+$/g, "");
		let name = `${base || "image"}${ext}`;
		for (let i = 2; used.has(name); i++) {
			name = `${base || "image"}-${i}${ext}`;
		}
		used.add(name);
		return name;
	};
};

const download = async (src, dest) => {
	const res = await fetch(src);
	if (!res.ok) throw new Error(`画像のダウンロードに失敗しました: ${src} (${res.status})`);
	await writeFile(dest, Buffer.from(await res.arrayBuffer()));
};

const TWEET_STATUS = /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/;

const hasClass = (node, className) =>
	(node.getAttribute("class") ?? "").split(/\s+/).includes(className);

/** iframe の src を、remarkEmbeds が展開できる URL（または画像）に変換する */
const iframeToMarkdown = (src) => {
	const url = new URL(src, "https://example.com");
	if (url.hostname === "cdn.iframe.ly") {
		const target = url.searchParams.get("url") ?? src;
		return /\.(gif|png|jpe?g|webp)$/i.test(target) ? `![](${target})` : target;
	}
	if (url.hostname === "giphy.com" && url.pathname.startsWith("/embed/")) {
		return `![](https://media.giphy.com/media/${url.pathname.split("/")[2]}/giphy.gif)`;
	}
	if (url.hostname.endsWith("youtube.com") && url.pathname.startsWith("/embed/")) {
		return `https://www.youtube.com/watch?v=${url.pathname.split("/")[2]}`;
	}
	return src;
};

/** 文字列中の最長のバッククォート連続より長いフェンスを返す */
const fenceFor = (code) => {
	const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((s) => s.length));
	return "`".repeat(Math.max(3, longest + 1));
};

const createTurndown = (imageMap) => {
	const turndown = new TurndownService({
		headingStyle: "atx",
		codeBlockStyle: "fenced",
		bulletListMarker: "-",
		emDelimiter: "*",
	});
	turndown.use(gfm);
	// 埋め込みは URL だけの行に変換し、ビルド時に remarkEmbeds で展開する
	turndown.remove("script");
	turndown.addRule("tweet", {
		filter: (node) => node.nodeName === "BLOCKQUOTE" && hasClass(node, "twitter-tweet"),
		replacement: (content, node) => {
			const hrefs = Array.from(node.getElementsByTagName("a"), (a) => a.getAttribute("href") ?? "");
			const status = hrefs.map((href) => href.match(TWEET_STATUS)).findLast(Boolean);
			return status ? `\n\nhttps://x.com/${status[1]}/status/${status[2]}\n\n` : content;
		},
	});
	turndown.addRule("iframelyCard", {
		filter: (node) => node.nodeName === "DIV" && hasClass(node, "iframely-embed"),
		replacement: (content, node) => {
			const href = node.getElementsByTagName("a")[0]?.getAttribute("href");
			return href ? `\n\n${href}\n\n` : content;
		},
	});
	turndown.addRule("iframe", {
		filter: "iframe",
		replacement: (_content, node) => {
			const src = node.getAttribute("src");
			return src ? `\n\n${iframeToMarkdown(src)}\n\n` : "";
		},
	});

	// microCMS のコードブロック: <div data-filename="..."><pre><code class="language-xx">...</code></pre></div>
	turndown.addRule("microcmsCodeBlock", {
		filter: (node) => node.nodeName === "PRE",
		replacement: (_content, node) => {
			const code = node.querySelector("code") ?? node;
			const text = code.textContent.replace(/\n$/, "");
			const lang = (code.getAttribute?.("class") ?? "").match(/language-([\w+#-]+)/)?.[1] ?? "";
			const filename = node.parentNode?.getAttribute?.("data-filename");
			const meta = filename ? ` title=${JSON.stringify(filename)}` : "";
			const fence = fenceFor(text);
			return `\n\n${fence}${lang}${meta}\n${text}\n${fence}\n\n`;
		},
	});

	// turndown 既定の "-   item" ではなく "- item" で出力する
	turndown.addRule("compactListItem", {
		filter: "li",
		replacement: (content, node, options) => {
			const parent = node.parentNode;
			const index = Array.prototype.indexOf.call(parent.children, node);
			const marker =
				parent.nodeName === "OL"
					? `${(Number(parent.getAttribute("start")) || 1) + index}. `
					: `${options.bulletListMarker} `;
			const body = content
				.replace(/^\n+/, "")
				.replace(/\n+$/, "\n")
				.replace(/\n/gm, `\n${" ".repeat(marker.length)}`);
			return `${marker}${body}${node.nextSibling && !/\n$/.test(body) ? "\n" : ""}`;
		},
	});

	turndown.addRule("localImage", {
		filter: "img",
		replacement: (_content, node) => {
			const src = node.getAttribute("src") ?? "";
			const alt = (node.getAttribute("alt") ?? "").replace(/[[\]]/g, "\\$&");
			const local = imageMap.get(src);
			// ファイル名の空白は createFileNamer で除去済みなのでエンコード不要（日本語もそのまま読める）
			const url = local ? `./${local}` : src;
			return `![${alt}](${url})`;
		},
	});

	return turndown;
};

/** アイキャッチを記事フォルダに保存し、frontmatter に書く値を返す */
const saveEyecatch = async (blog, dir, nameFor) => {
	const url = blog.eyecatch?.url;
	if (!url) return undefined;
	if (!isMicroCMSAsset(url)) return url;
	const name = nameFor(url, "eyecatch");
	await download(url, path.join(dir, name));
	return `./${name}`;
};

/** 本文中の microCMS 画像を記事フォルダに保存し、元 URL → ファイル名の Map を返す */
const saveContentImages = async (html, dir, nameFor) => {
	const imageMap = new Map();
	for (const [, src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
		const decodedSrc = src.replaceAll("&amp;", "&");
		if (imageMap.has(decodedSrc) || !isMicroCMSAsset(decodedSrc)) continue;
		const name = nameFor(decodedSrc);
		await download(decodedSrc, path.join(dir, name));
		imageMap.set(decodedSrc, name);
	}
	return imageMap;
};

const buildFrontmatter = (blog, eyecatch) => {
	const publishedAt = blog.publishedAt ?? blog.createdAt;
	const updatedAt = blog.revisedAt && blog.revisedAt !== publishedAt ? blog.revisedAt : undefined;
	const tags = (blog.tags ?? []).map((tag) => yamlString(tag.name)).join(", ");
	return [
		"---",
		`title: ${yamlString(blog.title)}`,
		`description: ${yamlString(blog.description ?? "")}`,
		`publishedAt: ${publishedAt}`,
		updatedAt && `updatedAt: ${updatedAt}`,
		eyecatch && `eyecatch: ${yamlString(eyecatch)}`,
		blog.category?.name && `category: ${yamlString(blog.category.name)}`,
		`tags: [${tags}]`,
		"---",
	]
		.filter(Boolean)
		.join("\n");
};

const migrateBlog = async (blog) => {
	const dir = path.join(BLOG_DIR, blog.id);
	// index.md は最後に書き込むので、その有無で移行済みかを判定する（途中で失敗したフォルダは再実行時にやり直す）
	if (existsSync(path.join(dir, "index.md")) && !FORCE) {
		console.log(`skip  ${blog.id}（既に存在します。上書きするには --force）`);
		return;
	}
	await mkdir(dir, { recursive: true });

	const nameFor = createFileNamer();
	const html = blog.content ?? "";
	const eyecatch = await saveEyecatch(blog, dir, nameFor);
	const imageMap = await saveContentImages(html, dir, nameFor);
	const markdown = createTurndown(imageMap).turndown(html);

	await writeFile(
		path.join(dir, "index.md"),
		`${buildFrontmatter(blog, eyecatch)}\n\n${markdown}\n`,
	);
	console.log(`done  ${blog.id}（本文画像 ${imageMap.size} 枚）`);
};

const migrateActivities = async () => {
	if (existsSync(ACTIVITIES_FILE) && !FORCE) {
		const current = await readFile(ACTIVITIES_FILE, "utf-8");
		if (current.trim().split("\n").at(-1) !== "[]") {
			console.log("skip  activities.yaml（既に内容があります。上書きするには --force）");
			return;
		}
	}

	const activities = await fetchAll("activities", { orders: "-date" });
	const lines = activities.map((item) => {
		let type = item.type?.[0] ?? "other";
		if (!ACTIVITY_TYPES.includes(type)) {
			console.warn(`warn  activity ${item.id}: 未知の type "${type}" を other にしました`);
			type = "other";
		}
		return [
			`- id: ${yamlString(item.id)}`,
			`  title: ${yamlString(item.title)}`,
			`  date: ${item.date}`,
			`  type: ${type}`,
			item.link && `  link: ${yamlString(item.link)}`,
			item.link_text && `  linkText: ${yamlString(item.link_text)}`,
		]
			.filter(Boolean)
			.join("\n");
	});

	const header = [
		"# About ページの Activities（タイムライン）",
		"#",
		"# - id: 一意な ID（任意の文字列）",
		"#   title: タイトル",
		"#   date: 2025-04-01",
		"#   type: project | event | work | examination | other",
		"#   link: https://example.com   # 任意",
		"#   linkText: 詳細               # 任意（link とセットで表示）",
	].join("\n");
	const body = lines.length > 0 ? lines.join("\n") : "[]";
	await writeFile(ACTIVITIES_FILE, `${header}\n${body}\n`);
	console.log(`done  activities.yaml（${activities.length} 件）`);
};

const blogs = await fetchAll("blogs", { depth: 2 });
console.log(`記事 ${blogs.length} 件を移行します`);
for (const blog of blogs) {
	await migrateBlog(blog);
}
await migrateActivities();
console.log("\n完了しました。pnpm dev で表示を確認してください。");
