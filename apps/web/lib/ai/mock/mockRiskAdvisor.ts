import { DashboardAIInput, DashboardAIOutput, RiskAIInput, RiskAIOutput } from '../types';

export class MockRiskAdvisor {
  public static async generateAdvisory(input: DashboardAIInput): Promise<DashboardAIOutput> {
    // Artificial latency delay
    await new Promise((resolve) => setTimeout(resolve, 350));

    const slippageAvg = input.currentSlippageBps;
    const computeAvg = input.meanComputeLatencyMs;
    
    // Determine mathematical recommendation
    let floorUSD = 15.00;
    let confidence = 0.945;
    let summaryEn = '';
    let summaryEs = '';

    if (slippageAvg > 15) {
      floorUSD = 24.50;
      confidence = 0.88;
      summaryEn = `Increased order book slippage detected (${slippageAvg} BPS). Recommend elevating Minimum Net Profit to $24.50 to absorb spread compression risk.`;
      summaryEs = `Se detectó un deslizamiento elevado en el libro de órdenes (${slippageAvg} BPS). Se recomienda elevar el Beneficio Neto Mínimo a $24.50 para mitigar la compresión del diferencial.`;
    } else if (computeAvg > 2.5) {
      floorUSD = 18.00;
      confidence = 0.91;
      summaryEn = `Compute latency spike identified (${computeAvg.toFixed(2)}ms). Volatility drift buffer should be padded. Recommend adjusting profit floor to $18.00.`;
      summaryEs = `Pico de latencia de cómputo detectado (${computeAvg.toFixed(2)}ms). Se sugiere ampliar el colchón de deriva de volatilidad. Ajuste recomendado: $18.00.`;
    } else {
      summaryEn = `Nominal latency (${computeAvg.toFixed(2)}ms) and slippage (${slippageAvg} BPS) observed. Maintaining stable calibration of $15.00 profit floor.`;
      summaryEs = `Latencia nominal (${computeAvg.toFixed(2)}ms) y deslizamiento bajo (${slippageAvg} BPS). Manteniendo calibración estándar de beneficio mínimo de $15.00.`;
    }

    return {
      recommendedProfitFloorUSD: floorUSD,
      sizingConfidenceScore: confidence,
      telemetrySummary: {
        en: summaryEn,
        es: summaryEs,
      },
      lastChecked: new Date().toISOString(),
    };
  }

  public static async calibrateRisk(input: RiskAIInput): Promise<RiskAIOutput> {
    await new Promise((resolve) => setTimeout(resolve, 450));

    const zScore = input.rollingVolatilityZScore;
    let profitFloor = input.currentRiskParams.minNetProfitUSD;
    let driftBuffer = input.currentRiskParams.latencyDriftBufferBps;
    let safetyCushion = input.currentRiskParams.slippageSafetyBps;

    let rationaleEn = '';
    let rationaleEs = '';
    let zExplEn = '';
    let zExplEs = '';

    if (zScore > 2.0) {
      // High Volatility scenario
      profitFloor = Math.max(profitFloor, 25.00);
      driftBuffer = 5; // Pad from 3
      safetyCushion = 15; // Pad from 10
      rationaleEn = 'Macro volatility surge (Z-Score > 2.0). Widening drift buffer to 5 BPS and slippage cushion to 15 BPS to prevent execution failure in sweeping markets.';
      rationaleEs = 'Incremento súbito en volatilidad macro (Z-Score > 2.0). Se amplía el búfer de latencia a 5 BPS y el colchón de deslizamiento a 15 BPS para evitar fallos de ejecución.';
      zExplEn = `Z-Score of ${zScore.toFixed(2)} indicates variance exceeds 2-sigma historical bounds. Spread drift risk is elevated.`;
      zExplEs = `Z-Score de ${zScore.toFixed(2)} indica que la varianza supera el límite histórico de 2-sigma. El riesgo de deriva es alto.`;
    } else if (zScore < -1.0) {
      // Very Compressed volatility
      profitFloor = Math.max(10.00, profitFloor - 3);
      driftBuffer = 2;
      safetyCushion = 8;
      rationaleEn = 'Highly compressed spreads. Latency jitter is low; recommend reducing parameters (floor: $10.00, slippage: 8 BPS) to capture low-spread cross-exchange loops safely.';
      rationaleEs = 'Diferenciales altamente comprimidos. La variabilidad es muy baja; se aconseja reducir parámetros (mínimo: $10.00, deslizamiento: 8 BPS) para capturar ciclos estrechos de forma segura.';
      zExplEn = `Z-Score of ${zScore.toFixed(2)} reflects extreme market compression. Spreads are thin but execution certainty is high.`;
      zExplEs = `Z-Score de ${zScore.toFixed(2)} refleja compresión extrema. Los diferenciales son estrechos pero la certidumbre de ejecución es muy alta.`;
    } else {
      // Nominal
      rationaleEn = 'Volatility is within 1-sigma normal limits. No immediate recalibration necessary. Standard configurations are mathematically optimized.';
      rationaleEs = 'La volatilidad se mantiene en rangos normales de 1-sigma. No se requiere calibración urgente. Los parámetros nominales están optimizados.';
      zExplEn = `Z-Score of ${zScore.toFixed(2)} is stable. Volatility levels are average.`;
      zExplEs = `Z-Score de ${zScore.toFixed(2)} es estable. Los niveles de volatilidad se encuentran en la media del sistema.`;
    }

    return {
      suggestedParams: {
        minNetProfitUSD: profitFloor,
        latencyDriftBufferBps: driftBuffer,
        slippageSafetyBps: safetyCushion,
      },
      calibrationRationale: { en: rationaleEn, es: rationaleEs },
      zScoreExplanation: { en: zExplEn, es: zExplEs },
    };
  }
}
