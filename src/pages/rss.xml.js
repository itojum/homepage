import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/consts";
import { getBlogs } from "@/libs/microcms";

export async function GET(context) {
	const response = await getBlogs({
		orders: "-publishedAt",
	});
	const posts = response.contents;
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.title,
			description: post.description || "",
			pubDate: new Date(post.publishedAt || post.createdAt),
			link: `/blog/${post.id}/`,
		})),
	});
}
