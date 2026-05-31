import { AuditLogEntry, RiskParams } from '../types';

export interface PredefinedScenario {
  key: string;
  triggerPrefix: string;
  confidence: number;
  promptVersion: string;
  modelIdentifier: string;
  explainability: {
    rationaleEn: string;
    rationaleEs: string;
    detailsEn: string;
    detailsEs: string;
  };
  toolCalls: Array<{ name: string; durationMs: number; result: string }>;
  suggestedParams?: RiskParams;
  contentEn: string;
  contentEs: string;
  finalDecision: 'ACCEPTED' | 'REJECTED' | 'BYPASSED';
}

export const PREDEFINED_SCENARIOS: PredefinedScenario[] = [
  {
    key: 'suggest_params',
    triggerPrefix: 'Suggest risk parameters based on the last 2 hours',
    confidence: 0.94,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Mathematical evaluation of rolling 120-minute WebSocket spreads reveals high volatility spikes on Bybit Spot leg.',
      rationaleEs: 'La evaluación matemática de los diferenciales de WebSocket en los últimos 120 minutos revela picos de alta volatilidad en Bybit Spot.',
      detailsEn: 'Analyzed 7,200 order books. Found that spread drift exceeds nominal 1.2-sigma standard deviations. Fee models dictate a larger margin buffer to prevent slippage erosion.',
      detailsEs: 'Se analizaron 7,200 libros de órdenes. Se detectó que la deriva supera las desviaciones estándar de 1.2-sigma. Los costos taker exigen un colchón más amplio para evitar pérdidas.',
    },
    toolCalls: [
      { name: 'query_telemetry_history', durationMs: 120, result: 'SUCCESS: Ingested 7200 telemetry frames.' },
      { name: 'calculate_zscore_volatility', durationMs: 85, result: 'VOL_ZSCORE: 2.14 (Elevated)' },
      { name: 'simulate_slippage_walks', durationMs: 140, result: 'SLIPPAGE_VARIATION: +4.8 BPS on Bybit asks' }
    ],
    suggestedParams: {
      minNetProfitUSD: 25.00,
      latencyDriftBufferBps: 5,
      slippageSafetyBps: 15
    },
    contentEn: `### 📊 Suggested Risk Parameter Recalibration

Based on analytical audits of our **real-time order book streams** over the last 120 minutes, I have formulated a volatility calibration advice. 

**Observations:**
*   **Vol Z-Score:** \`2.14\` (Exceeds standard 2-sigma boundaries, indicating erratic, high-frequency price sweeps).
*   **Mean Slippage Jitter:** Raised from 6 BPS to **11.2 BPS** on Bybit and Kraken pairs.
*   **Compute Latency:** Nominal mean of \`0.85ms\` (Optimal loop speed).

**Supervised Proposal:**
1.  Increase **Minimum Net Profit** from \`$15.00\` to **\`$25.00\`** to ensure candidate spreads fully cover volatility compression.
2.  Expand **Latency Drift Buffer** to **\`5 BPS\`** to safeguard against Bybit WebSocket queue drift.
3.  Set **Slippage Safety Cushion** to **\`15 BPS\`** to guard depth walking checks.

Click **\`Apply Suggested Parameters\`** below to safe pre-fill these settings in the Risk Calibration form.`,
    contentEs: `### 📊 Recalibración Sugerida de Parámetros de Riesgo

Basado en auditorías analíticas de nuestros **flujos de datos en tiempo real** de los últimos 120 minutos, he formulado una propuesta de calibración:

**Observaciones:**
*   **Z-Score de Volatilidad:** \`2.14\` (Supera el límite normal de 2-sigma, indicando barridos de precios erráticos).
*   **Fluctuación de Deslizamiento:** Elevado de 6 BPS a **11.2 BPS** en los pares de Bybit y Kraken.
*   **Latencia de Cómputo:** Media nominal de \`0.85ms\` (Óptima velocidad de bucle).

**Propuesta Supervisada:**
1.  Incrementar el **Beneficio Neto Mínimo** de \`$15.00\` a **\`$25.00\`** para garantizar la cobertura de la volatilidad.
2.  Ampliar el **Búfer de Deriva de Latencia** a **\`5 BPS\`** para protegerse de rezagos en colas de Bybit.
3.  Establecer el **Colchón de Seguridad contra Deslizamiento** en **\`15 BPS\`**.

Haga clic en **\`Apply Suggested Parameters\`** abajo para rellenar de forma segura esta configuración en el formulario de Calibración de Riesgo.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'explain_fail',
    triggerPrefix: 'Explain why the Bybit-Kraken spread failed to execute',
    confidence: 0.98,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Diagnostic-L3',
    explainability: {
      rationaleEn: 'Audit logs isolate a high-frequency race condition resulting in execution failure due to CEX latency mismatch.',
      rationaleEs: 'Los registros de auditoría aíslan una condición de carrera de alta frecuencia que resultó en un fallo de ejecución.',
      detailsEn: 'WebSocket broadcast time mismatch: Bybit ask sweep completed in us-east-1 under 12ms, but Kraken API gate experienced a 74ms packet delay. Sizing checks rejected the trade mid-flight.',
      detailsEs: 'Desajuste en difusión WebSocket: barrido de venta de Bybit completado en us-east-1 en 12ms, pero Kraken reportó 74ms de latencia en puerta. El control de sizing abortó el ciclo.',
    },
    toolCalls: [
      { name: 'fetch_trade_execution_logs', durationMs: 150, result: 'FOUND: Transaction ID AX-49202-FAIL.' },
      { name: 'reconstruct_order_book_state', durationMs: 110, result: 'L2_SNAPSHOT: Binance mid 67440.00, Bybit Ask 67442.20' },
      { name: 'measure_api_gate_jitter', durationMs: 95, result: 'KRAKEN_JITTER: 74.2ms delay detected.' }
    ],
    contentEn: `### 🔍 Execution Failure Diagnostics - Trade Ref: AX-49202

I have completed a forensic audit of the **Bybit Spot -> Kraken Spot** loop recorded at **15:42 UTC**. 

**Diagnostic Overview:**
*   **Gross Spread Detected:** \`0.038 BTC\` (Estimated gross value: \`$32.50 USD\`).
*   **Walked Sizing Limit:** Fully verified (L2 bid-ask liquidity supported up to 0.45 BTC).
*   **Root Cause of Failure:** **API Gate Jitter on Kraken connection**.
*   **Latency Timeline:**
    1.  *Spread Detection:* \`0.04ms\` (Compute trigger).
    2.  *Bybit Order Execution:* \`12ms\` (Success, order filled).
    3.  *Kraken Order Routing:* **\`74.2ms delay\`** due to public WebSocket gateway handshake buffer.
    4.  *Safety Check Triggered:* The risk engine detected that mid-price on Kraken drifted by 14 BPS during the routing delay. Sizing checks **aborted the leg** to prevent adverse execution fill.

**AI Quantitative Strategy Recommendation:**
No capital was lost; the safety circuit performed nominally. Suggest adjusting the Latency Drift buffer to **\`4 BPS\`** or routing quote cash reserves towards CEX portals with direct endpoint peering to mitigate network variance.`,
    contentEs: `### 🔍 Diagnóstico de Fallo de Ejecución - Ref: AX-49202

He completado una auditoría forense del ciclo **Bybit Spot -> Kraken Spot** registrado a las **15:42 UTC**.

**Resumen del Diagnóstico:**
*   **Diferencial Bruto Detectado:** \`0.038 BTC\` (Valor bruto aproximado: \`$32.50 USD\`).
*   **Límite de Sizing:** Verificado (Soporte de liquidez en profundidad L2 hasta 0.45 BTC).
*   **Causa Raíz del Fallo:** **Variabilidad extrema en puerta de enlace de Kraken (API Jitter)**.
*   **Línea de Tiempo de Latencia:**
    1.  *Detección de Spread:* \`0.04ms\` (Disparador computacional).
    2.  *Orden en Bybit:* \`12ms\` (Completada de manera exitosa).
    3.  *Envío a Kraken:* **\`74.2ms de retraso\`** debido a buffers de enlace públicos de Kraken.
    4.  *Activación de Seguridad:* El motor de riesgo detectó que el precio promedio de Kraken varió 14 BPS durante la demora. El motor **abortó la operación** para evitar pérdidas.

**Recomendación de Estrategia:**
No se perdió capital; los circuitos de seguridad respondieron nominalmente. Se sugiere ajustar la deriva de latencia a **\`4 BPS\`** o canalizar más liquidez a CEXs con conexiones directas.`,
    finalDecision: 'BYPASSED'
  },
  {
    key: 'risk_summary',
    triggerPrefix: 'Draft a risk assessment summary for the current board',
    confidence: 0.96,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Algorithmic evaluation of current active parameter configuration against live volatility indicators.',
      rationaleEs: 'Evaluación algorítmica de la configuración activa frente a los indicadores de volatilidad en tiempo real.',
      detailsEn: 'Compared profit floors ($15.00) against CEX maker/taker drag. Analyzed exposure limits across the 5 CEX wallets.',
      detailsEs: 'Se contrastaron beneficios mínimos ($15.00) frente al costo taker de CEX. Análisis de límites de exposición en las 5 carteras.',
    },
    toolCalls: [
      { name: 'get_current_risk_config', durationMs: 60, result: 'SUCCESS: Ingested active risk parameters.' },
      { name: 'scan_wallet_exposures', durationMs: 80, result: 'WALLET_TOTALS: 5.4 BTC / 100k USDT exposure.' }
    ],
    contentEn: `### 🛡️ Institutional Risk Assessment & Calibration Summary

Active parameters are reviewed against current micro-market structures. The terminal is operating under a **NOMINAL** safety profile.

#### Key Calibration Audits:
1.  **Spread Capture Margin (Min Net Profit: $15.00):**
    *   *Status:* **SUFFICIENT**
    *   *Audit:* Average taker fees total \`$8.20\` per 2-leg execution. The \`$15.00\` profit floor leaves an active net edge of \`$6.80\` per trade (approx 8.1 BPS).
2.  **Latency Safety (Buffer: 3 BPS):**
    *   *Status:* **OPTIMAL**
    *   *Audit:* Average network jitter across Binance, Bybit, OKX, and Kraken is \`1.24ms\`. Execution drift risk is mathematically contained within 1-sigma bounds.
3.  **Circuit Breaker Limits (Consecutive Losses: 3):**
    *   *Status:* **ARMED**
    *   *Audit:* The circuit breaker is fully armed. Local database state verifies zero losses in the current run window.

**Operational Risk Opinion:**
The terminal is structurally secure. No recalibrations are required. Maintain active parameters.`,
    contentEs: `### 🛡️ Resumen de Evaluación de Riesgos y Calibración Institucional

Los parámetros activos se han analizado frente a la estructura del micro-mercado. La consola opera bajo un perfil de seguridad **NOMINAL**.

#### Auditoría de Calibración:
1.  **Diferencial de Captura (Mínimo Neto: $15.00):**
    *   *Estado:* **SUFICIENTE**
    *   *Análisis:* Las comisiones de taker promedian \`$8.20\` por cada ciclo de 2 piernas. El mínimo de \`$15.00\` deja un margen neto óptimo de \`$6.80\` por orden (aprox 8.1 BPS).
2.  **Seguridad de Latencia (Búfer: 3 BPS):**
    *   *Estado:* **OPTIMAL**
    *   *Análisis:* El retraso de red promedio en Binance, Bybit, OKX y Kraken es \`1.24ms\`. El riesgo de deriva matemática está contenido en límites de 1-sigma.
3.  **Límite de Desconexión de Emergencia (Pérdidas consecutivas: 3):**
    *   *Estado:* **ARMADO**
    *   *Análisis:* Los interruptores automáticos están armados y configurados. Los registros confirman cero pérdidas en la ventana actual.

**Dictamen de Riesgos:**
La terminal se encuentra estructurada de manera segura. No se requieren calibraciones urgentes en este bloque.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'depth_patterns',
    triggerPrefix: 'Identify abnormal market depth patterns on Binance Spot',
    confidence: 0.92,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Algorithmic L2 depth check isolating abnormal buy/sell liquidity imbalances or whale walls.',
      rationaleEs: 'Análisis algorítmico de profundidad L2 aislando desequilibrios anormales de liquidez de compra/venta.',
      detailsEn: 'Walked the Binance Spot L2 order book up to 2.5% depth. Detected a large buy limit wall at 67,200 USD.',
      detailsEs: 'Se recorrió el libro L2 de Binance Spot hasta 2.5% de profundidad. Se detectó una pared de compra en 67,200 USD.',
    },
    toolCalls: [
      { name: 'fetch_binance_l2_depth', durationMs: 140, result: 'L2_DEPTH: Imbalance detected. Bids +42% vs Asks.' }
    ],
    contentEn: `### 📊 Binance Spot L2 Depth & Liquidity Analysis

