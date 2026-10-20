import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

async function main() {
  const screenshotsDir = path.resolve('screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  // 1. Setup local mock API & static server on port 3333
  const app = express();
  app.use(express.json());

  // Mock users
  const mockUser = {
    id: 1,
    name: 'Carlos Admin (PCP)',
    email: 'admin@comfortpro.com',
    role: 'Administrador',
    active: true,
    hourly_cost: 0
  };

  const mockStages = [
    { id: 10, name: 'Corte', sector_name: 'Corte', sort_order: 1, active: 1, calculation_type: 'por_peca' },
    { id: 20, name: 'Costura', sector_name: 'Costura', sort_order: 2, active: 1, calculation_type: 'por_peca' }
  ];

  const mockOrders = [
    {
      id: 1121,
      order_number: 'PED-1121',
      client_name: 'Confecções Alpha',
      product_type: 'Dry Fit',
      print_type: 'DTF',
      quantity: 50,
      status: 'Em Produção',
      pcp_status: 'EM_PRODUCAO',
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: true, quantidade_pedido: 50, quantidade_boa: 50 },
        { id: 20, name: 'Costura', finished: false, in_progress: true, quantidade_pedido: 50, quantidade_boa: 25 }
      ],
      created_at: '2026-10-18T10:00:00Z',
      deadline: '2026-10-25T18:00:00Z',
      items: [{ item_key: 'Dry Fit | Preto | M', quantity: 50 }]
    },
    {
      id: 1122,
      order_number: 'PED-1122',
      client_name: 'Uniformes Beta',
      product_type: 'Algodão',
      print_type: 'Silk',
      quantity: 120,
      status: 'Entrada',
      pcp_status: 'AGUARDANDO LIBERAÇÃO',
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: false, quantidade_pedido: 120, quantidade_boa: 0 },
        { id: 20, name: 'Costura', finished: false, quantidade_pedido: 120, quantidade_boa: 0 }
      ],
      created_at: '2026-10-19T08:30:00Z',
      deadline: '2026-10-28T18:00:00Z',
      items: [{ item_key: 'Algodão | Azul | G', quantity: 120 }]
    },
    {
      id: 1120,
      order_number: 'PED-1120',
      client_name: 'Academia Fit Life',
      product_type: 'Poliamida',
      print_type: 'Sublimação',
      quantity: 30,
      status: 'Pronto',
      pcp_status: 'PRONTO',
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: true, quantidade_pedido: 30, quantidade_boa: 30 },
        { id: 20, name: 'Costura', finished: true, quantidade_pedido: 30, quantidade_boa: 30 }
      ],
      created_at: '2026-10-17T09:00:00Z',
      deadline: '2026-10-22T18:00:00Z'
    }
  ];

  app.get('/api/users', (req, res) => {
    res.json([mockUser]);
  });

  app.get('/api/stages', (req, res) => {
    res.json(mockStages);
  });

  app.get('/api/orders', (req, res) => {
    res.json(mockOrders);
  });

  app.get('/api/orders/drafts', (req, res) => {
    res.json([]);
  });

  app.get('/api/collaborators/goals', (req, res) => {
    res.json([]);
  });

  app.get('/api/config', (req, res) => {
    res.json({
      capacidade_diaria: 300,
      jornada_horas: 8.8,
      dias_uteis_mes: 22
    });
  });

  app.get('/api/config/loss-reasons', (req, res) => {
    res.json([]);
  });

  app.get('/api/reports', (req, res) => {
    res.json({
      summary: {
        total_orders: 45,
        total_pieces: 1850,
        active_collaborators: 8,
        avg_efficiency: 94.2
      },
      productionByOperator: [
        { operator: 'Ana Silva', pieces: 420, hours: 38, piecesPerHour: 11.05 },
        { operator: 'João Souza', pieces: 395, hours: 36, piecesPerHour: 10.97 },
        { operator: 'Maria Santos', pieces: 510, hours: 40, piecesPerHour: 12.75 }
      ],
      productionBySector: [
        { sector: 'Corte', pieces: 920, target: 900 },
        { sector: 'Costura', pieces: 930, target: 900 }
      ]
    });
  });

  app.get('/api/reports/operational', (req, res) => {
    res.json([]);
  });

  app.get('/api/reports/delivery', (req, res) => {
    res.json({ onTime: 42, delayed: 3, taxa_pontualidade: 93.3, grafico: [] });
  });

  app.get('/api/reports/delays', (req, res) => {
    res.json([]);
  });

  app.get('/api/reports/loss', (req, res) => {
    res.json([]);
  });

  app.get('/api/reports/collaborator-goals', (req, res) => {
    res.json([]);
  });

  // Serve static dist
  const distPath = path.resolve('dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = app.listen(3333, '127.0.0.1');
  console.log('Test web server running on http://127.0.0.1:3333');

  // 2. Launch Edge with CDP
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.resolve('temp_edge_screenshots_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  try {
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9222/json/version');
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Edge CDP');

    // Create target page
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:3333', { method: 'PUT' });
    const pageData = await newPageRes.json();

    const ws = new WebSocket(pageData.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    function send(method: string, params: any = {}) {
      const id = msgId++;
      return new Promise<any>((resolve) => {
        const handler = (event: MessageEvent) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');

    ws.addEventListener('message', (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Console.messageAdded') {
        console.log('[Browser Console]', msg.params.message.text);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console API]', msg.params.type, msg.params.args?.map((a: any) => a.value).join(' '));
      }
    });

    // Setup Auth Session in LocalStorage
    const jwtHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const jwtPayload = Buffer.from(JSON.stringify({
      sub: '99999999-9999-9999-9999-999999999999',
      email: 'admin@comfortpro.com',
      role: 'authenticated',
      aud: 'authenticated',
      exp: 2500000000,
      iat: 1700000000
    })).toString('base64url');
    const validJwtToken = `${jwtHeader}.${jwtPayload}.mock`;

    const mockAuthSession = {
      access_token: validJwtToken,
      token_type: 'bearer',
      expires_in: 800000000,
      expires_at: 2500000000,
      refresh_token: 'mock-refresh-token',
      user: {
        id: '99999999-9999-9999-9999-999999999999',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@comfortpro.com',
        app_metadata: { provider: 'email' },
        user_metadata: { name: 'Carlos Admin (PCP)' }
      }
    };

    // Helper to evaluate script in page
    async function evaluate(expression: string) {
      return await send('Runtime.evaluate', { expression, awaitPromise: true });
    }

    // Navigate to initialize domain
    await send('Page.navigate', { url: 'http://127.0.0.1:3333' });
    await new Promise(r => setTimeout(r, 1200));

    // Store auth tokens for all potential supabase project refs
    const sessionStr = JSON.stringify(mockAuthSession);
    await evaluate(`
      localStorage.setItem('sb-dummy-auth-token', '${sessionStr}');
      localStorage.setItem('sb-dkyvzxmocppbydtpsgyu-auth-token', '${sessionStr}');
      localStorage.setItem('supabase.auth.token', '${sessionStr}');
    `);

    // Helper to capture a screenshot
    async function capture(fileName: string, width: number, height: number, urlPath: string, setupAction?: string) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600
      });

      await send('Page.navigate', { url: `http://127.0.0.1:3333${urlPath}` });
      await new Promise(r => setTimeout(r, 1500));

      if (setupAction) {
        await evaluate(setupAction);
        await new Promise(r => setTimeout(r, 500));
      }

      const evalRes = await evaluate('document.body.innerText');
      console.log(`[Page Text ${fileName}]`, evalRes?.result?.value?.replace(/\s+/g, ' ').slice(0, 150));

      const { data: base64 } = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.resolve('screenshots', fileName);
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      console.log(`[Screenshot OK] ${fileName} (${width}x${height}) -> ${filePath}`);
    }

    // 1. Desktop Dashboard + Menu Desktop
    await capture('01_menu_desktop.png', 1440, 900, '/');
    await capture('03_dashboard.png', 1440, 900, '/');

    // 2. Mobile Menu (Drawer aberto com botão mobile)
    await capture(
      '02_menu_mobile.png',
      390,
      844,
      '/',
      `
        const btn = document.querySelector('button[aria-label="Abrir menu"]') || document.querySelector('header button');
        if (btn) btn.click();
      `
    );

    // 3. Kanban
    await capture('04_kanban.png', 1440, 900, '/kanban');

    // 4. Pedidos (Entrada)
    await capture('05_pedidos.png', 1440, 900, '/orders');

    // 5. Colaboradores
    await capture('06_colaboradores.png', 1440, 900, '/collaborators');

    // 6. Relatórios
    await capture('07_relatorios.png', 1440, 900, '/reports');

    // 7. Configurações
    await capture('08_configuracoes.png', 1440, 900, '/settings');

    console.log('All 8 required screenshots successfully captured!');
    ws.close();
  } finally {
    proc.kill();
    server.close();
  }
}

main().catch(err => {
  console.error('[Error capturing screenshots]', err);
  process.exit(1);
});
