import axios from "axios";
import { parseHtml, ScrapedPage } from "./parser";
import { logger } from "../utils/logging";

export interface CrawlerConfig {
startUrls: string[];
maxDepth: number;
maxPages: number;
sameDomainOnly: boolean;
allowedDomains: string[];
delayMs: number;
}

interface QueueItem {
url: string;
depth: number;
}

/**
* A simple, robust crawler built around axios + cheerio parsing.
*/
export class CheerioCrawler {
private readonly visited = new Set<string>();
private readonly queue: QueueItem[] = [];
private readonly startDomains: Set<string> = new Set();

constructor(private readonly config: CrawlerConfig) {
this.config.startUrls.forEach((u) => {
try {
const url = new URL(u);
this.startDomains.add(url.hostname);
this.queue.push({ url: url.toString(), depth: 0 });
} catch (err) {
logger.warn(`Invalid start URL skipped: ${u}`);
}
});
}

private async delay(ms: number): Promise<void> {
if (ms <= 0) return;
await new Promise((resolve) => setTimeout(resolve, ms));
}

private normalizeUrl(href: string, baseUrl: string): string | null {
try {
const url = new URL(href, baseUrl);
if (!["http:", "https:"].includes(url.protocol)) {
return null;
}
// Remove fragments for canonicalization
url.hash = "";
return url.toString();
} catch {
return null;
}
}

private isAllowedUrl(urlStr: string): boolean {
try {
const url = new URL(urlStr);
const hostname = url.hostname;

if (this.config.allowedDomains.length > 0) {
if (!this.config.allowedDomains.includes(hostname)) {
return false;
}
}

if (this.config.sameDomainOnly) {
if (!Array.from(this.startDomains).includes(hostname)) {
return false;
}
}

return true;
} catch {
return false;
}
}

private enqueueLinks(links: string[], baseUrl: string, currentDepth: number): void {
const nextDepth = currentDepth + 1;
if (nextDepth > this.config.maxDepth) {
return;
}

for (const rawLink of links) {
const absolute = this.normalizeUrl(rawLink, baseUrl);
if (!absolute) {
continue;
}

if (!this.isAllowedUrl(absolute)) {
continue;
}

if (this.visited.has(absolute)) {
continue;
}

if (this.queue.find((item) => item.url === absolute)) {
continue;
}

this.queue.push({ url: absolute, depth: nextDepth });
}
}

private async fetchPage(url: string): Promise<string | null> {
try {
logger.debug(`Fetching: ${url}`);
const response = await axios.get<string>(url, {
responseType: "text",
timeout: 15000,
headers: {
"User-Agent":
"FR-Carre-Opera-Scraper/1.0 (+https://www.carre-opera.com; contact: automation)"
}
});

const contentType = response.headers["content-type"] || "";
if (!contentType.includes("text/html")) {
logger.debug(`Skipping non-HTML content at ${url} (content-type: ${contentType})`);
return null;
}

return response.data;
} catch (err: any) {
const message = err?.message || String(err);
logger.warn(`Failed to fetch ${url}: ${message}`);
return null;
}
}

/**
* Run the crawl and return a collection of ScrapedPage records.
*/
async crawl(): Promise<ScrapedPage[]> {
const results: ScrapedPage[] = [];

while (this.queue.length > 0 && results.length < this.config.maxPages) {
const { url, depth } = this.queue.shift() as QueueItem;

if (this.visited.has(url)) {
continue;
}
this.visited.add(url);

logger.info(`Crawling [depth=${depth}] ${url}`);

const html = await this.fetchPage(url);
if (!html) {
continue;
}

try {
const page = parseHtml(url, html);
results.push(page);
logger.info(
`Parsed: "${page.title || "Untitled"}" (${page.links.length} links on page)`
);
this.enqueueLinks(page.links, url, depth);
} catch (parseErr: any) {
const message = parseErr?.message || String(parseErr);
logger.error(`Failed to parse page ${url}: ${message}`);
}

if (results.length >= this.config.maxPages) {
logger.info("Reached maxPages limit, stopping crawl.");
break;
}

await this.delay(this.config.delayMs);
}

logger.info(
`Crawl complete. Visited ${this.visited.size} page(s), collected ${results.length} record(s).`
);
return results;
}
}