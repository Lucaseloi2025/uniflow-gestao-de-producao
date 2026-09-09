-- ── PASSO 1: ADICIONAR A COLUNA NO BANCO DE DADOS ──────────────────────────
-- Execute este comando no SQL Editor do seu Supabase Dashboard para adicionar a coluna:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dtf_location TEXT;

-- ── PASSO 2: ATUALIZAR A FUNÇÃO RPC 'get_orders_with_stages' ──────────────
-- Recriar a função para incluir a nova coluna 'dtf_location' no retorno.

DROP FUNCTION IF EXISTS public.get_orders_with_stages(text, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.get_orders_with_stages(
    p_search text DEFAULT NULL::text,
    p_stage_id integer DEFAULT NULL::integer,
    p_stage_status text DEFAULT NULL::text,
    p_product_type text DEFAULT NULL::text,
    p_print_type text DEFAULT NULL::text
)
 RETURNS TABLE(
    id bigint,
    order_number text,
    client_name text,
    product_type text,
    print_type text,
    quantity integer,
    deadline timestamp without time zone,
    status text,
    observations text,
    art_url text,
    total_time_seconds integer,
    estimated_time_seconds integer,
    required_stages integer[],
    stages_status jsonb,
    art_urls text[],
    num_colors integer,
    deleted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    dtf_complete boolean,
    dtf_location text
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number,
        o.client_name,
        o.product_type,
        o.print_type,
        o.quantity,
        o.deadline,
        o.status,
        o.observations,
        o.art_url,
        o.total_time_seconds,
        o.estimated_time_seconds,
        o.required_stages,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', s.id,
                    'name', s.name,
                    'sort_order', s.sort_order,
                    'finished', COALESCE(osp.finished, false),
                    'in_progress', COALESCE(osp.in_progress, false)
                ) ORDER BY s.sort_order
            )
            FROM stages s
            LEFT JOIN order_stage_progress osp ON osp.stage_id = s.id AND osp.order_id = o.id
            WHERE s.id = ANY(o.required_stages)
        ) AS stages_status,
        o.art_urls,
        o.num_colors,
        o.deleted_at,
        o.cancelled_at,
        o.dtf_complete,
        o.dtf_location
    FROM orders o
    WHERE 
        o.deleted_at IS NULL
        AND (p_search IS NULL OR o.order_number ILIKE '%' || p_search || '%' OR o.client_name ILIKE '%' || p_search || '%')
        AND (p_product_type IS NULL OR o.product_type = p_product_type)
        AND (p_print_type IS NULL OR o.print_type = p_print_type)
        AND (
            p_stage_id IS NULL OR (
                p_stage_id = ANY(o.required_stages) AND (
                    p_stage_status IS NULL OR (
                        p_stage_status = 'em_andamento' AND EXISTS (
                            SELECT 1 FROM order_stage_progress osp 
                            WHERE osp.order_id = o.id AND osp.stage_id = p_stage_id AND osp.in_progress = true AND osp.finished = false
                        )
                    ) OR (
                        p_stage_status = 'pendente' AND EXISTS (
                            SELECT 1 FROM order_stage_progress osp 
                            WHERE osp.order_id = o.id AND osp.stage_id = p_stage_id AND osp.finished = false
                        )
                    )
                )
            )
        )
    ORDER BY o.deadline ASC, o.id DESC;
END;
$function$;
