import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";
import { CheerioCrawler, CrawlerConfig } from "./crawler/cheerioCrawler";
import { logger, setLogLevel, LogLevel } from "./utils/logging";

interface InputConfig {
startUrls: string[];
maxDepth?: number;
maxPages?: number;
sameDomainOnly?: boolean;
allowedDomains?: string[];
outputFile?: string;
delayMs?: number;
logLevel?: LogLevel;
}

function loadJson(filePath: string): any {
const content = fs.readFileSync(filePath, "utf-8");
return JSON.parse(content);
}

function resolveRootDir(): string {
// main.ts lives in src/, root is one level up
return path.resolve(__dirname, "..");
}

async function run(): Promise<void> {
const rootDir = resolveRootDir();
const configPathArg = process.argv[2];
const defaultConfigPath = path.join(rootDir, "data", "input.example.json");
const configPath = configPathArg
? path.resolve(configPathArg)
: defaultConfigPath;

if (!fs.existsSync(configPath)) {
logger.error(`Config file not found at: ${configPath}`);
process.exit(1);
}

const rawConfig = loadJson(configPath);

// Validate against schema if present
const schemaPath = path.join(rootDir, "src", "config", "input.schema.json");
if (fs.existsSync(schemaPath)) {
const schema = loadJson(schemaPath);
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const valid = validate(rawConfig);
if (!valid) {
logger.error("Configuration is invalid according to input.schema.json:");
logger.error(JSON.stringify(validate.errors, null, 2));
process.exit(1);
}
} else {
logger.warn("No input.schema.json found, skipping configuration validation.");
}

const config = rawConfig as InputConfig;

const logLevel: LogLevel = config.logLevel || "info";
setLogLevel(logLevel);

if (!config.startUrls || !Array.isArray(config.startUrls) || config.startUrls.length === 0) {
logger.error("Configuration must include at least one start URL in 'startUrls'.");
process.exit(1);
}

const crawlerConfig: CrawlerConfig = {
startUrls: config.startUrls,
maxDepth: config.maxDepth ?? 2,
maxPages: config.maxPages ?? 50,
sameDomainOnly: config.sameDomainOnly ?? true,
allowedDomains: config.allowedDomains ?? [],
delayMs: config.delayMs ?? 500
};

const crawler = new CheerioCrawler(crawlerConfig);
logger.info(
`Starting crawl with ${crawlerConfig.startUrls.length} start URL(s), ` +
`maxDepth=${crawlerConfig.maxDepth}, maxPages=${crawlerConfig.maxPages}`
);

const results = await crawler.crawl();

const outputFile = config.outputFile || "data/sample-output.json";
const outputPath = path.isAbsolute(outputFile)
? outputFile
: path.join(rootDir, outputFile);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");

logger.info(`Crawl finished. Saved ${results.length} record(s) to ${outputPath}`);
}

run().catch((err: unknown) => {
const message = err instanceof Error ? err.message : String(err);
logger.error(`Fatal error in main: ${message}`);
process.exit(1);
});