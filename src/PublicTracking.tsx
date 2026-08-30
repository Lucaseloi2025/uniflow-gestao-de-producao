import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, Loader2, AlertCircle, Star } from 'lucide-react';

interface PublicStage {
  id: number;
  name: string;
  status: 'concluida' | 'em_andamento' | 'pendente';
}

interface PublicOrder {
  order_number: string;
  client_name: string;
  product_type: string;
  print_type: string;
  quantity: number;
  deadline: string;
  stages: PublicStage[];
  last_updated_at?: string;
  last_update_message?: string;
}

/* ── Comfort Logo Component ─────────────────────────────────────── */
const ComfortLogo = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 320 80" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* T-shirt icon */}
    <g transform="translate(10,8)">
      {/* Dark blue shirt body */}
      <path d="M8,25 L8,60 L45,60 L45,25 L35,20 L28,25 L25,25 L18,20 L8,25Z" fill="#0B2545"/>
      {/* Orange arrow/accent */}
      <path d="M20,28 L35,45 L28,45 L28,58 L20,58 L20,45 L13,45Z" fill="#F27B20" opacity="0.9"/>
      {/* Stars */}
      <circle cx="38" cy="10" r="2.5" fill="#F27B20"/>
      <circle cx="45" cy="5" r="2" fill="#F27B20"/>
      <circle cx="48" cy="14" r="1.5" fill="#F27B20"/>
    </g>
    {/* COMFORT text */}
    <text x="75" y="42" fontFamily="Arial, Helvetica, sans-serif" fontSize="32" fontWeight="900" fill="#0B2545" letterSpacing="1">COMFORT</text>
    {/* Subtitle */}
    <text x="75" y="62" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" fontWeight="600" fill="#0B2545" letterSpacing="0.5">Uniformes e Camisetas</text>
  </svg>
);

/* ── Animated pulse ring ─────────────────────────────────────── */
const PulseRing = () => (
  <span className="ct-pulse-ring">
    <span className="ct-pulse-ring-inner" />
  </span>
);

