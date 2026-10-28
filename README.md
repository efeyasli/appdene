# İşlerim

iPhone öncelikli, Türkçe, yerel çalışan görev ve hatırlatma uygulaması. React Native + Expo SDK 58 + TypeScript. Web/PWA projesi, hesap, backend veya ücretli AI servisi yok. İlk açılış boştur; örnek görev eklenmez.

## Başlatma

Node.js 24 LTS ve npm kullanın (bu ortam: Node 24.19). Proje klasöründe:

```sh
npm ci
npm start
```

### iPhone’da deneme

Bu proje dosyalarını kendi bilgisayarınıza alın. Yukarıdaki komutları çalıştırın. Güncel, SDK 58 ile uyumlu **Expo Go** uygulamasını iPhone’a yükleyin. Bilgisayar ve telefon aynı ağdayken terminaldeki QR kodunu iPhone kamerasıyla açın. Cloud makinesinin localhost adresi telefonunuzdan erişilebilir değildir; yerel bilgisayarda çalıştırın. Expo Go sürümü SDK ile uyuşmazsa native geliştirme derlemesini kullanın.

Bağımsız native geliştirme uygulaması için macOS, Xcode, iOS platform araçları ve cihazda imzalama için Apple geliştirme takımı gerekir:

```sh
npm ci
npm run ios -- --device
```

Xcode kişisel takımınızla imzalama isteyebilir. Simülatör için Mac’te `npm run ios`. Bu Linux ortamında Xcode, simülatör ve iPhone bulunmadığından IPA/native iOS derlemesi üretilmedi ve cihazda çalıştırılmadı. App Store’a yayınlama yapılmadı. Expo Go, native uygulamayı denemek için geliştirme istemcisidir; bağımsız kurulum paketi değildir.

## Kullanım

- Ana kutuya “Cuma ACCT quiz var” veya “Yarın 14:00’te mail at” yazıp klavyeden gönderin ya da + düğmesine basın. Boş metin kaydedilmez. Kaydetme sürerken ikinci gönderim engellenir.
- Algılanan tarih satırına dokunup teslim ve hatırlatma zamanlarını düzeltin. Başlık ve özgün metin korunur; tarih kelimeleri başlıktan silinmez.
- Görev satırına dokunarak başlığı, teslim tarihini/isteğe bağlı saatini, çalışma gününü, önemi ve hatırlatmayı düzenleyin. Değişiklikler **Kaydet** ile uygulanır. Erteleme de bu formda Kaydet ile uygulanır.
- Kaydetme sonrasında ekranda başarı kartı bırakılmaz. Diğer kısa geri bildirimler 3 saniyede, geri alma içerenler 6 saniyede kapanır.
- Sekme göstergesi ve listeler kısa native animasyonlarla geçiş yapar. Sistem “Hareketi Azalt” ayarı açıksa geçişler animasyonsuzdur.
- Tamamlama ve silmeden sonra ana ekrandaki **Geri al** son işlemi geri getirir. Son geri alma geçicidir; uygulama yeniden açıldığında tutulmaz.
- Bugüne ekleme teslim tarihini değiştirmez. Aynı görev bugün ve yaklaşan listelerinde görünebilir. Geciken ve geçmiş çalışma günlü işler Bugün’de kalır.
- Tarihsiz işler Sonra’da. Tamamlananlar isteğe bağlı alt listede. Önemli & yaklaşan sırası: gecikmiş → 3 gün içinde teslim → önemli; ertelenenler süre bitene kadar bu alandan gizlenir.

## Tarih kuralları

Cihazın yerel tarihi ve saat dilimi kullanılır. Bugün, yarın/yarin, öbür gün, Türkçe/ASCII gün adları, haftaya/gelecek hafta + gün, `2 Kasım`, `02.11.2026`, `02/11`, `14:00` ve `saat 14` desteklenir. Tek gün adı bugün dahil en yakın gündür. Gelecek hafta pazartesi başlar. Yılsız geçmiş tarihler bir sonraki yıla alınır; yıl ekranda görünür. Açık yıl korunur. Geçersiz tarihler/saatler uyarılır; tarihsiz kaydetmek mümkündür. Bu kural motoru bütün Türkçe ifadeleri çözmez; “bu hafta” kesin tarihe, “akşam” kesin saate çevrilmez.

