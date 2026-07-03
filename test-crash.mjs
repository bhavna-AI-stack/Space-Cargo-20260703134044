import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    console.log('Navigating...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log('Clicking UPGRADES...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('UPGRADES'));
      if(btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    await browser.close();
    console.log('Done.');
  } catch (err) {
    console.error('Puppeteer Script Error:', err);
  }
})();