I have executed an algorithmic walk of the **Binance Spot (BTC/USDT)** L2 order book up to **2.5% depth** from the active mid-price.

**Key Findings:**
*   **Liquidity Imbalance:** A **+42% buy-side concentration** has developed within 0.8% of the mid-price.
*   **Institutional Wall Identified:** A massive limit order of **\`145.20 BTC\`** is resting at **\`67,200.00 USD\`**.
*   **Slippage Cushion Implication:** Walking asks will encounter near-zero slippage. However, selling into bids below the wall will trigger high execution drag.

**AI Quant Recommendation:**
The risk engine should constrain single-leg selling volume to a maximum of **\`0.35 BTC\`** to prevent crossing into depth layers with heavy slippage.`,
    contentEs: `### 📊 Análisis de Profundidad L2 en Binance Spot

He ejecutado un recorrido algorítmico del libro de órdenes L2 de **Binance Spot (BTC/USDT)** hasta una profundidad del **2.5%** desde el precio medio activo.

**Hallazgos Clave:**
*   **Desequilibrio de Liquidez:** Concentración de **+42% en la compra (bids)** dentro de una proximidad de 0.8%.
*   **Pared Institucional:** Se localizó una orden límite masiva de **\`145.20 BTC\`** bloqueada en los **\`67,200.00 USD\`**.
*   **Implicación de Deslizamiento:** Comprar (sweeping asks) tiene deslizamiento mínimo. Vender (sweeping bids) por debajo de la pared generará un deslizamiento de precio elevado.

**Recomendación:**
El motor cuantitativo debería restringir la exposición de venta en una sola orden a un límite de **\`0.35 BTC\`** para evitar cruzar hacia capas con deslizamiento elevado.`,
    finalDecision: 'BYPASSED'
  },
  {
    key: 'ws_diagnose',
    triggerPrefix: 'Run a diagnostic check on WebSocket feed health',
    confidence: 0.95,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Diagnostic-L3',
    explainability: {
      rationaleEn: 'Real-time routing audit and handshake metrics diagnostics on CEX connection pipelines.',
      rationaleEs: 'Auditoría de enrutamiento en tiempo real y diagnóstico de métricas de conexión en tuberías de CEX.',
      detailsEn: 'Parsed TCP logs and WebSocket buffer limits. Measured ping/pong handshake latencies.',
      detailsEs: 'Se analizaron registros TCP y límites de búfer WebSocket. Medición de latencias de saludo ping/pong.',
    },
    toolCalls: [
      { name: 'ping_cex_endpoints', durationMs: 110, result: 'PINGS: Binance 8ms, Coinbase 12ms, OKX 15ms, Kraken 42ms.' },
      { name: 'diagnose_packet_buffers', durationMs: 80, result: 'BUFFERS: Nominal. Zero dropped frames.' }
    ],
    contentEn: `### 📡 WebSocket Connection & Jitter Diagnostic Report

System diagnostics have verified connection pipelines across all **5 live exchanges**. 

#### Current Connection Logs:
*   **Binance Spot:** \`8ms\` (Nominal, stable WebSocket frame rate).
*   **Coinbase Spot:** \`12ms\` (Nominal, TCP buffer clear).
*   **OKX Spot:** \`15ms\` (Optimal, secure TLS pipeline).
*   **Kraken Spot:** **\`42ms (Elevated Jitter)\`** (Variance of \`+8.5ms\` observed in high-frequency streams).
*   **Bybit Spot:** \`14ms\` (Nominal, connection active).

**System Analysis:**
Kraken pipeline is experiencing minor packet queuing. This is attributed to route congestion in AWS us-east-1 gateways. Average compute loop safety is undisturbed. No connection reconnect is required.`,
    contentEs: `### 📡 Reporte de Diagnóstico de Red y Conectividad WebSocket

Los diagnósticos de red han verificado las conexiones de comunicación de las **5 plataformas activas**.

#### Registros de Conexión:
*   **Binance Spot:** \`8ms\` (Nominal, flujo de datos estable).
*   **Coinbase Spot:** \`12ms\` (Nominal, búfer TCP limpio).
*   **OKX Spot:** \`15ms\` (Óptimo, enlace TLS seguro).
*   **Kraken Spot:** **\`42ms (Latencia Elevada)\`** (Varianza de \`+8.5ms\` detectada en el flujo continuo).
*   **Bybit Spot:** \`14ms\` (Nominal, conexión activa).

**Análisis de Red:**
El nodo de Kraken experimenta retrasos leves en el enrutamiento de paquetes debido a congestión de AWS us-east-1. No se requiere reinicio forzado de la conexión.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'sizing_explain',
    triggerPrefix: 'Explain how the current sizing algorithm limits CEX slippage',
    confidence: 0.97,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Mathematical explanation of depth-walk volume allocations based on L2 bids/asks limits.',
      rationaleEs: 'Explicación matemática del cálculo de volumen basado en límites de profundidad L2.',
      detailsEn: 'Outlined the depth-walk algorithm walking price layers and applying slippage buffers (e.g. 10 BPS).',
      detailsEs: 'Descripción del algoritmo de recorrido de profundidad y aplicación de colchones de seguridad (e.g. 10 BPS).',
    },
    toolCalls: [
      { name: 'verify_sizing_logic', durationMs: 70, result: 'ALGO: L2 depth-walker verified.' }
    ],
    contentEn: `### 🧮 Sizing Algorithm & Slippage Mitigation Blueprint

The Aurex terminal enforces strict **L2 Depth-Walk Liquidity calculations** to insulate execution margins from slippage erosion.

#### How It Works:
1.  **Depth-Walk Analysis:** Instead of sizing trades against CEX "mid-price," the algorithm walks active **bid-ask layers** of the L2 book layer-by-layer up to the target volume.
2.  **Slippage Cushion Deduction:** We apply a **\`Slippage Safety Cushion (BPS)\`** safety discount. This mathematically lowers the simulated sell fill price and inflates the buy fill price before evaluating net edge.
3.  **Volume Ceiling Constraint:** If L2 volume layers indicate that executing a 1.0 BTC trade will slip the average price by more than 10 BPS, the engine automatically constrains the order size to the maximum compliant limit.

This protective loop prevents the system from triggering trades that look profitable on standard spreads but disappear during depth executions.`,
    contentEs: `### 🧮 Explicación del Algoritmo de Sizing y Mitigación del Deslizamiento

La terminal Aurex aplica un riguroso **cálculo de recorrido de profundidad L2** para proteger los márgenes de beneficio del deslizamiento de precios.

#### Funcionamiento Matemático:
1.  **Depth-Walk (Recorrido de Profundidad):** En lugar de evaluar diferenciales contra el precio medio, el motor calcula el costo real recorriendo capa por capa del libro L2 hasta el volumen objetivo.
2.  **Colchón de Deslizamiento:** Se aplica un descuento de seguridad (**Slippage Safety Cushion**). Esto devalúa matemáticamente el precio simulado de venta e infla el de compra antes de autorizar el ciclo.
3.  **Restricción de Exposición:** Si el análisis de profundidad revela que una orden de 1.0 BTC devaluará el precio neto de ejecución en más de 10 BPS, el motor restringe la orden de forma automática al volumen que garantice el beneficio neto mínimo.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'rebalance_strategy',
    triggerPrefix: 'Suggest optimal rebalancing ranges for our stablecoin',
    confidence: 0.93,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Statistical asset allocation scan prioritizing exchanges with high historical spread activity.',
      rationaleEs: 'Escaneo estadístico de balance de activos priorizando plataformas con alta actividad histórica de diferenciales.',
      detailsEn: 'Mapped current balances across Binance, Bybit, OKX, Kraken. Analyzed volume captured by each exchange leg.',
      detailsEs: 'Se mapearon los saldos actuales en Binance, Bybit, OKX, Kraken. Análisis de volumen capturado.',
    },
    toolCalls: [
      { name: 'fetch_wallet_balances', durationMs: 90, result: 'BALANCES: Stablecoin split: OKX 30k, Binance 40k, Bybit 30k.' }
    ],
    contentEn: `### 💼 Simulated Stablecoin Pool Rebalancing Recommendations

Based on rolling 24-hour spread capture metrics, I have calculated an asset rebalancing suggestion to prepare for upcoming cross-exchange activity.

#### Asset Exposure Split:
*   **Binance Spot:** \`40,000 USDT\` (Nominal: Keep 40% capital reserve).
*   **Bybit Spot:** \`30,000 USDT\` (Over-allocated: Active spreads have narrowed on Bybit-Binance legs).
*   **OKX Spot:** \`30,000 USDT\` (Nominal: Active OKX-Kraken spreads represent high profit density).

**AI Recommendation:**
Recommend shifting **\`10,000 USDT\`** from Bybit Spot to **Kraken Spot** to cover a persistent +$22.50 spread premium variance developing on Kraken bids. 

Click **\`Load Suggestion\`** to stage this simulated transfer.`,
    contentEs: `### 💼 Recomendaciones de Rebalanceo del Pool de Stablecoins

Basado en métricas de captura de los últimos 24 horas, he calculado una recomendación de rebalanceo de liquidez para optimizar los ciclos de arbitraje.

#### Distribución de Capital Activo:
*   **Binance Spot:** \`40,000 USDT\` (Adecuado: Mantener el 40% del capital).
*   **Bybit Spot:** \`30,000 USDT\` (Sobre-asignado: Diferenciales Bybit-Binance se han estrechado).
*   **OKX Spot:** \`30,000 USDT\` (Adecuado: Alta frecuencia en piernas OKX-Kraken).

**Recomendación Cuantitativa:**
Se sugiere transferir **\`10,000 USDT\`** de Bybit Spot a **Kraken Spot** para capturar la prima de diferencial persistente de +$22.50 detectada en las compras de Kraken.

Haga clic en **\`Load Suggestion\`** para programar esta transferencia en el simulador.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'fee_estimation',
    triggerPrefix: 'Estimate fee ranges for mid-tier liquidity bounds',
    confidence: 0.91,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Algorithmic calculation of CEX taker fee impact under VIP/mid-tier level assumptions.',
      rationaleEs: 'Cálculo algorítmico del impacto de la tarifa de taker bajo supuestos de nivel VIP / medio.',
      detailsEn: 'Evaluated taker fees for standard accounts (Binance: 0.10%, OKX: 0.08%, Bybit: 0.10%) vs mid-tier levels.',
      detailsEs: 'Evaluación de comisiones taker estándar (Binance: 0.10%, OKX: 0.08%, Bybit: 0.10%) frente a niveles VIP.',
    },
    toolCalls: [
      { name: 'fetch_exchange_fees', durationMs: 80, result: 'FEES: Ingested active fee schedule.' }
    ],
    contentEn: `### 💸 CEX Fee Impact & Mid-Tier Taker Fee Audit

Taker fee drag represents the highest cost burden in cross-exchange execution. This report estimates the fee bounds required to clear operational costs.

#### Taker Fee Drag Breakdown:
*   **Standard Retail Tier (Taker: 0.10%):** A 1.0 BTC cross-exchange trade ($67,000 USD) incurs **\`$134.00 USD\`** in total fee drag. Net spreads must exceed 20 BPS to clear costs.
*   **VIP 3 Mid-Tier (Taker: 0.04%):** Incurs **\`$53.60 USD\`** in total fee drag. Net spreads must only clear 8 BPS.

**AI Quant Suggestion:**
Configure the **\`Minimum Net Profit\`** parameter to at least **\`$22.00\`** if trading on standard retail tiers to prevent taker fee drag from eroding margins.`,
    contentEs: `### 💸 Auditoría del Impacto de Comisiones Taker en Exchanges

Las tarifas de taker representan la carga de costo operativa más alta en el arbitraje cross-exchange. Este reporte calcula los rangos necesarios para asegurar beneficios netos.

#### Desglose de Comisión Taker:
*   **Nivel Minorista Estándar (Taker: 0.10%):** Una orden de 1.0 BTC ($67,000 USD) incurre en **\`$134.00 USD\`** de comisiones totales. El diferencial bruto debe superar 20 BPS para generar ganancia.
*   **Nivel VIP 3 Medio (Taker: 0.04%):** Incurre en **\`$53.60 USD\`** totales. Los diferenciales solo requieren superar 8 BPS.

**Sugerencia Cuantitativa:**
Se sugiere calibrar el **\`Beneficio Neto Mínimo\`** a un límite no menor de **\`$22.00\`** si opera con comisiones retail estándar para evitar pérdidas.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'strategy_critique',
    triggerPrefix: 'Draft a quantitative strategy critique for the last 100',
    confidence: 0.95,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Quant-Llama-70B',
    explainability: {
      rationaleEn: 'Performance audit of the last 100 simulated fills checking execution slippage and cost buffers.',
      rationaleEs: 'Auditoría de rendimiento de las últimas 100 órdenes verificando deslizamiento y búfers de costo.',
      detailsEn: 'Aggregated net profit, computed Sharpe ratio variance, and tracked network connection lag rejects.',
      detailsEs: 'Cálculo de ganancias netas promedio, variabilidad del ratio Sharpe, y rechazos por desfase.',
    },
    toolCalls: [
      { name: 'fetch_recent_executions', durationMs: 130, result: 'SUCCESS: Loaded 100 trade records.' },
      { name: 'calculate_sharpe_ratio', durationMs: 70, result: 'SHARPE_RATIO: 3.12' }
    ],
    contentEn: `### 📈 Quantitative Strategy Critique - Last 100 Executions

I have completed a quantitative audit of the **last 100 simulated executions** logged in the database ledger.

#### Strategy Diagnostics:
*   **Net Profit Accumulated:** \`+$684.50 USD\`
*   **Win Rate:** \`96.2%\`
*   **Execution Sharpe Ratio:** **\`3.12\`** (Indicates highly consistent return distribution).
*   **Slippage Slippage Waste:** Average slippage was contained at \`1.4 BPS\` per trade.
*   **Canceled Spreads:** \`14 opportunities\` were canceled mid-flight by the Latency Drift safeguard.

**Conclusion:**
Active calibrations are highly effective. The low average slippage (1.4 BPS) proves that our **L2 Depth-Walk Sizing** is working as intended. No modifications are needed.`,
    contentEs: `### 📈 Auditoría y Crítica de Estrategia Cuantitativa - Últimas 100 Órdenes

He completado una auditoría cuantitativa de las **últimas 100 transacciones simuladas** registradas en la bitácora de la consola.

#### Diagnóstico del Rendimiento:
*   **Ganancia Neta Acumulada:** \`+$684.50 USD\`
*   **Ratio de Acierto (Win Rate):** \`96.2%\`
*   **Ratio Sharpe de Ejecución:** **\`3.12\`** (Indica una alta estabilidad de ganancias).
*   **Fuga por Deslizamiento:** El deslizamiento promedio se mantuvo controlado en \`1.4 BPS\` por orden.
*   **Spreads Cancelados:** \`14 oportunidades\` canceladas de manera preventiva por el búfer de latencia.

**Conclusión:**
Los parámetros de calibración actuales son sumamente eficientes. El bajo deslizamiento (1.4 BPS) demuestra que el algoritmo de **Sizing L2** protege correctamente los retornos.`,
    finalDecision: 'ACCEPTED'
  },
  {
    key: 'checklist_deploy',
    triggerPrefix: 'Build an automated production checklist for live API',
    confidence: 0.90,
    promptVersion: 'AurexQuant-V2.1',
    modelIdentifier: 'Aurex-Diagnostic-L3',
    explainability: {
      rationaleEn: 'Generates secure operations setup steps for API key handling and system deployment.',
      rationaleEs: 'Genera pasos seguros para el manejo de llaves API y despliegue del sistema.',
      detailsEn: 'Reviewed encryption protocols, rate-limiting variables, and system failover guidelines.',
      detailsEs: 'Revisión de protocolos de cifrado, límites de tasas de llamada, y redundancia de fallos.',
    },
    toolCalls: [
      { name: 'verify_security_rules', durationMs: 80, result: 'RULES: Checked encryption protocols.' }
    ],
    contentEn: `### 🛡️ Production Checklist for Live API Key Deployment

Preparing to move from simulation-only to live operations requires rigorous security and operational steps to safeguard capital assets.

#### 1. API Key Isolation and Encryption
*   [ ] **Z-Knowledge Storage:** Enforce AES-256 GCM encryption on all API secret keys stored in DB vaults.
*   [ ] **Strict IP Whitelisting:** Bind CEX API keys strictly to the static IP nodes of our execution servers.
*   [ ] **Scope Minimization:** Ensure keys are granted **\`Trade\`** and **\`Read\`** scopes only. **\`Withdrawal\`** capabilities must be explicitly disabled.

#### 2. Network Latency & Rate Limits
*   [ ] **Colocation Check:** Verify execution node server ping to CEX portals is under 10ms.
*   [ ] **IP Rate Limiting:** Enforce dynamic delay buffers to prevent crossing CEX public WebSocket IP caps.

Verify all items before deploying secrets.`,
    contentEs: `### 🛡️ Lista de Verificación Operativa para Despliegue de Llaves API

La transición de simulación pura a operaciones en vivo requiere pasos rigurosos para salvaguardar los activos y la seguridad del sistema.

#### 1. Cifrado y Aislamiento de Llaves API
*   [ ] **Almacenamiento Cifrado:** Encriptar llaves API con AES-256 GCM en bóvedas seguras.
*   [ ] **Lista Blanca de IPs:** Asociar las credenciales exclusivamente a las IPs fijas del servidor de ejecución.
*   [ ] **Restricción de Permisos:** Garantizar únicamente alcances de **\`Trade\`** y **\`Read\`**. Los retiros de capital deben ser desactivados explícitamente.

#### 2. Latencia de Red y Límites de Tasa
*   [ ] **Cointegración de Servidor:** Verificar que la latencia a los endpoints del CEX sea menor a 10ms.
*   [ ] **Límites de Llamada:** Calibrar colas de despacho para evitar bloqueos temporales de IP por parte del CEX.`,
    finalDecision: 'ACCEPTED'
  }
];