Günler `YYYY-MM-DD`, isteğe bağlı teslim saati `HH:mm` olarak ayrı tutulur. Saat belirtilmezse teslim saati icat edilmez. Hatırlatmalar ISO UTC zaman anlarıdır; ilk görev saat dilimi de kaydedilir. Saat dilimi değişince teslim/çalışma günü aynı kalır, mevcut hatırlatma **aynı zaman anında** yeni yerel saatle görünür. Sonradan seçilen yeni zamanlar cihazın o anki diliminde hesaplanır.

## Veriler

`src/domain`: model, tarih motoru, üç listenin filtreleri, öncelik ve bildirim planı. React Native’den bağımsızdır.

`src/data`: arayüzden ayrı Repository ve SQLite adaptörü. Cihazın uygulama alanında `islerim.db`, WAL modu, sürümlü tek durum kaydı (v1) kullanılır. Tek SQL yazımı atomiktir. Uygulama yeniden açılırken kayıt okunur. Yazma başarısızsa başarılı gibi gösterilmez, form korunur. Desteklenmeyen sürüm sessizce sıfırlanmaz. Bildirim hatası veriyi geri almaz; ayrı bir hata gösterilir. Telefonlar arası senkronizasyon/yedekleme uygulanmadı. Uygulama silinirse veriler kaybolabilir; tek cihazda tutulan kişisel veriler için henüz dışa aktarma yoktur.

Backend sonraki aşamada bu Repository sınırında eklenebilir. Kimlikler, oluşturulma/güncellenme zamanları hazırdır; hesap, erişim kuralları, yerel verinin hesaba taşınması, silme işaretleri ve çakışma çözümü ayrıca tasarlanmalıdır. Paylaşılan domain kodu gelecekte web tarafından kullanılabilir; web ekranları henüz yoktur.

## Yerel bildirimler

İlk açılışta izin istenmez. **Ayarlar → Yerel bildirimleri etkinleştir** ile izin isteyin. Reddedilirse görevler çalışır; izin Sistem Ayarları’ndan değiştirilebilir. Görev varsayılanı: saatsiz teslimin önceki günü 18:00, saatli teslimden 1 saat önce. Geçmişe bildirim kurulmaz; tarih satırından gelecekte bir zaman seçin. Varsayılanlar ayarlardan değişir ve yeni görevler için uygulanır. Önem işareti tek başına bildirim üretmez.

`expo-notifications` işletim sistemi yerel takvimini kullanır; uygulamanın JS sayacına dayanmaz. Kimlikler deterministiktir ve görev kaydında tutulur. Düzenleme, silme, tamamlama, geri alma, erteleme ve uygulamaya dönüşte uygulamaya ait kuyruk yeniden uzlaştırılır. Kesintiden kalan kimlikler de temizlenir; yinelenen hatırlatma kurulmaz. İşlem yarıda kesilirse yeniden açma veya Ayarlar’daki yeniden deneme kuyruk kurulumunu tekrarlar. Veritabanı yazımı ve OS bildirim kurulumu tek atomik işlem değildir; aradaki işletim sistemi kesintisi sonraki açılışa kadar hatırlatmayı eksik bırakabilir.

Günlük özet varsayılan kapalı, saat 09:00. Etkinse mevcut verilerle **en fazla sonraki 7 gün** için tek seferlik içerik hazırlanır; boş gün kurulmaz. Uygulama kapalıyken içerik yeniden hesaplanmaz. Bildirim takviminde uygulamanın seçtiği güvenli üst sınır **en yakın 50 bildirim**dir (işler ve özet birlikte); kalanlar için uyarı gösterilir. Bu bir OS garantisi değildir. Daha uzun süre açılmayan uygulama yeni özet üretmez. Telefonun Odak/özet ayarları, bildirim izni ve işletim sistemi teslim zamanını etkileyebilir. Uzaktan push, sunucu ve cihazlar arası bildirim yönetimi yoktur.

## Doğrulama

```sh
npm run typecheck
npm run lint
npm test
npx expo export --platform ios --max-workers 2
```

