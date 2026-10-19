import fs from 'node:fs';

const content = fs.readFileSync('api/index.ts', 'utf8');
const lines = content.split('\n');

interface RouteInfo {
  method: string;
  path: string;
  startLine: number;
  endLine: number;
}

const routes: RouteInfo[] = [];
const routeRegex = /app\.(post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
let match: RegExpExecArray | null;

while ((match = routeRegex.exec(content)) !== null) {
  const lineNo = content.substring(0, match.index).split('\n').length;
  routes.push({
    method: match[1].toUpperCase(),
    path: match[2],
    startLine: lineNo,
    endLine: 0,
  });
}

const anyRouteIndices: number[] = [];
const anyRouteRegex = /\napp\.(get|post|put|patch|delete|use)\s*\(/g;
let anyMatch: RegExpExecArray | null;
while ((anyMatch = anyRouteRegex.exec(content)) !== null) {
  const lineNo = content.substring(0, anyMatch.index).split('\n').length + 1;
  anyRouteIndices.push(lineNo);
}

for (let i = 0; i < routes.length; i++) {
  const nextAny = anyRouteIndices.find(idx => idx > routes[i].startLine);
  routes[i].endLine = nextAny ? nextAny - 1 : lines.length;
}

console.log(`Total de rotas mutáveis encontradas: ${routes.length}`);

for (const r of routes) {
  const routeBlock = lines.slice(r.startLine - 1, r.endLine).join('\n');
  const issues: string[] = [];

  if (/user_id\s*\|\|\s*1|Number\(user_id\)\s*\|\|\s*1/.test(routeBlock)) {
    issues.push('Contém fallback para user_id || 1');
  }
  if (/const\s*\{[^}]*user_id[^}]*\}\s*=\s*req\.body/.test(routeBlock)) {
    issues.push('Lê user_id do req.body');
  }
  if (/const\s*\{[^}]*user_name[^}]*\}\s*=\s*req\.body/.test(routeBlock)) {
    issues.push('Lê user_name do req.body');
  }
  if (/stage_id\s*:\s*2\b/.test(routeBlock)) {
    issues.push('Contém stage_id: 2 fixo');
  }
  if (/catch\s*\([a-zA-Z0-9_]*\)\s*\{\s*\}/.test(routeBlock)) {
    issues.push('Contém catch vazio');
  }

  // Count direct writes to supabase
  const writeMatches = routeBlock.match(/supabase(?:Admin)?\s*\.\s*from\s*\([^)]+\)\s*\.\s*(insert|update|delete|upsert)/g) || [];
  const rpcMatches = routeBlock.match(/supabase(?:Admin)?\s*\.\s*rpc\s*\(\s*['"]([^'"]+)['"]/g) || [];

  console.log(`\n- [${r.method} ${r.path}] (L${r.startLine}-L${r.endLine})`);
  console.log(`  Writes diretos: ${writeMatches.length} (${writeMatches.join(', ') || 'nenhum'})`);
  console.log(`  RPCs chamadas: ${rpcMatches.length} (${rpcMatches.join(', ') || 'nenhuma'})`);
  if (issues.length > 0) {
    console.log(`  ⚠️ PROBLEMAS: ${issues.join(' | ')}`);
  }
}
