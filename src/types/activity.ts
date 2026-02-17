/** microCMS のアクティビティ（タイムライン項目） */
export type Activity = {
	id: string;
	title: string;
	date: string; // ISO文字列
	type: string[]; // 配列形式
	link: string | null;
	link_text: string | null;
};
