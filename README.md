# Ankara Etkinlik Toplayıcı

Ankara'da yapılan ve yaklaşan etkinlikleri farklı sağlayıcılardan toplayıp tek bir JSON API ve web arayüzünde birleştiren Node.js projesi.

Bu GitHub deposu başlangıçta boştu. Proje, mevcut bir teknoloji yığını varsaymadan Node.js 20+, Express ve statik web arayüzüyle sıfırdan oluşturuldu.

## Özellikler

- Tek ekranda etkinlik kartları, tarih aralığı, kategori ve metin araması.
- Kaynakları ayrı ayrı çalıştıran bağlayıcı mimarisi.
- Ortak etkinlik veri modeli ve tekrar eden kayıtları birleştirme.
- Kaynak hatası olsa bile diğer kaynaklardan gelen sonuçları gösterme.
- API anahtarlarını yalnızca sunucu tarafındaki .env dosyasında tutma.
- Kaynakların bağlantı ve yapılandırma durumunu gösteren /api/sources endpoint'i.
- Varsayılan 5 dakikalık sunucu önbelleği.
- Kaynak başına zaman aşımı ve istemci tarafı istek sınırı.
- Türkçe arayüz, mobil uyumlu kart görünümü.

## Desteklenen veri kaynakları

| Kaynak | Bağlantı tipi | Yapılandırma |
|---|---|---|
| WhatsMood | Herkese açık JSON etkinlik endpoint'i | Varsayılan açık, anahtar yok |
| Etkinlik.io | Ankara filtreli RSS | RSS oluşturucudan alınan URL gerekir |
| Etkinlik.io | V2 REST API | Yayıncı ağı onayı ve token gerekir |
| Biletsa | REST API | Okuma API anahtarı gerekir |
| Ticketmaster Discovery | REST API | Developer Consumer Key gerekir |
| Ek kaynaklar | RSS | EXTRA_RSS_FEEDS ile tanımlanır |

### API'si doğrulanmamış kaynaklar

ABB Kültür Sanat, ABB Gençlik ve Spor, Çankaya Belediyesi, Etimesgut Belediyesi, Biletix, Bubilet, Biletinial, CSO Ada Ankara, CerModern, Erimtan, TOBB Fuar Takvimi, Meetup, Institut français, ODTÜ Mezunları Derneği ve Ankara Kent Konseyi /api/sources kataloğunda listelenir.

Bu sitelerin tümü için herkese açık, belgelenmiş bir etkinlik API'si doğrulanmadığından otomatik çekiliyormuş gibi gösterilmez. Kaynağın resmî API/RSS adresi veya yazılı entegrasyon izni elde edildiğinde yeni adapter eklenebilir. Sitelerin HTML sayfalarını izinsiz ve kırılgan biçimde taramak yerine resmî veri erişimi tercih edilir.

## Gereksinimler

- Node.js 20 veya üzeri
- npm

## Windows PowerShell kurulumu

    git clone https://github.com/umitalgan061-sudo/ankara_etkinlik.git
    cd ankara_etkinlik
    Copy-Item .env.example .env
    notepad .env
    npm install
    npm run dev

Tarayıcıdan aç:

- Web arayüzü: http://localhost:4000
- Sağlık kontrolü: http://localhost:4000/api/health
- Kaynak ayarları: http://localhost:4000/api/sources
- Etkinlik JSON: http://localhost:4000/api/events

## API anahtarları ve RSS yapılandırması

### 1. WhatsMood

Anahtarsız JSON endpoint'i kullanılır. Kaynak dokümanı:

https://www.whatsmood.com/gelistiriciler

Uygulama şehir ve tarih aralığıyla şu endpoint'i çağırır:

https://www.whatsmood.com/api/ai/events?city=Ankara&date=YYYY-MM-DD..YYYY-MM-DD&limit=20

Dokümana göre IP başına dakikada 60 istek sınırı vardır. Sonuçlarda WhatsMood kaynak bağlantısı ve "Powered by WhatsMood" atfı korunmalıdır. Uygulama 5 dakika önbellekleme yapar; bu sınırı aşmamak için önbellek süresini gereksiz yere düşürmeyin.

### 2. Etkinlik.io RSS

https://etkinlik.io/rss/bilgi adresini açın. Şehirler bölümünde Ankara'yı seçerek kişiselleştirilmiş RSS URL'si oluşturun. Oluşan tam URL'yi .env dosyasındaki ETKINLIKIO_RSS_URL alanına yazın.

Genel RSS URL'si tüm şehirleri içerebildiği için doğrudan kullanılması önerilmez.

