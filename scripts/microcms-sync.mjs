/**
 * microCMS 同期スクリプト
 *
 * Usage:
 *   node scripts/microcms-sync.mjs --mode=draft   --files=content/blogs/foo/index.md
 *   node scripts/microcms-sync.mjs --mode=publish --files=content/blogs/foo/index.md content/blogs/bar/index.md
 *
 * 環境変数:
 *   MICROCMS_SERVICE_DOMAIN  — サービスドメイン（.microcms.io を除く）
 *   MICROCMS_WRITE_API_KEY   — 書き込み権限付き API キー
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- CLI 引数パース -----------------------------------------------------------

const args = process.argv.slice(2);
const getArg = (name) => {
	const found = args.find((a) => a.startsWith(`--${name}=`));
	return found ? found.split("=").slice(1).join("=") : null;
};

const mode = getArg("mode");
if (mode !== "draft" && mode !== "publish") {
	console.error("--mode=draft または --mode=publish を指定してください");
	process.exit(1);
}

// --files の残りはスペース区切りで渡される（Actions では複数引数になる）
const filesArg = getArg("files");
let filePaths = filesArg ? filesArg.split(" ").filter(Boolean) : [];

// --files 未指定の場合は content/blogs/ 配下の全 index.md
if (filePaths.length === 0) {
	const blogsDir = join(ROOT, "content", "blogs");
	if (existsSync(blogsDir)) {
		const slugs = readdirSync(blogsDir).filter((d) =>
			statSync(join(blogsDir, d)).isDirectory(),
		);
		filePaths = slugs.map((s) => join(blogsDir, s, "index.md")).filter(existsSync);
	}
}

if (filePaths.length === 0) {
	console.log("同期対象のファイルがありません");
	process.exit(0);
}

// --- microCMS 設定 ------------------------------------------------------------

const SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_DOMAIN;
// MICROCMS_WRITE_API_KEY 未設定時は MICROCMS_API_KEY（フルアクセスキー）にフォールバック
const WRITE_API_KEY = process.env.MICROCMS_WRITE_API_KEY ?? process.env.MICROCMS_API_KEY;

if (!SERVICE_DOMAIN || !WRITE_API_KEY) {
	console.error(
		"MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY（または MICROCMS_WRITE_API_KEY）を環境変数に設定してください",
	);
	process.exit(1);
}

const BASE_URL = `https://${SERVICE_DOMAIN}.microcms.io/api/v1`;

const headers = {
	"X-MICROCMS-API-KEY": WRITE_API_KEY,
};

// --- ユーティリティ -----------------------------------------------------------

async function fetchMicroCMS(path, options = {}) {
	const res = await fetch(`${BASE_URL}${path}`, {
		...options,
		headers: { ...headers, ...options.headers },
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`microCMS API エラー [${res.status}] ${path}: ${text}`);
	}
	return res.json();
}

// --- リンクカード（OGP）-----------------------------------------------------

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const ogpCache = new Map();

async function fetchOGP(url) {
	if (ogpCache.has(url)) return ogpCache.get(url);

	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
			signal: AbortSignal.timeout(8000),
			redirect: "follow",
		});
		const html = await res.text();

		const getMeta = (property) => {
			const m =
				new RegExp(
					`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
					"i",
				).exec(html) ||
				new RegExp(
					`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
					"i",
				).exec(html);
			return m?.[1];
		};

		const result = {
			title:
				getMeta("og:title") ||
				/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim(),
			description: getMeta("og:description"),
			image: getMeta("og:image"),
			siteName: getMeta("og:site_name") || new URL(url).hostname,
		};
		ogpCache.set(url, result);
		return result;
	} catch (e) {
		console.warn(`  OGP取得失敗: ${url} (${e.message})`);
		const result = { siteName: new URL(url).hostname };
		ogpCache.set(url, result);
		return result;
	}
}

function buildLinkCardHtml(url, { title, description, image, siteName }) {
	const hostname = new URL(url).hostname;
	const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

	const imageHtml = image
		? `<img src="${escapeHtml(image)}" alt="" class="link-card__image" loading="lazy">`
		: "";

	return `<div class="link-card"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="link-card__anchor"><div class="link-card__body">${title ? `<div class="link-card__title">${escapeHtml(title)}</div>` : ""}${description ? `<div class="link-card__description">${escapeHtml(description)}</div>` : ""}<div class="link-card__meta"><img src="${escapeHtml(faviconUrl)}" alt="" class="link-card__favicon" width="16" height="16"><span class="link-card__site">${escapeHtml(siteName ?? hostname)}</span></div></div>${imageHtml}</a></div>`;
}

/** URL のみの段落をリンクカード HTML ノードに変換する remark プラグイン */
function remarkLinkCard() {
	return async (tree) => {
		const candidates = [];

		visit(tree, "paragraph", (node, index, parent) => {
			if (node.children.length !== 1) return;
			const child = node.children[0];

			let url = null;
			if (
				child.type === "text" &&
				/^https?:\/\/\S+$/.test(child.value.trim())
			) {
				url = child.value.trim();
			} else if (
				child.type === "link" &&
				child.children.length === 1 &&
				child.children[0].type === "text" &&
				child.children[0].value === child.url
			) {
				url = child.url;
			}

			if (url) candidates.push({ index, parent, url });
		});

		for (const { index, parent, url } of candidates) {
			console.log(`  リンクカード取得: ${url}`);
			const ogp = await fetchOGP(url);
			parent.children[index] = {
				type: "html",
				value: buildLinkCardHtml(url, ogp),
			};
		}
	};
}

