-- ============================================================================
-- MIGRATION: Fix Duplicate Production Counting in get_reports and get_dashboard_stats_v2
-- ============================================================================
-- Description:
-- Previously, get_reports and get_dashboard_stats_v2 were summing order quantities
-- across ALL finished stage executions for each order. As a result, an order passing
-- through 3-4 stages had its pieces counted 3-4 times in the monthly/weekly volume.
--
-- This migration updates the SQL functions to count each order's physical pieces ONCE
-- when it reaches its LAST 'por_peca' stage (or when the order is completed).
-- ============================================================================

-- 1. Helper function to find the last 'por_peca' stage for a given required_stages array
CREATE OR REPLACE FUNCTION public.get_last_por_peca_stage_id(p_required_stages integer[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_stage_id integer;
BEGIN
    SELECT s.id INTO v_last_stage_id
    FROM stages s
    WHERE s.id = ANY(p_required_stages)
      AND s.calculation_type = 'por_peca'
    ORDER BY s.sort_order DESC
    LIMIT 1;

    IF v_last_stage_id IS NULL THEN
        SELECT s.id INTO v_last_stage_id
        FROM stages s
        WHERE s.id = ANY(p_required_stages)
        ORDER BY s.sort_order DESC
        LIMIT 1;
    END IF;

    RETURN v_last_stage_id;
END;
$$;

-- 2. Updated get_reports function
CREATE OR REPLACE FUNCTION public.get_reports(
    p_period text DEFAULT 'day'::text,
    p_user_id integer DEFAULT NULL::integer,
    p_stage_id integer DEFAULT NULL::integer,
    p_start_date text DEFAULT NULL::text,
    p_end_date text DEFAULT NULL::text,
    p_print_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time timestamp;
    v_end_time timestamp;
    v_result jsonb;
BEGIN
    IF p_start_date IS NOT NULL AND p_start_date <> '' THEN
        v_start_time := (p_start_date || ' 00:00:00')::timestamp;
    ELSE
        v_start_time := date_trunc('month', NOW());
    END IF;

    IF p_end_date IS NOT NULL AND p_end_date <> '' THEN
        v_end_time := (p_end_date || ' 23:59:59.999')::timestamp;
    ELSE
        v_end_time := NOW();
    END IF;

    WITH finished_orders AS (
        SELECT DISTINCT ON (o.id)
            o.id AS order_id,
            o.order_number,
            o.quantity,
            se.end_time
        FROM stage_executions se
        JOIN orders o ON o.id = se.order_id
        WHERE se.status = 'Finalizado'
          AND o.deleted_at IS NULL
          AND o.status <> 'Cancelado'
          AND se.stage_id = public.get_last_por_peca_stage_id(o.required_stages)
          AND se.end_time >= v_start_time
          AND se.end_time <= v_end_time
          AND (p_print_type IS NULL OR o.print_type = p_print_type)
        ORDER BY o.id, se.end_time DESC
    ),
    volume_grouped AS (
        SELECT 
            CASE 
                WHEN p_period = 'month' THEN to_char(end_time, 'YYYY-MM')
                WHEN p_period = 'week' THEN 'Semana ' || to_char(date_trunc('week', end_time), 'DD/MM')
                ELSE to_char(end_time, 'YYYY-MM-DD')
            END AS label,
            COUNT(order_id) AS orders,
            COALESCE(SUM(quantity), 0) AS pieces
        FROM finished_orders
        GROUP BY 1
        ORDER BY 1 ASC
    ),
    summary_data AS (
        SELECT 
            COALESCE(SUM(quantity), 0) AS total_parts,
            COUNT(order_id) AS total_orders,
            COUNT(order_id) AS total_stages
        FROM finished_orders
    )
    SELECT jsonb_build_object(
        'volume', COALESCE((SELECT jsonb_agg(v) FROM volume_grouped v), '[]'::jsonb),
        'summary', (SELECT row_to_json(s) FROM summary_data s)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
