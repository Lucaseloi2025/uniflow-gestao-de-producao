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

const isAdminOrComercial = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Admin' && role !== 'Comercial') {
        return res.status(403).json({ error: "Acesso negado. Ação permitida apenas para Administração ou Comercial." });
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
    const { data, error } = await supabase.rpc("get_dashboard_stats_v2", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_product_type: product_type || null,
        p_print_type: print_type || null,
    });
    if (checkError(error, res, "Erro no dashboard")) return;
    return res.json(data);
});

// ── Production Config & Goals ─────────────────────────────────────────────
app.get("/api/config", async (_req, res) => {
    const { data, error } = await supabase.from("config_producao").select("*").single();
    if (checkError(error, res)) return;
    return res.json(data);
});

app.patch("/api/config", isAdmin, async (req, res) => {
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas, meta_custo_por_peca, auto_pause_time_weekday, auto_pause_time_friday, auto_pause_time_lunch } = req.body;
    const updates: any = {};
    if (jornada_horas !== undefined) updates.jornada_horas = jornada_horas;
    if (operadores_ativos !== undefined) updates.operadores_ativos = operadores_ativos;
    if (eficiencia_percentual !== undefined) updates.eficiencia_percentual = eficiencia_percentual;
    if (dias_uteis_mes !== undefined) updates.dias_uteis_mes = dias_uteis_mes;
    if (meta_diaria_pedidos !== undefined) updates.meta_diaria_pedidos = meta_diaria_pedidos;
    if (meta_diaria_pecas !== undefined) updates.meta_diaria_pecas = meta_diaria_pecas;
    if (meta_custo_por_peca !== undefined) updates.meta_custo_por_peca = meta_custo_por_peca;
    if (auto_pause_time_weekday !== undefined) updates.auto_pause_time_weekday = auto_pause_time_weekday;
    if (auto_pause_time_friday !== undefined) updates.auto_pause_time_friday = auto_pause_time_friday;
    if (auto_pause_time_lunch !== undefined) updates.auto_pause_time_lunch = auto_pause_time_lunch;
    const { data, error } = await supabase
        .from("config_producao")
        .update(updates)
        .eq("id", 1)
        .select()
        .single();
    if (checkError(error, res)) return;
    return res.json(data);
});

