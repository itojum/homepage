// biome-ignore-all lint/suspicious/noConsole: CLI スクリプトのため
/**
 * ブログ画像を WebP に変換し、本文画像の横幅をそろえる
 *
 * 使い方:
 *   pnpm images:optimize   変換して index.md の参照も書き換える（元画像は削除）
 *   pnpm images:check      未変換の画像があれば一覧を出して終了コード 1（CI 用）
 *
 * - 本文画像: 横幅を BODY_MAX_WIDTH に縮小（小さい画像は拡大しない）
 * - アイキャッチ: 本文とはそろえず、極端に大きいものだけ EYECATCH_MAX_WIDTH に縮小
 * - EXIF の回転を反映し、メタデータ（位置情報など）は削除する
 */
import { existsSync } from "node:fs";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BLOG_DIR = path.join(process.cwd(), "src/content/blogs");
/** 本文の表示幅 720px の 2 倍（高解像度ディスプレイ向け） */
const BODY_MAX_WIDTH = 1440;
const EYECATCH_MAX_WIDTH = 1920;
const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);
const CHECK = process.argv.includes("--check");

/** frontmatter の eyecatch に書かれた相対パス（./ を除く） */
const getEyecatch = (markdown) => {
	const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const value = frontmatter.match(/^eyecatch:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1];
	return value?.startsWith("./") ? decodeURI(value.slice(2)) : undefined;
};

/** 同じフォルダ内で重複しない .webp のファイル名を決める */
const webpNameFor = (fileName, taken) => {
	const base = path.basename(fileName, path.extname(fileName));
	let name = `${base}.webp`;
	for (let i = 2; taken.has(name); i++) name = `${base}-${i}.webp`;
	return name;
};

/** 変換が必要か（WebP 以外、または上限より大きい） */
const needsWork = (ext, width, maxWidth) => ext !== ".webp" || width > maxWidth;

/** 変換後の WebP をバッファで返す（元ファイルと同名で上書きできるよう、書き込みは呼び出し側で行う） */
const convert = (source, maxWidth) => {
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

const replaceReference = (markdown, from, to) => {
	let result = markdown;
	for (const variant of new Set([from, encodeURI(from)])) {
		result = result.replaceAll(`./${variant}`, `./${to}`);
	}
	return result;
};

/** 1 枚を WebP に変換して書き込み、新しいファイル名を返す */
const optimizeImage = async (dir, file, maxWidth, taken) => {
	const source = path.join(dir, file);
	const before = (await stat(source)).size;
	const dest = path.extname(file).toLowerCase() === ".webp" ? file : webpNameFor(file, taken);
	taken.add(dest);
	const buffer = await convert(source, maxWidth);
	await writeFile(path.join(dir, dest), buffer);
	if (dest !== file) await rm(source);
	const kb = (bytes) => `${(bytes / 1024) | 0}KB`;
	console.log(`${path.basename(dir)}/${file} → ${dest}  ${kb(before)} → ${kb(buffer.length)}`);
	return dest;
};

const processPost = async (dir) => {
	const markdownPath = path.join(dir, "index.md");
	if (!existsSync(markdownPath)) return [];
	let markdown = await readFile(markdownPath, "utf-8");
	const eyecatch = getEyecatch(markdown);
	const files = await readdir(dir);
	const taken = new Set(files);
	const pending = [];

	for (const file of files) {
		const ext = path.extname(file).toLowerCase();
		if (!SOURCE_EXTENSIONS.has(ext)) continue;
		const maxWidth = file === eyecatch ? EYECATCH_MAX_WIDTH : BODY_MAX_WIDTH;
		const { width = 0 } = await sharp(path.join(dir, file)).metadata();
		if (!needsWork(ext, width, maxWidth)) continue;

		pending.push(path.relative(process.cwd(), path.join(dir, file)));
		if (CHECK) continue;
		const dest = await optimizeImage(dir, file, maxWidth, taken);
		markdown = replaceReference(markdown, file, dest);
	}

	if (!CHECK && pending.length > 0) await writeFile(markdownPath, markdown);
	return pending;
};

const dirs = (await readdir(BLOG_DIR, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => path.join(BLOG_DIR, entry.name));

const pending = [];
for (const dir of dirs) {
	pending.push(...(await processPost(dir)));
}

if (CHECK && pending.length > 0) {
	console.error("最適化されていないブログ画像があります。pnpm images:optimize を実行してください:");
	for (const file of pending) console.error(`  ${file}`);
	process.exit(1);
}
console.log(
	pending.length === 0 ? "すべての画像が最適化済みです" : `${pending.length} 件を変換しました`,
);
