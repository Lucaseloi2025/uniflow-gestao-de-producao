import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

async function main() {
  const screenshotsDir = path.resolve('screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  // 1. Setup local mock API & static server on port 3334
  const app = express();
  app.use(express.json());

  const mockAdminUser = {
    id: 100,
    name: 'Carlos Admin',
    email: 'admin@comfortpro.com',
    role: 'Administrador',
    active: true,
    hourly_cost: 0
  };

  const mockOperatorUser = {
    id: 400,
    name: 'Lucas Operador',
    email: 'lucas.operador@comfortpro.com',
    role: 'Operador',
    active: true,
    sector_name: 'Corte',
    hourly_cost: 0
  };

  let currentUserToServe: any = mockAdminUser;

  const mockStages = [
    { id: 10, name: 'Corte', sector_name: 'Corte', sort_order: 1, active: 1, calculation_type: 'por_peca' },
    { id: 20, name: 'Costura', sector_name: 'Costura', sort_order: 2, active: 1, calculation_type: 'por_peca' }
  ];

  const mockOrders = [
    {
      id: 1121,
      order_number: 'TESTE FASE 2 - 01',
      client_name: 'Cliente Homologação',
      product_type: 'Dry Fit',
      print_type: 'DTF',
      quantity: 25,
      status: 'Em Produção',
      pcp_status: 'EM_PRODUCAO',
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: false, in_progress: true, quantidade_pedido: 25, quantidade_boa: 10 },
        { id: 20, name: 'Costura', finished: false, quantidade_pedido: 25, quantidade_boa: 0 }
      ],
      created_at: '2026-10-18T10:00:00Z',
      deadline: '2026-10-19T18:00:00Z',
      items: [{ item_key: 'Dry Fit | Preto | M', quantity: 25 }]
    },
    {
      id: 1122,
      order_number: 'TESTE FASE 2 - 02',
      client_name: 'Uniformes Esportivos',
      product_type: 'Dry Fit',
      print_type: 'Silk',
      quantity: 60,
      status: 'Entrada',
      pcp_status: 'AGUARDANDO LIBERAÇÃO',
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: false, quantidade_pedido: 60, quantidade_boa: 0 },
        { id: 20, name: 'Costura', finished: false, quantidade_pedido: 60, quantidade_boa: 0 }
      ],
      created_at: '2026-10-20T08:30:00Z',
      deadline: '2026-10-21T18:00:00Z',
      items: [{ item_key: 'Dry Fit | Azul | G', quantity: 60 }]
    },
    {
      id: 1125,
      order_number: 'TESTE BLOQUEADO',
      client_name: 'Confecções Retidas',
      product_type: 'Dry Fit',
      print_type: 'DTF',
      quantity: 35,
      status: 'Entrada',
      pcp_status: 'BLOQUEADO',
      pcp_is_blocked: true,
      required_stages: [10, 20],
      stages_status: [
        { id: 10, name: 'Corte', finished: false, quantidade_pedido: 35, quantidade_boa: 0 },
        { id: 20, name: 'Costura', finished: false, quantidade_pedido: 35, quantidade_boa: 0 }
      ],
      observations: 'Bloqueado por falta de insumo têxtil'
    }
  ];

  app.get('/api/users', (req, res) => {
    res.json([mockAdminUser, mockOperatorUser]);
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

  app.get('/api/executions/active/:userId', (req, res) => {
    res.json([
      {
        id: 991,
        order_id: 1121,
        order_number: 'TESTE FASE 2 - 01',
        client_name: 'Cliente Homologação',
        product_type: 'Dry Fit',
        print_type: 'DTF',
        stage_id: 10,
        stage_name: 'Corte',
        user_id: Number(req.params.userId),
        start_time: new Date(Date.now() - 1420 * 1000).toISOString(),
        total_time_seconds: 1420,
        current_session_seconds: 1420,
        status: 'Em andamento',
        is_paused: false,
        order_quantity: 25
      }
    ]);
  });

  app.get('/api/pcp-phase1/minha-fila', (req, res) => {
    res.json({
      fila: [
        {
          id: 1121,
          order_number: 'TESTE FASE 2 - 01',
          client_name: 'Cliente Homologação',
          product_type: 'Dry Fit',
          print_type: 'DTF',
          quantity: 25,
          current_stage_id: 10,
          current_stage_name: 'Corte',
          current_stage_status: 'EM_ANDAMENTO',
          urgencia: 'critica',
          posicao_fila: 1,
          justificativa: '1º na Fila • 🚨 Atrasado (19/10) • Prioridade ALTA',
          observations: 'Prioridade urgente homologação Fase 2'
        },
        {
          id: 1122,
          order_number: 'TESTE FASE 2 - 02',
          client_name: 'Uniformes Esportivos',
          product_type: 'Dry Fit',
          print_type: 'Silk',
          quantity: 60,
          current_stage_id: 10,
          current_stage_name: 'Corte',
          current_stage_status: 'LIBERADA',
          urgencia: 'alta',
          posicao_fila: 2,
          justificativa: '2º na Fila • ⚡ Vence hoje • Prioridade ALTA'
        }
      ],
      bloqueados: [
        {
          id: 1125,
          order_number: 'TESTE BLOQUEADO',
          client_name: 'Confecções Retidas',
          product_type: 'Dry Fit',
          quantity: 35,
          motivo_bloqueio: 'Falta de Tecido Preto Dry Fit',
          bloqueado_por: 'PCP Central',
          block_info: {
            motivo: 'Falta de Tecido Preto Dry Fit',
            observacao: 'Aguardando entrega do fornecedor prevista para 24/10'
          }
        }
      ],
      execucao_atual: {
        id: 991,
        order_id: 1121,
        order_number: 'TESTE FASE 2 - 01',
        client_name: 'Cliente Homologação',
        product_type: 'Dry Fit',
        print_type: 'DTF',
        stage_id: 10,
        stage_name: 'Corte',
        order_quantity: 25,
        total_time_seconds: 1420,
        current_session_seconds: 1420,
        status: 'Em andamento',
        is_paused: false
      },
      metricas: {
        pecas_pendentes_fila: 85,
        tarefas_em_andamento: 1,
        pecas_produzidas_hoje: 50,
        tempo_produtivo_hoje_segundos: 14400
      }
    });
  });

  // Serve static dist
  const distPath = path.resolve('dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = app.listen(3334, '127.0.0.1');
  console.log('Fase 2 Test web server running on http://127.0.0.1:3334');

  // 2. Launch Edge with CDP
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.resolve('temp_edge_screenshots_profile_fase2');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ]);

  try {
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch('http://127.0.0.1:9223/json/version');
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
    }

    if (!wsUrl) throw new Error('Could not connect to Edge CDP');

    const newPageRes = await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:3334', { method: 'PUT' });
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

    async function evaluate(expression: string) {
      return await send('Runtime.evaluate', { expression, awaitPromise: true });
    }

    // Set auth session
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
        user_metadata: { name: 'Carlos Admin' }
      }
    };

    await send('Page.navigate', { url: 'http://127.0.0.1:3334' });
    await new Promise(r => setTimeout(r, 1200));

    const sessionStr = JSON.stringify(mockAuthSession);
    await evaluate(`
      localStorage.setItem('sb-dummy-auth-token', '${sessionStr}');
      localStorage.setItem('sb-dkyvzxmocppbydtpsgyu-auth-token', '${sessionStr}');
      localStorage.setItem('supabase.auth.token', '${sessionStr}');
    `);

    async function capture(fileName: string, width: number, height: number, urlPath: string, setupAction?: string) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600
      });

      await send('Page.navigate', { url: `http://127.0.0.1:3334${urlPath}` });
      await new Promise(r => setTimeout(r, 2000));

      if (setupAction) {
        await evaluate(setupAction);
        await new Promise(r => setTimeout(r, 500));
      }

      const { data: base64 } = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.resolve('screenshots', fileName);
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      console.log(`[Screenshot OK] ${fileName} (${width}x${height}) -> ${filePath}`);
    }

    // 1. Minha Fila - Desktop (1440x900)
    await capture('fase2_01_minha_fila_desktop.png', 1440, 900, '/minha-fila');

    // 2. Minha Fila - Mobile (390x844 - iPhone / Smartphone)
    await capture('fase2_02_minha_fila_celular.png', 390, 844, '/minha-fila');

    // 3. Menu lateral com Minha Fila ativo
    await capture('fase2_03_sidebar_minha_fila.png', 1440, 900, '/minha-fila');

    console.log('All Fase 2 screenshots captured successfully!');
    ws.close();
  } finally {
    proc.kill();
    server.close();
  }
}

main().catch(err => {
  console.error('[Error capturing Fase 2 screenshots]', err);
  process.exit(1);
});
