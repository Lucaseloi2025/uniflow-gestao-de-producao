import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Supabase Client ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith("http")) {
  console.error(
    "❌ SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidos no arquivo .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log("✅ Supabase client initialized.");

// ─── File Upload ──────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ─── Helper: check Supabase error ────────────────────────────────────────────
function checkError(error: any, res: express.Response, msg = "Erro interno") {
  if (error) {
    console.error(msg, error);
    res.status(500).json({ error: error.message || msg });
    return true;
  }
  return false;
}

// ─── Server ───────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  app.use(express.json());

  // ── Supabase status (health check) ────────────────────────────────────────
  app.get("/api/supabase/status", async (_req, res) => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name")
      .limit(1);
    if (error)
      return res.status(500).json({
        status: "error",
        message: error.message,
        hint: "Verifique se a tabela 'users' existe no Supabase.",
      });
    return res.json({ status: "success", message: "Supabase SDK funcionando!", sample_data: data });
  });

  // ── Dashboard Stats ───────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", async (req, res) => {
    const { startDate, endDate, product_type, print_type } = req.query;
    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_product_type: product_type || null,
      p_print_type: print_type || null,
    });
    if (checkError(error, res, "Erro no dashboard")) return;
    return res.json(data);
  });

  // ── Reports ───────────────────────────────────────────────────────────────
  app.get("/api/reports", async (req, res) => {
    const { period, user_id, stage_id } = req.query;
    const { data, error } = await supabase.rpc("get_reports", {
      p_period: period || "day",
      p_user_id: user_id ? Number(user_id) : null,
      p_stage_id: stage_id ? Number(stage_id) : null,
    });
    if (checkError(error, res, "Erro nos relatórios")) return;
    return res.json(data);
  });

  // ── Order Templates ───────────────────────────────────────────────────────
  app.get("/api/order-templates", async (_req, res) => {
    const { data, error } = await supabase
      .from("order_templates")
      .select("*");
    if (checkError(error, res)) return;
    return res.json(data);
  });

  // ── Orders ────────────────────────────────────────────────────────────────
  app.get("/api/orders", async (req, res) => {
    const { search, stage_id, stage_status } = req.query;
    const { data, error } = await supabase.rpc("get_orders_with_stages", {
      p_search: search || null,
      p_stage_id: stage_id ? Number(stage_id) : null,
      p_stage_status: stage_status || null,
    });
    if (checkError(error, res, "Erro ao buscar pedidos")) return;
    return res.json(data);
  });

  app.post("/api/orders", upload.single("art_file"), async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations } = req.body;
    const order_number = `PED-${Date.now().toString().slice(-6)}`;
    const art_url = (req as any).file ? `/uploads/${(req as any).file.filename}` : null;

    // Estimate time from historical avg
    const { data: estimateData } = await supabase
      .from("orders")
      .select("total_time_seconds")
      .eq("product_type", product_type)
      .eq("print_type", print_type)
      .eq("status", "Entregue");

    const totalSeconds = estimateData?.reduce(
      (sum: number, r: any) => sum + (r.total_time_seconds || 0), 0
    ) ?? 0;
    const estimated_time = estimateData && estimateData.length > 0
      ? Math.round(totalSeconds / estimateData.length)
      : 3600;

    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_number,
        client_name: client_name || "Cliente Avulso",
        product_type,
        print_type,
        quantity: Number(quantity),
        deadline,
        observations,
        estimated_time_seconds: estimated_time,
        art_url,
      })
      .select("id")
      .single();

    if (checkError(error, res, "Erro ao criar pedido")) return;
    return res.json({ id: data.id, order_number, art_url });
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  app.patch("/api/orders/:id", async (req, res) => {
    const { deadline } = req.body;
    const { error } = await supabase
      .from("orders")
      .update({ deadline })
      .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  // ── Stages ────────────────────────────────────────────────────────────────
  app.get("/api/stages", async (_req, res) => {
    const { data, error } = await supabase
      .from("stages")
      .select("*")
      .eq("active", 1)
      .order("sort_order");
    if (checkError(error, res)) return;
    return res.json(data);
  });

  app.post("/api/stages", async (req, res) => {
    const { name } = req.body;
    const { data: maxData } = await supabase
      .from("stages")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    const sort_order = (maxData?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from("stages")
      .insert({ name, sort_order })
      .select()
      .single();
    if (checkError(error, res)) return;
    return res.json(data);
  });

  app.patch("/api/stages/:id", async (req, res) => {
    const { name, active, sort_order } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { error } = await supabase
      .from("stages")
      .update(updates)
      .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  app.delete("/api/stages/:id", async (req, res) => {
    const { error } = await supabase
      .from("stages")
      .update({ active: 0 })
      .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  // ── Executions ────────────────────────────────────────────────────────────
  app.get("/api/orders/:id/executions", async (req, res) => {
    const { data, error } = await supabase
      .from("stage_executions")
      .select(`
        *,
        stages ( name ),
        users ( name )
      `)
      .eq("order_id", Number(req.params.id));
    if (checkError(error, res)) return;
    const formatted = (data || []).map((e: any) => ({
      ...e,
      stage_name: e.stages?.name,
      user_name: e.users?.name,
      stages: undefined,
      users: undefined,
    }));
    return res.json(formatted);
  });

  app.post("/api/executions/start", async (req, res) => {
    const { order_id, stage_id, user_id } = req.body;

    // Check for active execution on same stage/order
    const { data: existing } = await supabase
      .from("stage_executions")
      .select("id")
      .eq("order_id", Number(order_id))
      .eq("stage_id", Number(stage_id))
      .eq("status", "Em andamento")
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Esta etapa já está sendo executada." });
    }

    const { data, error } = await supabase
      .from("stage_executions")
      .insert({
        order_id: Number(order_id),
        stage_id: Number(stage_id),
        user_id: Number(user_id),
        status: "Em andamento",
      })
      .select("id")
      .single();
    if (checkError(error, res)) return;
    return res.json({ id: data.id });
  });

  app.post("/api/executions/:id/pause", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { error: e1 } = await supabase
      .from("stage_executions")
      .update({ status: "Pausado" })
      .eq("id", execution_id);
    if (checkError(e1, res)) return;

    const { error: e2 } = await supabase
      .from("pauses")
      .insert({ execution_id });
    if (checkError(e2, res)) return;
    return res.json({ success: true });
  });

  app.post("/api/executions/:id/resume", async (req, res) => {
    const execution_id = Number(req.params.id);
    const now = new Date().toISOString();

    // Close open pause
    const { data: lastPauseData } = await supabase
      .from("pauses")
      .select("id, start_pause")
      .eq("execution_id", execution_id)
      .is("end_pause", null)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (lastPauseData) {
      const duration = Math.floor(
        (new Date().getTime() - new Date(lastPauseData.start_pause).getTime()) / 1000
      );
      await supabase
        .from("pauses")
        .update({ end_pause: now, duration_seconds: duration })
        .eq("id", lastPauseData.id);
    }

    const { error } = await supabase
      .from("stage_executions")
      .update({ status: "Em andamento" })
      .eq("id", execution_id);
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  app.post("/api/executions/:id/finish", async (req, res) => {
    const execution_id = Number(req.params.id);
    const now = new Date().toISOString();

    // Get execution
    const { data: execution } = await supabase
      .from("stage_executions")
      .select("*, stages(name)")
      .eq("id", execution_id)
      .single();

    if (!execution) return res.status(404).json({ error: "Execução não encontrada." });

    // Close open pause
    const { data: lastPauseData } = await supabase
      .from("pauses")
      .select("id, start_pause")
      .eq("execution_id", execution_id)
      .is("end_pause", null)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (lastPauseData) {
      const duration = Math.floor(
        (new Date().getTime() - new Date(lastPauseData.start_pause).getTime()) / 1000
      );
      await supabase
        .from("pauses")
        .update({ end_pause: now, duration_seconds: duration })
        .eq("id", lastPauseData.id);
    }

    // Calculate total pause time
    const { data: pausesData } = await supabase
      .from("pauses")
      .select("duration_seconds")
      .eq("execution_id", execution_id);
    const totalPauseSeconds = (pausesData || []).reduce(
      (sum: number, p: any) => sum + (p.duration_seconds || 0), 0
    );

    const totalExecutionSeconds = Math.floor(
      (new Date().getTime() - new Date(execution.start_time).getTime()) / 1000
    ) - totalPauseSeconds;

    // Finish execution
    await supabase
      .from("stage_executions")
      .update({ end_time: now, total_time_seconds: totalExecutionSeconds, status: "Finalizado" })
      .eq("id", execution_id);

    // Update order total time
    const { data: allExecs } = await supabase
      .from("stage_executions")
      .select("total_time_seconds")
      .eq("order_id", execution.order_id);
    const totalOrderTime = (allExecs || []).reduce(
      (sum: number, e: any) => sum + (e.total_time_seconds || 0), 0
    );
    await supabase
      .from("orders")
      .update({ total_time_seconds: totalOrderTime })
      .eq("id", execution.order_id);

    // Workflow automation
    if (execution.stages?.name === "Aguardando ficha de aprovação") {
      await supabase
        .from("orders")
        .update({ status: "Em Produção" })
        .eq("id", execution.order_id)
        .eq("status", "Entrada");
    }

    return res.json({ success: true });
  });

  // ── Production Config ─────────────────────────────────────────────────────
  app.get("/api/config/producao", async (_req, res) => {
    const { data, error } = await supabase
      .from("config_producao")
      .select("*")
      .limit(1)
      .single();
    if (checkError(error, res)) return;
    return res.json(data);
  });

  app.patch("/api/config/producao", async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes } = req.body;
    const { error } = await supabase
      .from("config_producao")
      .update({ jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes })
      .eq("id", 1);
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  app.get("/api/users", async (req, res) => {
    const { search } = req.query;
    let query = supabase
      .from("users")
      .select("id, name, email, role, hourly_cost, active");

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
  });

  app.post("/api/users", async (req, res) => {
    const { name, email, password, role, hourly_cost } = req.body;
    const { data, error } = await supabase
      .from("users")
      .insert({ name, email, password: password || "123456", role, hourly_cost: hourly_cost || 0 })
      .select("id")
      .single();
    if (checkError(error, res)) return;
    return res.json({ id: data.id });
  });

  app.patch("/api/users/:id", async (req, res) => {
    const { name, email, role, hourly_cost, active } = req.body;
    const { error } = await supabase
      .from("users")
      .update({ name, email, role, hourly_cost, active: active ? 1 : 0 })
      .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
  });

  // ── Clients ───────────────────────────────────────────────────────────────
  app.get("/api/clients", async (req, res) => {
    const { search } = req.query;
    let query = supabase.from("clients").select("*").order("name");
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
  });

  app.post("/api/clients", async (req, res) => {
    const { name, phone, email } = req.body;
    const { data, error } = await supabase
      .from("clients")
      .insert({ name, phone, email })
      .select("id")
      .single();
    if (checkError(error, res)) return;
    return res.json({ id: data.id });
  });

  // ── 404 for API routes ────────────────────────────────────────────────────
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────
  app.use("/uploads", express.static(uploadsDir));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
