import * as cheerio from "cheerio";

export interface ScrapedPage {
url: string;
title: string;
textContent: string;
links: string[];
metadata: Record<string, unknown>;
}

/**
* Normalize whitespace in extracted text.
*/
function normalizeText(text: string): string {
return text.replace(/\s+/g, " ").trim();
}

/**
* Extract a best-effort title for the page.
*/
function extractTitle($: cheerio.CheerioAPI): string {
const ogTitle = $('meta[property="og:title"]').attr("content");
if (ogTitle && ogTitle.trim()) {
return ogTitle.trim();
}

const titleTag = $("title").first().text();
if (titleTag && titleTag.trim()) {
return normalizeText(titleTag);
}

const h1 = $("h1").first().text();
if (h1 && h1.trim()) {
return normalizeText(h1);
}

return "";
}

/**
* Extract main textual content from the page.
*/
function extractTextContent($: cheerio.CheerioAPI): string {
$("script, style, noscript, svg").remove();

let text =
$("main").text() ||
$("article").text() ||
$(".content").first().text() ||
$("body").text();

return normalizeText(text);
}

/**
* Extract raw links as they appear in the HTML.
* URL resolution happens at the crawler level.
*/
function extractLinks($: cheerio.CheerioAPI): string[] {
const links = new Set<string>();

$("a[href]").each((_, el) => {
const href = $(el).attr("href");
if (!href) {
return;
}
const trimmed = href.trim();
if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) {
return;
}
links.add(trimmed);
});

return Array.from(links);
}

/**
* Extract metadata to enrich the scraped record.
*/
function extractMetadata(
$: cheerio.CheerioAPI,
pageUrl: string
): Record<string, unknown> {
const metadata: Record<string, unknown> = {};
const htmlLang =
$("html").attr("lang") || $('meta[http-equiv="content-language"]').attr("content");

if (htmlLang) {
metadata.language = htmlLang.trim();
}

const description = $('meta[name="description"]').attr("content");
if (description) {
metadata.description = description.trim();
}

const keywords = $('meta[name="keywords"]').attr("content");
if (keywords) {
metadata.keywords = keywords
.split(",")
.map((kw) => kw.trim())
.filter(Boolean);
}

const ogType = $('meta[property="og:type"]').attr("content");
if (ogType) {
metadata.openGraphType = ogType.trim();
}

const ogLocale = $('meta[property="og:locale"]').attr("content");
if (ogLocale) {
metadata.openGraphLocale = ogLocale.trim();
}

const categoryMeta =
$('meta[name="category"]').attr("content") ||
$('meta[property="article:section"]').attr("content");
if (categoryMeta) {
metadata.category = categoryMeta.trim();
} else {
const breadcrumb =
$(".breadcrumb li").last().text() ||
$('[itemprop="itemListElement"]').last().text();
if (breadcrumb && breadcrumb.trim()) {
metadata.category = normalizeText(breadcrumb);
}
}

metadata.sourceUrl = pageUrl;

return metadata;
}

/**
* Parse HTML into a structured ScrapedPage object.
*/
export function parseHtml(pageUrl: string, html: string): ScrapedPage {
const $ = cheerio.load(html);

const title = extractTitle($);
const textContent = extractTextContent($);
const links = extractLinks($);
const metadata = extractMetadata($, pageUrl);

return {
url: pageUrl,
title,
textContent,
links,
metadata
};
}