/**
 * frontmatter に eyecatch が無い記事のアイキャッチ画像をビルド時に生成する
 * （/og/blogs/<slug>.png）
 */
import { getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";
import type { BlogEntry } from "@/libs/blog";
import { generateEyecatch } from "@/libs/eyecatch";

// sharp を使うため必ずビルド時に静的ファイルとして出力する
export const prerender = true;

export const getStaticPaths = (async () => {
	const entries = await getCollection("blogs", (entry) => !entry.data.eyecatch);
	return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { entry } = props as { entry: BlogEntry };
	const image = await generateEyecatch({
		title: entry.data.title,
		publishedAt: entry.data.publishedAt,
	});
	return new Response(new Uint8Array(image), {
		headers: { "Content-Type": "image/png" },
	});
};
