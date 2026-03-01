import express from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith("http")) {
    console.warn("⚠️ SUPABASE_URL ou SUPABASE_ANON_KEY não estão definidos. Configure as Environment Variables no Vercel.");
}

const supabase = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder"
);

const supabaseAdmin = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseServiceRoleKey || supabaseAnonKey // Fallback to anon key if not provided (will fail on restricted actions)
);

// Utilizando memória ao invés de disco local
const storage = multer.memoryStorage();
const upload = multer({ storage });

function checkError(error: any, res: express.Response, msg = "Erro interno") {
    if (error) {
        console.error(`[INTERNAL ERROR] ${msg}:`, error);
        // Avoid exposing raw database errors to the client
        res.status(500).json({ error: msg });
        return true;
    }
    return false;
}

const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." });
    }
    next();
};

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

app.post("/api/order-templates", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { data, error } = await supabase
        .from("order_templates")
        .insert({
            name,
            product_type,
            print_type,
            quantity: Number(quantity) || 0,
            observations,
            required_stages: required_stages || []
        })
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { name, product_type, print_type, quantity, observations, required_stages } = req.body;
    const { error } = await supabase
        .from("order_templates")
        .update({
            name,
            product_type,
            print_type,
            quantity: quantity !== undefined ? Number(quantity) : undefined,
            observations,
            required_stages
        })
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

app.delete("/api/order-templates/:id", isAdmin, async (req, res) => {
    const { error } = await supabase
        .from("order_templates")
        .delete()
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
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

app.post("/api/orders", upload.array("art_files", 10), async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages } = req.body;
    const order_number = `PED-${Date.now().toString().slice(-6)}`;
    const art_urls: string[] = [];

    const files = (req as any).files;
    console.log(`[API] Criando pedido. Arquivos recebidos: ${files?.length || 0}`);
    if (files && Array.isArray(files)) {
        for (const file of files) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `pedidos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('artes')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                });

            if (uploadError) {
                console.error("Erro no upload da arte para o Supabase:", uploadError);
                continue; // Skip failed uploads
            }

            const { data: publicUrlData } = supabase.storage.from('artes').getPublicUrl(filePath);
            art_urls.push(publicUrlData.publicUrl);
        }
    }

    // 2. Estimate time
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

    // 3. Create order
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
            art_url: art_urls[0] || null, // Primary image
            art_urls: art_urls, // All images
            required_stages: required_stages ? (typeof required_stages === 'string' ? JSON.parse(required_stages) : required_stages) : [],
        })
        .select("id")
        .single();

    if (checkError(error, res, "Erro ao criar pedido")) return;
    console.log(`[API] Pedido criado: ${order_number}. Imagens: ${art_urls.length}`);
    return res.json({ id: data.id, order_number, art_url: art_urls[0] || null, art_urls });
});

app.post("/api/orders/:id/images", upload.array("art_files", 10), async (req, res) => {
    const { id } = req.params;
    const files = (req as any).files;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // 1. Get current order images
    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("art_urls, art_url")
        .eq("id", Number(id))
        .single();

    if (fetchError || !order) {
        return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const current_urls = order.art_urls || [];
    const new_urls: string[] = [];

    // 2. Upload new files
    for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pedidos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('artes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
            });

        if (uploadError) {
            console.error("Erro no upload da arte para o Supabase:", uploadError);
            continue;
        }

        const { data: publicUrlData } = supabase.storage.from('artes').getPublicUrl(filePath);
        new_urls.push(publicUrlData.publicUrl);
    }

    const updated_urls = [...current_urls, ...new_urls];

    // 3. Update order
    const { error: updateError } = await supabase
        .from("orders")
        .update({
            art_urls: updated_urls,
            art_url: order.art_url || updated_urls[0] // Set primary if missing
        })
        .eq("id", Number(id));

    if (checkError(updateError, res, "Erro ao atualizar imagens do pedido")) return;

    return res.json({ success: true, art_urls: updated_urls });
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

app.patch("/api/orders/:id", isAdmin, async (req, res) => {
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

app.get("/api/executions/active/:userId", async (req, res) => {
    const { data, error } = await supabase
        .from("stage_executions")
        .select(`
            *,
            stages ( name ),
            orders ( order_number )
        `)
        .eq("user_id", Number(req.params.userId))
        .eq("status", "Em andamento")
        .order("start_time", { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is 'No rows found'
        return res.status(500).json({ error: error.message });
    }

    if (!data) return res.json(null);

    // Calculate total pause time so far
    const { data: pauses } = await supabase
        .from("pauses")
        .select("duration_seconds, start_pause, end_pause")
        .eq("execution_id", data.id);

    const accumulatedPauseSeconds = (pauses || []).reduce((sum, p) => {
        if (p.duration_seconds !== null) return sum + p.duration_seconds;
        // If there's an active pause, we don't count it in the "running" clock 
        // because the clock only runs when NOT paused. 
        // But the frontend needs to know if it's currently paused.
        return sum;
    }, 0);

    const is_paused = (pauses || []).some(p => p.end_pause === null);

    const formatted = {
        ...data,
        stage_name: data.stages?.name,
        order_number: data.orders?.order_number,
        accumulated_pause_seconds: accumulatedPauseSeconds,
        is_paused: is_paused,
        stages: undefined,
        orders: undefined,
    };
    return res.json(formatted);
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

    // Fetch all pauses for these executions to calculate accumulated time
    const executionIds = (data || []).map(e => e.id);
    const { data: pauses } = executionIds.length > 0
        ? await supabase.from("pauses").select("*").in("execution_id", executionIds)
        : { data: [] };

    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const accumulatedPauseSeconds = itemPauses.reduce((sum, p) => sum + (p.duration_seconds || 0), 0);
        const is_paused = itemPauses.some(p => p.end_pause === null);

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            accumulated_pause_seconds: accumulatedPauseSeconds,
            is_paused: is_paused,
            stages: undefined,
            users: undefined,
        };
    });
    return res.json(formatted);
});

app.post("/api/executions/start", async (req, res) => {
    const { order_id, stage_id, user_id } = req.body;

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
    // Note: Pause should check if it's the owner or Admin, but keeping it simple for now
    // as per current implementation context.
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

    const { data: execution } = await supabase
        .from("stage_executions")
        .select("*, stages(name)")
        .eq("id", execution_id)
        .single();

    if (!execution) return res.status(404).json({ error: "Execução não encontrada." });

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

    await supabase
        .from("stage_executions")
        .update({ end_time: now, total_time_seconds: totalExecutionSeconds, status: "Finalizado" })
        .eq("id", execution_id);

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

app.patch("/api/config/producao", isAdmin, async (req, res) => {
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
            `name.ilike.% ${search} %, email.ilike.% ${search} % `
        );
    }

    const { data, error } = await query;
    if (checkError(error, res)) return;
    return res.json(data);
});

app.post("/api/users", isAdmin, async (req, res) => {
    const { name, email, password, role, hourly_cost } = req.body;

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "Variável SUPABASE_SERVICE_ROLE_KEY não configurada no backend." });
    }

    // 1. Criar o usuário no Supabase Auth primeiro
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || "123456",
        email_confirm: true, // Ignorar verificação de email forçadamente
        user_metadata: { name }
    });

    if (authError) {
        console.error("Erro ao criar usuário no Supabase Auth:", authError);
        return res.status(400).json({ error: authError.message });
    }

    // 2. Inserir os dados na tabela pública 'users'
    const { data, error } = await supabaseAdmin
        .from("users")
        .insert({
            name,
            email,
            password: "-", // A senha verdadeira fica apenas no Auth por segurança
            role,
            hourly_cost: hourly_cost || 0,
            active: 1
        })
        .select("id")
        .single();

    if (error) {
        // Se falhou a inserção na tabela pública, desfazemos a criação no Auth
        if (authData?.user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        }
        return checkError(error, res, "Erro ao criar perfil de usuário na tabela.") ? undefined : undefined;
    }

    return res.json({ id: data.id });
});

app.patch("/api/users/:id", isAdmin, async (req, res) => {
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
        query = query.or(`name.ilike.% ${search} %, email.ilike.% ${search} % `);
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

export default app;
