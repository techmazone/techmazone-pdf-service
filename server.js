const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'tz-pdf-secret-2026';

// Allow large HTML payloads
app.use(express.json({ limit: '10mb' }));

// Simple API key auth
const authenticate = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'techmazone-pdf-service' });
});

// Generate PDF from HTML - Receipt
app.post('/api/generate-receipt', authenticate, async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'HTML content is required' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 700, height: 1000 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    // Get the exact content height
    const bodyHeight = await page.evaluate(() => {
      const receipt = document.querySelector('.receipt');
      if (receipt) {
        return Math.ceil(receipt.getBoundingClientRect().height);
      }
      return Math.ceil(document.body.scrollHeight);
    });

    const pdfBuffer = await page.pdf({
      width: '700px',
      height: `${bodyHeight}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Receipt PDF error:', error.message);
    res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Generate PDF from HTML - Certificate (landscape)
app.post('/api/generate-certificate', authenticate, async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'HTML content is required' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1122, height: 793 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      width: '1122px',
      height: '793px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Certificate PDF error:', error.message);
    res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`PDF Service running on port ${PORT}`);
});
