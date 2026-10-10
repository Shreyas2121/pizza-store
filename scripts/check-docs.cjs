/* Validate retained documentation against files, mounted routes and table declarations. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../backend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
  const file = path.posix.join(dir, entry.name);
  if (entry.isDirectory()) return ['node_modules', '.git', '.agents', '.codex', 'dist', 'uploads', '.private'].includes(entry.name) ? [] : walk(file);
  return entry.isFile() ? [file] : [];
});
const files = walk('');
const errors = [];
let links = 0;
const docs = files.filter(file => /\.mdx?$/.test(file));
for (const file of docs) {
  for (const match of read(file).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].replace(/^<|>$/g, '');
    if (!target || /^(https?:|mailto:|app:)/.test(target)) continue;
    links++;
    const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) errors.push(`${file}: missing ${target}`);
  }
}
const mounts = new Map();
const routes = [];
const tables = [];
for (const file of files.filter(file => file === 'backend/src/routes.ts' || file.endsWith('.routes.ts') || (file.startsWith('backend/src/db/schema/') && file.endsWith('.ts') && !file.endsWith('.test.ts')))) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(source);
      const method = node.expression.name.text;
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) {
        if (owner === 'mainRoutes' && method === 'use') {
          const router = node.arguments.at(-1).getText(source);
          if (!mounts.has(router)) mounts.set(router, first.text);
        } else if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) routes.push({ owner, method: method.toUpperCase(), route: first.text });
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'pgTable') {
      const [name, columns] = node.initializer.arguments;
      if (ts.isStringLiteral(name) && ts.isObjectLiteralExpression(columns)) tables.push({ name: name.text, fields: columns.properties.map(column => column.name.getText(source)) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
mounts.set('promotions', mounts.get('promotionRoutes'));
mounts.set('stores', mounts.get('storePromotionRoutes'));
mounts.set('paymentWebhookRoutes', '/payments/razorpay/webhook');
mounts.set('financeMetricsRoutes', '/metrics');
const expected = new Set();
for (const route of routes) {
  const prefix = mounts.get(route.owner);
  if (!prefix) continue;
  const endpoint = (route.owner === 'financeMetricsRoutes' ? '' : '/api/v1') + prefix + (['', '/'].includes(route.route) ? '' : route.route);
  expected.add(`${route.method} ${endpoint}`);
}
const documented = new Set([...read('docs/api-reference.md').matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)`/gm)].map(match => `${match[1]} ${match[2]}`));
for (const route of expected) if (!documented.has(route)) errors.push(`API reference missing ${route}`);
for (const route of documented) if (!expected.has(route)) errors.push(`API reference has unmounted ${route}`);
const schema = read('docs/database-schema.md');
const declaredTables = new Set(tables.map(table => table.name.replaceAll('_', '-')));
for (const heading of schema.matchAll(/^### ([a-z0-9-]+)$/gm)) {
  if (!declaredTables.has(heading[1])) errors.push(`Schema reference has undeclared table ${heading[1]}`);
}
for (const table of tables) {
  const heading = `### ${table.name.replaceAll('_', '-')}`;
  const start = schema.indexOf(heading + '\n');
  if (start < 0) { errors.push(`Schema reference missing ${table.name}`); continue; }
  const next = schema.indexOf('\n### ', start + heading.length);
  const section = schema.slice(start, next < 0 ? undefined : next);
  const fields = new Set([...section.matchAll(/^\| `[^`]+` \| `([^`]+)` \|/gm)].map(match => match[1]));
  for (const field of table.fields) if (!fields.has(field)) errors.push(`Schema reference missing ${table.name}.${field}`);
  for (const field of fields) if (!table.fields.includes(field)) errors.push(`Schema reference has undeclared ${table.name}.${field}`);
}
const evidencePaths = [...read('frontend/src/features/docs/content/evidence.ts').matchAll(/(?:source|test): "([^"]+)"/g)].map(match => match[1]);
for (const file of evidencePaths) if (!fs.existsSync(path.join(root, file))) errors.push(`Public evidence missing ${file}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Documentation check passed: ${docs.length} Markdown files, ${links} relative links, ${expected.size} handlers, ${tables.length} tables/${tables.reduce((sum, table) => sum + table.fields.length, 0)} columns, ${evidencePaths.length} public evidence paths.`);
