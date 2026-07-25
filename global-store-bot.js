/* 
  ======================================================
  المساعد الذكي (Agent V11.0 - Pro Bundle & Smart Pricing)
  ------------------------------------------------------
  الميزات الجديدة في هذا الإصدار:
  1. خوارزمية "تجميع السلة": عند كتابة ميزانية، يقوم بتجميع منتجات متعددة تناسب المبلغ.
  2. تصميم محسّن: زر اللغة أصبح باللون الأخضر للوضوح، أيقونة متوهجة، نصوص واضحة.
  3. حماية قوية، ترحيب صوتي، ومسح تلقائي للشاشة.
  ======================================================
*/

class CompactSmartAgent {
  constructor() {
    ['agent-launcher-v11', 'agent-widget-v11'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    this.allProducts = [];
    this.currentLang = 'ar';

    // قاموس المرادفات - تم بناؤه ليكون ثنائي الاتجاه تلقائيًا (رابط تلقائي بين كل كلمة ومرادفاتها)
    const rawSynonymGroups = [
      ['كمبيوتر', 'حاسوب', 'computer', 'pc', 'لابتوب', 'laptop'],
      ['موبايل', 'جوال', 'هاتف', 'mobile', 'phone'],
      ['سماعات', 'سماعه', 'headphones', 'headset'],
      ['شاشات', 'شاشه', 'screen', 'monitor'],
      ['كيبورد', 'لوحه', 'keyboard'],
      ['سياره', 'عربه', 'car'],
      ['سيارات', 'عربات', 'cars']
    ];
    this.synonyms = {};
    rawSynonymGroups.forEach(group => {
      group.forEach(word => {
        const others = group.filter(w => w !== word);
        if (!this.synonyms[word]) this.synonyms[word] = [];
        others.forEach(o => { if (!this.synonyms[word].includes(o)) this.synonyms[word].push(o); });
      });
    });

    this.renderWidget();
    this.scanStore();
    // نطلب قائمة الأصوات مبكرًا فقط لتحفيز المتصفح على تحميلها بدون التحكم بتوقيت النطق
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  // دالة النطق الصوتي - تنطق دائمًا (نفس سلوك النسخة الأصلية)، مع محاولة اختيار صوت
  // فعلي مطابق للغة إذا كانت قائمة الأصوات جاهزة، بدون أي شرط يوقف النطق بالكامل
  speak(text) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const targetPrefix = this.currentLang === 'ar' ? 'ar' : 'en';
      utterance.lang = this.currentLang === 'ar' ? 'ar-SA' : 'en-US';
      utterance.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        let matchedVoice = voices.find(v => v.lang && v.lang.toLowerCase() === utterance.lang.toLowerCase())
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith(targetPrefix));
        if (matchedVoice) utterance.voice = matchedVoice;
      }