export default function PublicTracking({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/public/orders/${token}`);
        if (!res.ok) {
          setError(true);
        } else {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [token]);

  /* ── Loading state ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="ct-page ct-center">
        <style>{trackingStyles}</style>
        <div className="ct-loading-card">
          <ComfortLogo className="ct-logo-loading" />
          <div className="ct-spinner-wrapper">
            <Loader2 className="ct-spinner" />
          </div>
          <p className="ct-loading-text">Carregando informações do seu pedido...</p>
        </div>
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────── */
  if (error || !order) {
    return (
      <div className="ct-page ct-center">
        <style>{trackingStyles}</style>
        <div className="ct-error-card">
          <ComfortLogo className="ct-logo-error" />
          <div className="ct-error-icon-wrapper">
            <AlertCircle className="ct-error-icon" />
          </div>
          <h1 className="ct-error-title">Link não encontrado</h1>
          <p className="ct-error-desc">
            O link de acompanhamento que você tentou acessar é inválido, expirou ou o pedido foi arquivado.
          </p>
          <div className="ct-error-contact">
            <p>Entre em contato conosco para solicitar um novo link de acompanhamento.</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Calculate statistics ─────────────────────────────── */
  const totalStages = order.stages.length;
  const completedStages = order.stages.filter((s) => s.status === 'concluida').length;
  const inProgressStages = order.stages.filter((s) => s.status === 'em_andamento').length;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
  const isAllDone = completedStages === totalStages && totalStages > 0;

  /* ── Format date ─────────────────────────────────────── */
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return `Hoje às ${hours}:${minutes}`;
      }
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Ontem às ${hours}:${minutes}`;
      }
      
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (e) {
      return dateStr;
    }
  };

  /* ── Greeting based on time ──────────────────────────── */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getStatusMessage = () => {
    if (isAllDone) return '🎉 Seu pedido está pronto!';
    if (inProgressStages > 0) return 'Seu pedido está sendo produzido com carinho!';
    return 'Seu pedido está na fila de produção.';
  };

  /* ── Main render ─────────────────────────────────────── */
  return (
    <div className="ct-page">
      <style>{trackingStyles}</style>

      {/* ── Header ─────────────────────────────────────── */}
      <header className="ct-header">
        <div className="ct-header-inner">
          <ComfortLogo className="ct-logo" />
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────── */}
      <main className="ct-main">
        {/* ── Welcome Card ───────────────────────────── */}
        <section className="ct-welcome-card">
          <div className="ct-welcome-bg" />
          <div className="ct-welcome-content">
            <p className="ct-greeting">{getGreeting()}, <strong>{order.client_name}</strong>!</p>
            <p className="ct-status-message">{getStatusMessage()}</p>
          </div>
        </section>

        {/* ── Última Atualização ─────────────────────── */}
        {order.last_updated_at && (
          <section className="ct-update-card">
            <div className="ct-update-header">
              <span className="ct-update-pulse-dot">
                <span className="ct-update-pulse-ring" />
              </span>
              <span className="ct-update-title">Status da Produção</span>
            </div>
            <p className="ct-update-message">{order.last_update_message}</p>
            <p className="ct-update-time">
              Atualizado: {formatDateTime(order.last_updated_at)}
            </p>
          </section>
        )}

        {/* ── Order Info ─────────────────────────────── */}
        <section className="ct-info-card">
          <div className="ct-info-grid">
            <div className="ct-info-item">
              <span className="ct-info-label">Pedido</span>
              <span className="ct-info-value ct-order-number">{order.order_number}</span>
            </div>
            <div className="ct-info-item">
              <span className="ct-info-label">Previsão de Entrega</span>
              <span className="ct-info-value ct-deadline">
                <Clock size={15} />
                {formatDate(order.deadline)}
              </span>
            </div>
          </div>
        </section>

        {/* ── Progress Card ──────────────────────────── */}
        <section className="ct-progress-card">
          <div className="ct-progress-header">
            <div>
              <h2 className="ct-progress-title">Etapas da Confecção</h2>
              <p className="ct-progress-subtitle">
                {completedStages} de {totalStages} etapas concluídas
              </p>
            </div>
            <div className={`ct-progress-percent ${isAllDone ? 'ct-done' : ''}`}>
              {progressPercent}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="ct-progress-bar-track">
            <div
              className={`ct-progress-bar-fill ${isAllDone ? 'ct-bar-done' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* ── Stage Cards (non-sequential) ─────────── */}
          <div className="ct-stages-grid">
            {order.stages.map((stage) => {
              const isConcluida = stage.status === 'concluida';
              const isEmAndamento = stage.status === 'em_andamento';

              return (
                <div
                  key={stage.id}
                  className={`ct-stage-card ${
                    isConcluida ? 'ct-stage-done' : isEmAndamento ? 'ct-stage-active' : 'ct-stage-pending'
                  }`}
                >
                  <div className="ct-stage-icon">
                    {isConcluida ? (
                      <CheckCircle2 className="ct-icon-done" />
                    ) : isEmAndamento ? (
                      <div className="ct-icon-active-wrapper">
                        <PulseRing />
                        <div className="ct-icon-active-dot" />
                      </div>
                    ) : (
                      <Circle className="ct-icon-pending" />
                    )}
                  </div>
                  <div className="ct-stage-info">
                    <h3 className={`ct-stage-name ${
                      isConcluida ? 'ct-name-done' : isEmAndamento ? 'ct-name-active' : 'ct-name-pending'
                    }`}>
                      {stage.name}
                    </h3>
                    <span className={`ct-stage-badge ${
                      isConcluida ? 'ct-badge-done' : isEmAndamento ? 'ct-badge-active' : 'ct-badge-pending'
                    }`}>
                      {isConcluida ? 'Concluída' : isEmAndamento ? 'Em Andamento' : 'Aguardando'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>



        {/* ── All done celebration ───────────────────── */}
        {isAllDone && (
          <section className="ct-celebration-card">
            <div className="ct-celebration-stars">
              <Star className="ct-star ct-star-1" />
              <Star className="ct-star ct-star-2" />
              <Star className="ct-star ct-star-3" />
            </div>
            <h2 className="ct-celebration-title">Pedido Finalizado!</h2>
            <p className="ct-celebration-desc">
              Todas as etapas de produção foram concluídas. Em breve entraremos em contato para combinar a entrega.
            </p>
          </section>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="ct-footer">
        <p className="ct-footer-text">
          Comfort Uniformes e Camisetas © {new Date().getFullYear()}
        </p>
        <p className="ct-footer-sub">Produzindo com qualidade e carinho</p>
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CSS-in-JS Styles — warm, welcoming, Comfort brand identity
   ════════════════════════════════════════════════════════════════════ */
const trackingStyles = `
  /* ── Fonts ──────────────────────────────────────────────────── */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  /* ── Base / Page ───────────────────────────────────────────── */
  .ct-page {
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(135deg, #FFF8F0 0%, #FFF0E0 30%, #F0F4FF 100%);
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }

  .ct-center {
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* ── Header ────────────────────────────────────────────────── */
  .ct-header {
    background: #fff;
    border-bottom: 1px solid rgba(11,37,69,0.08);
    padding: 16px 24px;
    box-shadow: 0 1px 8px rgba(11,37,69,0.04);
  }

  .ct-header-inner {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ct-logo {
    width: 200px;
    height: auto;
  }

  .ct-logo-loading {
    width: 220px;
    height: auto;
    margin-bottom: 32px;
  }

  .ct-logo-error {
    width: 200px;
    height: auto;
    margin-bottom: 24px;
  }

  /* ── Main ───────────────────────────────────────────────────── */
  .ct-main {
    flex: 1;
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
    padding: 20px 16px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Welcome Card ──────────────────────────────────────────── */
  .ct-welcome-card {
    position: relative;
    background: linear-gradient(135deg, #0B2545 0%, #13315C 50%, #1B4175 100%);
    border-radius: 20px;
    overflow: hidden;
    padding: 28px 24px;
    box-shadow: 0 8px 32px rgba(11,37,69,0.18);
  }

  .ct-welcome-bg {
    position: absolute;
    top: -40px;
    right: -30px;
    width: 160px;
    height: 160px;
    background: radial-gradient(circle, rgba(242,123,32,0.2) 0%, transparent 70%);
    border-radius: 50%;
  }

  .ct-welcome-content {
    position: relative;
    z-index: 1;
  }

  .ct-greeting {
    color: rgba(255,255,255,0.85);
    font-size: 15px;
    font-weight: 500;
    margin: 0 0 6px;
  }

  .ct-greeting strong {
    color: #fff;
    font-weight: 700;
  }

  .ct-status-message {
    color: #F2A95B;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
  }

  /* ── Update Card ───────────────────────────────────────────── */
  .ct-update-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(11,37,69,0.05);
    border: 1px solid rgba(11,37,69,0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ct-update-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ct-update-pulse-dot {
    position: relative;
    width: 8px;
    height: 8px;
    background: #16A34A;
    border-radius: 50%;
    display: inline-block;
  }

  .ct-update-pulse-ring {
    position: absolute;
    top: -4px;
    left: -4px;
    width: 16px;
    height: 16px;
    border: 2px solid #16A34A;
    border-radius: 50%;
    opacity: 0;
    animation: ctPulseSlow 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  }

  @keyframes ctPulseSlow {
    0% { transform: scale(0.6); opacity: 1; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  .ct-update-title {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 850;
    letter-spacing: 0.8px;
    color: #8899AA;
  }

  .ct-update-message {
    font-size: 15px;
    font-weight: 700;
    color: #0B2545;
    margin: 0;
  }

  .ct-update-time {
    font-size: 11px;
    font-weight: 500;
    color: #8899AA;
    margin: 0;
  }

  /* ── Info Card ─────────────────────────────────────────────── */
  .ct-info-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(11,37,69,0.05);
    border: 1px solid rgba(11,37,69,0.06);
  }

  .ct-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .ct-info-divider {
    border-top: 1px solid #F1F5F9;
    padding-top: 12px;
  }

  .ct-info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ct-info-label {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #8899AA;
  }

  .ct-info-value {
    font-size: 14px;
    font-weight: 700;
    color: #0B2545;
  }

  .ct-order-number {
    font-family: 'Inter', monospace;
    font-size: 18px;
    font-weight: 900;
    color: #0B2545;
  }

  .ct-deadline {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #0B2545;
  }

  .ct-deadline svg {
    color: #F27B20;
    flex-shrink: 0;
  }

  /* ── Progress Card ─────────────────────────────────────────── */
  .ct-progress-card {
    background: #fff;
    border-radius: 16px;
    padding: 24px 20px;
    box-shadow: 0 2px 12px rgba(11,37,69,0.06);
    border: 1px solid rgba(11,37,69,0.06);
  }

  .ct-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .ct-progress-title {
    font-size: 15px;
    font-weight: 800;
    color: #0B2545;
    margin: 0 0 2px;
  }

  .ct-progress-subtitle {
    font-size: 12px;
    color: #8899AA;
    font-weight: 500;
    margin: 0;
  }

  .ct-progress-percent {
    font-size: 28px;
    font-weight: 900;
    color: #F27B20;
    line-height: 1;
  }

  .ct-progress-percent.ct-done {
    color: #16A34A;
  }

  /* ── Progress Bar ──────────────────────────────────────────── */
  .ct-progress-bar-track {
    width: 100%;
    height: 10px;
    background: #F0F2F5;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .ct-progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #F27B20, #F2A95B);
    border-radius: 10px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ct-progress-bar-fill.ct-bar-done {
    background: linear-gradient(90deg, #16A34A, #22C55E);
  }

  /* ── Stages Grid (connected timeline) ───────────────────────── */
  .ct-stages-grid {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ct-stages-grid::before {
    content: '';
    position: absolute;
    top: 24px;
    bottom: 24px;
    left: 32px; /* Center of 32px icon (16px padding + 16px radius) */
    width: 2px;
    background: #E2E8F0;
    z-index: 1;
  }

  .ct-stage-card {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .ct-stage-done {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
  }

  .ct-stage-active {
    background: linear-gradient(135deg, #FFF7ED, #FFEDD5);
    border: 1px solid #FED7AA;
    box-shadow: 0 2px 12px rgba(242,123,32,0.1);
  }

  .ct-stage-pending {
    background: #F8FAFC;
    border: 1px solid #E2E8F0;
  }

  /* ── Stage Icons ───────────────────────────────────────────── */
  .ct-stage-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 10;
    border-radius: 50%;
  }

  .ct-stage-done .ct-stage-icon {
    background-color: #F0FDF4;
  }

  .ct-stage-active .ct-stage-icon {
    background-color: #FFEDD5;
  }

  .ct-stage-pending .ct-stage-icon {
    background-color: #F8FAFC;
  }

  .ct-icon-done {
    width: 28px;
    height: 28px;
    color: #16A34A;
  }

  .ct-icon-active-wrapper {
    position: relative;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ct-icon-active-dot {
    width: 12px;
    height: 12px;
    background: #F27B20;
    border-radius: 50%;
    position: relative;
    z-index: 2;
  }

  .ct-pulse-ring {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ct-pulse-ring-inner {
    width: 28px;
    height: 28px;
    border: 2px solid #F27B20;
    border-radius: 50%;
    animation: ctPulse 2s ease-in-out infinite;
  }

  @keyframes ctPulse {
    0%, 100% { transform: scale(0.8); opacity: 1; }
    50% { transform: scale(1.15); opacity: 0.4; }
  }

  .ct-icon-pending {
    width: 24px;
    height: 24px;
    color: #CBD5E1;
  }

  /* ── Stage Info ────────────────────────────────────────────── */
  .ct-stage-info {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    z-index: 10;
  }

  .ct-stage-name {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .ct-name-done {
    color: #166534;
  }

  .ct-name-active {
    color: #0B2545;
    font-weight: 800;
  }

  .ct-name-pending {
    color: #94A3B8;
  }

  .ct-stage-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 4px 10px;
    border-radius: 20px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ct-badge-done {
    background: #DCFCE7;
    color: #166534;
  }

  .ct-badge-active {
    background: #FFF7ED;
    color: #C2410C;
    border: 1px solid #FDBA74;
  }

  .ct-badge-pending {
    background: #F1F5F9;
    color: #94A3B8;
  }

  /* ── Help / Support Card ───────────────────────────────────── */
  .ct-help-card {
    background: linear-gradient(135deg, #FFF8F0 0%, #FFF0E0 100%);
    border-radius: 16px;
    padding: 24px 20px;
    text-align: center;
    border: 1px solid #FED7AA;
    box-shadow: 0 4px 20px rgba(242,123,32,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .ct-help-title {
    font-size: 16px;
    font-weight: 800;
    color: #7C2D12;
    margin: 0;
  }

  .ct-help-desc {
    font-size: 13px;
    color: #9A3412;
    line-height: 1.5;
    margin: 0 0 8px;
    max-width: 440px;
  }

  .ct-help-btn {
    display: inline-block;
    background: #16A34A;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    padding: 10px 24px;
    border-radius: 10px;
    text-decoration: none;
    box-shadow: 0 4px 12px rgba(22,163,74,0.2);
    transition: all 0.2s ease;
  }

  .ct-help-btn:hover {
    background: #15803D;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(22,163,74,0.25);
  }

  .ct-help-btn:active {
    transform: translateY(0);
  }

  /* ── Celebration Card ──────────────────────────────────────── */
  .ct-celebration-card {
    position: relative;
    background: linear-gradient(135deg, #F0FDF4, #DCFCE7);
    border: 1px solid #BBF7D0;
    border-radius: 16px;
    padding: 28px 24px;
    text-align: center;
    box-shadow: 0 4px 16px rgba(22,163,74,0.1);
  }

  .ct-celebration-stars {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .ct-star {
    color: #F27B20;
    fill: #F27B20;
  }

  .ct-star-1 { width: 18px; height: 18px; animation: ctStarBounce 1.5s ease infinite 0s; }
  .ct-star-2 { width: 24px; height: 24px; animation: ctStarBounce 1.5s ease infinite 0.2s; }
  .ct-star-3 { width: 18px; height: 18px; animation: ctStarBounce 1.5s ease infinite 0.4s; }

  @keyframes ctStarBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  .ct-celebration-title {
    font-size: 20px;
    font-weight: 900;
    color: #166534;
    margin: 0 0 8px;
  }

  .ct-celebration-desc {
    font-size: 14px;
    color: #15803D;
    line-height: 1.5;
    margin: 0;
    font-weight: 500;
  }

  /* ── Loading ───────────────────────────────────────────────── */
  .ct-loading-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 360px;
    width: 100%;
  }

  .ct-spinner-wrapper {
    margin-bottom: 16px;
  }

  .ct-spinner {
    width: 36px;
    height: 36px;
    color: #F27B20;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .ct-loading-text {
    font-size: 14px;
    color: #64748B;
    font-weight: 500;
  }

  /* ── Error ─────────────────────────────────────────────────── */
  .ct-error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    background: #fff;
    border-radius: 20px;
    padding: 40px 32px;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 8px 32px rgba(11,37,69,0.08);
    border: 1px solid rgba(11,37,69,0.06);
  }

  .ct-error-icon-wrapper {
    margin-bottom: 16px;
  }

  .ct-error-icon {
    width: 56px;
    height: 56px;
    color: #F27B20;
  }

  .ct-error-title {
    font-size: 20px;
    font-weight: 800;
    color: #0B2545;
    margin: 0 0 8px;
  }

  .ct-error-desc {
    font-size: 14px;
    color: #64748B;
    line-height: 1.6;
    margin: 0 0 20px;
  }

  .ct-error-contact {
    background: #FFF7ED;
    border: 1px solid #FED7AA;
    border-radius: 12px;
    padding: 14px 18px;
  }

  .ct-error-contact p {
    font-size: 13px;
    color: #9A3412;
    font-weight: 500;
    margin: 0;
    line-height: 1.5;
  }

  /* ── Footer ────────────────────────────────────────────────── */
  .ct-footer {
    padding: 24px 16px;
    text-align: center;
    border-top: 1px solid rgba(11,37,69,0.06);
    background: rgba(255,255,255,0.5);
  }

  .ct-footer-text {
    font-size: 12px;
    color: #0B2545;
    font-weight: 600;
    margin: 0 0 2px;
  }

  .ct-footer-sub {
    font-size: 11px;
    color: #94A3B8;
    font-weight: 500;
    margin: 0;
  }

  /* ── Responsive ────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .ct-info-row {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .ct-stage-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .ct-progress-percent {
      font-size: 24px;
    }

    .ct-welcome-card {
      padding: 22px 18px;
    }

    .ct-status-message {
      font-size: 16px;
    }

    .ct-logo {
      width: 170px;
    }
  }
`;
