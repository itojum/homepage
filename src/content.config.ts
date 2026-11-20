import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";
import { QIITA_USER_ID } from "@/consts";
import { BLOG_CONTENT_DIR } from "@/libs/blogImage";
import { qiitaLoader, qiitaSchema } from "@/libs/qiita";

/**
 * ブログ記事
 *
 * src/content/blogs/<slug>/index.md に記事を置き、画像は同じフォルダに配置して相対パスで参照する。
 * 画像を使わない記事は src/content/blogs/<slug>.md でもよい。
 */
const blogs = defineCollection({
	loader: glob({ base: `./${BLOG_CONTENT_DIR}`, pattern: "**/*.md" }),
	schema: z.object({
		title: z.string(),
		description: z.string().default(""),
		publishedAt: z.coerce.date(),
		updatedAt: z.coerce.date().optional(),
		/** アイキャッチ画像（記事フォルダからの相対パス、または外部 URL） */
		eyecatch: z.string().optional(),
		category: z.string().optional(),
		tags: z.array(z.string()).default([]),
	}),
});

/** About ページの Activities（タイムライン） */
const activities = defineCollection({
	loader: file("src/content/activities.yaml"),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		type: z.enum(["project", "event", "work", "examination", "other"]).default("other"),
		link: z.string().url().optional(),
		linkText: z.string().optional(),
	}),
});

/** Qiita の記事（ビルド時に Qiita API から取得。一覧には載せるが本文はリンク先の Qiita で読む） */
const qiita = defineCollection({
	loader: qiitaLoader({ userId: QIITA_USER_ID, token: import.meta.env.QIITA_TOKEN || undefined }),
	schema: qiitaSchema,
});

export const collections = { blogs, activities, qiita };
