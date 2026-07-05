import { test, expect, Page } from '@playwright/test';

// Helper to install the mock WebSocket client on the browser window object
async function setupMockWebSocket(page: Page) {
  await page.addInitScript(() => {
    (window as any).IS_PLAYWRIGHT = true;
    const OriginalWebSocket = window.WebSocket;

    class MockWebSocket extends EventTarget {
      url: string;
      readyState: number;
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string) {
        super();
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        
        // Auto-connect with a tiny delay
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          const openEvent = new Event('open');
          this.dispatchEvent(openEvent);
          if (this.onopen) this.onopen(openEvent);
          
          // Store reference on window so tests can interact with it
          (window as any).mockWsInstance = this;
          console.log('[MOCK WEBSOCKET] Registered mockWsInstance on window for URL:', url);
        }, 10);
      }

      send(data: any) {
        console.log('[MOCK WEBSOCKET] Sent data to server:', data);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        setTimeout(() => {
          const closeEvent = new Event('close');
          this.dispatchEvent(closeEvent);
          if (this.onclose) this.onclose(closeEvent);
        }, 0);
      }

      triggerMessage(data: any) {
        console.log('[MOCK WEBSOCKET] Triggering inbound mock message:', data?.pnl?.totalProfitUSD);
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(data)
        });
        this.dispatchEvent(messageEvent);
        if (this.onmessage) this.onmessage(messageEvent);
      }

      onopen: any = null;
      onclose: any = null;
      onerror: any = null;
      onmessage: any = null;
    }

    // Use a proxy constructor to dynamically switch between original and mock WebSockets
    // This allows Next.js Fast Refresh HMR (Hot Module Replacement) to function normally over WebSocket
    const WebSocketProxy = new Proxy(OriginalWebSocket, {
      construct(target, args) {
        const url = args[0] as string;
        console.log('[BROWSER] WebSocket connection requested for URL:', url);
        
        // If it's a simulator WebSocket connection (e.g. going to port 3001) or NOT the dev servers (port 3000/3005)
        if (url && (url.includes(':3001') || (!url.includes(':3000') && !url.includes(':3005') && !url.includes('/_next/')))) {
          console.log('[BROWSER] Mocking WebSocket connection to:', url);
          return new MockWebSocket(url);
        }
        
        console.log('[BROWSER] Allowing native WebSocket connection to:', url);
        return Reflect.construct(OriginalWebSocket, args);
      }
    });

    (window as any).WebSocket = WebSocketProxy;
  });
}

// Helper to push mock StatePayload via the mocked WebSocket client
async function pushMockState(page: Page, state: any) {
  console.log('[E2E TEST] Waiting for mockWsInstance to be defined in browser context...');
  // Wait up to 5000ms until mockWsInstance is defined on window
  await page.waitForFunction(() => (window as any).mockWsInstance !== undefined, { timeout: 5000 });
  console.log('[E2E TEST] mockWsInstance is active! Pushing StatePayload...');
  
  await page.evaluate((payload) => {
    if ((window as any).mockWsInstance) {
      (window as any).mockWsInstance.triggerMessage(payload);
    }
  }, state);
}

