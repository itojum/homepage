// biome-ignore-all lint/suspicious/noConsole: CLI スクリプトのため
/**
 * R2 にアップロードするブログ画像を生成する（GitHub Actions の同期ワークフローから実行）
 *
 * 使い方:
 *   pnpm images:build [出力先]   既定の出力先は .blog-images/
 *
 * src/content/blogs/<slug>/ の画像を <出力先>/<slug>/ に書き出す。
 * - PNG / JPEG / GIF / WebP / AVIF は WebP に変換する（ファイル名は toPublishedImagePath に従う）
 * - 本文画像は横幅 BODY_MAX_WIDTH にそろえる（小さい画像は拡大しない）
 * - アイキャッチは本文とはそろえず、極端に大きいものだけ EYECATCH_MAX_WIDTH に縮小する
 * - EXIF の回転を反映し、メタデータ（位置情報など）は削除する
 * - SVG はそのままコピーする
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BLOG_CONTENT_DIR, toPublishedImagePath } from "../src/libs/blogImage.ts";

const SOURCE_DIR = path.join(process.cwd(), BLOG_CONTENT_DIR);
const OUT_DIR = path.resolve(process.argv[2] ?? ".blog-images");
/** 本文の表示幅 720px の 2 倍（高解像度ディスプレイ向け） */
const BODY_MAX_WIDTH = 1440;
const EYECATCH_MAX_WIDTH = 1920;
const RASTER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

/** frontmatter の eyecatch に書かれた相対パス（./ を除く） */
const getEyecatch = (markdown) => {
	const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const value = frontmatter.match(/^eyecatch:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1];
	return value?.startsWith("./") ? decodeURI(value.slice(2)) : undefined;
};

const toWebp = (source, maxWidth) => {
	const isLossless = /\.(png|gif)$/i.test(source);
	return (
		sharp(source, { animated: true })
			.rotate()
			.resize({ width: maxWidth, withoutEnlargement: true })
			// スクリーンショットなどの PNG は文字がにじまないよう near-lossless にする
			.webp(
				isLossless ? { nearLossless: true, quality: 80, effort: 5 } : { quality: 80, effort: 5 },
			)
			.toBuffer()
	);
};

/** 1 記事分の画像を書き出し、書き出した枚数を返す */
const buildPost = async (slug) => {
	const dir = path.join(SOURCE_DIR, slug);
	const markdownPath = path.join(dir, "index.md");
	const eyecatch = existsSync(markdownPath)
		? getEyecatch(await readFile(markdownPath, "utf-8"))
		: undefined;
	const outDir = path.join(OUT_DIR, slug);
	const written = new Map();

	for (const file of await readdir(dir)) {
		const ext = path.extname(file).toLowerCase();
		if (!RASTER_EXTENSIONS.has(ext) && ext !== ".svg") continue;

		const dest = toPublishedImagePath(file);
		if (written.has(dest)) {
			throw new Error(
				`${slug}/${file} と ${slug}/${written.get(dest)} が同じ ${dest} になります。どちらかのファイル名を変えてください。`,
			);
		}
		written.set(dest, file);
		await mkdir(outDir, { recursive: true });

		const source = path.join(dir, file);
		if (ext === ".svg") {
			await copyFile(source, path.join(outDir, dest));
			continue;
		}
		const maxWidth = file === eyecatch ? EYECATCH_MAX_WIDTH : BODY_MAX_WIDTH;
		await writeFile(path.join(outDir, dest), await toWebp(source, maxWidth));
	}
	return written.size;
};

await rm(OUT_DIR, { recursive: true, force: true });
const slugs = (await readdir(SOURCE_DIR, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

let total = 0;
for (const slug of slugs) {
	total += await buildPost(slug);
}
console.log(`${total} 枚の画像を ${path.relative(process.cwd(), OUT_DIR)} に書き出しました`);