export class MockAiAgent {
  private static inMemoryAudits: AuditLogEntry[] = [];

  public static async getAuditLogs(): Promise<AuditLogEntry[]> {
    return this.inMemoryAudits;
  }

  public static async insertAuditLog(
    entry: Omit<AuditLogEntry, 'id' | 'created_at'>
  ): Promise<{ success: boolean; id: string }> {
    // Artificial write delay to mimic Supabase INSERT
    await new Promise((resolve) => setTimeout(resolve, 220));
    
    const id = Math.random().toString(36).substring(2, 15);
    const newEntry: AuditLogEntry = {
      ...entry,
      id,
      created_at: new Date().toISOString(),
    };

    this.inMemoryAudits.unshift(newEntry);
    return { success: true, id };
  }

  public static async streamScenarioResponse(
    query: string,
    onToken: (token: string) => void,
    onStatus: (status: 'thinking' | 'streaming' | 'completed') => void,
    onToolInvocation: (tool: { name: string; status: 'executing' | 'success'; durationMs: number; result: string }) => void,
    language: 'en' | 'es' = 'en'
  ): Promise<{
    confidence: number;
    promptVersion: string;
    modelIdentifier: string;
    explainability: {
      rationaleEn: string;
      rationaleEs: string;
      detailsEn: string;
      detailsEs: string;
    };
    suggestedParams?: RiskParams;
    finalDecision: 'ACCEPTED' | 'REJECTED' | 'BYPASSED';
    scenarioKey: string;
  }> {
    // 1. Match Scenario
    const scenario = PREDEFINED_SCENARIOS.find(s => 
      query.toLowerCase().startsWith(s.triggerPrefix.toLowerCase())
    ) || PREDEFINED_SCENARIOS[0]; // Fallback to suggest_params if no match

    onStatus('thinking');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 2. Play Tool Invocations sequentially
    for (const t of scenario.toolCalls) {
      onToolInvocation({ name: t.name, status: 'executing', durationMs: 0, result: '' });
      await new Promise((resolve) => setTimeout(resolve, t.durationMs * 1.5));
      onToolInvocation({ name: t.name, status: 'success', durationMs: t.durationMs, result: t.result });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    onStatus('streaming');

    const content = language === 'en' ? scenario.contentEn : scenario.contentEs;
    const tokens = content.split(/(\s+)/);

    // Stream tokens with timing
    for (let i = 0; i < tokens.length; i++) {
      onToken(tokens[i]);
      // Small randomized delay
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15 + 5));
    }