// A complete mock state payload that mimics the backend aggregated state
const mockStatePayload = {
  config: {
    minNetProfitUSD: 1.5,
    maxPositionBTCPerExchange: 2.0,
    maxPositionQuotePerExchange: 100000,
    latencySafetyBps: 5,
    slippageSafetyBps: 2,
    maxTradesPerMinute: 15,
    enabledExchanges: ['binance', 'kraken'],
    enabledPairs: ['BTCUSDT'],
    isPaused: false,
  },
  connections: {
    binance: { connected: true, reconnects: 0, lastMessageAt: Date.now() },
    kraken: { connected: true, reconnects: 0, lastMessageAt: Date.now() },
  },
  orderBooks: {
    'binance:BTCUSDT': {
      bids: [
        { price: 68000, amount: 1.5 },
        { price: 67990, amount: 2.5 },
      ],
      asks: [
        { price: 68010, amount: 1.2 },
        { price: 68020, amount: 2.2 },
      ],
      updatedAt: Date.now(),
    },
    'kraken:BTCUSDT': {
      bids: [
        { price: 68005, amount: 1.8 },
        { price: 67995, amount: 2.8 },
      ],
      asks: [
        { price: 68015, amount: 1.4 },
        { price: 68025, amount: 2.4 },
      ],
      updatedAt: Date.now(),
    },
  },
  wallets: {
    binance: {
      BTC: { free: 1.5, locked: 0 },
      USDT: { free: 50000, locked: 0 },
    },
    kraken: {
      BTC: { free: 1.5, locked: 0 },
      USDT: { free: 50000, locked: 0 },
    },
  },
  opportunities: [],
  trades: [
    {
      id: 'trade-1',
      opportunityId: 'opp-1',
      timestamp: Date.now() - 5000,
      buyExchange: 'binance',
      sellExchange: 'kraken',
      symbol: 'BTCUSDT',
      buyPrice: 68010,
      sellPrice: 68005,
      volume: 0.5,
      grossProfit: 10,
      netProfit: 5,
      feesPaid: 3,
      slippagePaid: 2,
    }
  ],
  pnl: {
    totalProfitUSD: 500.50,
    dailyProfitUSD: 100.25,
    winRate: 75.0,
    totalTrades: 25,
    sharpeRatio: 2.5,
    equityHistory: [
      { timestamp: Date.now() - 10000, value: 100000 },
      { timestamp: Date.now(), value: 100500.5 },
    ],
  },
  risk: {
    isCoolingDown: false,
    cooldownUntil: 0,
    globalBtcExposure: 0,
    globalQuoteExposure: 0,
    consecutiveLosses: 0,
    status: 'SAFE',
  },
  events: [],
  uptime: 3600,
};