RSS açıklamasında açıkça etkinlik tarihi bulunmayan kayıtlar güvenilir takvim sıralaması yapılamadığı için adapter tarafından dışarıda bırakılabilir. RSS alan yapısı sağlayıcı tarafından değiştirilirse adapter güncellenmelidir.

### 3. Etkinlik.io REST API

https://etkinlik.io/api-bilgi adresinden yayıncı ağı başvurusunu tamamlayın. Onay sonrası verilen token'ı .env içindeki ETKINLIKIO_API_TOKEN alanına ekleyin.

Uygulama önce /cities üzerinden Ankara şehir ID'sini bulur; ardından /events endpoint'ini şehir, tarih ve sayfalama parametreleriyle çağırır.

### 4. Biletsa

https://biletsa.com/entegrasyon dokümanına göre okuma anahtarı için biletsaresmi@gmail.com adresinden talepte bulunun. Anahtarı .env içindeki BILETSA_API_KEY alanına yazın.

Uygulama /etkinlikler endpoint'ini sehir=Ankara, başlangıç, bitiş ve sayfa parametreleriyle çağırır. Biletsa yalnız yayındaki ve satışta gelecek seansı olan etkinlikleri döndürür.

### 5. Ticketmaster

https://developer.ticketmaster.com/ adresinde geliştirici hesabı oluşturup Consumer Key alın. Anahtarı .env içindeki TICKETMASTER_API_KEY alanına yazın.

Türkiye/Ankara sonuç kapsamı sağlayıcı hesabı ve katalog kapsamına bağlıdır. Kaynak yapılandırılsa bile hiç kayıt dönmemesi API arızası anlamına gelmeyebilir.

### 6. İlave RSS kaynakları

EXTRA_RSS_FEEDS değişkeni, Ankara'ya özel RSS yayınlayan kurumlar için kullanılabilir. Örnek:

    EXTRA_RSS_FEEDS=[{"id":"kurum-adi","name":"Kurum Adı","url":"https://ornek.gov.tr/ankara-etkinlikleri.rss","city":"Ankara"}]

Örnekteki URL yer tutucudur; yalnızca gerçekten yayımlanan ve kullanımına izin verilen RSS adresini girin.

## Ortak API kullanımı

Etkinlikleri listele:

    GET /api/events?from=2026-11-16&to=2027-02-16

Metin ve kategori filtresi:

    GET /api/events?from=2026-11-16&to=2027-02-16&q=caz&category=Müzik

İlçe filtresi:

    GET /api/events?district=Çankaya

Belirli kaynağı filtrele:

    GET /api/events?source=whatsmood

Önbelleği atlayıp kaynakları yeniden sorgula:

    GET /api/events?refresh=true

Sayfalama:

    GET /api/events?page=2&limit=30

Kaynakların durumu:

    GET /api/sources

Yanıtta her kaynağın türü, yapılandırma durumu, dokümantasyon bağlantısı ve henüz bağlanmamış kaynaklar gösterilir.

## Etkinlik veri modeli

Her kayıt aşağıdaki ortak alanlara dönüştürülür:

- id, fingerprint, source, sourceId
- title, description, category
- startAt, endAt, timezone
- city, district, venue, address
- latitude, longitude
- price, currency, isFree
- imageUrl, url, ticketUrl
- sources, sourceLinks, attribution

Saatler ekranda Europe/Istanbul saat diliminde gösterilir. Koordinatı olmayan kayıtlar için uydurma koordinat üretilmez. Mekân adresinden geocoding daha sonra ayrı bir adım olarak eklenebilir.

## Çalıştırma ve test

    npm test
    npm start

Sunucu varsayılan olarak http://localhost:4000 adresinde çalışır.

## Güvenlik ve kullanım notları

- Gerçek API anahtarlarını GitHub'a yüklemeyin; yalnızca yerel .env veya sunucu ortam değişkenlerini kullanın.
- .env dosyası .gitignore içindedir.
- WhatsMood atıf ve bağlantı şartlarını koruyun.
- Sağlayıcıların hız sınırlarına, kullanım şartlarına ve görsel/lisans koşullarına uyun.
- Bir kaynağın API anahtarının alınması, o kaynağın bütün içeriğini yeniden yayımlama hakkı verdiği anlamına gelmez.
- Etkinlik tarihleri, mekânlar ve fiyatlar değişebilir; kullanıcıyı kaynak sayfasına yönlendirin.
- Bu başlangıç sürümü verileri bellekte 5 dakika önbellekler. Kalıcı arşiv, PostGIS ve otomatik zamanlanmış toplama ayrı aşamada eklenebilir.
