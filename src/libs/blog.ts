/**
 * ブログ記事の取得（src/content/blogs の Content Collection と Qiita の記事）
 */
import { type CollectionEntry, getCollection } from "astro:content";
import { generatedEyecatchPath, resolveBlogImageUrl } from "@/libs/blogImage";
import type { Blog } from "@/types/blog";

export type BlogEntry = CollectionEntry<"blogs">;

/** Content Collection のエントリを表示用の Blog に変換 */
export const toBlog = (entry: BlogEntry): Blog => {
	const { data } = entry;
	const eyecatchUrl =
		data.eyecatch && entry.filePath
			? resolveBlogImageUrl({
					entryFilePath: entry.filePath,
					src: data.eyecatch,
					baseUrl: import.meta.env.IMAGE_BASE_URL,
					dev: import.meta.env.DEV,
				})
			: // アイキャッチが無い記事はビルド時に自動生成した画像を使う
				generatedEyecatchPath(entry.id);

	return {
		id: entry.id,
		source: "blog",
		url: `/blogs/${entry.id}/`,
		title: data.title,
		description: data.description,
		eyecatch: { url: eyecatchUrl },
		category: data.category ?? null,
		tags: data.tags,
		publishedAt: data.publishedAt,
		updatedAt: data.updatedAt ?? null,
	};
};

const byPublishedAtDesc = (a: BlogEntry, b: BlogEntry) =>
	b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

/** 公開済み記事のエントリを新しい順に取得 */
export const getPublishedBlogEntries = async (): Promise<BlogEntry[]> => {
	const entries = await getCollection("blogs");
	return entries.sort(byPublishedAtDesc);
};

/** 公開済み記事を新しい順に取得 */
export const getBlogs = async (): Promise<Blog[]> => {
	return (await getPublishedBlogEntries()).map(toBlog);
};

/** Qiita の記事を表示用の Blog に変換 */
const qiitaToBlog = (entry: CollectionEntry<"qiita">): Blog => {
	const { data } = entry;
	return {
		id: `qiita-${entry.id}`,
		source: "qiita",
		url: data.url,
		title: data.title,
		description: data.description,
		eyecatch: data.ogImage ? { url: data.ogImage } : null,
		category: null,
		tags: data.tags,
		publishedAt: data.publishedAt,
		updatedAt: data.updatedAt,
	};
};

/**
 * 一覧に載せる記事（このサイトの記事 + Qiita の記事）を新しい順に取得
 *
 * RSS・関連記事など、このサイトの記事だけを扱う箇所では getBlogs を使う。
 */
export const getListedBlogs = async (): Promise<Blog[]> => {
	const qiita = (await getCollection("qiita")).map(qiitaToBlog);
	return [...(await getBlogs()), ...qiita].sort(
		(a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
	);
};

/** 関連記事を最大 limit 件取得（カテゴリまたはタグが一致するもの優先、不足分は新しい記事で補填） */
export const getRelatedBlogs = async (blog: Blog, limit = 3): Promise<Blog[]> => {
	const candidates = (await getBlogs()).filter((b) => b.id !== blog.id);
	const isRelated = (b: Blog) =>
		(blog.category !== null && b.category === blog.category) ||
		b.tags.some((tag) => blog.tags.includes(tag));

	const related = candidates.filter(isRelated).slice(0, limit);
	if (related.length >= limit) return related;

	const relatedIds = new Set(related.map((b) => b.id));
	const additional = candidates
		.filter((b) => !relatedIds.has(b.id))
		.slice(0, limit - related.length);
	return [...related, ...additional];
};
