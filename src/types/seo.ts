/** 記事ページ向けのメタデータ（og:type="article" と JSON-LD の BlogPosting に使う） */
export type ArticleMeta = {
	/** 公開日時 */
	publishedTime: Date;
	/** 更新日時（未更新なら省略） */
	modifiedTime?: Date | null;
	/** タグ（article:tag / keywords） */
	tags?: string[];
	/** カテゴリ（article:section / articleSection） */
	section?: string | null;
};
