/** アイキャッチ画像 */
export type Eyecatch = {
	url: string;
};

/** ブログ記事（表示用） */
export type Blog = {
	id: string;
	title: string;
	description: string;
	eyecatch: Eyecatch | null;
	category: string | null;
	tags: string[];
	publishedAt: Date;
	updatedAt: Date | null;
};
