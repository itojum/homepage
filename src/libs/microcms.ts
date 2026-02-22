/**
 * microCMS API クライアント
 *
 * 利用前にプロジェクトルートに .env を用意し、以下を設定してください：
 *   MICROCMS_SERVICE_DOMAIN=<YOUR_SERVICE>  （.microcms.io は含めない）
 *   MICROCMS_API_KEY=<YOUR_KEY_VALUE>
 */
import type { MicroCMSQueries } from "microcms-js-sdk";
import { createClient } from "microcms-js-sdk";
import type { Blog } from "@/types/blog";
import type { Activity } from "@/types/activity";

const client = createClient({
	serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
	apiKey: import.meta.env.MICROCMS_API_KEY,
});

/** 記事一覧を取得 */
export const getBlogs = async (queries?: MicroCMSQueries) => {
	return await client.getList<Blog>({ endpoint: "blogs", queries });
};

/** 全記事の ID を取得 */
export const getAllBlogIds = async () => {
	return await client.getAllContentIds({ endpoint: "blogs" });
};

/** 記事詳細を取得 */
export const getBlogDetail = async (contentId: string, queries?: MicroCMSQueries) => {
	return await client.getListDetail<Blog>({
		endpoint: "blogs",
		contentId,
		queries,
	});
};

/** アクティビティ一覧を取得 */
export const getActivities = async (queries?: MicroCMSQueries) => {
	return await client.getAllContents<Activity>({ endpoint: "activities", queries });
};
