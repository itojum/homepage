/** Speaker Deck のスライド（表示用） */
export type Slide = {
	title: string;
	url: string;
	description: string;
	thumbnailUrl: string | null;
	publishedAt: Date | null;
};
