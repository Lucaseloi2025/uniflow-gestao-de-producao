import fs from 'node:fs';

const content = fs.readFileSync('api/index.ts', 'utf8');
const lines = content.split('\n');
const routes = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.*)/);
  if (match) {
    let fullCall = match[3];
    let j = i;
    while (!fullCall.includes('async (req') && !fullCall.includes('(req, res') && j < i + 5 && j < lines.length - 1) {
      j++;
      fullCall += ' ' + lines[j].trim();
    }
    routes.push({
      line: i + 1,
      method: match[1].toUpperCase(),
      path: match[2],
      signature: fullCall.trim()
    });
  }
}

console.log(`Total routes: ${routes.length}`);
routes.forEach((r, idx) => {
  console.log(`${idx + 1}. [${r.method}] ${r.path} -> ${r.signature.slice(0, 80)}`);
});
