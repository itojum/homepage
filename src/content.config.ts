import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { BLOG_CONTENT_DIR } from "@/libs/blogImage";

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
		/** true の場合は一覧・RSS に出さず、/draft/blogs/<slug> にのみ生成する */
		draft: z.boolean().default(false),
	}),
});

export const collections = { blogs };
