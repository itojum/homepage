/**
 * ブログ記事の取得（src/content/blogs の Content Collection）
 */
import { type CollectionEntry, getCollection } from "astro:content";
import { resolveBlogImageUrl } from "@/libs/blogImage";
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
			: null;

	return {
		id: entry.id,
		title: data.title,
		description: data.description,
		eyecatch: eyecatchUrl ? { url: eyecatchUrl } : null,
		category: data.category ?? null,
		tags: data.tags,
		publishedAt: data.publishedAt,
		updatedAt: data.updatedAt ?? null,
		draft: data.draft,
	};
};

const byPublishedAtDesc = (a: BlogEntry, b: BlogEntry) =>
	b.data.publishedAt.getTime() - a.data.publishedAt.getTime();

/** 公開済み記事のエントリを新しい順に取得 */
export const getPublishedBlogEntries = async (): Promise<BlogEntry[]> => {
	const entries = await getCollection("blogs", (entry) => !entry.data.draft);
	return entries.sort(byPublishedAtDesc);
};

/** 下書き記事のエントリを取得（ビルド時のプレビューページ生成用） */
export const getDraftBlogEntries = async (): Promise<BlogEntry[]> => {
	const entries = await getCollection("blogs", (entry) => entry.data.draft);
	return entries.sort(byPublishedAtDesc);
};

/** 公開済み記事を新しい順に取得 */
export const getBlogs = async (): Promise<Blog[]> => {
	return (await getPublishedBlogEntries()).map(toBlog);
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