// ── Reports ───────────────────────────────────────────────────────────────
app.get("/api/reports", async (req, res) => {
    const { period, user_id, stage_id, startDate, endDate } = req.query;
    const { data, error } = await supabase.rpc("get_reports", {
        p_period: period || "day",
        p_user_id: user_id ? Number(user_id) : null,
        p_stage_id: stage_id ? Number(stage_id) : null,
        p_start_date: startDate || null,
        p_end_date: endDate || null
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

// ── Delivery Forecast ─────────────────────────────────────────────────────
app.get("/api/orders/delivery-forecast", async (_req, res) => {
    try {
        // 1. Active orders (not delivered, not cancelled, not deleted)
        const { data: rawOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("id, order_number, client_name, quantity, deadline, status, required_stages, print_type, product_type, created_at")
            .is("deleted_at", null)
            .not("status", "in", '("Entregue","Cancelado")')
            .order("deadline", { ascending: true });

        if (ordersErr) throw ordersErr;
        if (!rawOrders || rawOrders.length === 0) return res.json([]);

        // 2. All stages sorted
        const { data: allStages, error: stagesErr } = await supabase
            .from("stages")
            .select("id, name, sort_order")
            .eq("active", 1)
            .order("sort_order", { ascending: true });

        if (stagesErr) throw stagesErr;

        // 3. Capacity config
        const { data: configRows } = await supabase
            .from("config_producao")
            .select("jornada_horas, operadores_ativos, eficiencia_percentual")
            .limit(1);

        const config = configRows?.[0] || { jornada_horas: 8, operadores_ativos: 2, eficiencia_percentual: 0.85 };
        // Minutes available per day per sector (shared pool)
        const dailyCapacityMinutes = config.jornada_horas * 60 * config.operadores_ativos * config.eficiencia_percentual;

        // 4. Avg seconds per piece per stage (last 30 days, fallback all-time)
        let recentAvg: any[] | null = null;
        let allTimeAvg: any[] | null = null;
        try {
            const { data: r30 } = await supabase.rpc("get_stage_avg_times", { p_days: 30 });
            recentAvg = r30;
        } catch (_) { /* no data yet */ }
        try {
            const { data: rAll } = await supabase.rpc("get_stage_avg_times", { p_days: 3650 });
            allTimeAvg = rAll;
        } catch (_) { /* no data yet */ }

        // Build lookup: stageId → avgSecPerPiece
        const avgByStage: Record<number, number> = {};

        // Default fallback per print_type (seconds per piece)
        const printDefaults: Record<string, number> = {
            "Silk": 5 * 60,        // 5 min
            "DTF": 4 * 60,         // 4 min
            "Sublimação": 3 * 60,  // 3 min
        };
        const stageDefaults: Record<string, number> = {
            "Ficha de aprovação": 1.5 * 60,
            "Separação / Corte": 2 * 60,
            "Revelação de Tela": 2 * 60,
            "Silk": 5 * 60,
            "DTF": 4 * 60,
            "Sublimação": 3 * 60,
            "Costura": 2.5 * 60,
            "Conferência": 1 * 60,
            "Embalagem": 0.5 * 60,
        };

        for (const stage of (allStages || [])) {
            // Try recent avg first
            const recent = (recentAvg as any[])?.find((r: any) => r.stage_id === stage.id);
            if (recent?.avg_sec_per_piece > 0) {
                avgByStage[stage.id] = recent.avg_sec_per_piece;
                continue;
            }
            // Then all-time
            const atAll = (allTimeAvg as any[])?.find((r: any) => r.stage_id === stage.id);
            if (atAll?.avg_sec_per_piece > 0) {
                avgByStage[stage.id] = atAll.avg_sec_per_piece;
                continue;
            }
            // Default by stage name
            avgByStage[stage.id] = stageDefaults[stage.name] ?? 2 * 60;
        }

        // 5. Simulate queue — orders already sorted by deadline (most urgent first)
        // sectorAvailableAt: when can a sector next accept work (in ms)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sectorAvailableAt: Record<number, number> = {};
        for (const stage of (allStages || [])) {
            sectorAvailableAt[stage.id] = now.getTime();
        }

        const helper = {
            addWorkingDays: (startMs: number, days: number): number => {
                // Simple approximation: 5/7 of days are working days
                // Use calendar days = workingDays / (5/7) = workingDays * 1.4
                const calendarMs = days * 1.4 * 24 * 60 * 60 * 1000;
                return startMs + calendarMs;
            }
        };

        const forecasts: any[] = [];

        for (const order of (rawOrders || [])) {
            // Determine which stages this order needs
            let orderStageIds: number[] = [];
            if (order.required_stages && order.required_stages.length > 0) {
                orderStageIds = order.required_stages;
            } else {
                orderStageIds = (allStages || []).map((s: any) => s.id);
            }

            // Sort by sort_order
            const orderStages = (allStages || [])
                .filter((s: any) => orderStageIds.includes(s.id))
                .sort((a: any, b: any) => a.sort_order - b.sort_order);

            let prevStageEndMs = now.getTime();
            const stageForecastDetails: any[] = [];
            let bottleneckStage: string | null = null;
            let maxQueueDays = -1;

            for (const stage of orderStages) {
                const avgSecPerPiece = avgByStage[stage.id] ?? 2 * 60;
                const totalMinutes = (order.quantity * avgSecPerPiece) / 60;
                const execDays = totalMinutes / dailyCapacityMinutes; // working days

                const sectorAvail = sectorAvailableAt[stage.id] ?? now.getTime();
                const startMs = Math.max(prevStageEndMs, sectorAvail);

                const queueDays = Math.max(0, (sectorAvail - now.getTime()) / (24 * 60 * 60 * 1000) / 1.4);
                const endMs = helper.addWorkingDays(startMs, execDays);

                // Update sector availability
                sectorAvailableAt[stage.id] = endMs;
                prevStageEndMs = endMs;

                stageForecastDetails.push({
                    stageId: stage.id,
                    stageName: stage.name,
                    startDate: new Date(startMs).toISOString().split("T")[0],
                    endDate: new Date(endMs).toISOString().split("T")[0],
                    queueDays: Math.round(queueDays * 10) / 10,
                    execDays: Math.round(execDays * 10) / 10,
                });

                const totalDelay = queueDays + execDays;
                if (totalDelay > maxQueueDays) {
                    maxQueueDays = totalDelay;
                    bottleneckStage = stage.name;
                }
            }

            const predictedDate = new Date(prevStageEndMs);
            const deadline = new Date(order.deadline);
            deadline.setHours(23, 59, 59, 0);

            const deadlineDaysFromNow = Math.max(1, (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            const predictedDaysFromNow = Math.max(0, (predictedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

            const riskIndex = predictedDaysFromNow / deadlineDaysFromNow;
            const riskLevel = riskIndex <= 0.8 ? "safe" : riskIndex <= 1.0 ? "warning" : "danger";

            forecasts.push({
                orderId: order.id,
                orderNumber: order.order_number,
                clientName: order.client_name,
                quantity: order.quantity,
                printType: order.print_type,
                productType: order.product_type,
                deadline: order.deadline,
                predictedDate: predictedDate.toISOString().split("T")[0],
                riskIndex: Math.round(riskIndex * 100) / 100,
                riskLevel,
                bottleneckStage,
                stageForecasts: stageForecastDetails,
            });
        }

        // Sort by risk descending (highest risk first)
        forecasts.sort((a, b) => b.riskIndex - a.riskIndex);
        return res.json(forecasts);

    } catch (err: any) {
        console.error("[Forecast] Error:", err);
        return res.status(500).json({ error: "Erro no cálculo de previsão" });
    }
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

    if (data && data.length > 0) {
        const orderIds = data.map((o: any) => o.id);
        const { data: executions } = await supabase
            .from("stage_executions")
            .select("order_id, users(name)")
            .in("order_id", orderIds)
            .in("status", ["Em andamento"]);

        const operatorMap = new Map();
        if (executions) {
            executions.forEach((ex: any) => {
                operatorMap.set(ex.order_id, ex.users?.name || null);
            });
        }

        data.forEach((order: any) => {
            order.current_operator = operatorMap.get(order.id) || null;
        });
    }

    return res.json(data);
});

app.post("/api/orders", upload.array("art_files", 10), async (req, res) => {
    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors } = req.body;
    const order_number = `PED-${Date.now().toString().slice(-6)}`;
    const art_urls: string[] = [];

    const files = (req as any).files;
    const uploadErrors: string[] = [];
    console.log(`[API] Criando pedido. Arquivos recebidos: ${files?.length || 0}`);
    if (files && Array.isArray(files)) {
        for (const file of files) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `pedidos/${fileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from('artes')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
                uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
                continue;
            }

            const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
            art_urls.push(publicUrlData.publicUrl);
        }
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
    }

    // 2. Estimate time
    const { data: estimateData } = await supabase
        .from("orders")
        .select("total_time_seconds")
        .eq("product_type", product_type)
        .eq("print_type", print_type)
        .eq("num_colors", Number(num_colors) || 1)
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
            num_colors: Number(num_colors) || 1,
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

// Soft delete — mantém histórico de execuções intacto
app.delete("/api/orders/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

    // 1. Fetch current order before soft-deleting
    const { data: order, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", Number(id))
        .single();

    if (fetchErr || !order) return res.status(404).json({ error: "Pedido não encontrado" });
    if (order.deleted_at) return res.status(400).json({ error: "Pedido já foi excluído" });

    // 2. Soft delete — only update deleted_at and deleted_by
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ deleted_at: now, deleted_by: usuario })
        .eq("id", Number(id));

    if (checkError(updateErr, res, "Erro ao excluir pedido")) return;

    // 3. Log to order_history
    await supabaseAdmin.from("order_history").insert({
        order_id: Number(id),
        usuario,
        acao: "excluiu",
        antes: order,
        depois: null,
    });

    console.log(`[API] Pedido ${id} marcado como excluído (soft delete) por ${usuario}`);
    return res.json({ success: true });
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
    const uploadErrors: string[] = [];
    for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pedidos/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('artes')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) {
            console.error(`[API] Erro no upload da arte (${file.originalname}):`, uploadError);
            uploadErrors.push(`${file.originalname}: ${uploadError.message}`);
            continue;
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from('artes').getPublicUrl(filePath);
        new_urls.push(publicUrlData.publicUrl);
    }

    if (uploadErrors.length > 0) {
        return res.status(400).json({ 
            error: "Falha no upload de alguns arquivos", 
            details: uploadErrors 
        });
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
    const updates: any = { status };
    if (status === 'Entregue') {
        updates.delivered_at = new Date().toISOString();
    } else {
        updates.delivered_at = null;
    }
    const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", Number(req.params.id));
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// Full order edit with validation and audit log
app.patch("/api/orders/:id", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";
    const confirmFinalized = req.headers["x-confirm-finalized"] === "true";

    const { client_name, product_type, print_type, quantity, deadline, observations, required_stages, num_colors, art_urls, art_url } = req.body;

    // ── Validations ──────────────────────────────────────────────────────────
    if (quantity !== undefined && Number(quantity) <= 0) {
        return res.status(400).json({ error: "Quantidade deve ser maior que zero" });
    }
    if (num_colors !== undefined && Number(num_colors) < 1) {
        return res.status(400).json({ error: "Número de cores deve ser pelo menos 1" });
    }

    // 1. Fetch current order for audit log + finalized check
    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Não é possível editar um pedido excluído" });
    if (currentOrder.status === "Entregue" && !confirmFinalized) {
        return res.status(409).json({ error: "CONFIRM_FINALIZED", message: "Este pedido já foi entregue. Deseja mesmo editá-lo?" });
    }

    // 2. Build update payload with only provided fields
    const updates: any = {};
    if (client_name !== undefined) updates.client_name = client_name;
    if (product_type !== undefined) updates.product_type = product_type;
    if (print_type !== undefined) updates.print_type = print_type;
    if (quantity !== undefined) updates.quantity = Number(quantity);
    if (deadline !== undefined) updates.deadline = deadline || null;
    if (observations !== undefined) updates.observations = observations;
    if (required_stages !== undefined) updates.required_stages = required_stages;
    if (num_colors !== undefined) updates.num_colors = Number(num_colors);
    if (art_urls !== undefined) updates.art_urls = art_urls;
    if (art_url !== undefined) updates.art_url = art_url;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    // 3. Perform update
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update(updates)
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao atualizar pedido")) return;

    // 4. Log to order_history
    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "editou",
        antes: currentOrder,
        depois: { ...currentOrder, ...updates },
    });

    return res.json({ success: true });
});

// Cancel order — keeps history, removes from capacity calculations
app.patch("/api/orders/:id/cancel", isAdminOrComercial, async (req, res) => {
    const orderId = Number(req.params.id);
    const usuario = (req.headers["x-user-name"] as string) || "Admin";

    const { data: currentOrder, error: fetchErr } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (fetchErr || !currentOrder) return res.status(404).json({ error: "Pedido não encontrado" });
    if (currentOrder.deleted_at) return res.status(400).json({ error: "Pedido excluído não pode ser cancelado" });
    if (currentOrder.status === "Cancelado") return res.status(400).json({ error: "Pedido já está cancelado" });

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ status: "Cancelado", cancelled_at: now, cancelled_by: usuario })
        .eq("id", orderId);

    if (checkError(updateErr, res, "Erro ao cancelar pedido")) return;

    await supabaseAdmin.from("order_history").insert({
        order_id: orderId,
        usuario,
        acao: "cancelou",
        antes: currentOrder,
        depois: { ...currentOrder, status: "Cancelado", cancelled_at: now, cancelled_by: usuario },
    });

    return res.json({ success: true });
});

// Order history / audit log
app.get("/api/orders/:id/history", isAdminOrComercial, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("order_history")
        .select("*")
        .eq("order_id", Number(req.params.id))
        .order("created_at", { ascending: false });
    if (checkError(error, res, "Erro ao buscar histórico")) return;
    return res.json(data || []);
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

    const is_paused = (pauses || []).some(p => p.end_pause === null);

    const accumulatedPauseSeconds = (pauses || []).reduce((sum, p) => {
        if (p.duration_seconds !== null) return sum + p.duration_seconds;
        if (p.end_pause === null) {
            const pauseStart = new Date(p.start_pause).getTime();
            const now = new Date().getTime();
            return sum + Math.max(0, Math.floor((now - pauseStart) / 1000));
        }
        return sum;
    }, 0);

    const nowMs = new Date().getTime();
    const startMs = new Date(data.start_time).getTime();
    const calculatedTotalSeconds = Math.max(0, Math.floor((nowMs - startMs - (accumulatedPauseSeconds * 1000)) / 1000));

    const formatted = {
        ...data,
        stage_name: data.stages?.name,
        order_number: data.orders?.order_number,
        accumulated_pause_seconds: accumulatedPauseSeconds,
        total_time_seconds: data.status === 'Finalizado' ? data.total_time_seconds : calculatedTotalSeconds,
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

    const nowMs = new Date().getTime();
    const formatted = (data || []).map((e: any) => {
        const itemPauses = (pauses || []).filter(p => p.execution_id === e.id);
        const accumulatedPauseSeconds = itemPauses.reduce((sum, p) => {
            if (p.duration_seconds !== null) return sum + p.duration_seconds;
            if (p.end_pause === null) {
                const pauseStart = new Date(p.start_pause).getTime();
                const now = new Date().getTime();
                return sum + Math.max(0, Math.floor((now - pauseStart) / 1000));
            }
            return sum;
        }, 0);
        const is_paused = itemPauses.some(p => p.end_pause === null);

        const startMs = new Date(e.start_time).getTime();
        const calculatedTotalSeconds = Math.max(0, Math.floor((nowMs - startMs - (accumulatedPauseSeconds * 1000)) / 1000));

        return {
            ...e,
            stage_name: e.stages?.name,
            user_name: e.users?.name,
            accumulated_pause_seconds: accumulatedPauseSeconds,
            total_time_seconds: e.status === 'Finalizado' ? e.total_time_seconds : calculatedTotalSeconds,
            is_paused: is_paused,
            stages: undefined,
            users: undefined,
        };
    });
    return res.json(formatted);
});

app.post("/api/executions/start", async (req, res) => {
    const { order_id, stage_id, user_id } = req.body;

    // Use supabaseAdmin to bypass RLS for internal logic
    const { data: existing, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("id")
        .eq("order_id", Number(order_id))
        .eq("stage_id", Number(stage_id))
        .eq("status", "Em andamento")
        .limit(1);

    if (e1) {
        return checkError(e1, res, "Erro ao verificar execuções existentes");
    }

    if (existing && existing.length > 0) {
        return res.status(400).json({ error: "Esta etapa já está sendo executada para este pedido." });
    }

    if (Number(user_id) === 0) {
        return res.status(400).json({ error: "Usuário não identificado. Por favor, saia e entre novamente." });
    }

    // ── AUTO-PAUSA: pausar qualquer tarefa ativa do mesmo usuário ──────────
    try {
        const { data: activeExecs } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("user_id", Number(user_id))
            .eq("status", "Em andamento");

        if (activeExecs && activeExecs.length > 0) {
            const now = new Date();
            for (const exec of activeExecs) {
                await supabaseAdmin
                    .from("stage_executions")
                    .update({ status: "Pausado" })
                    .eq("id", exec.id);
                await supabaseAdmin
                    .from("pauses")
                    .insert({ execution_id: exec.id, start_pause: now.toISOString() });
                console.log(`[API] Auto-pausa: execução ${exec.id} pausada para o usuário ${user_id} ao iniciar nova tarefa.`);
            }
        }
    } catch (autoPauseErr) {
        console.error("[API] Erro na auto-pausa:", autoPauseErr);
        // Não bloquear o início da tarefa se o auto-pause falhar
    }

    const { data, error } = await supabaseAdmin
        .from("stage_executions")
        .insert({
            order_id: Number(order_id),
            stage_id: Number(stage_id),
            user_id: Number(user_id),
            status: "Em andamento",
        })
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("[API] Erro ao iniciar execução:", error);
        return res.status(500).json({ error: `Erro ao iniciar execução: ${error.message}` });
    }

    if (!data) {
        return res.status(500).json({ error: "Erro ao recuperar ID da nova execução." });
    }

    // --- AUTOMAÇÃO CORTE VS SEPARAÇÃO ESTOQUE ---
    try {
        // Obter nome da etapa sendo iniciada
        const { data: stageData } = await supabaseAdmin
            .from("stages")
            .select("name")
            .eq("id", Number(stage_id))
            .single();

        if (stageData && (stageData.name === "Corte" || stageData.name === "Separação estoque")) {
            // Se for "Corte", a etapa oponente a remover é "Separação estoque". E vice-versa.
            const oppositeStageName = stageData.name === "Corte" ? "Separação estoque" : "Corte";

            // Encontrar o ID da etapa oponente
            const { data: oppositeStageData } = await supabaseAdmin
                .from("stages")
                .select("id")
                .eq("name", oppositeStageName)
                .single();

            if (oppositeStageData) {
                const oppositeStageId = oppositeStageData.id;

                // Obter required_stages do pedido atual
                const { data: orderData } = await supabaseAdmin
                    .from("orders")
                    .select("required_stages")
                    .eq("id", Number(order_id))
                    .single();

                if (orderData && Array.isArray(orderData.required_stages)) {
                    // Remover a etapa oposta se ela existir no array (considerando strings e números)
                    const updatedStages = orderData.required_stages.filter(
                        (id) => String(id) !== String(oppositeStageId)
                    );

                    if (updatedStages.length !== orderData.required_stages.length) {
                        // Atualizar pedido apenas se houve remoção
                        await supabaseAdmin
                            .from("orders")
                            .update({ required_stages: updatedStages })
                            .eq("id", Number(order_id));
                        console.log(`[API] Automação: Estágio oponente '${oppositeStageName}' (${oppositeStageId}) removido do pedido ${order_id}.`);
                    }
                }
            }
        }
    } catch (autoErr) {
        console.error("[API] Erro na automação de exclusividade Corte/Separação:", autoErr);
        // Não retornar erro para o front, deixar a execução seguir normalmente se a automação falhar
    }

    return res.json({ id: data.id });
});

// ── Pause-All: pausa todas as execuções ativas (fim de expediente) ────────
app.post("/api/executions/pause-all", isAdmin, async (req, res) => {
    try {
        const now = new Date();

        const { data: activeExecs, error: fetchErr } = await supabaseAdmin
            .from("stage_executions")
            .select("id")
            .eq("status", "Em andamento");

        if (fetchErr) return checkError(fetchErr, res, "Erro ao buscar execuções ativas");
        if (!activeExecs || activeExecs.length === 0) {
            return res.json({ success: true, paused: 0 });
        }

        for (const exec of activeExecs) {
            await supabaseAdmin
                .from("stage_executions")
                .update({ status: "Pausado" })
                .eq("id", exec.id);
            await supabaseAdmin
                .from("pauses")
                .insert({ execution_id: exec.id, start_pause: now.toISOString() });
        }

        console.log(`[API] Pause-all: ${activeExecs.length} execução(ões) pausada(s) no fim de expediente.`);
        return res.json({ success: true, paused: activeExecs.length });
    } catch (err: any) {
        console.error("[API] Erro no pause-all:", err);
        return res.status(500).json({ error: "Erro ao pausar todas as execuções" });
    }
});

app.post("/api/executions/:id/pause", async (req, res) => {
    const execution_id = Number(req.params.id);
    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Pausado" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao pausar execução")) return;

    const { error: e2 } = await supabaseAdmin
        .from("pauses")
        .insert({ execution_id });
    if (checkError(e2, res, "Erro ao registrar pausa")) return;

    return res.json({ success: true });
});

app.post("/api/executions/:id/resume", async (req, res) => {
    const execution_id = Number(req.params.id);
    const now = new Date();

    // 1. Get the active pause
    const { data: activePause, error: e0 } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (e0) return checkError(e0, res, "Erro ao buscar pausa ativa");

    if (activePause) {
        const duration = Math.floor((now.getTime() - new Date(activePause.start_pause).getTime()) / 1000);
        const { error: e2 } = await supabaseAdmin
            .from("pauses")
            .update({
                end_pause: now.toISOString(),
                duration_seconds: Math.max(0, duration)
            })
            .eq("id", activePause.id);
        if (checkError(e2, res, "Erro ao finalizar pausa")) return;
    }

    const { error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .update({ status: "Em andamento" })
        .eq("id", execution_id);
    if (checkError(e1, res, "Erro ao retomar execução")) return;

    return res.json({ success: true });
});

app.post("/api/executions/:id/finish", async (req, res) => {
    const execution_id = Number(req.params.id);
    const nowISO = new Date().toISOString();
    const nowMs = new Date().getTime();

    // 1. Get current execution
    const { data: execution, error: e1 } = await supabaseAdmin
        .from("stage_executions")
        .select("*, stages(name)")
        .eq("id", execution_id)
        .single();

    if (checkError(e1, res, "Execução não encontrada") || !execution) return;

    // 2. Finalize any active pause
    const { data: lastPauseData } = await supabaseAdmin
        .from("pauses")
        .select("id, start_pause")
        .eq("execution_id", execution_id)
        .is("end_pause", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastPauseData) {
        const duration = Math.floor((nowMs - new Date(lastPauseData.start_pause).getTime()) / 1000);
        await supabaseAdmin
            .from("pauses")
            .update({ end_pause: nowISO, duration_seconds: duration })
            .eq("id", lastPauseData.id);
    }

    // 3. Calculate total pause time
    const { data: pausesData } = await supabaseAdmin
        .from("pauses")
        .select("duration_seconds")
        .eq("execution_id", execution_id);

    const totalPauseSeconds = (pausesData || []).reduce(
        (sum: number, p: any) => sum + (p.duration_seconds || 0), 0
    );

    // 4. Calculate total execution time
    const totalExecutionSeconds = Math.max(0, Math.floor(
        (nowMs - new Date(execution.start_time).getTime()) / 1000
    ) - totalPauseSeconds);

    // 5. Update execution status
    const { error: e2 } = await supabaseAdmin
        .from("stage_executions")
        .update({
            end_time: nowISO,
            total_time_seconds: totalExecutionSeconds,
            status: "Finalizado"
        })
        .eq("id", execution_id);

    if (checkError(e2, res, "Erro ao finalizar execução")) return;

    // 6. Update order total time
    const { data: allExecs } = await supabaseAdmin
        .from("stage_executions")
        .select("total_time_seconds")
        .eq("order_id", execution.order_id);

    const totalOrderTime = (allExecs || []).reduce(
        (sum: number, e: any) => sum + (e.total_time_seconds || 0), 0
    );

    await supabaseAdmin
        .from("orders")
        .update({ total_time_seconds: totalOrderTime })
        .eq("id", execution.order_id);

    // 7. Update order status if specific stage finished
    if (execution.stages?.name === "Aguardando ficha de aprovação") {
        await supabaseAdmin
            .from("orders")
            .update({ status: "Em Produção" })
            .eq("id", execution.order_id)
            .eq("status", "Entrada");
    }

    if (execution.stages?.name === "Conferência" || execution.stages?.name === "Conferencia") {
        await supabaseAdmin
            .from("orders")
            .update({ 
                status: "Entregue",
                delivered_at: nowISO
            })
            .eq("id", execution.order_id);
        console.log(`[API] Pedido ${execution.order_id} marcado como Entregue automaticamente ao finalizar Conferência.`);
    }

    return res.json({ success: true, total_time: totalExecutionSeconds });
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
    const { jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas } = req.body;
    const { error } = await supabase
        .from("config_producao")
        .update({ jornada_horas, operadores_ativos, eficiencia_percentual, dias_uteis_mes, meta_diaria_pedidos, meta_diaria_pecas })
        .eq("id", 1);
    if (checkError(error, res)) return;
    return res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
app.get("/api/users", async (req, res) => {
    const { search } = req.query;
    let query = supabaseAdmin
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

// ── Delivery & Delays Reports ─────────────────────────────────────────────
app.get("/api/reports/delays", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
        .from("orders")
        .select("id, order_number, client_name, product_type, print_type, quantity, deadline")
        .neq("status", "Entregue")
        .neq("status", "Cancelado")
        .is("deleted_at", null);

    if (print_type) query = query.eq("print_type", print_type as string);

    if (startDate && endDate) {
        query = query.gte("deadline", startDate).lte("deadline", endDate);
    } else {
        query = query.lt("deadline", today);
    }

    const { data, error } = await query.order("deadline", { ascending: true });

    if (checkError(error, res, "Erro ao buscar atrasos")) return;

    const atrasados = (data || []).map(o => {
        const diffTime = Math.abs(new Date().getTime() - new Date(o.deadline).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
            ...o,
            dias_atraso: diffDays
        };
    });

    return res.json(atrasados);
});

app.get("/api/reports/delivery", async (req, res) => {
    const { period, startDate: queryStartDate, endDate: queryEndDate, print_type } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (queryStartDate) {
        startDate = new Date(queryStartDate as string);
    } else if (period === 'day') {
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    } else {
        startDate.setFullYear(2000);
    }

    let endDate = now;
    if (queryEndDate) {
        endDate = new Date(queryEndDate as string);
        // Ensure end date includes the full day (23:59:59)
        endDate.setHours(23, 59, 59, 999);
    } else {
        endDate.setHours(23, 59, 59, 999);
    }

    let ordersQuery = supabase
        .from("orders")
        .select("id, created_at, quantity, deadline, delivered_at")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gte("delivered_at", startDate.toISOString())
        .lte("delivered_at", endDate.toISOString());

    if (print_type) ordersQuery = ordersQuery.eq("print_type", print_type as string);

    const { data: orders, error } = await ordersQuery;

    if (checkError(error, res, "Erro ao buscar entregas")) return;

    const data = orders || [];

    // Fallback if missing delivered_at somehow
    const safeData = data.filter(o => o.delivered_at);

    const entregues_hoje = safeData.filter(o => {
        return new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR');
    }).length;

    const entregues_periodo = safeData.length;

    let parts_delivered = 0;
    let on_time_count = 0;
    let total_lead_seconds = 0;

    safeData.forEach(o => {
        parts_delivered += Number(o.quantity) || 0;
        const deliveredAt = new Date(o.delivered_at).getTime();
        const deadline = new Date(o.deadline).getTime();
        if (deliveredAt <= deadline + 24 * 60 * 60 * 1000) {
            on_time_count++;
        }
        const createdAt = new Date(o.created_at).getTime();
        total_lead_seconds += Math.max(0, (deliveredAt - createdAt) / 1000);
    });

    const taxa_no_prazo_percent = safeData.length > 0 ? (on_time_count / safeData.length) * 100 : 0;
    const lead_time_medio_dias = safeData.length > 0 ? (total_lead_seconds / safeData.length) / (24 * 3600) : 0;

    const chartMap: Record<string, { pedidos: number, pecas: number }> = {};
    safeData.forEach(o => {
        const localDate = new Date(o.delivered_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        if (!chartMap[localDate]) chartMap[localDate] = { pedidos: 0, pecas: 0 };
        chartMap[localDate].pedidos++;
        chartMap[localDate].pecas += Number(o.quantity) || 0;
    });

    const { data: config } = await supabase.from("config_producao").select("meta_diaria_pedidos, meta_diaria_pecas").eq("id", 1).single();
    const meta_pedidos = config?.meta_diaria_pedidos || 0;
    const meta_pecas = config?.meta_diaria_pecas || 0;

    const chartData = Object.keys(chartMap).map(dateStr => ({
        data: dateStr,
        pedidos: chartMap[dateStr].pedidos,
        pecas: chartMap[dateStr].pecas,
        meta_pedidos,
        meta_pecas
    }));

    chartData.sort((a, b) => {
        const [d1, m1, y1] = a.data.split('/');
        const [d2, m2, y2] = b.data.split('/');
        return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
    });

    let met_goal_days = 0;
    chartData.forEach(d => {
        if (d.pedidos >= meta_pedidos) met_goal_days++;
    });

    const cumprimento_meta_percent = chartData.length > 0 ? (met_goal_days / chartData.length) * 100 : 0;

    return res.json({
        entregues_hoje: safeData.filter(o => new Date(o.delivered_at).toLocaleDateString('pt-BR') === now.toLocaleDateString('pt-BR')).length,
        entregues_periodo,
        taxa_no_prazo_percent,
        lead_time_medio_dias,
        cumprimento_meta_percent,
        grafico: chartData,
        atrasados: []
    });
});

// ── Operational Report (Drill-Down) ───────────────────────────────────────
app.get("/api/reports/operational", async (req, res) => {
    const { startDate, endDate, print_type } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Parâmetros startDate e endDate são obrigatórios" });
    }

    const rpcParams: any = {
        p_start_date: startDate,
        p_end_date: endDate
    };
    if (print_type) rpcParams.p_print_type = print_type;

    const { data, error } = await supabase.rpc("get_operational_report", rpcParams);

    if (checkError(error, res, "Erro ao buscar relatório operacional")) return;
    return res.json(data);
});

// ── Production Profile Report ─────────────────────────────────────────────
app.get("/api/reports/profile", async (req, res) => {
    const { startDate, endDate } = req.query;

    let query = supabase
        .from("orders")
        .select("product_type, print_type, num_colors, total_time_seconds, quantity")
        .eq("status", "Entregue")
        .is("deleted_at", null)
        .gt("total_time_seconds", 0);

    if (startDate && endDate) {
        // Ensure endDate includes the full day
        const endDay = new Date(endDate as string);
        endDay.setHours(23, 59, 59, 999);
        query = query.gte("delivered_at", startDate).lte("delivered_at", endDay.toISOString());
    }

    const { data, error } = await query;

    if (checkError(error, res)) return;

    // Group by profile key
    const profileMap: Record<string, {
        product_type: string;
        print_type: string;
        num_colors: number;
        times: number[];
        quantities: number[];
    }> = {};

    for (const order of (data || [])) {
        const colors = order.num_colors || 1;
        const key = `${order.product_type}|${order.print_type}|${colors}`;
        if (!profileMap[key]) {
            profileMap[key] = {
                product_type: order.product_type,
                print_type: order.print_type,
                num_colors: colors,
                times: [],
                quantities: [],
            };
        }
        profileMap[key].times.push(order.total_time_seconds);
        profileMap[key].quantities.push(order.quantity || 0);
    }

    const profiles = Object.values(profileMap).map(p => ({
        product_type: p.product_type,
        print_type: p.print_type,
        num_colors: p.num_colors,
        count: p.times.length,
        avg_time_seconds: Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length),
        min_time_seconds: Math.min(...p.times),
        max_time_seconds: Math.max(...p.times),
        avg_quantity: Math.round(p.quantities.reduce((a, b) => a + b, 0) / p.quantities.length),
    })).sort((a, b) => b.count - a.count);

    return res.json(profiles);
});

// ── 404 for API routes ────────────────────────────────────────────────────
app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

export default app;
