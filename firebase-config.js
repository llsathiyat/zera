/* ═══════════════════════════════════════════════════════════
   ExpiryTrack — Firebase Bağlantı ve Senkronizasyon Katmanı
   localStorage'daki veriyi Firebase Realtime Database ile
   otomatik senkronize eder. app.js'in kodunu değiştirmez.

   HIZ STRATEJİSİ:
   - Giriş ekranı SADECE et_users verisi gelince açılır (küçük veri, hızlı).
   - et_products gibi büyük veriler ARKA PLANDA paralel çekilir,
     giriş ekranını ASLA bloklamaz. Geldiğinde ekranlar otomatik tazelenir.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const firebaseConfig = {
    apiKey:        "AIzaSyBUhWYOog7EbZQ1jsd1JcT3WhR9CdZbPaQ",
    authDomain:    "skt-kontrol-503f1.firebaseapp.com",
    databaseURL:   "https://skt-kontrol-503f1-default-rtdb.firebaseio.com",
    projectId:     "skt-kontrol-503f1",
    storageBucket: "skt-kontrol-503f1.firebasestorage.app",
  };

  let dbRef = null;
  let firebaseOk = false;

  try {
    firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database();
    firebaseOk = true;
  } catch (e) {
    console.warn('[Firebase] başlatma hatası:', e);
  }

  const SYNC_KEYS = ['et_users', 'et_products', 'et_stores', 'et_brands', 'et_settings', 'et_notes', 'et_activity_logs', 'et_last_active'];

  function fetchKey(key, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (got) => { if (!done) { done = true; resolve(got); } };

      if (!firebaseOk) { finish(false); return; }

      dbRef.ref(key).once('value')
        .then((snap) => {
          const val = snap.val();
          if (val !== null && val !== undefined) {
            localStorage.setItem(key, JSON.stringify(val));
            finish(true);
          } else {
            finish(false);
          }
        })
        .catch((err) => { console.warn('[Firebase] okuma hatası:', key, err); finish(false); });

      setTimeout(() => finish(false), timeoutMs);
    });
  }

  // ── ÖNCELİKLİ: SADECE kullanıcı listesi — giriş ekranı bunu bekler ──
  // Küçük veri (genelde birkaç KB), normal bağlantıda 1-2 saniye sürer.
  // 8 saniyelik üst sınır bile çok kötü bir bağlantı için yeterli garanti.
  window.__usersReady = fetchKey('et_users', 8000);

  // ── ARKA PLAN: büyük veriler — giriş ekranını ASLA bloklamaz ──
  // Bunlar yüklenirken kullanıcı zaten giriş yapmış, panel açık olabilir.
  // Geldiklerinde app.js tarafındaki render fonksiyonları tazelenir.
  window.__backgroundReady = Promise.all([
    fetchKey('et_products', 30000),
    fetchKey('et_stores',   12000),
    fetchKey('et_brands',   12000),
    fetchKey('et_settings', 12000),
    fetchKey('et_notes',    15000),
    fetchKey('et_activity_logs', 12000),
    fetchKey('et_last_active',   10000),
  ]).then((results) => results.some(Boolean));

  // Geriye dönük uyumluluk: eski kodun beklediği isim
  window.__firebaseReady = window.__usersReady;

  // GÜVENLİK AĞI: Kullanıcı verisi bile gelmezse, 10 saniye sonra
  // yükleme ekranını zorla kaldır (elindeki yerel veriyle devam et).
  setTimeout(() => {
    const overlay = document.getElementById('firebaseLoadingOverlay');
    if (overlay) {
      console.warn('[Firebase] Zaman aşımı güvenliği devreye girdi.');
      overlay.remove();
    }
  }, 10000);

  // ── localStorage.setItem'i ele geçir: her yazımda Firebase'e de gönder ──
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (firebaseOk && SYNC_KEYS.includes(key)) {
      try {
        dbRef.ref(key).set(JSON.parse(value))
          .catch((err) => console.warn('[Firebase] yazma hatası:', key, err));
      } catch (e) {
        console.warn('[Firebase] JSON parse hatası:', key, e);
      }
    }
  };

  console.log('[Firebase] Senkronizasyon katmanı hazır (öncelikli kullanıcı + arka plan veri stratejisi).');
})();
