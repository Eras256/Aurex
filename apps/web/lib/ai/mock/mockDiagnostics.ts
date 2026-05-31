import { HealthAIInput, HealthAIOutput, TradeCritiqueInput, TradeCritiqueOutput, OpportunityAIInput, OpportunityAIOutput } from '../types';

export class MockDiagnostics {
  public static async diagnoseHealth(input: HealthAIInput): Promise<HealthAIOutput> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const jitter = input.jitterVarianceMs;
    const disconnects = Object.values(input.reconnectCounts).reduce((a, b) => a + b, 0);

    let rating: 'NOMINAL' | 'DEGRADED' | 'CRITICAL' = 'NOMINAL';
    let analysisEn = '';
    let analysisEs = '';

    if (disconnects > 3) {
      rating = 'CRITICAL';
      analysisEn = `Critical instability: ${disconnects} reconnects logged across feeds in last window. Network diagnostic isolates Bybit gateway packet drop. Recommending failover trigger.`;
      analysisEs = `Inestabilidad crítica: ${disconnects} reconexiones registradas en la última ventana. El diagnóstico aísla pérdida de paquetes en el nodo Bybit. Se recomienda redundancia.`;
    } else if (jitter > 8.0) {
      rating = 'DEGRADED';
      analysisEn = `Network jitter spike observed (+${jitter.toFixed(1)}ms). AI diagnostics trace routing congestion on AWS us-east CEX connection hops. Spreads are highly vulnerable to race execution decay.`;
      analysisEs = `Pico de varianza de red detectado (+${jitter.toFixed(1)}ms). El diagnóstico rastrea congestión en los saltos de conexión AWS us-east. Los diferenciales son altamente vulnerables a carreras de ejecución.`;
    } else {
      analysisEn = `Connection telemetry clean. Network jitter variance (+${jitter.toFixed(2)}ms) remains within standard deviations. Taker fee API handshakes responding under 15ms. Node is fully optimal.`;
      analysisEs = `Telemetría de red limpia. La varianza de retardo (+${jitter.toFixed(2)}ms) permanece en desviaciones estándar normales. Apertura de APIs por debajo de 15ms. El nodo está optimizado.`;
    }

    return {
      healthRating: rating,
      telemetryAnalysis: {
        en: analysisEn,
        es: analysisEs,
      },
    };
  }

  public static async critiqueTrade(input: TradeCritiqueInput): Promise<TradeCritiqueOutput> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const latency = input.elapsedExecutionMs;
    const slippage = input.slippageUSD;

    let score = 100;
    let detailsEn = '';
    let detailsEs = '';

    // Calculate score
    if (latency > 50) score -= 15;
    if (slippage > 2.0) score -= 10;
    if (slippage > 5.0) score -= 15;
    score = Math.max(50, score);

    if (score >= 90) {
      detailsEn = `Excellent execution. Sized order walked L2 depth with near-zero slippage ($${slippage.toFixed(2)}) within a ${latency}ms latency window. Net return maximized.`;
      detailsEs = `Ejecución óptima. El algoritmo recorrió la profundidad L2 con deslizamiento mínimo ($${slippage.toFixed(2)}) dentro de una ventana de latencia de ${latency}ms. Retorno neto maximizado.`;
    } else if (score >= 75) {
      detailsEn = `Acceptable trade loop. Execution latency of ${latency}ms caused a minor slippage drag of $${slippage.toFixed(2)}. Suggest checking CEX WebSocket queues.`;
      detailsEs = `Ciclo aceptable. La latencia de ejecución de ${latency}ms causó un arrastre leve de deslizamiento de $${slippage.toFixed(2)}. Se sugiere verificar colas del WebSocket.`;
    } else {
      detailsEn = `Suboptimal loop speed. High compute/network lag (${latency}ms) exposed order to adverse queue sweeping. Slippage was elevated at $${slippage.toFixed(2)}. Fee parameters might require wider buffers.`;
      detailsEs = `Velocidad subóptima. El rezago computacional/red (${latency}ms) expuso la orden a barridos de cola desfavorables. Deslizamiento alto de $${slippage.toFixed(2)}. Requiere ampliar colchones de costos.`;
    }

    return {
      vwapEfficiencyScore: score,
      critiqueDetails: {
        en: detailsEn,
        es: detailsEs,
      },
    };
  }

  public static async explainOpportunity(input: OpportunityAIInput): Promise<OpportunityAIOutput> {
    await new Promise((resolve) => setTimeout(resolve, 250));

    const gross = input.grossSpreadUSD;
    const estCost = input.estimatedCostUSD;
    const net = gross - estCost;
    
    let rating: 'EXCELLENT' | 'HIGH_RISK' | 'SKIPPED_UNPROFITABLE' = 'EXCELLENT';
    let summaryEn = '';
    let summaryEs = '';

    if (net < 0) {
      rating = 'SKIPPED_UNPROFITABLE';
      summaryEn = `Trade bypassed. Gross spread of $${gross.toFixed(2)} USD failed to clear minimum taker fee drag ($${(estCost * 0.6).toFixed(2)}) plus latency drift safety ($${(estCost * 0.4).toFixed(2)}).`;
      summaryEs = `Operación omitida. El diferencial bruto de $${gross.toFixed(2)} USD no logró superar comisiones de taker ($${(estCost * 0.6).toFixed(2)}) más la deriva de latencia ($${(estCost * 0.4).toFixed(2)}).`;
    } else if (net < 5.0) {
      rating = 'HIGH_RISK';
      summaryEn = `Thin edge detected ($${net.toFixed(2)} USD). Margin is highly sensitive to CEX order queue latency. Execution risk is elevated.`;
      summaryEs = `Margen estrecho detectado ($${net.toFixed(2)} USD). El ciclo es altamente sensible a la latencia de colas del CEX. El riesgo es alto.`;
    } else {
      rating = 'EXCELLENT';
      summaryEn = `Optimal candidate. Net margin ($${net.toFixed(2)} USD) is secure, backed by robust L2 depth buy-walls across connected venues.`;
      summaryEs = `Candidato óptimo. El margen neto ($${net.toFixed(2)} USD) está asegurado y respaldado por sólidas paredes de compra L2 en los venues conectados.`;
    }

    return {
      executionRating: rating,
      explainabilitySummary: {
        en: summaryEn,
        es: summaryEs,
      },
      costBreakdown: {
        takerFeeUSD: estCost * 0.6,
        slippageBufferUSD: estCost * 0.3,
        latencyRiskUSD: estCost * 0.1,
      },
    };
  }
}
