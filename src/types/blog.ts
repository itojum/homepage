/** microCMS の画像オブジェクト */
export type Eyecatch = {
	url: string;
	height: number;
	width: number;
};

/** microCMS のカテゴリ（共通の日付フィールド付き） */
export type Category = {
	id: string;
	createdAt: string;
	updatedAt: string;
	publishedAt: string;
	revisedAt: string;
	name: string;
};

/** microCMS のタグ（共通の日付フィールド付き） */
export type Tag = {
	id: string;
	createdAt: string;
	updatedAt: string;
	publishedAt: string;
	revisedAt: string;
	name: string;
};

/** ブログ記事（microCMS API レスポンス形式） */
export type Blog = {
	id: string;
	createdAt: string;
	updatedAt: string;
	publishedAt: string;
	revisedAt: string;
	title: string;
	content: string;
	eyecatch: Eyecatch;
	category: Category | null;
	tags: Tag[];
};