      // نحتفظ بمرجع قوي للـ utterance على this لمنع بعض المتصفحات من حذفه من الذاكرة
      // قبل أن ينطق به (خلل معروف يسبب صمتًا بدون أي خطأ ظاهر)
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    };

    // تأخير بسيط بعد cancel() لتفادي خلل معروف في بعض المتصفحات (خصوصًا على الجوال)
    // حيث ينطق() فورًا بعد cancel() لا يُنفَّذ فعليًا
    setTimeout(doSpeak, 50);
  }

  // دالة الحماية - لم يتم تغييرها
  escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }

  // التطبيع النصي - لم يتم تغييره
  normalizeText(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ـ/g, '')
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  }

  // معالجة المفرد والجمع - لم يتم تغييرها
  reduceWord(word) {
    if (!word) return '';
    if (word.endsWith('ات')) return word.slice(0, -2);
    if (word.endsWith('ون') || word.endsWith('ين')) return word.slice(0, -2);
    if (word.endsWith('ه')) return word.slice(0, -1);
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
    return word;
  }

  // تحويل الحروف لأرقام - لم يتم تغييره
  textToNumber(text) {
    const dict = { 'خمسين': 50, 'مية': 100, 'مائة': 100, 'مئه': 100, 'متين': 200, 'مائتين': 200, 'ثلاثمائة': 300, 'ثلاثمئة': 300, 'أربعمائة': 400, 'خمسمائة': 500, 'ألف': 1000, 'fifty': 50, 'hundred': 100, 'thousand': 1000 };
    let words = this.normalizeText(text).split(/\s+/);
    for (let word of words) { if (dict[word]) return dict[word]; }
    return null;
  }

  // قراءة المنتجات من المتجر - لم يتم تغييرها
  scanStore() {
    this.allProducts = [];
    const seenNames = new Set();
    const elements = document.querySelectorAll('[class*="product"], [class*="card"], [class*="item"], .product-box, .product-thumb');
    
    elements.forEach(el => {
      if (this.widget && this.widget.contains(el)) return;
      if (this.launcher && this.launcher.contains(el)) return;
      
      const text = el.innerText || "";
      const priceMatch = text.match(/(\d+[\.,]?\d*)\s*(ريال|SAR|ر\.س|\$|QAR|AED)/i);
      
      if (priceMatch && priceMatch[1]) {
        let price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (isNaN(price) || price <= 0) return;
        
        let name = "";
        const titleEl = el.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
        if (titleEl && titleEl.innerText.trim().length > 1) {
          name = titleEl.innerText.trim().split('\n')[0];
        } else {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !l.match(/\d+/));
          name = lines[0] || "";
        }
        
        if (name && name.length >= 2 && !seenNames.has(name)) {
          seenNames.add(name);
          const linkEl = el.querySelector('a');
          const normalizedName = this.normalizeText(name);
          const reducedName = normalizedName.split(/\s+/).map(w => this.reduceWord(w)).join(' ');
          
          this.allProducts.push({ 
            name, price, currency: priceMatch[2] || 'ريال', 
            url: linkEl ? linkEl.href : window.location.href,
            normalizedName, reducedName
          });
        }
      }
    });
  }

  renderWidget() {
    // إضافة تأثير التوهج النابض للأيقونة
    const style = document.createElement('style');
    style.textContent = `
      @keyframes glowPulse {
        0% { box-shadow: 0 0 10px 3px rgba(37, 99, 235, 0.35); }
        50% { box-shadow: 0 0 22px 7px rgba(37, 99, 235, 0.7); }
        100% { box-shadow: 0 0 10px 3px rgba(37, 99, 235, 0.35); }
      }
      #agent-launcher-v11 {
        animation: glowPulse 2.2s infinite ease-in-out;
        transition: all 0.3s ease;
      }
      #agent-launcher-v11:hover {
        transform: scale(1.12);
        animation-play-state: paused;
        box-shadow: 0 0 28px 10px rgba(37, 99, 235, 0.8);
      }
      button {
        transition: all 0.25s ease !important;
      }
      button:hover {
        filter: brightness(1.05);
        transform: translateY(-1px);
      }
      input:focus {
        border-color: #2563EB !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      }
    `;
    if (!document.getElementById('agent-glow-style')) {
      style.id = 'agent-glow-style';
      document.head.appendChild(style);
    }

    this.launcher = document.createElement('div');
    this.launcher.id = 'agent-launcher-v11';
    this.launcher.innerHTML = '🤖';
    this.launcher.style = `position: fixed; bottom: 20px; right: 20px; width: 58px; height: 58px; background: linear-gradient(145deg, #2563EB, #1D4ED8); border-radius: 50%; color: white; display: flex; justify-content: center; align-items: center; z-index: 999999; cursor: pointer; font-size: 28px; font-weight: bold;`;

    this.widget = document.createElement('div');
    this.widget.id = 'agent-widget-v11';
    this.widget.style = `position: fixed; bottom: 95px; right: 20px; width: 350px; height: 490px; background: white; border-radius: 18px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); display: none; flex-direction: column; z-index: 999999; border: 1px solid #E5E7EB; font-family: 'Segoe UI', system-ui, 'Tahoma', sans-serif; overflow: hidden; direction: rtl;`;

    this.widget.innerHTML = `
      <div style="background: linear-gradient(145deg, #2563EB, #1E40AF); color: white; padding: 15px 18px; display: flex; justify-content: space-between; align-items: center;">
        <span id="v11-title" style="font-weight: 700; font-size: 17px;">المساعد الذكي</span>
        <div>
          <button id="v11-lang-btn" style="background: #10B981; color: white; border: none; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; margin-left: 12px; font-weight: 600;">EN</button>
          <span id="v11-close" style="cursor: pointer; font-size: 26px; line-height: 1; padding: 0 5px; opacity: 0.9;">&times;</span>
        </div>
      </div>
      <div id="v11-chat-body" style="flex: 1; padding: 15px; overflow-y: auto; background: #F8FAFC; display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <div style="background: #EFF6FF; color: #1E40AF; padding: 14px; border-radius: 12px; max-width: 90%; align-self: flex-start; line-height: 1.6;" id="v11-welcome">
          أهلاً! اكتب اسم المنتج أو ميزانيتك (مثال: 1000).
        </div>
      </div>
      <div style="padding: 12px; background: #fff; display: flex; gap: 10px; border-top: 1px solid #F1F5F9; justify-content: center; flex-wrap: wrap;">
        <button id="v11-btn-cheapest" style="background: #F1F5F9; border: 1px solid #CBD5E1; padding: 8px 14px; border-radius: 22px; font-size: 15px; cursor: pointer; font-weight: 700;">💸 الأقل سعرًا</button>
        <button id="v11-btn-average" style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 8px 14px; border-radius: 22px; font-size: 15px; cursor: pointer; font-weight: 700;">⚖️ السعر المتوسط</button>
        <button id="v11-btn-premium" style="background: #FEF3C7; border: 1px solid #FCD34D; padding: 8px 14px; border-radius: 22px; font-size: 15px; cursor: pointer; font-weight: 700;">🏆 الفئة العليا</button>
      </div>
      <div style="padding: 12px; display: flex; gap: 10px; background: white; border-top: 1px solid #E5E7EB;">
        <input id="v11-user-input" type="text" placeholder="اكتب هنا..." style="flex: 1; padding: 12px 16px; border: 1px solid #CBD5E1; border-radius: 10px; font-size: 15px; outline: none;">
        <button id="v11-send-btn" style="background: #2563EB; color: white; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 15px;">إرسال</button>
      </div>
    `;

    document.body.appendChild(this.launcher);
    document.body.appendChild(this.widget);
    this.setupListeners();
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'ar' ? 'en' : 'ar';
    const body = document.getElementById('v11-chat-body');
    body.innerHTML = ''; 
    
    let welcomeText = '';
    if (this.currentLang === 'en') {
      document.getElementById('v11-title').innerText = "Smart Agent";
      document.getElementById('v11-lang-btn').innerText = "عربي";
      document.getElementById('v11-user-input').placeholder = "Type here...";
      document.getElementById('v11-send-btn').innerText = "Send";
      document.getElementById('v11-btn-cheapest').innerText = "💸 Lowest Price";
      document.getElementById('v11-btn-average').innerText = "⚖️ Average";
      document.getElementById('v11-btn-premium').innerText = "🏆 Premium";
      welcomeText = "Welcome! Type a product name or your budget (e.g., 1000).";
      this.addMessage(welcomeText, false);
    } else {
      document.getElementById('v11-title').innerText = "المساعد الذكي";
      document.getElementById('v11-lang-btn').innerText = "EN";
      document.getElementById('v11-user-input').placeholder = "اكتب هنا...";
      document.getElementById('v11-send-btn').innerText = "إرسال";
      document.getElementById('v11-btn-cheapest').innerText = "💸 الأقل سعرًا";
      document.getElementById('v11-btn-average').innerText = "⚖️ السعر المتوسط";
      document.getElementById('v11-btn-premium').innerText = "🏆 الفئة العليا";
      welcomeText = "أهلاً! اكتب اسم المنتج أو ميزانيتك (مثال: 1000).";
      this.addMessage(welcomeText, false);
    }
    this.speak(welcomeText);
  }

  setupListeners() {
    this.launcher.onclick = () => {
      this.launcher.style.display = 'none'; 
      this.widget.style.display = 'flex'; 
      this.scanStore();
      const welcomeMsg = this.currentLang === 'ar' ? 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟' : 'Welcome! How can I help you today?';
      this.speak(welcomeMsg);
    };
    
    document.getElementById('v11-close').onclick = () => { 
      this.widget.style.display = 'none'; 
      this.launcher.style.display = 'flex';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
    
    document.getElementById('v11-send-btn').onclick = () => this.processInput();
    document.getElementById('v11-user-input').onkeypress = (e) => { if (e.key === 'Enter') this.processInput(); };

    document.getElementById('v11-btn-cheapest').onclick = () => this.handleQuickAction('cheapest');
    document.getElementById('v11-btn-average').onclick = () => this.handleQuickAction('average');
    document.getElementById('v11-btn-premium').onclick = () => this.handleQuickAction('premium');
    
    document.getElementById('v11-lang-btn').onclick = () => this.toggleLanguage();
  }

  addMessage(text, isUser) {
    const body = document.getElementById('v11-chat-body');
    const div = document.createElement('div');
    div.style = `padding: 10px 14px; border-radius: 12px; margin-bottom: 6px; max-width: 90%; font-size: 14px; line-height: 1.6; ${isUser ? 'align-self: flex-end; background: #2563EB; color: white;' : 'align-self: flex-start; background: #EFF6FF; color: #1E40AF;'}`;
    isUser ? (div.textContent = text) : (div.innerHTML = text); 
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  handleQuickAction(type) {
    this.scanStore();
    if (!this.allProducts.length) return this.addMessage(this.currentLang === 'ar' ? "⚠️ لا توجد منتجات." : "⚠️ No products found.", false);
    
    document.getElementById('v11-chat-body').innerHTML = '';
    this.addMessage(this.currentLang === 'ar' ? "🔎 جاري البحث..." : "🔎 Searching...", true);

    let sorted = [...this.allProducts].sort((a, b) => a.price - b.price);
    let count = Math.max(1, Math.round(sorted.length * 0.1));
    let list = [];

    if (type === 'cheapest') {
      list = sorted.slice(0, count);
    } else if (type === 'premium') {
      list = sorted.slice(-count).reverse();
    } else {
      // السعر المتوسط: نأخذ 10% من المنتجات حول نقطة الوسط تمامًا مثل باقي الأزرار
      let midIndex = Math.floor(sorted.length / 2);
      let start = midIndex - Math.floor(count / 2);
      start = Math.max(0, Math.min(start, sorted.length - count));
      list = sorted.slice(start, start + count);
      // شبكة أمان: لو لأي سبب خرجت القائمة فاضية، نرجع للعنصر الأوسط مباشرة بدل ما يظهر لا شيء
      if (!list.length) list = sorted.slice(midIndex, midIndex + 1);
    }

    if (list.length) {
      let label = type === 'cheapest'
        ? (this.currentLang === 'ar' ? `🎯 إليك الأقل سعرًا (${list.length} من ${sorted.length}):` : `🎯 Lowest priced (${list.length} of ${sorted.length}):`)
        : type === 'premium'
        ? (this.currentLang === 'ar' ? `🎯 إليك الفئة العليا (${list.length} من ${sorted.length}):` : `🎯 Premium picks (${list.length} of ${sorted.length}):`)
        : (this.currentLang === 'ar' ? `🎯 إليك الفئة المتوسطة (${list.length} من ${sorted.length}):` : `🎯 Mid-range picks (${list.length} of ${sorted.length}):`);
      this.addMessage(label, false);
      list.forEach(p => this.addMessage(this.formatCard(p), false));
    } else {
      // لن يحدث عمليًا بعد شبكة الأمان أعلاه، لكن نتجنب أي حالة "لا يظهر شيء" بشكل نهائي
      this.addMessage(this.currentLang === 'ar' ? "⚠️ تعذر إيجاد نتائج لهذه الفئة." : "⚠️ Couldn't find results for this category.", false);
    }
  }

  processInput() {
    const inputEl = document.getElementById('v11-user-input');
    const input = inputEl.value.trim();
    if (!input) return;

    document.getElementById('v11-chat-body').innerHTML = '';
    this.addMessage(input, true);
    inputEl.value = "";
    this.scanStore();

    let budget = parseFloat(input.match(/\d+[\.,]?\d*/));
    if (isNaN(budget)) budget = this.textToNumber(input);

    // ====== خوارزمية تجميع السلة الذكية - لم يتم تغييرها ======
    if (budget !== null && !isNaN(budget) && budget > 0) {
      let affordable = [...this.allProducts].filter(p => p.price <= budget).sort((a, b) => b.price - a.price);
      
      if (!affordable.length) {
        return this.addMessage(this.currentLang === 'ar' ? `🔍 لا توجد منتجات تناسب ${budget}.` : `🔍 No products for ${budget}.`, false);
      }

      let bundle = [];
      let remaining = budget;
      
      for (let p of affordable) {
        if (p.price <= remaining && bundle.length < 4) {
          bundle.push(p);
          remaining -= p.price;
        }
        if (remaining <= 0 || bundle.length >= 4) break;
      }

      let totalSpent = budget - remaining;
      
      if (bundle.length === 1) {
        this.addMessage(this.currentLang === 'ar' ? `✨ إليك أفضل ما يمكنك الحصول عليه بميزانية ${budget}:` : `✨ Best option for ${budget}:`, false);
      } else {
        this.addMessage(this.currentLang === 'ar' ? `🛒 بميزانية ${budget} يمكنك شراء هذه المجموعة (الإجمالي: ${totalSpent}):` : `🛒 For ${budget} you can buy this bundle (Total: ${totalSpent}):`, false);
      }
      
      return bundle.forEach(p => this.addMessage(this.formatCard(p), false));
    }

    // ====== محرك البحث اللغوي الذكي - لم يتم تغييره ======
    let normInput = this.normalizeText(input);
    let terms = normInput.split(/\s+/).filter(t => t.length > 1);
    
    let searchTerms = new Set();
    terms.forEach(term => {
      let reduced = this.reduceWord(term);
      searchTerms.add(reduced);
      let syns = this.synonyms[term] || this.synonyms[reduced];
      if (syns) { syns.forEach(s => searchTerms.add(this.reduceWord(this.normalizeText(s)))); }
    });

    let results = this.allProducts.filter(p => {
      return [...searchTerms].some(term => p.normalizedName.includes(term) || p.reducedName.includes(term));
    });

    if (!results.length) {
      return this.addMessage(this.currentLang === 'ar' ? `🔍 عذراً، لم أجد نتائج.` : `🔍 Sorry, no results found.`, false);
    }

    this.addMessage(this.currentLang === 'ar' ? `✨ النتائج (${results.length}):` : `✨ Results (${results.length}):`, false);
    results.slice(0, 4).forEach(p => this.addMessage(this.formatCard(p), false));
  }

  formatCard(p) {
    return `
      <div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid #E2E8F0; margin-top: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-weight: bold; color: #0F172A; margin-bottom: 4px; font-size: 15px;">${this.escapeHtml(p.name)}</div>
        <div style="color: #059669; font-weight: bold; margin-bottom: 6px; font-size: 15px;">${this.escapeHtml(p.price)} ${this.escapeHtml(p.currency)}</div>
        <a href="${this.escapeHtml(p.url)}" target="_blank" style="display: inline-block; background: #2563EB; color: white; padding: 5px 12px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: bold;">${this.currentLang === 'ar' ? 'معاينة المنتج' : 'View Product'}</a>
      </div>
    `;
  }
}

new CompactSmartAgent();
