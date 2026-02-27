/**
 * Gerador de gráficos server-side para embutir em planilhas Excel
 * Usa chartjs-node-canvas para renderizar Chart.js como imagens PNG
 */

import type { ChartConfiguration } from "chart.js";

// Cores do tema LAN7 Pegasus
const COLORS = {
  primary: "#1E3A5F",       // Azul escuro principal
  primaryLight: "#2E5A8F",  // Azul médio
  accent: "#3B82F6",        // Azul brilhante
  success: "#10B981",       // Verde
  warning: "#F59E0B",       // Amarelo/Laranja
  danger: "#EF4444",        // Vermelho
  purple: "#8B5CF6",        // Roxo
  cyan: "#06B6D4",          // Ciano
  pink: "#EC4899",          // Rosa
  indigo: "#6366F1",        // Indigo
  teal: "#14B8A6",          // Teal
  gray: "#94A3B8",          // Cinza
  white: "#FFFFFF",
  lightBg: "#F8FAFC",
  border: "#E2E8F0",
};

const CHART_PALETTE = [
  COLORS.accent, COLORS.success, COLORS.warning, COLORS.danger,
  COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.indigo,
  COLORS.teal, COLORS.primaryLight, COLORS.gray,
];

const CHART_PALETTE_ALPHA = CHART_PALETTE.map(c => c + "CC");

interface ChartRenderOptions {
  width?: number;
  height?: number;
}

async function renderChart(config: ChartConfiguration, opts?: ChartRenderOptions): Promise<Buffer> {
  const { ChartJSNodeCanvas } = await import("chartjs-node-canvas");
  const width = opts?.width || 600;
  const height = opts?.height || 350;
  const canvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "white",
  });
  return canvas.renderToBuffer(config as any);
}

// ─── Gráfico de Barras: Notas por Mês ─────────────────────────────
export async function chartNotasPorMes(
  data: { mes: string; total: number; emitidas: number; recebidas: number }[],
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const labels = data.map(d => {
    const [y, m] = d.mes.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
  });

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Emitidas",
          data: data.map(d => d.emitidas),
          backgroundColor: COLORS.accent + "CC",
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Recebidas",
          data: data.map(d => d.recebidas),
          backgroundColor: COLORS.warning + "CC",
          borderColor: COLORS.warning,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Notas por Mês", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { position: "bottom", labels: { font: { size: 12 }, usePointStyle: true, padding: 20 } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: COLORS.border }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  };

  return renderChart(config, opts);
}

// ─── Gráfico de Barras Horizontal: Top Empresas ─────────────────────
export async function chartTopEmpresas(
  data: { razaoSocial: string; valorTotal: number }[],
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const top = data.slice(0, 10);
  const labels = top.map(d => d.razaoSocial.length > 30 ? d.razaoSocial.slice(0, 28) + "..." : d.razaoSocial);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Valor Total (R$)",
        data: top.map(d => d.valorTotal),
        backgroundColor: CHART_PALETTE_ALPHA.slice(0, top.length),
        borderColor: CHART_PALETTE.slice(0, top.length),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: false,
      plugins: {
        title: { display: true, text: "Top 10 Empresas por Valor", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { display: false },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: COLORS.border }, ticks: { font: { size: 10 }, callback: (v: any) => `R$ ${Number(v).toLocaleString("pt-BR")}` } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  };

  return renderChart(config, { width: opts?.width || 700, height: opts?.height || 400 });
}

// ─── Gráfico de Pizza: Distribuição Emitidas vs Recebidas ───────────
export async function chartDistribuicaoTipo(
  emitidas: number,
  recebidas: number,
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: ["Emitidas", "Recebidas"],
      datasets: [{
        data: [emitidas, recebidas],
        backgroundColor: [COLORS.accent + "CC", COLORS.warning + "CC"],
        borderColor: [COLORS.accent, COLORS.warning],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Emitidas vs Recebidas", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { position: "bottom", labels: { font: { size: 13 }, usePointStyle: true, padding: 20 } },
      },
    },
  };

  return renderChart(config, { width: opts?.width || 400, height: opts?.height || 350 });
}

// ─── Gráfico de Pizza: Status das Notas ─────────────────────────────
export async function chartDistribuicaoStatus(
  validas: number,
  canceladas: number,
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: ["Ativas", "Canceladas"],
      datasets: [{
        data: [validas, canceladas],
        backgroundColor: [COLORS.success + "CC", COLORS.danger + "CC"],
        borderColor: [COLORS.success, COLORS.danger],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Status das Notas", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { position: "bottom", labels: { font: { size: 13 }, usePointStyle: true, padding: 20 } },
      },
    },
  };

  return renderChart(config, { width: opts?.width || 400, height: opts?.height || 350 });
}

// ─── Gráfico de Linha: Evolução de Valores por Mês ─────────────────
export async function chartEvolucaoValores(
  data: { mes: string; valor: string | number }[],
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const labels = data.map(d => {
    const [y, m] = d.mes.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
  });

  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Valor Total (R$)",
        data: data.map(d => parseFloat(String(d.valor))),
        borderColor: COLORS.purple,
        backgroundColor: COLORS.purple + "33",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: COLORS.purple,
        pointBorderColor: COLORS.white,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Evolução de Valores Mensais", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { position: "bottom", labels: { font: { size: 12 }, usePointStyle: true, padding: 20 } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: COLORS.border }, ticks: { font: { size: 11 }, callback: (v: any) => `R$ ${Number(v).toLocaleString("pt-BR")}` } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  };

  return renderChart(config, opts);
}

// ─── Gráfico de Barras Empilhadas: Emitidas vs Recebidas por Mês ───
export async function chartEmitidasRecebidasMes(
  data: { mes: string; emitidas: number; recebidas: number }[],
  opts?: ChartRenderOptions,
): Promise<Buffer> {
  const labels = data.map(d => {
    const [y, m] = d.mes.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
  });

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Emitidas",
          data: data.map(d => d.emitidas),
          backgroundColor: COLORS.accent + "CC",
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Recebidas",
          data: data.map(d => d.recebidas),
          backgroundColor: COLORS.warning + "CC",
          borderColor: COLORS.warning,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Emitidas vs Recebidas por Mês", font: { size: 16, weight: "bold" }, color: COLORS.primary },
        legend: { position: "bottom", labels: { font: { size: 12 }, usePointStyle: true, padding: 20 } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { stacked: true, beginAtZero: true, grid: { color: COLORS.border }, ticks: { font: { size: 11 } } },
      },
    },
  };

  return renderChart(config, opts);
}

export { COLORS, CHART_PALETTE };
