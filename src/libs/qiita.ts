/**
 * Qiita の記事をビルド時に取得する Content Loader
 *
 * Qiita API v2 で記事一覧を取得し、各記事ページの og:image をサムネイルとして使う。
 * API にはサムネイルのフィールドが無いため、記事ページの HTML から抜き出している。
 *
 * - QIITA_TOKEN（read_qiita スコープのアクセストークン）を設定するとレート制限が 60 → 1000 回/時 に緩和される
 * - 取得に失敗してもビルドは止めず、前回取得した内容を残す（オフライン開発でも動くように）
 */

import { z } from "astro:content";
import type { Loader } from "astro/loaders";

const API_BASE = "https://qiita.com/api/v2";
const PER_PAGE = 100;
/** 記事ページ（og:image）の同時取得数 */
const CONCURRENCY = 4;
/** 概要文の最大文字数 */
const DESCRIPTION_LENGTH = 120;

type QiitaItem = {
	id: string;
	title: string;
	url: string;
	body: string;
	created_at: string;
	updated_at: string;
	private: boolean;
	tags: { name: string }[];
};

export const qiitaSchema = z.object({
	title: z.string(),
	description: z.string(),
	url: z.string().url(),
	ogImage: z.string().url().nullable(),
	publishedAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	tags: z.array(z.string()),
});

const fetchJson = async <T>(url: string, token?: string): Promise<T> => {
	const res = await fetch(url, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
	return (await res.json()) as T;
};

/** ユーザーの公開記事をすべて取得 */
const fetchItems = async (userId: string, token?: string): Promise<QiitaItem[]> => {
	const items: QiitaItem[] = [];
	for (let page = 1; ; page++) {
		const batch = await fetchJson<QiitaItem[]>(
			`${API_BASE}/users/${encodeURIComponent(userId)}/items?page=${page}&per_page=${PER_PAGE}`,
			token,
		);
		items.push(...batch);
		if (batch.length < PER_PAGE) break;
	}
	return items.filter((item) => !item.private);
};

const decodeHtmlEntities = (s: string) =>
	s
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");

/** 記事ページの HTML から og:image を取り出す（取れなければ null） */
const fetchOgImage = async (url: string): Promise<string | null> => {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const html = await res.text();
		const meta = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0];
		const content = meta?.match(/content=["']([^"']+)["']/i)?.[1];
		return content ? decodeHtmlEntities(content) : null;
	} catch {
		return null;
	}
};

/** 同時実行数を制限して map する */
const mapWithConcurrency = async <T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> => {
	const results = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
};

/** Markdown 本文から一覧用の概要文を作る */
const toDescription = (body: string) => {
	const text = body
		.replace(/```[\s\S]*?```/g, " ") // コードブロック
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 画像
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // リンクはテキストだけ残す
		.replace(/<[^>]+>/g, " ") // HTML タグ
		.replace(/^[#>\-*+|:\s]+/gm, "") // 見出し・引用・リスト・表の記号
		.replace(/[`*_~]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > DESCRIPTION_LENGTH ? `${text.slice(0, DESCRIPTION_LENGTH)}…` : text;
};

export const qiitaLoader = (options: { userId: string; token?: string }): Loader => ({
	name: "qiita-loader",
	load: async ({ store, logger, parseData, generateDigest }) => {
		let items: QiitaItem[];
		try {
			items = await fetchItems(options.userId, options.token);
		} catch (error) {
			logger.warn(`Qiita の記事を取得できませんでした（前回の内容を使います）: ${error}`);
			return;
		}

		const ogImages = await mapWithConcurrency(items, CONCURRENCY, (item) => fetchOgImage(item.url));

		store.clear();
		for (const [i, item] of items.entries()) {
			const data = await parseData({
				id: item.id,
				data: {
					title: item.title,
					description: toDescription(item.body),
					url: item.url,
					ogImage: ogImages[i],
					publishedAt: item.created_at,
					updatedAt: item.updated_at,
					tags: item.tags.map((tag) => tag.name),
				},
			});
			store.set({ id: item.id, data, digest: generateDigest(data) });
		}
		logger.info(`Qiita の記事を ${items.length} 件取得しました`);
	},
});
