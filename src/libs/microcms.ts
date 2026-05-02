/**
 * microCMS API クライアント
 *
 * 利用前にプロジェクトルートに .env を用意し、以下を設定してください：
 *   MICROCMS_SERVICE_DOMAIN=<YOUR_SERVICE>  （.microcms.io は含めない）
 *   MICROCMS_API_KEY=<YOUR_KEY_VALUE>
 *   MICROCMS_PREVIEW_API_KEY=<DRAFT_READ_KEY>  （下書き読み取り可キー）
 */
import type { MicroCMSQueries } from "microcms-js-sdk";
import { createClient } from "microcms-js-sdk";
import type { Blog } from "@/types/blog";
import type { Activity } from "@/types/activity";

const client = createClient({
	serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
	apiKey: import.meta.env.MICROCMS_API_KEY,
});

/** 下書きを含むクライアント（静的ページ生成用）。専用キー未設定時は MICROCMS_API_KEY を使用 */
const previewClient = createClient({
	serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
	apiKey: import.meta.env.MICROCMS_PREVIEW_API_KEY ?? import.meta.env.MICROCMS_API_KEY,
});

/** 記事一覧を取得 */
export const getBlogs = async (queries?: MicroCMSQueries) => {
	return await client.getList<Blog>({ endpoint: "blogs", queries });
};

/** 全記事の ID を取得（公開のみ） */
export const getAllBlogIds = async () => {
	return await client.getAllContentIds({ endpoint: "blogs" });
};

/** 全記事の ID を取得（下書き含む）— 静的パス生成用 */
export const getAllBlogIdsIncludingDraft = async () => {
	return await previewClient.getAllContentIds({ endpoint: "blogs" });
};

/** 記事詳細を取得（公開のみ） */
export const getBlogDetail = async (contentId: string, queries?: MicroCMSQueries) => {
	return await client.getListDetail<Blog>({
		endpoint: "blogs",
		contentId,
		queries,
	});
};

/** 記事詳細を取得（下書き含む）— 静的ページ生成用 */
export const getBlogDetailForBuild = async (contentId: string, queries?: MicroCMSQueries) => {
	return await previewClient.getListDetail<Blog>({
		endpoint: "blogs",
		contentId,
		queries,
	});
};

/** アクティビティ一覧を取得 */
export const getActivities = async (queries?: MicroCMSQueries) => {
	return await client.getAllContents<Activity>({ endpoint: "activities", queries });
};

/** 関連ブログを最大 limit 件取得（カテゴリまたはタグが一致するもの優先、不足分は他の記事で補填） */
export const getRelatedBlogs = async (blog: Blog, limit: number = 3): Promise<Blog[]> => {
	const filterParts: string[] = [];

	if (blog.category) {
		filterParts.push(`category[equals]${blog.category.id}`);
	}
	for (const tag of blog.tags) {
		filterParts.push(`tags[contains]${tag.id}`);
	}

	let relatedBlogs: Blog[] = [];

	if (filterParts.length > 0) {
		const response = await getBlogs({
			limit: limit + 1,
			filters: filterParts.join("[or]"),
			depth: 2,
		});
		relatedBlogs = response.contents.filter((b) => b.id !== blog.id).slice(0, limit);
	}

	if (relatedBlogs.length < limit) {
		const needed = limit - relatedBlogs.length;
		const excludeIds = new Set([blog.id, ...relatedBlogs.map((b) => b.id)]);
		const response = await getBlogs({
			limit: needed + excludeIds.size,
			depth: 2,
		});
		const additional = response.contents.filter((b) => !excludeIds.has(b.id)).slice(0, needed);
		relatedBlogs = [...relatedBlogs, ...additional];
	}

	return relatedBlogs;
};
