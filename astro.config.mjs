import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import dotenv from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

dotenv.config();

const siteUrl = process.env.SITE_URL;

export default defineConfig({
	build: {
		format: 'file',
	},
	site: siteUrl,
	integrations: [sitemap(), icon(), tailwind(), pagefind()],
	vite: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
		},
		plugins: [
			{
				name: 'generate-robots-txt',
				closeBundle() {
					const outDir = path.join(process.cwd(), 'dist');
					const sitemapLine = siteUrl
						? `Sitemap: ${siteUrl.replace(/\/$/, '')}/sitemap-index.xml`
						: '';
					const body = ['User-agent: *', 'Allow: /', '', sitemapLine].filter(Boolean).join('\n');
					fs.writeFileSync(path.join(outDir, 'robots.txt'), body + '\n', 'utf-8');
				},
			},
		],
	},
});
