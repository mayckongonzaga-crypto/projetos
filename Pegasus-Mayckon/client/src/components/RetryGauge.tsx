import { useEffect, useState } from "react";

interface RetryGaugeProps {
  rodada: number;
  maxRodadas: number | null;
  retomadaInfinita: boolean;
  fase: string;
  retomados?: number;
  falhas?: number;
  pendentes?: number;
  totalErros?: number;
}

export function RetryGauge({
  rodada,
  maxRodadas,
  retomadaInfinita,
  fase,
  retomados = 0,
  falhas = 0,
  pendentes = 0,
  totalErros = 0,
}: RetryGaugeProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Calcular progresso: empresas processadas na rodada atual
  const processados = retomados + falhas;
  const total = totalErros || 1;
  const progressPercent = Math.min(100, Math.round((processados / total) * 100));

  // Animar o progresso
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercent);
    }, 100);
    return () => clearTimeout(timer);
  }, [progressPercent]);

  // SVG circle params
  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  // Anel de fundo (track)
  const trackStrokeWidth = 4;

  const isActive = fase === "retomando";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Fundo escuro circular */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, #1e1b2e 0%, #0f0e1a 70%, #0a0914 100%)",
            boxShadow: "0 0 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)",
          }}
        />

        <svg
          width={size}
          height={size}
          className="absolute inset-0"
          style={{ transform: "rotate(-90deg)" }}
        >
          <defs>
            {/* Gradiente do anel de progresso */}
            <linearGradient id="retryGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="retryGaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track (anel de fundo) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(139, 92, 246, 0.15)"
            strokeWidth={trackStrokeWidth}
          />

          {/* Marcas de escala (ticks) */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const innerR = radius - 12;
            const outerR = radius - 8;
            const x1 = size / 2 + innerR * Math.cos(rad);
            const y1 = size / 2 + innerR * Math.sin(rad);
            const x2 = size / 2 + outerR * Math.cos(rad);
            const y2 = size / 2 + outerR * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(139, 92, 246, 0.2)"
                strokeWidth={i % 6 === 0 ? 1.5 : 0.5}
              />
            );
          })}

          {/* Anel de progresso */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#retryGaugeGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#retryGaugeGlow)"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />

          {/* Ponto brilhante na ponta do progresso */}
          {animatedProgress > 2 && (() => {
            const angle = ((animatedProgress / 100) * 360 - 90) * (Math.PI / 180);
            const dotX = size / 2 + radius * Math.cos(angle + Math.PI / 2);
            const dotY = size / 2 + radius * Math.sin(angle + Math.PI / 2);
            return (
              <circle
                cx={dotX}
                cy={dotY}
                r={4}
                fill="#06b6d4"
                filter="url(#retryGaugeGlow)"
                style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
              />
            );
          })()}
        </svg>

        {/* Conteúdo central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Número da rodada */}
          <span
            className="text-3xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #c4b5fd, #67e8f9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
            }}
          >
            {String(rodada).padStart(2, "0")}
          </span>

          {/* Label */}
          <span className="text-[10px] text-purple-300/80 font-medium tracking-wider uppercase mt-0.5">
            {retomadaInfinita ? "/ ∞" : `/ ${maxRodadas ?? "?"}`}
          </span>
        </div>

        {/* Indicador de atividade (pulso) */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              border: "1px solid rgba(139, 92, 246, 0.15)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        )}
      </div>

      {/* Texto abaixo do gauge */}
      <div className="mt-2 text-center">
        <p className="text-[11px] font-semibold text-purple-300/90 tracking-wide">
          {isActive ? "Retomando..." : fase === "concluido" ? "Concluído" : "Aguardando"}
        </p>
        {totalErros > 0 && (
          <p className="text-[9px] text-purple-400/60 mt-0.5">
            {retomados > 0 && <span className="text-cyan-400/70">{retomados} ok</span>}
            {retomados > 0 && falhas > 0 && <span> · </span>}
            {falhas > 0 && <span className="text-red-400/70">{falhas} falha(s)</span>}
            {(retomados > 0 || falhas > 0) && pendentes > 0 && <span> · </span>}
            {pendentes > 0 && <span>{pendentes} restante(s)</span>}
          </p>
        )}
      </div>
    </div>
  );
}