Bu ortamda geçenler: 8 domain/entegrasyon testi; sabit referans tarihle gün/hafta/ay/yıl sınırları, geçersiz tarihler, kaybolmayan görevler, bağımsız çalışma günü, erteleme ve öncelik; gerçek dosya tabanlı SQLite’ı kapatıp yeniden açarak Repository CRUD; hata durumları; sahte OS adaptörüyle bildirim oluşturma/yenileme/iptal/geri alma/izin reddi/kapasite. Node SQLite testi aynı Repository’yi kullanır, Expo SQLite köprüsünü test etmez. Typecheck, lint, iOS Hermes/Metro paketlemesi ve geliştirme sunucusunun iOS manifest yanıtı doğrulandı.

**Gerçek cihazda test edilen özellik: yok.** UI dokunuşları, Expo SQLite native köprüsünün uygulama zorla kapatılıp açıldıktan sonraki kalıcılığı, yerel bildirimin kilit ekranında teslimi, klavye, VoiceOver ve büyük yazı/küçük ekran görünümü bu Linux makinesinde doğrulanamadı. Kodda safe area, klavye kaçınması, kaydırılabilir formlar, erişilebilir etiketler ve en az 44 pt kontroller var; fiziksel doğrulama yapılmış sayılmaz.

### İlk iPhone kabul turu

1. Temiz açılışta tarihli/tarihsiz iki iş ekleyin; hızlı çift dokunuşta kopya oluşmadığını kontrol edin.
2. Cuma teslimli işi Bugüne alın; iki listeden düzenleyin, teslimin cuma kaldığını kontrol edin.
3. Düzenleyin, tamamlayın, geri alın, silin, geri alın. Uygulamayı tamamen kapatıp yeniden açın.
4. Bildirim iznini reddederek ekleme deneyin. Sonra izin verin; 2 dakika sonrası hatırlatma seçip uygulamayı kapatın, kilit ekranı teslimini gözleyin.
5. Aynı bildirimi başka zamana taşıyın; eski zamanda bildirim gelmemeli. Tamamlama/silme iptal etmeli; geri alma gelecekteki hatırlatmayı geri getirmeli.
6. Küçük iPhone, en büyük yazı ayarı, VoiceOver ve açık klavye ile ekleme/düzenleme deneyin.

## Teknoloji kaynakları

Expo’nun resmi güncel dokümanlarının GitHub kaynakları incelendi (28 Ekim 2026):

- [Yerel bildirimler / Expo Go ve development build ayrımı](https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/notifications.mdx)
- [SQLite ve yeniden başlatmada kalıcılık](https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/sqlite.mdx)
- [Native tarih/saat seçici](https://github.com/expo/expo/blob/main/docs/pages/versions/unversioned/sdk/date-time-picker.mdx)

Paket sürümleri Expo’nun kurulu SDK uyumluluk tablosuyla (`expo install --offline`) seçildi ve npm lockfile’a sabitlendi. Bu TypeScript yaklaşımı ortak iş mantığını paylaşırken gerçek native kontroller, SQLite ve OS bildirimlerini kullanmamızı sağlıyor. `docs.expo.dev` bu ortamın ağ politikasıyla engellendiğinden resmi GitHub kaynakları kullanıldı. Apple’ın cihaz/sürüm bazlı gerçek teslim ve bekleyen bildirim sınırları bu ortamda ayrıca ölçülmedi; kapasite politikası ve kabul turu bu nedenle açıkça belgelenmiştir.

## Sesle ekleme

iPhone klavyesinin dikte mikrofonuyla görev kutusuna metin girmek mümkündür (iOS Ayarları → Genel → Klavye → Dikte’yi Etkinleştir; Türkçe klavye kullanın). Sonuç normal metin gibi tarih algılama motorundan geçer; kaydetmeden önce düzeltilebilir. Bu sistem klavyesinin özelliğidir, uygulamaya özel ses tanıma eklenmedi.

Uygulama içi mikrofon için incelenen [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition) native modül ve izinler içerir; Expo Go yerine ayrı development build gerekir. Bu turda kapsam dışında bırakıldı; ücretli API veya mikrofon izni eklenmedi. Sonraki iterasyonda Türkçe konuşma, izin reddi ve cihaz desteğiyle birlikte ele alınabilir. Yeni geçişlerin ve sistem diktesinin fiziksel iPhone davranışı bu ortamda test edilmedi.