/** Markdown → HTML */
async function markdownToHtml(markdown) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkLinkCard)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeStringify, { allowDangerousHtml: true })
		.process(markdown);
	return String(file);
}

/** 画像ファイルを microCMS メディア API にアップロードして URL を返す */
async function uploadImage(imagePath) {
	const filename = basename(imagePath);
	const imageBuffer = readFileSync(imagePath);

	// Content-Type を拡張子から推定
	const ext = filename.split(".").pop()?.toLowerCase();
	const mimeMap = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		avif: "image/avif",
	};
	const contentType = mimeMap[ext] ?? "application/octet-stream";

	const formData = new FormData();
	formData.append("file", new Blob([imageBuffer], { type: contentType }), filename);

	const res = await fetch(`${BASE_URL}/media`, {
		method: "POST",
		headers,
		body: formData,
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`画像アップロード失敗 [${res.status}] ${filename}: ${text}`);
	}

	const data = await res.json();
	return { url: data.url, width: data.width, height: data.height };
}

/**
 * index.md 内のローカル画像パスを microCMS URL に置換する。
 * 変更があった場合は index.md を上書きし、変更フラグを返す。
 */
async function replaceLocalImages(mdPath) {
	const content = readFileSync(mdPath, "utf-8");
	const parsed = matter(content);
	const slugDir = dirname(mdPath);
	const imagesDir = join(slugDir, "images");

	let changed = false;
	let newContent = content;

	// frontmatter の eyecatch がローカルパスの場合にアップロード
	if (
		typeof parsed.data.eyecatch === "string" &&
		!parsed.data.eyecatch.startsWith("http")
	) {
		const localPath = resolve(slugDir, parsed.data.eyecatch);
		if (existsSync(localPath)) {
			console.log(`  画像アップロード: ${basename(localPath)}`);
			const result = await uploadImage(localPath);
			// YAML の eyecatch 文字列をオブジェクト形式に置換（文字列検索で対応）
			newContent = newContent.replace(
				/^eyecatch:\s*.+$/m,
				`eyecatch:\n  url: "${result.url}"\n  width: ${result.width ?? ""}\n  height: ${result.height ?? ""}`,
			);
			changed = true;
		}
	}

	// 本文中の相対パス画像 ![alt](./images/xxx) をアップロード
	const imgRegex = /!\[([^\]]*)\]\((\.\/images\/[^)]+)\)/g;
	let match;
	while ((match = imgRegex.exec(content)) !== null) {
		const [full, alt, relPath] = match;
		const localPath = resolve(slugDir, relPath);
		if (existsSync(localPath)) {
			console.log(`  画像アップロード: ${basename(localPath)}`);
			const result = await uploadImage(localPath);
			newContent = newContent.replace(full, `![${alt}](${result.url})`);
			changed = true;
		}
	}

	if (changed) {
		writeFileSync(mdPath, newContent, "utf-8");
		console.log(`  index.md を更新しました: ${mdPath}`);
	}

	return changed;
}