    onStatus('completed');

    // 3. Automated Database Audit Logging Simulation
    await this.insertAuditLog({
      session_id: 'a29b20b2-4822-4911-8ce2-47209cb14e21', // Static simulated session
      operator_id: '8cb38a10-29c8-4721-98bc-298319a28c31', // Static simulated user
      widget_source: 'COPILOT_WORKSPACE',
      scenario_key: scenario.key,
      prompt_version: scenario.promptVersion,
      prompt_language: language,
      user_query: query,
      model_identifier: scenario.modelIdentifier,
      model_latency_ms: 1200 + scenario.toolCalls.reduce((sum, t) => sum + t.durationMs, 0),
      confidence_percentage: scenario.confidence * 100,
      explainability_payload: {
        rationale: language === 'en' ? scenario.explainability.rationaleEn : scenario.explainability.rationaleEs,
        details: language === 'en' ? scenario.explainability.detailsEn : scenario.explainability.detailsEs,
      },
      applied_parameters: scenario.suggestedParams ? { ...scenario.suggestedParams } : null,
      operator_action: 'REVIEWED',
      final_system_decision: scenario.finalDecision
    });

    return {
      confidence: scenario.confidence,
      promptVersion: scenario.promptVersion,
      modelIdentifier: scenario.modelIdentifier,
      explainability: scenario.explainability,
      suggestedParams: scenario.suggestedParams,
      finalDecision: scenario.finalDecision,
      scenarioKey: scenario.key,
    };
  }
}
