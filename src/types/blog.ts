/** アイキャッチ画像 */
export type Eyecatch = {
	url: string;
};

/** 記事の掲載元（blog: このサイトの記事、qiita: Qiita の記事） */
export type BlogSource = "blog" | "qiita";

/** ブログ記事（表示用） */
export type Blog = {
	id: string;
	source: BlogSource;
	/** 記事の URL（このサイトの記事はパス、外部の記事は絶対 URL） */
	url: string;
	title: string;
	description: string;
	eyecatch: Eyecatch | null;
	category: string | null;
	tags: string[];
	publishedAt: Date;
	updatedAt: Date | null;
};
