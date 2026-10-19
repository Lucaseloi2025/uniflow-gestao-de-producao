import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

interface Finding {
  file: string;
  line: number;
  rule: string;
  match: string;
}

const FORBIDDEN_PATTERNS: { name: string; regex: RegExp; filter?: (match: string) => boolean }[] = [
  {
    name: 'Supabase Project Ref (Staging/Production)',
    regex: /\b(qdwjuedsktpewepkbolj|dkyvzxmocppbydtpsgyu)\b/g,
  },
  {
    name: 'Supabase Secret Key (sb_secret_*)',
    regex: /\bsb_secret_[a-zA-Z0-9_-]{10,}\b/g,
  },
  {
    name: 'Supabase Publishable Key (sb_publishable_*)',
    regex: /\bsb_publishable_[a-zA-Z0-9_-]{10,}\b/g,
  },
  {
    name: 'Exposed Key Fragments',
    regex: /\b(vy8vYEw2Yl4gtBNxGsLl|JlZGQX3EVtnRO9JLsRBFww|g3twCjJN5mltmYRQY9p2jw|Tqv63e1cj_brkpCSn98kvg)\b/g,
  },
  {
    name: 'Real Supabase JWT / Service Role Token',
    regex: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{20,}\b/g,
    filter: (m: string) => {
      const allowedFictitious = [
        'dummy-anon-key-build-verification',
        'mock-anon-key-local-only',
        'dummy-anon-token-build-test',
        'invalid.signature',
      ];
      return !allowedFictitious.some((allowed) => m.includes(allowed));
    },
  },
  {
    name: 'Olist/Tiny ERP Secret Token',
    regex: /\b(olist|tiny)[_-]?(?:token|secret|key)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
    filter: (m: string) => !m.toLowerCase().includes('placeholder') && !m.toLowerCase().includes('dummy'),
  },
  {
    name: 'Hardcoded Service Role Assignment',
    regex: /STAGING_SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]ey[a-zA-Z0-9._-]+['"]/g,
  },
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.gemini',
  'brain',
]);

const IGNORE_FILES = new Set([
  'package-lock.json',
  'scan_secrets.ts',
]);

function scanDirectory(dir: string, baseDir: string, findings: Finding[]) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || relPath.startsWith('.gemini') || relPath.startsWith('.agents/memory')) {
        continue;
      }
      scanDirectory(fullPath, baseDir, findings);
      continue;
    }

    if (IGNORE_FILES.has(entry.name)) {
      continue;
    }

    // Only scan text-like files or scripts
    const ext = path.extname(entry.name).toLowerCase();
    const isTextFile = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.json', '.sql', '.md', '.txt', '.ps1', '.sh',
      '.env', '.yaml', '.yml', '.html', '.css',
    ].includes(ext) || entry.name.startsWith('.env');

    if (!isTextFile) {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      for (const pattern of FORBIDDEN_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(lineText)) !== null) {
          const matchedStr = match[0];
          if (!pattern.filter || pattern.filter(matchedStr)) {
            findings.push({
              file: relPath,
              line: i + 1,
              rule: pattern.name,
              match: matchedStr.substring(0, 10) + '...',
            });
          }
        }
      }
    }
  }
}

function scanZip(zipPath: string, findings: Finding[]) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-zip-'));
  try {
    const absZip = path.resolve(zipPath);
    console.log(`📦 Extraindo arquivo ZIP para análise de segredos: ${absZip}`);
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${absZip.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    );
    scanDirectory(tempDir, tempDir, findings);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp dir cleanup errors
    }
  }
}

function main() {
  const target = process.argv[2] || '.';
  console.log('================================================================================');
  console.log(`🔍 PROCOMFORT — SCANNER AUTOMÁTICO DE SEGREDOS E CREDENCIAIS`);
  console.log(`Alvo de auditoria: ${path.resolve(target)}`);
  console.log('================================================================================');

  const findings: Finding[] = [];

  if (fs.existsSync(target) && fs.statSync(target).isFile() && target.toLowerCase().endsWith('.zip')) {
    scanZip(target, findings);
  } else {
    scanDirectory(path.resolve(target), path.resolve(target), findings);
  }

  if (findings.length > 0) {
    console.error('\n❌ BLOQUEIO DE SEGURANÇA: Credenciais reais ou segredos proibidos detectados!');
    console.error(`Total de violações encontradas: ${findings.length}\n`);
    for (const f of findings) {
      console.error(`  - [${f.rule}] em ${f.file}:${f.line} -> "${f.match}"`);
    }
    console.error('\nRemova todas as credenciais reais antes de prosseguir com a homologação ou empacotamento.');
    process.exit(1);
  }

  console.log('\n✅ [Secret Scanner] Verificação de segurança concluída com sucesso: ZERO segredos encontrados.');
  console.log('================================================================================');
  process.exit(0);
}

main();
