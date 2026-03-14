import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://raguna2.github.io/takt-explainer',
  integrations: [
    starlight({
      title: 'takt 解説',
      defaultLocale: 'root',
      locales: {
        root: { label: '日本語', lang: 'ja' },
      },
      social: {
        github: 'https://github.com/nrslib/takt',
      },
      sidebar: [
        {
          label: '背景と思想',
          autogenerate: { directory: 'background' },
        },
        {
          label: 'アーキテクチャ',
          autogenerate: { directory: 'architecture' },
        },
        {
          label: '利用方法',
          autogenerate: { directory: 'usage' },
        },
      ],
    }),
  ],
});
