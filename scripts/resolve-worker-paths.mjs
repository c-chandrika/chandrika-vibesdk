import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔧 Resolving TypeScript path aliases for Wrangler...');

// Create temporary worker directory with resolved paths
const tempRoot = path.join(rootDir, '.wrangler', 'resolved');
const tempWorkerDir = path.join(tempRoot, 'worker');
const tempSharedDir = path.join(tempRoot, 'shared');

function resolvePathAliases(content, filePath) {
	const fileDir = path.dirname(filePath);
	
	// Replace 'worker/*' imports with relative paths
	content = content.replace(/from ['"]worker\/([^'"]+)['"]/g, (match, importPath) => {
		const targetPath = path.join(tempRoot, 'worker', importPath);
		const relativePath = path.relative(fileDir, targetPath);
		const normalized = relativePath.replace(/\\/g, '/');
		return `from '${normalized.startsWith('.') ? normalized : './' + normalized}'`;
	});
	
	// Replace 'shared/*' imports with relative paths
	content = content.replace(/from ['"]shared\/([^'"]+)['"]/g, (match, importPath) => {
		const targetPath = path.join(tempRoot, 'shared', importPath);
		const relativePath = path.relative(fileDir, targetPath);
		const normalized = relativePath.replace(/\\/g, '/');
		return `from '${normalized.startsWith('.') ? normalized : './' + normalized}'`;
	});
	
	return content;
}

function processDirectory(srcDir, destDir, baseDir = rootDir) {
	mkdirSync(destDir, { recursive: true });
	
	const entries = readdirSync(srcDir);
	
	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry);
		const destPath = path.join(destDir, entry);
		const stat = statSync(srcPath);
		
		if (stat.isDirectory()) {
			processDirectory(srcPath, destPath, baseDir);
		} else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
			let content = readFileSync(srcPath, 'utf-8');
			content = resolvePathAliases(content, destPath);
			writeFileSync(destPath, content);
		} else {
			// Copy other files as-is
			copyFileSync(srcPath, destPath);
		}
	}
}

try {
	// Process worker directory
	console.log('📦 Processing worker directory...');
	processDirectory(path.join(rootDir, 'worker'), tempWorkerDir);
	
	// Process shared directory
	console.log('📦 Processing shared directory...');
	processDirectory(path.join(rootDir, 'shared'), tempSharedDir);
	
	console.log('✅ Path aliases resolved');
	console.log(`📁 Resolved files in: ${tempRoot}`);
} catch (error) {
	console.error('❌ Failed to resolve path aliases:', error);
	process.exit(1);
}
