"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Calendar,
  Filter,
  Package,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
  ChevronUp,
  ChevronDown,
  Hospital
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Tipados de entrada
type Posta = { id: string; nombre: string; codigo: string | null };
type Medicamento = { id: string; nombre: string; unidadMedida: string; categoria: string };
type Movimiento = { postaId: string; medicamentoId: string; fecha: string; totalDia: number };
type Ingreso = { postaId: string; medicamentoId: string; fecha: string; cantidad: number };
type StockActual = {
  postaId: string;
  medicamentoId: string;
  stockFinal: number;
  stockRecomendado: number;
  stockCritico: number;
};

interface ComparativasPanelProps {
  postas: Posta[];
  medicamentos: Medicamento[];
  movimientos: Movimiento[];
  ingresos: Ingreso[];
  stockActual: StockActual[];
  hoyStr: string; // Formato YYYY-MM-DD
}

// Helpers de fecha locales para el cliente
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ComparativasPanel({
  postas,
  medicamentos,
  movimientos,
  ingresos,
  stockActual,
  hoyStr
}: ComparativasPanelProps) {
  const [selectedPostaId, setSelectedPostaId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"wow-mom" | "compare-postas" | "history">("wow-mom");

  // Postas elegidas para comparación cruzada
  const defaultPostaA = postas[0]?.id ?? "";
  const defaultPostaB = postas[1]?.id ?? postas[0]?.id ?? "";
  const [postaAId, setPostaAId] = useState<string>(defaultPostaA);
  const [postaBId, setPostaBId] = useState<string>(defaultPostaB);

  // Ordenamiento de tabla principal
  const [sortBy, setSortBy] = useState<"nombre" | "wow" | "mom" | "stock">("nombre");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Ordenamiento de tabla de comparación cruzada
  const [sortByCompare, setSortByCompare] = useState<"nombre" | "postaA" | "postaB" | "diferencia">("nombre");
  const [sortOrderCompare, setSortOrderCompare] = useState<"asc" | "desc">("asc");

  const [y, m, d] = useMemo(() => hoyStr.split("-").map(Number), [hoyStr]);

  // Rangos de Fechas
  const dateRanges = useMemo(() => {
    // WoW
    const w1Start = addDays(hoyStr, -6);
    const w1End = hoyStr;
    const w2Start = addDays(hoyStr, -13);
    const w2End = addDays(hoyStr, -7);

    // MoM (Relativo)
    const m1Start = `${y}-${String(m).padStart(2, "0")}-01`;
    const m1End = hoyStr;

    let prevMonth = m - 1;
    let prevYear = y;
    if (prevMonth <= 0) {
      prevMonth = 12;
      prevYear = y - 1;
    }
    const m2Start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const lastDayPrevMonth = getDaysInMonth(prevYear, prevMonth);
    const relativeDay = Math.min(d, lastDayPrevMonth);
    const m2End = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(relativeDay).padStart(2, "0")}`;

    // 6 Meses
    const monthsList: { label: string; key: string }[] = [];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      let year = y;
      let month = m - i;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      monthsList.push({
        label: `${monthNames[month - 1]} ${year}`,
        key: `${year}-${String(month).padStart(2, "0")}`
      });
    }

    return {
      w1Start, w1End,
      w2Start, w2End,
      m1Start, m1End,
      m2Start, m2End,
      monthsList
    };
  }, [hoyStr, y, m, d]);

  // Filtrado de data base según la Posta elegida (para pestaña WoW/MoM e Historial)
  const { filteredMovs, filteredIngresos, filteredStock } = useMemo(() => {
    if (selectedPostaId === "all") {
      return {
        filteredMovs: movimientos,
        filteredIngresos: ingresos,
        filteredStock: stockActual
      };
    }
    return {
      filteredMovs: movimientos.filter((x) => x.postaId === selectedPostaId),
      filteredIngresos: ingresos.filter((x) => x.postaId === selectedPostaId),
      filteredStock: stockActual.filter((x) => x.postaId === selectedPostaId)
    };
  }, [selectedPostaId, movimientos, ingresos, stockActual]);

  // Mapear stock disponible
  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredStock) {
      map.set(s.medicamentoId, (map.get(s.medicamentoId) ?? 0) + s.stockFinal);
    }
    return map;
  }, [filteredStock]);

  // Cálculos por Medicamento (WoW, MoM)
  const medStats = useMemo(() => {
    const map = new Map<string, { w1: number; w2: number; m1: number; m2: number }>();

    for (const mov of filteredMovs) {
      const mid = mov.medicamentoId;
      if (!map.has(mid)) {
        map.set(mid, { w1: 0, w2: 0, m1: 0, m2: 0 });
      }
      const stats = map.get(mid)!;

      // Evaluar WoW
      if (mov.fecha >= dateRanges.w1Start && mov.fecha <= dateRanges.w1End) {
        stats.w1 += mov.totalDia;
      } else if (mov.fecha >= dateRanges.w2Start && mov.fecha <= dateRanges.w2End) {
        stats.w2 += mov.totalDia;
      }

      // Evaluar MoM
      if (mov.fecha >= dateRanges.m1Start && mov.fecha <= dateRanges.m1End) {
        stats.m1 += mov.totalDia;
      } else if (mov.fecha >= dateRanges.m2Start && mov.fecha <= dateRanges.m2End) {
        stats.m2 += mov.totalDia;
      }
    }

    return map;
  }, [filteredMovs, dateRanges]);

  // KPI resumidos de alto nivel
  const kpis = useMemo(() => {
    let totW1 = 0;
    let totW2 = 0;
    let totM1 = 0;
    let totM2 = 0;

    let maxAlzaMedId = "";
    let maxAlzaVal = -Infinity;
    let maxBajaMedId = "";
    let maxBajaVal = Infinity;

    for (const med of medicamentos) {
      const stats = medStats.get(med.id) || { w1: 0, w2: 0, m1: 0, m2: 0 };
      totW1 += stats.w1;
      totW2 += stats.w2;
      totM1 += stats.m1;
      totM2 += stats.m2;

      // Calcular diferencias WoW absolutas
      const diffW = stats.w1 - stats.w2;
      if (diffW > 0 && diffW > maxAlzaVal) {
        maxAlzaVal = diffW;
        maxAlzaMedId = med.id;
      }
      if (diffW < 0 && diffW < maxBajaVal) {
        maxBajaVal = diffW;
        maxBajaMedId = med.id;
      }
    }

    const diffW = totW1 - totW2;
    const pctW = totW2 === 0 ? 0 : Math.round((diffW / totW2) * 100);

    const diffM = totM1 - totM2;
    const pctM = totM2 === 0 ? 0 : Math.round((diffM / totM2) * 100);

    // Balance de entradas y salidas en el mes actual
    let ingresosM1 = 0;
    for (const ing of filteredIngresos) {
      if (ing.fecha >= dateRanges.m1Start && ing.fecha <= dateRanges.m1End) {
        ingresosM1 += ing.cantidad;
      }
    }
    const balanceM1 = ingresosM1 - totM1;

    const medMaxAlza = medicamentos.find((m) => m.id === maxAlzaMedId);
    const medMaxBaja = medicamentos.find((m) => m.id === maxBajaMedId);

    return {
      totW1, totW2, diffW, pctW,
      totM1, totM2, diffM, pctM,
      ingresosM1, balanceM1,
      medMaxAlza, maxAlzaVal: maxAlzaVal === -Infinity ? 0 : maxAlzaVal,
      medMaxBaja, maxBajaVal: maxBajaVal === Infinity ? 0 : Math.abs(maxBajaVal)
    };
  }, [medicamentos, medStats, filteredIngresos, dateRanges]);

  // Historial de 6 meses
  const historyStats = useMemo(() => {
    return dateRanges.monthsList.map(({ label, key }) => {
      // Sumar consumos del mes
      const egr = filteredMovs
        .filter((m) => m.fecha.startsWith(key))
        .reduce((sum, item) => sum + item.totalDia, 0);

      // Sumar ingresos del mes
      const ing = filteredIngresos
        .filter((i) => i.fecha.startsWith(key))
        .reduce((sum, item) => sum + item.cantidad, 0);

      return {
        mesLabel: label,
        ingresos: ing,
        egresos: egr,
        balance: ing - egr
      };
    });
  }, [filteredMovs, filteredIngresos, dateRanges]);

  // Lista de Medicamentos filtrada y ordenada para la pestaña principal
  const filteredAndSortedMeds = useMemo(() => {
    // 1. Filtrado
    const query = searchQuery.trim().toLowerCase();
    const result = medicamentos.filter((med) => {
      if (query === "") return true;
      return (
        med.nombre.toLowerCase().includes(query) ||
        med.categoria.toLowerCase().includes(query)
      );
    });

    // 2. Ordenado
    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === "nombre") {
        valA = a.nombre.toLowerCase();
        valB = b.nombre.toLowerCase();
      } else if (sortBy === "wow") {
        const sa = medStats.get(a.id);
        const sb = medStats.get(b.id);
        valA = sa ? sa.w1 - sa.w2 : 0;
        valB = sb ? sb.w1 - sb.w2 : 0;
      } else if (sortBy === "mom") {
        const sa = medStats.get(a.id);
        const sb = medStats.get(b.id);
        valA = sa ? sa.m1 - sa.m2 : 0;
        valB = sb ? sb.m1 - sb.m2 : 0;
      } else if (sortBy === "stock") {
        valA = stockMap.get(a.id) ?? 0;
        valB = stockMap.get(b.id) ?? 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [medicamentos, searchQuery, sortBy, sortOrder, medStats, stockMap]);

  // Lógica de comparación cruzada entre Posta A y Posta B
  const crossCompareStats = useMemo(() => {
    const mapA = new Map<string, { week: number; month: number }>();
    const mapB = new Map<string, { week: number; month: number }>();

    const movsA = movimientos.filter((m) => m.postaId === postaAId);
    const movsB = movimientos.filter((m) => m.postaId === postaBId);

    // Posta A
    for (const m of movsA) {
      const mid = m.medicamentoId;
      if (!mapA.has(mid)) mapA.set(mid, { week: 0, month: 0 });
      const stats = mapA.get(mid)!;
      if (m.fecha >= dateRanges.w1Start && m.fecha <= dateRanges.w1End) {
        stats.week += m.totalDia;
      }
      if (m.fecha >= dateRanges.m1Start && m.fecha <= dateRanges.m1End) {
        stats.month += m.totalDia;
      }
    }

    // Posta B
    for (const m of movsB) {
      const mid = m.medicamentoId;
      if (!mapB.has(mid)) mapB.set(mid, { week: 0, month: 0 });
      const stats = mapB.get(mid)!;
      if (m.fecha >= dateRanges.w1Start && m.fecha <= dateRanges.w1End) {
        stats.week += m.totalDia;
      }
      if (m.fecha >= dateRanges.m1Start && m.fecha <= dateRanges.m1End) {
        stats.month += m.totalDia;
      }
    }

    let countAMayor = 0;
    let countBMayor = 0;
    let countIgual = 0;
    let totalConsumoA = 0;
    let totalConsumoB = 0;

    for (const med of medicamentos) {
      const a = mapA.get(med.id) || { week: 0, month: 0 };
      const b = mapB.get(med.id) || { week: 0, month: 0 };

      totalConsumoA += a.month;
      totalConsumoB += b.month;

      if (a.month > b.month) {
        countAMayor++;
      } else if (b.month > a.month) {
        countBMayor++;
      } else if (a.month > 0 || b.month > 0) {
        countIgual++;
      }
    }

    return {
      mapA,
      mapB,
      countAMayor,
      countBMayor,
      countIgual,
      totalConsumoA,
      totalConsumoB
    };
  }, [movimientos, medicamentos, postaAId, postaBId, dateRanges]);

  // Lista filtrada y ordenada para la pestaña de comparación cruzada
  const filteredAndSortedCompareMeds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = medicamentos.filter((med) => {
      if (query === "") return true;
      return (
        med.nombre.toLowerCase().includes(query) ||
        med.categoria.toLowerCase().includes(query)
      );
    });

    result.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      const statsA_medA = crossCompareStats.mapA.get(a.id) || { week: 0, month: 0 };
      const statsB_medA = crossCompareStats.mapB.get(a.id) || { week: 0, month: 0 };

      const statsA_medB = crossCompareStats.mapA.get(b.id) || { week: 0, month: 0 };
      const statsB_medB = crossCompareStats.mapB.get(b.id) || { week: 0, month: 0 };

      if (sortByCompare === "nombre") {
        valA = a.nombre.toLowerCase();
        valB = b.nombre.toLowerCase();
      } else if (sortByCompare === "postaA") {
        valA = statsA_medA.month;
        valB = statsA_medB.month;
      } else if (sortByCompare === "postaB") {
        valA = statsB_medA.month;
        valB = statsB_medB.month;
      } else if (sortByCompare === "diferencia") {
        valA = Math.abs(statsA_medA.month - statsB_medA.month);
        valB = Math.abs(statsA_medB.month - statsB_medB.month);
      }

      if (valA < valB) return sortOrderCompare === "asc" ? -1 : 1;
      if (valA > valB) return sortOrderCompare === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [medicamentos, searchQuery, sortByCompare, sortOrderCompare, crossCompareStats]);

  const handleSort = (field: "nombre" | "wow" | "mom" | "stock") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleSortCompare = (field: "nombre" | "postaA" | "postaB" | "diferencia") => {
    if (sortByCompare === field) {
      setSortOrderCompare(sortOrderCompare === "asc" ? "desc" : "asc");
    } else {
      setSortByCompare(field);
      setSortOrderCompare("desc");
    }
  };

  const selectedPostaNombre = useMemo(() => {
    if (selectedPostaId === "all") return "Todas las postas";
    return postas.find((p) => p.id === selectedPostaId)?.nombre ?? "";
  }, [selectedPostaId, postas]);

  const postaANombre = useMemo(() => {
    return postas.find((p) => p.id === postaAId)?.nombre ?? "Posta 1";
  }, [postaAId, postas]);

  const postaBNombre = useMemo(() => {
    return postas.find((p) => p.id === postaBId)?.nombre ?? "Posta 2";
  }, [postaBId, postas]);

  return (
    <div className="space-y-6">
      {/* Barra de Filtros (Solo visible en pestañas WoW/MoM e Historial) */}
      {activeTab !== "compare-postas" && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/80 bg-card/65 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex items-center justify-center text-primary">
              <Hospital className="size-5" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtrar Postas</label>
              <select
                value={selectedPostaId}
                onChange={(e) => setSelectedPostaId(e.target.value)}
                className="mt-0.5 bg-transparent font-medium text-foreground text-sm focus:outline-none cursor-pointer max-w-[200px]"
              >
                <option value="all" className="bg-popover text-foreground">Todas las Postas</option>
                {postas.map((p) => (
                  <option key={p.id} value={p.id} className="bg-popover text-foreground">
                    {p.nombre} {p.codigo ? `(${p.codigo})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeTab === "wow-mom" && (
            <div className="relative w-full max-w-[320px] shrink-0">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar medicamento o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs border-border/80 bg-background/50 focus-visible:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {/* Barra de Filtros Especial para Comparación de Postas */}
      {activeTab === "compare-postas" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-border/80 bg-card/65 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-6 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Hospital className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Posta Comparativa A</span>
                <select
                  value={postaAId}
                  onChange={(e) => setPostaAId(e.target.value)}
                  className="mt-0.5 bg-transparent font-semibold text-foreground text-sm focus:outline-none cursor-pointer"
                >
                  {postas.map((p) => (
                    <option key={p.id} value={p.id} className="bg-popover text-foreground">
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hidden lg:block text-muted-foreground/40 font-light text-lg">vs</div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Hospital className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Posta Comparativa B</span>
                <select
                  value={postaBId}
                  onChange={(e) => setPostaBId(e.target.value)}
                  className="mt-0.5 bg-transparent font-semibold text-foreground text-sm focus:outline-none cursor-pointer"
                >
                  {postas.map((p) => (
                    <option key={p.id} value={p.id} className="bg-popover text-foreground">
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-[320px] shrink-0">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar medicamento o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs border-border/80 bg-background/50 focus-visible:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Tarjetas Resumen (KPI) - WoW/MoM */}
      {activeTab === "wow-mom" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Consumo Semanal</span>
              <div className="flex size-8 items-center justify-center rounded-lg text-sky-600 dark:text-sky-400">
                <Activity className="size-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {kpis.totW1} <span className="text-xs font-normal text-muted-foreground">unids.</span>
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {kpis.diffW > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowUpRight className="size-3" />
                    +{kpis.pctW}% (+{kpis.diffW})
                  </span>
                ) : kpis.diffW < 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownRight className="size-3" />
                    {kpis.pctW}% ({kpis.diffW})
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground">
                    Sin cambio (0)
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/80">vs sem. anterior</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Consumo Mensual Acumulado</span>
              <div className="flex size-8 items-center justify-center rounded-lg text-emerald-600 dark:text-emerald-400">
                <Calendar className="size-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                {kpis.totM1} <span className="text-xs font-normal text-muted-foreground">unids.</span>
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {kpis.diffM > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <ArrowUpRight className="size-3" />
                    +{kpis.pctM}% (+{kpis.diffM})
                  </span>
                ) : kpis.diffM < 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownRight className="size-3" />
                    {kpis.pctM}% ({kpis.diffM})
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground">
                    Sin cambio (0)
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/80">vs periodo anterior</span>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mayor Aumento Semanal</span>
              <div className="flex size-8 items-center justify-center rounded-lg text-rose-600 dark:text-rose-400">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="mt-4">
              {kpis.medMaxAlza ? (
                <>
                  <p className="font-heading text-sm font-bold text-foreground truncate max-w-[210px]" title={kpis.medMaxAlza.nombre}>
                    {kpis.medMaxAlza.nombre}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      +{kpis.maxAlzaVal} unids.
                    </span>
                    <span className="text-[10px] text-muted-foreground/85">esta semana</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-muted-foreground">Sin registros</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-2">Consumo estable o nulo</p>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balance Stock Mes</span>
              <div className="flex size-8 items-center justify-center rounded-lg text-amber-600 dark:text-amber-400">
                <Package className="size-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className={cn(
                "text-xl font-extrabold tracking-tight tabular-nums",
                kpis.balanceM1 >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {kpis.balanceM1 >= 0 ? "+" : ""}{kpis.balanceM1} <span className="text-xs font-normal text-muted-foreground">unids.</span>
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-2 leading-tight">
                Ingresos ({kpis.ingresosM1}) − Descuentos ({kpis.totM1}) en este mes
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Tarjetas Resumen (KPI) - Comparación entre Postas */}
      {activeTab === "compare-postas" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mayor Consumo en {postaANombre}</p>
            <p className="text-3xl font-extrabold text-sky-600 dark:text-sky-400 mt-2.5 tabular-nums">
              {crossCompareStats.countAMayor} <span className="text-xs font-normal text-muted-foreground">insumos</span>
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1.5">
              Consumo acumulado del mes: <span className="font-bold text-foreground">{crossCompareStats.totalConsumoA} unids.</span>
            </p>
          </Card>

          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mayor Consumo en {postaBNombre}</p>
            <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2.5 tabular-nums">
              {crossCompareStats.countBMayor} <span className="text-xs font-normal text-muted-foreground">insumos</span>
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1.5">
              Consumo acumulado del mes: <span className="font-bold text-foreground">{crossCompareStats.totalConsumoB} unids.</span>
            </p>
          </Card>

          <Card className="p-5 border-border/80 bg-card/45 backdrop-blur shadow-sm hover:shadow-md transition-all">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Consumo Idéntico</p>
            <p className="text-3xl font-extrabold text-muted-foreground mt-2.5 tabular-nums">
              {crossCompareStats.countIgual} <span className="text-xs font-normal text-muted-foreground">insumos</span>
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1.5">
              Ambas postas registran el mismo número de descuentos.
            </p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        <button
          onClick={() => setActiveTab("wow-mom")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-all duration-150 -mb-[2px] shrink-0",
            activeTab === "wow-mom"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Comparativa por Medicamento
        </button>
        <button
          onClick={() => setActiveTab("compare-postas")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-all duration-150 -mb-[2px] shrink-0",
            activeTab === "compare-postas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Comparar entre Postas
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "pb-3 text-sm font-semibold border-b-2 px-4 transition-all duration-150 -mb-[2px] shrink-0",
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Historial de Ingresos / Descuentos (6 meses)
        </button>
      </div>

      {/* Contenido de Tab: WoW / MoM */}
      {activeTab === "wow-mom" && (
        <Card className="overflow-hidden border border-border/80 bg-card/30 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors"
                    onClick={() => handleSort("nombre")}
                  >
                    <div className="flex items-center gap-1">
                      Medicamento
                      {sortBy === "nombre" ? (
                        sortOrder === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-right"
                    onClick={() => handleSort("wow")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Consumo Semanal
                      {sortBy === "wow" ? (
                        sortOrder === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-right"
                    onClick={() => handleSort("mom")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Consumo Mensual
                      {sortBy === "mom" ? (
                        sortOrder === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-right"
                    onClick={() => handleSort("stock")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stock Disp.
                      {sortBy === "stock" ? (
                        sortOrder === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAndSortedMeds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      No se encontraron medicamentos para esta búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedMeds.map((med) => {
                    const stats = medStats.get(med.id) || { w1: 0, w2: 0, m1: 0, m2: 0 };
                    const stock = stockMap.get(med.id) ?? 0;

                    const diffW = stats.w1 - stats.w2;
                    const pctW = stats.w2 === 0 ? 0 : Math.round((diffW / stats.w2) * 100);

                    const diffM = stats.m1 - stats.m2;
                    const pctM = stats.m2 === 0 ? 0 : Math.round((diffM / stats.m2) * 100);

                    return (
                      <tr key={med.id} className="hover:bg-muted/20 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{med.nombre}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                              <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 uppercase font-semibold font-mono tracking-wider">
                                {med.categoria}
                              </span>
                              <span>·</span>
                              <span>{med.unidadMedida}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-foreground tabular-nums">
                              {stats.w1} <span className="text-[10px] text-muted-foreground/60">esta sem.</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground/75 tabular-nums">
                              {stats.w2} ant.
                            </span>
                            {diffW > 0 ? (
                              <span className="inline-flex items-center mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <ArrowUpRight className="size-2.5 mr-0.5 shrink-0" />
                                +{pctW}% (+{diffW})
                              </span>
                            ) : diffW < 0 ? (
                              <span className="inline-flex items-center mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <ArrowDownRight className="size-2.5 mr-0.5 shrink-0" />
                                {pctW}% ({diffW})
                              </span>
                            ) : (
                              <span className="inline-flex mt-1 text-[10px] font-medium text-muted-foreground/60">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-foreground tabular-nums">
                              {stats.m1} <span className="text-[10px] text-muted-foreground/60">este mes</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground/75 tabular-nums">
                              {stats.m2} ant.
                            </span>
                            {diffM > 0 ? (
                              <span className="inline-flex items-center mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <ArrowUpRight className="size-2.5 mr-0.5 shrink-0" />
                                +{pctM}% (+{diffM})
                              </span>
                            ) : diffM < 0 ? (
                              <span className="inline-flex items-center mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                <ArrowDownRight className="size-2.5 mr-0.5 shrink-0" />
                                {pctM}% ({diffM})
                              </span>
                            ) : (
                              <span className="inline-flex mt-1 text-[10px] font-medium text-muted-foreground/60">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          <div className="flex flex-col items-end justify-center h-full">
                            <span className={cn("font-bold text-sm", stock > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                              {stock}
                            </span>
                            <span className="text-[9px] text-muted-foreground/50 font-medium">unidades</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Contenido de Tab: Comparar entre Postas */}
      {activeTab === "compare-postas" && (
        <Card className="overflow-hidden border border-border/80 bg-card/30 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-left">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors"
                    onClick={() => handleSortCompare("nombre")}
                  >
                    <div className="flex items-center gap-1">
                      Medicamento
                      {sortByCompare === "nombre" ? (
                        sortOrderCompare === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-right"
                    onClick={() => handleSortCompare("postaA")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Consumo {postaANombre}
                      {sortByCompare === "postaA" ? (
                        sortOrderCompare === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-right"
                    onClick={() => handleSortCompare("postaB")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Consumo {postaBNombre}
                      {sortByCompare === "postaB" ? (
                        sortOrderCompare === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3.5 cursor-pointer hover:bg-muted/65 transition-colors text-center"
                    onClick={() => handleSortCompare("diferencia")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Mayor Consumidor
                      {sortByCompare === "diferencia" ? (
                        sortOrderCompare === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : null}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAndSortedCompareMeds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      No se encontraron medicamentos para esta comparación.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedCompareMeds.map((med) => {
                    const statsA = crossCompareStats.mapA.get(med.id) || { week: 0, month: 0 };
                    const statsB = crossCompareStats.mapB.get(med.id) || { week: 0, month: 0 };
                    const diff = statsA.month - statsB.month;

                    return (
                      <tr key={med.id} className="hover:bg-muted/20 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{med.nombre}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                              <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 uppercase font-semibold font-mono tracking-wider">
                                {med.categoria}
                              </span>
                              <span>·</span>
                              <span>{med.unidadMedida}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-foreground tabular-nums">
                              {statsA.month} <span className="text-[10px] text-muted-foreground/60">mes</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground/75 tabular-nums">
                              {statsA.week} sem.
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-foreground tabular-nums">
                              {statsB.month} <span className="text-[10px] text-muted-foreground/60">mes</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground/75 tabular-nums">
                              {statsB.week} sem.
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {diff > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-700 dark:text-sky-400">
                              {postaANombre} (+{diff})
                            </span>
                          ) : diff < 0 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                              {postaBNombre} (+{Math.abs(diff)})
                            </span>
                          ) : statsA.month > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-muted border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              Consumo idéntico ({statsA.month})
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs font-light">Sin consumo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Contenido de Tab: Historial de Ingresos y Descuentos */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-sky-500/10 bg-sky-500/5 px-4 py-3 text-xs text-sky-700 dark:text-sky-300">
            <Info className="size-4 shrink-0 text-sky-500" />
            <p>
              Los **Ingresos** representan las cargas de stock ingresadas a la posta, mientras que los **Descuentos** indican los medicamentos rebajados mediante las operaciones diarias. Un **Balance Neto** positivo señala acumulación de stock y uno negativo indica reducción del stock.
            </p>
          </div>

          <Card className="overflow-hidden border border-border/80 bg-card/30 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3.5">Período Mensual</th>
                    <th className="px-6 py-3.5 text-right">Ingresos</th>
                    <th className="px-6 py-3.5 text-right">Descuentos</th>
                    <th className="px-6 py-3.5 text-right">Balance Neto</th>
                    <th className="px-6 py-3.5 text-center">Estado del Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {historyStats.map((row) => (
                    <tr key={row.mesLabel} className="hover:bg-muted/20 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <span className="font-bold text-foreground">{row.mesLabel}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-foreground/80 tabular-nums">
                        +{row.ingresos}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-foreground/80 tabular-nums">
                        {row.egresos}
                      </td>
                      <td className="px-6 py-4 text-right font-bold tabular-nums">
                        <span className={cn(
                          row.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : row.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                        )}>
                          {row.balance > 0 ? "+" : ""}{row.balance}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.balance > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Aumento de stock
                          </span>
                        ) : row.balance < 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            Disminución de stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                            Sin cambios
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
