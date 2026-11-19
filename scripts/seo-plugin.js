// Build-time SEO for the portfolio. The page itself is a React app that loads
// public/content/*.json in the browser, so the raw HTML used to be an empty <div id="root">.
// At `vite build` this plugin reads the same JSON and adds:
//   - <head>: description, canonical, Open Graph, and one schema.org Person block
//     (same names and profiles as the founder markup on ofststudio.com);
//   - <noscript>: the same text the app shows (about + projects), for crawlers without JavaScript.
// Nothing visible changes for people with JavaScript on.
import fs from 'node:fs';

const SITE = 'https://maria-chernobai-portfolio.vercel.app';
const STUDIO = { '@type': 'Organization', '@id': 'https://ofststudio.com/#studio', name: 'OFST Studio', url: 'https://ofststudio.com/' };

// Kept in sync with scripts/gen-apps.mjs (FOUNDER) in the offset repo.
const ALTERNATE_NAMES = [
  'Maria Chernobay', 'Mariia Chernobai', 'Masha Chernobay', 'Masha Chernobai', 'Máša Černobaj',
  'Мария Чернобай', 'Марія Чернобай', 'Маша Чернобай',
  '4rnbay', 'Форнбэй', 'foreign baby', 'Форджин Бэйби', 'Маша Форджин', 'Masha Foreign',
];
const SAME_AS = [
  'https://www.instagram.com/4rnbay/',
  'https://www.threads.com/@4rnbay',
  'https://github.com/yunglordsimens',
];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readJson = (name) => JSON.parse(fs.readFileSync(new URL(`../public/content/${name}`, import.meta.url), 'utf8'));
const LINK_LINE = /^\s*(?:\/\/\s*)?(https?:\/\/\S+)\s*$/;

// A line that is only a link ("// https://…") is the project's own address.
function projectLinks(text) {
  return [...new Set(String(text || '').split('\n').map((l) => (l.match(LINK_LINE) || [])[1]).filter(Boolean))];
}

// Project descriptions are written as "// paragraph" blocks, sometimes with a "# Title" line;
// keep the words, drop the slashes, heading marks, link-only lines and a repeat of the title.
function paragraphs(text, title) {
  const same = (p) => p.toLowerCase() === String(title || '').toLowerCase();
  return String(text || '')
    .split('\n').filter((l) => !LINK_LINE.test(l)).join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\s*\/\/\s?/gm, '').replace(/^\s*#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p && !/^[\s/.,:;-]*$/.test(p) && !same(p));
}

function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,.;:—-]+$/, '') + '…';
}

export default function portfolioSeo() {
  return {
    name: 'portfolio-seo',
    apply: 'build',
    transformIndexHtml(html) {
      const about = readJson('about.json');
      const raw = readJson('projects.json');
      const projects = (raw.projects || raw)
        .filter((p) => p.visible !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({
          id: p.id,
          title: p.title,
          text: paragraphs(p.description, p.title),
          links: projectLinks(p.description),
        }));

      const description = shorten(`${about.role}, ${about.location}. ${about.practice}`, 158);
      const person = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${SITE}/#person`,
        name: about.name,
        alternateName: ALTERNATE_NAMES.filter((n) => n !== about.name),
        url: `${SITE}/`,
        jobTitle: about.role,
        description: about.practice,
        address: { '@type': 'PostalAddress', addressLocality: 'Prague', addressCountry: 'CZ' },
        knowsLanguage: ['en', 'uk', 'ru', 'cs', 'es'],
        worksFor: STUDIO,
        sameAs: SAME_AS,
        subjectOf: projects.map((p) => ({
          '@type': 'CreativeWork',
          name: p.title,
          ...(p.text[0] ? { description: shorten(p.text[0], 300) } : {}),
          ...(p.links[0] ? { url: p.links[0] } : {}),
          creator: { '@id': `${SITE}/#person` },
        })),
      };
      const ld = JSON.stringify(person).replace(/</g, '\\u003c');

      const head = [
        `<link rel="canonical" href="${SITE}/" />`,
        `<meta property="og:type" content="profile" />`,
        `<meta property="og:title" content="${esc(about.name)} — ${esc(about.role)}" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta property="og:url" content="${SITE}/" />`,
        `<script type="application/ld+json">${ld}</script>`,
      ].join('\n    ');

      const list = projects.map((p) => `<li><h3>${esc(p.title)}</h3>${p.text.map((t) => `<p>${esc(t)}</p>`).join('')}${p.links.map((l) => `<p><a href="${esc(l)}">${esc(l)}</a></p>`).join('')}</li>`).join('');
      const facts = ['practice', 'services', 'education', 'languages', 'modeling', 'available']
        .filter((k) => about[k]).map((k) => `<p>${esc(about[k])}</p>`).join('');
      const noscript = `<noscript><main><h1>${esc(about.name)}</h1><p>${esc(about.role)} — ${esc(about.location)}</p>${facts}<h2>Projects</h2><ul>${list}</ul><p>Instagram <a href="https://www.instagram.com/4rnbay/">${esc(about.instagram)}</a> · <a href="https://github.com/yunglordsimens">GitHub</a> · <a href="https://ofststudio.com/">OFST Studio</a></p></main></noscript>`;

      return html
        .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
        .replace('</head>', `    ${head}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
    },
  };
}