/** カテゴリ名から ID を取得（なければ作成） */
async function resolveCategory(name) {
	if (!name) return undefined;
	const res = await fetchMicroCMS(
		`/categories?filters=name%5Bequals%5D${encodeURIComponent(name)}&limit=1`,
	);
	if (res.contents.length > 0) return res.contents[0].id;

	console.log(`  カテゴリを作成: ${name}`);
	const created = await fetchMicroCMS("/categories", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	return created.id;
}

/** タグ名から ID を取得（なければ作成） */
async function resolveTag(name) {
	const res = await fetchMicroCMS(
		`/tags?filters=name%5Bequals%5D${encodeURIComponent(name)}&limit=1`,
	);
	if (res.contents.length > 0) return res.contents[0].id;

	console.log(`  タグを作成: ${name}`);
	const created = await fetchMicroCMS("/tags", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	return created.id;
}

// --- メイン処理 ---------------------------------------------------------------

// 変更された index.md のパス一覧（呼び出し元 Action がコミット用に使う）
const changedFiles = [];

for (const rawPath of filePaths) {
	const mdPath = resolve(ROOT, rawPath);
	if (!existsSync(mdPath)) {
		console.warn(`スキップ（存在しない）: ${rawPath}`);
		continue;
	}

	const slugDir = dirname(mdPath);
	const slug = basename(slugDir);
	console.log(`\n処理中: ${slug} [${mode}]`);

	// 1. 画像アップロード & パス置換
	const imageChanged = await replaceLocalImages(mdPath);
	if (imageChanged) changedFiles.push(mdPath);

	// 2. frontmatter + body パース（置換後のファイルを再読み込み）
	const updatedContent = readFileSync(mdPath, "utf-8");
	const { data: fm, content: body } = matter(updatedContent);

	// 3. タグ・カテゴリ ID 解決
	const categoryId = await resolveCategory(fm.category ?? null);
	const tagIds = [];
	for (const tagName of fm.tags ?? []) {
		tagIds.push(await resolveTag(tagName));
	}

	// 4. Markdown → HTML
	const htmlContent = await markdownToHtml(body);

	// 5. microCMS コンテンツオブジェクト組み立て
	const contentBody = {
		title: fm.title,
		description: fm.description,
		content: htmlContent,
	};

	if (fm.eyecatch) {
		// eyecatch はオブジェクト（URL 置換済み）または文字列（外部 URL）
		if (typeof fm.eyecatch === "object") {
			contentBody.eyecatch = fm.eyecatch;
		} else {
			contentBody.eyecatch = fm.eyecatch;
		}
	}

	if (categoryId) contentBody.category = categoryId;
	if (tagIds.length > 0) contentBody.tags = tagIds;

	// 6. PUT で下書き作成・更新
	await fetchMicroCMS(`/blogs/${slug}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(contentBody),
	});
	console.log(`  microCMS 下書き更新完了: ${slug}`);

	// 7. publish モードの場合は公開ステータスに変更
	if (mode === "publish") {
		await fetchMicroCMS(`/blogs/${slug}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "PUBLISH" }),
		});
		console.log(`  microCMS 公開完了: ${slug}`);
	}
}

// 変更ファイルのパスを stdout に出力（Actions の $GITHUB_OUTPUT から読み取る用）
if (changedFiles.length > 0) {
	// パスをリポジトリルートからの相対パスに変換
	const relative = changedFiles.map((p) => p.replace(`${ROOT}/`, ""));
	console.log(`\n::set-output name=changed_files::${relative.join(" ")}`);
}

console.log("\n完了");
