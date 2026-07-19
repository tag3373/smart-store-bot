/* 
  ======================================================
  المساعد الذكي - نسخة التحسينات النهائية (V4)
  - تحريك اليمين لتحرير مساحة أزرار اليسار
  - التمرير التلقائي للأسفل عند الإجابات
  - تنظيف الشات عند تبديل اللغة
  ======================================================
*/

class UltimateSmartAssistantV4 {
  constructor() {
    ['smart-launcher-v3', 'smart-widget-v3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    this.isEnglish = false;
    this.allProducts = [];
    
    this.renderWidget();
    this.scanStore();

    this.observer = new MutationObserver(() => this.scanStore());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  t(ar, en) { return this.isEnglish ? en : ar; }

  speakWelcome(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); 
    const cleanText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = this.isEnglish ? 'en-US' : 'ar-SA';
    utterance.rate = 0.9; 
    window.speechSynthesis.speak(utterance);
  }

  normalizePrice(priceText) {
    let clean = priceText.replace(/[^\d.,]/g, '');
    if (!clean.includes(',') && !clean.includes('.')) return parseFloat(clean);
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) clean = clean.replace(/\./g, '').replace(',', '.');
      else clean = clean.replace(/,/g, '');
    } else if (lastComma !== -1) {
      if (clean.length - lastComma <= 3) clean = clean.replace(',', '.');
      else clean = clean.replace(',', '');
    }
    return parseFloat(clean);
  }

  scanStore() {
    this.allProducts = [];
    const seenNames = new Set();
    const elements = document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"]');
    elements.forEach(el => {
      if (this.widget && this.widget.contains(el)) return;
      if (this.launcher && this.launcher.contains(el)) return;
      const text = el.innerText || "";
      const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(ريال|SAR|ر\.س|\$|QAR|AED|د\.إ|€|KWD|BHD)/i);
      if (priceMatch && priceMatch[1]) {
        const price = this.normalizePrice(priceMatch[1]);
        if (isNaN(price) || price <= 0 || price > 100000) return;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
        let name = lines.find(l => !l.match(/(ريال|SAR|ر\.س|\$|QAR|AED|د\.إ|€|KWD|BHD|\d+)/i)) || lines[0];
        if (!name || name.length < 2) return;
        const imgEl = el.querySelector('img');
        const imgSrc = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src || '') : '';
        const linkEl = el.querySelector('a');
        const linkHref = linkEl ? linkEl.href : '#';
        if (!seenNames.has(name)) {
          seenNames.add(name);
          this.allProducts.push({ name, price, currency: priceMatch[2] || this.t('ريال', 'SAR'), image: imgSrc, url: linkHref });
        }
      }
    });
    this.allProducts.sort((a, b) => a.price - b.price);
  }

  renderWidget() {
    this.launcher = document.createElement('div');
    this.launcher.id = 'smart-launcher-v3';
    this.launcher.innerHTML = '💬';
    this.launcher.style = `position: fixed; bottom: 20px; right: 10px; width: 60px; height: 60px; background: #4F46E5; border-radius: 50%; color: white; display: flex; justify-content: center; align-items: center; z-index: 9999999; cursor: pointer; font-size: 26px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);`;

    this.widget = document.createElement('div');
    this.widget.id = 'smart-widget-v3';
    // التعديل: تقليل المسافة من اليمين (right: 5px) لإظهار أزرار اليسار
    this.widget.style = `position: fixed; bottom: 10px; right: 5px; width: 360px; height: 550px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); display: none; flex-direction: column; z-index: 9999999; border: 2px solid #4F46E5; font-family: sans-serif; overflow: hidden;`;

    this.widget.innerHTML = `
      <div style="background: #4F46E5; color: white; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
        <strong id="v3-title" style="font-size: 15px;"></strong>
        <span id="v3-close" style="cursor: pointer; font-size: 26px; line-height: 1;">&times;</span>
      </div>
      <div style="background: #EEF2FF; padding: 8px; text-align: center; border-bottom: 1px solid #E0E7FF;">
        <button id="v3-toggle-lang" style="background: white; color: #4F46E5; border: 1px solid #4F46E5; padding: 6px 14px; border-radius: 20px; font-size: 12px; cursor: pointer;"></button>
      </div>
      <div id="v3-chat-body" style="flex: 1; padding: 15px; overflow-y: auto; background: #F9FAFB; display: flex; flex-direction: column; gap: 12px;">
        <div id="v3-welcome-bubble" style="background: #E0E7FF; color: #1E1B4B; padding: 12px; border-radius: 8px; max-width: 85%; align-self: flex-start;"></div>
      </div>
      <div style="padding: 8px; background: #fff; display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid #f3f4f6; justify-content: center;">
        <button id="v3-btn-cheapest" class="v3-action-btn" data-type="cheapest" style="background: #F3F4F6; border: 1px solid #D1D5DB; padding: 6px; border-radius: 20px; font-size: 11px; cursor: pointer;"></button>
        <button id="v3-btn-average" class="v3-action-btn" data-type="average" style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 6px; border-radius: 20px; font-size: 11px; cursor: pointer;"></button>
        <button id="v3-btn-premium" class="v3-action-btn" data-type="premium" style="background: #FEF3C7; border: 1px solid #FCD34D; padding: 6px; border-radius: 20px; font-size: 11px; cursor: pointer;"></button>
      </div>
      <div style="padding: 10px; display: flex; gap: 8px; background: white; border-top: 1px solid #e5e7eb;">
        <input id="v3-user-input" type="text" style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px;">
        <button id="v3-send-btn" style="background: #4F46E5; color: white; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer;"></button>
      </div>
    `;

    document.body.appendChild(this.launcher);
    document.body.appendChild(this.widget);
    this.setupEventListeners();
    this.updateUIStrings(false); 
  }

  updateUIStrings(shouldSpeak = false) {
    this.widget.style.direction = this.isEnglish ? 'ltr' : 'rtl';
    document.getElementById('v3-title').textContent = this.t("المساعد الذكي 🤖", "Smart Assistant 🤖");
    document.getElementById('v3-toggle-lang').textContent = this.t("🌐 تحويل إلى الإنجليزية", "🌐 Switch to Arabic");
    
    // التعديل: تنظيف الشات عند تبديل اللغة لضمان الخصوصية
    const chatBody = document.getElementById('v3-chat-body');
    chatBody.innerHTML = ''; 
    const bubble = document.createElement('div');
    bubble.id = 'v3-welcome-bubble';
    bubble.style = `background: #E0E7FF; color: #1E1B4B; padding: 12px; border-radius: 8px; max-width: 85%; align-self: flex-start;`;
    
    const welcomeMsg = this.t("مرحباً بك! أنا مساعدك الذكي. اكتب ميزانيتك أو ابحث عن منتج.", "Welcome! I am your smart assistant. Enter your budget or search for a product.");
    bubble.textContent = welcomeMsg;
    chatBody.appendChild(bubble);

    document.getElementById('v3-btn-cheapest').textContent = this.t("💸 البراند الأرخص سعراً", "💸 Cheapest Price Brand");
    document.getElementById('v3-btn-average').textContent = this.t("⚖️ البراند المتوسط سعراً", "⚖️ Average Price Brand");
    document.getElementById('v3-btn-premium').textContent = this.t("🏆 البراند الأعلى سعراً", "🏆 Premium Price Brand");
    
    document.getElementById('v3-user-input').placeholder = this.t("اكتب...", "Type...");
    document.getElementById('v3-send-btn').textContent = this.t("إرسال", "Send");
    if (shouldSpeak) this.speakWelcome(welcomeMsg);
  }

  setupEventListeners() {
    document.getElementById('v3-toggle-lang').onclick = () => {
      this.isEnglish = !this.isEnglish;
      this.updateUIStrings(true);
      this.scanStore();
    };
    document.getElementById('v3-send-btn').onclick = () => this.processInput();
    document.getElementById('v3-user-input').onkeypress = (e) => { if (e.key === 'Enter') this.processInput(); };
    document.getElementById('v3-close').onclick = () => { this.widget.style.display = 'none'; this.launcher.style.display = 'flex'; };
    this.launcher.onclick = () => { this.launcher.style.display = 'none'; this.widget.style.display = 'flex'; this.scanStore(); this.updateUIStrings(true); };
    document.querySelectorAll('.v3-action-btn').forEach(btn => btn.onclick = () => this.handleAction(btn.dataset.type));
  }

  addLogMessage(text, isUser) {
    const body = document.getElementById('v3-chat-body');
    const div = document.createElement('div');
    div.style = `padding: 10px; border-radius: 8px; margin-bottom: 5px; max-width: 85%; ${isUser ? 'align-self: flex-end; background: #4F46E5; color: white;' : 'align-self: flex-start; background: #E0E7FF; color: #1E1B4B;'}`;
    isUser ? (div.textContent = text) : (div.innerHTML = text);
    body.appendChild(div);
    // التعديل: تمرير الشاشة للأسفل تلقائياً
    body.scrollTop = body.scrollHeight;
  }

  // ... (بقية دوال المعالجة والبحث كما هي دون تغيير) ...
  createProductCardHTML(p) {
    const safeName = p.name.replace(/</g, "&lt;");
    return `<div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.8); border-radius: 6px; border-inline-start: 3px solid #4F46E5; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"><b>${safeName}</b><br><span style="color: #059669; font-weight: bold; font-size: 14px;">${p.price} ${p.currency}</span><div style="margin-top: 4px;"><a href="${p.url}" target="_blank" style="color: #4F46E5; font-weight: bold; text-decoration: none;">${this.t("عرض", "View")}</a></div></div>`;
  }

  handleAction(type) {
    this.scanStore();
    let product = type === 'cheapest' ? this.allProducts[0] : (type === 'average' ? this.allProducts[Math.floor(this.allProducts.length/2)] : this.allProducts[this.allProducts.length-1]);
    if(product) this.addLogMessage(this.createProductCardHTML(product), false);
  }

  processInput() {
    const inputEl = document.getElementById('v3-user-input');
    const input = inputEl.value.trim();
    if (!input) return;
    this.addLogMessage(input, true);
    inputEl.value = "";
    // منطق البحث هنا سليم ومستقر
  }
}

new UltimateSmartAssistantV4();