test.describe('📈 Bitcoin Arbitrage Simulator Visual Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Pipe browser console messages and errors to CLI output for seamless debugging
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`[BROWSER UNCAUGHT EXCEPTION] ${err.message}\n${err.stack}`);
    });
    page.on('requestfailed', request => {
      console.error(`[BROWSER REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });
    page.on('response', response => {
      if (response.status() === 404) {
        console.error(`[BROWSER 404 NOT FOUND] ${response.url()}`);
      }
    });

    // Setup WebSocket proxy before page loads
    await setupMockWebSocket(page);
  });

  test('1. should load the Overview dashboard and display basic KPIs', async ({ page }) => {
    await page.goto('/');

    // Verify initial metadata title matches (allow extra timeout for Next.js on-demand compilation)
    await expect(page).toHaveTitle(/Bitcoin Arbitrage Terminal/, { timeout: 20000 });

    // Push the state payload to trigger calculations and UI fills
    await pushMockState(page, mockStatePayload);

    // Assert that the brand heading is rendered
    await expect(page.getByRole('main').getByRole('heading', { name: 'Aurex' })).toBeVisible();

    // Assert equity growth curve and portfolio values are shown matching mock state
    // Equity: 100000 + 500.50 = 100500.50 (shown in both the header ticker and the KPI card)
    await expect(page.getByText('PORTFOLIO EQUITY', { exact: true })).toBeVisible();
    await expect(page.getByText('$100,500.50').first()).toBeVisible();

    // Accumulated P&L: +$500.50
    await expect(page.getByText('SIMULATED NET P&L', { exact: true })).toBeVisible();
    await expect(page.getByText('+$500.50')).toBeVisible();

    // Win Rate: 75.0%
    await expect(page.getByText('WIN RATE', { exact: true })).toBeVisible();
    await expect(page.getByText('75.0%')).toBeVisible();

    // Total Trades: 25
    await expect(page.getByText('TOTAL TRADES', { exact: true })).toBeVisible();
    await expect(page.getByText('25', { exact: true })).toBeVisible();

    // Sharpe Ratio: 2.50
    await expect(page.getByText('RATIO SHARPE', { exact: true })).toBeVisible();
    await expect(page.getByText('2.50', { exact: true })).toBeVisible();
  });

  test('2. should show two order books and update when mock WebSocket data is pushed', async ({ page }) => {
    await page.goto('/markets');

    // Asserts page title and empty state are handled (allow extra timeout for Next.js on-demand compilation)
    await expect(page.locator('h2')).toContainText('Comparative L2 Markets', { timeout: 20000 });
    await expect(page.getByText('Awaiting WebSocket...').first()).toBeVisible();

    // Now push the real-time order books payload
    await pushMockState(page, mockStatePayload);

    // Binance card (5-CEX live ticker grid): bid $68,000.00 and ask $68,010.00
    await expect(page.getByText('Binance', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$68,000.00').first()).toBeVisible();
    await expect(page.getByText('$68,010.00').first()).toBeVisible();

    // Kraken card: bid $68,005.00 and ask $68,015.00
    await expect(page.getByText('Kraken', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('$68,005.00').first()).toBeVisible();
    await expect(page.getByText('$68,015.00').first()).toBeVisible();

    // Real-time multi-venue calculator panel (defaults to Binance -> Kraken)
    await expect(page.getByText('GROSS SPREAD').first()).toBeVisible();
    await expect(page.getByText('NET ESTIMATE').first()).toBeVisible();
  });

  test('3. should verify that Risk & Settings changes are saved and reflected in the UI', async ({ page }) => {
    // Intercept the API save request
    await page.route('**/config', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        // Return simulated success payload matching updated configs
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            config: body,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/risk');

    // Make sure configurations form is rendered (allow extra timeout for Next.js on-demand compilation)
    await expect(page.locator('text=Risk Parameters')).toBeVisible({ timeout: 20000 });

    // Push standard config to load values
    await pushMockState(page, mockStatePayload);

    // Locate the first premium slider (Minimum Net Profit)
    const slider = page.getByRole('slider').first();
    await slider.waitFor({ state: 'visible', timeout: 10000 });
    
    // Assert the initial label value
    await expect(page.getByText('$1.5 USD')).toBeVisible();

    // Focus the slider and increment it using keyboard ArrowRight key (step is 0.1)
    await slider.focus();
    await slider.press('ArrowRight');

    // Assert that the label updates to reflect the new value ($1.6 USD)
    await expect(page.getByText('$1.6 USD')).toBeVisible();

    // Click submit form (basic settings form's submit button — distinct from the advanced
    // parametrization panel's "Save advanced" button)
    const submitBtn = page.locator('button:has-text("Save Settings")');
    await submitBtn.click();

    // Assert that the confirmation toast notice becomes visible
    const saveNotice = page.locator('text=Configuration persisted successfully');
    await expect(saveNotice).toBeVisible();
  });

  test('4. should trigger a CSV download for the export action on Trades page', async ({ page }) => {
    // Mock the export endpoint to return static CSV data
    const mockCsvContent = 'id,opportunityId,timestamp,buyExchange,sellExchange,symbol,buyPrice,sellPrice,volume,grossProfitUSD,netProfitUSD,feesPaidUSD,slippagePaidUSD\n' +
      'trade-1,opp-1,2026-05-30T20:12:12.000Z,binance,kraken,BTCUSDT,68010,68005,0.5,10,5,3,2';

    await page.route('**/trades/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename=simulated_trades_e2e.csv',
        },
        body: mockCsvContent,
      });
    });

    await page.goto('/trades');

    // Make sure historical table header is visible (allow extra timeout for Next.js on-demand compilation)
    await expect(page.locator('text=Simulated Trade Ledger')).toBeVisible({ timeout: 20000 });

    // Push mock trades state to let UI render ledger elements
    await pushMockState(page, mockStatePayload);

    // Assert a single mock trade is rendered
    await expect(page.getByText('binance → kraken')).toBeVisible();

    // Wait for the download file event when clicking the CSV link
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export CSV');
    const download = await downloadPromise;

    // Check download parameters
    expect(download.suggestedFilename()).toBe('simulated_trades_e2e.csv');

    // Verify we can read the file path locally and assert download was successful
    const path = await download.path();
    expect(path).not.toBeNull();
  });
});
