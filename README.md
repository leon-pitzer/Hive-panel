# 🐝 Hive Panel - Sichere Login-Website

Eine vollständige, sichere Login-Website mit Google reCAPTCHA v2, bcrypt-Passwort-Verschlüsselung und intelligentem Rate-Limiting-System.

## 📋 Features

### Sicherheit
- ✅ **Bcrypt-Passwort-Verschlüsselung**: Alle Passwörter werden mit bcrypt gehasht (niemals Klartext)
- ✅ **Google reCAPTCHA v2**: Schutz vor automatisierten Angriffen
- ✅ **Intelligentes Rate Limiting**: Progressive Sperrzeiten bei Fehlversuchen
  - 5 Fehlversuche → 1 Minute Sperre
  - 10 Fehlversuche → 5 Minuten Sperre
  - 20 Fehlversuche → 1 Stunde Sperre
  - 20+ Fehlversuche → 24 Stunden Sperre
- ✅ **Session-Management**: Sichere Browser-Sessions mit Ablaufzeit
- ✅ **XSS-Schutz**: Eingabevalidierung und sichere Datenverarbeitung

### Design
- 📱 **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- 🎨 **Modernes UI**: Professionelles, minimalistisches Design
- ⚡ **Smooth Animations**: Flüssige Übergänge und Animationen
- 🌈 **Moderne Farbpalette**: Attraktives Blau/Lila-Farbschema

### Funktionalität
- 👤 **Automatische Admin-Erstellung**: Beim ersten Start wird automatisch ein Admin-Benutzer erstellt
- 🔐 **Sichere Authentifizierung**: Login mit Benutzername und Passwort
- 📊 **Dashboard**: Übersichtliches Dashboard nach erfolgreicher Anmeldung
- 🚪 **Logout-Funktion**: Sichere Abmeldung mit Session-Bereinigung

## 🚀 Installation & Setup

### 1. Dateien herunterladen
Klonen oder laden Sie dieses Repository herunter:

```bash
git clone <repository-url>
cd Hive-panel
```

### 2. Google reCAPTCHA konfigurieren

#### reCAPTCHA-Schlüssel erhalten:
1. Besuchen Sie [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Registrieren Sie eine neue Website
3. Wählen Sie **reCAPTCHA v2** → "Ich bin kein Roboter"-Kontrollkästchen
4. Fügen Sie Ihre Domain hinzu (für lokale Tests: `localhost`)
5. Kopieren Sie den **Site Key** und **Secret Key**

#### Schlüssel einfügen:
Öffnen Sie `index.html` und ersetzen Sie den Test-Schlüssel:

```html
<!-- Zeile 42 in index.html -->
<div class="g-recaptcha" data-sitekey="HIER_IHREN_SITE_KEY_EINFÜGEN"></div>
```

**Hinweis**: Der aktuelle Test-Schlüssel (`6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`) funktioniert nur für Tests und akzeptiert jede Eingabe. Die Anwendung funktioniert auch ohne reCAPTCHA (falls CDN blockiert ist), jedoch wird dann kein Bot-Schutz angewendet.

### 3. Website starten

#### Option A: Mit lokalem Webserver (empfohlen)
```bash
# Mit Python 3
python -m http.server 8000

# Mit Python 2
python -m SimpleHTTPServer 8000

# Mit Node.js (npx http-server)
npx http-server -p 8000

# Mit PHP
php -S localhost:8000
```

Dann öffnen Sie: `http://localhost:8000`

#### Option B: Direkt im Browser
Öffnen Sie `index.html` direkt in Ihrem Browser. 

**Achtung**: Einige Features funktionieren möglicherweise nicht optimal ohne Webserver (z.B. localStorage-Einschränkungen).

## 👥 Benutzerverwaltung

### Standard-Admin-Benutzer

Beim ersten Start wird automatisch ein Admin-Benutzer erstellt:

- **Benutzername**: `admin`
- **Passwort**: `Admin123!`

⚠️ **WICHTIG**: Ändern Sie dieses Passwort sofort nach der ersten Anmeldung!

### Neue Benutzer erstellen

Öffnen Sie die Browser-Konsole (F12) und verwenden Sie:

```javascript
// Neuen Benutzer erstellen
Users.createUser('benutzername', 'passwort', 'user');

// Neuen Admin erstellen
Users.createUser('admin2', 'sicheres_passwort', 'admin');
```

### Benutzer verwalten

```javascript
// Alle Benutzer anzeigen
Users.getAllUsers();

// Benutzer löschen
Users.deleteUser('benutzername');

// Passwort ändern
Users.changePassword('benutzername', 'altes_passwort', 'neues_passwort');
```

## 📁 Projektstruktur

```
Hive-panel/
├── index.html              # Login-Seite
├── dashboard.html          # Dashboard nach Login
├── styles.css              # Zentrales CSS für alle Seiten
├── js/
│   ├── auth.js            # Session-Management & Authentifizierung
│   ├── users.js           # Benutzerverwaltung mit bcrypt
│   ├── ratelimit.js       # Rate-Limiting-System
│   └── login.js           # Login-Logik mit reCAPTCHA
├── lib/
│   └── bcrypt.js          # bcrypt.js Bibliothek (lokal)
├── data/                  # Datenverzeichnis (automatisch erstellt)
│   └── users.json         # Benutzerdaten (im .gitignore)
├── .gitignore             # Git-Ausschlüsse
├── package.json           # NPM Konfiguration
└── README.md              # Diese Datei
```

## 🔒 Sicherheitshinweise

### Passwort-Sicherheit
- ✅ Alle Passwörter werden mit **bcrypt** (10 Salz-Runden) gehasht
- ✅ Passwort-Hashes werden in LocalStorage gespeichert
- ✅ Original-Passwörter sind **niemals** abrufbar
- ⚠️ Mindestlänge: 6 Zeichen (kann in `users.js` angepasst werden)

### Rate Limiting
Das System trackt Fehlversuche pro Benutzername:
- Nach 5 Fehlversuchen: 1 Minute Sperre
- Nach 10 Fehlversuchen: 5 Minuten Sperre
- Nach 20 Fehlversuchen: 1 Stunde Sperre
- Nach mehr als 20 Fehlversuchen: 24 Stunden Sperre

Die Sperre wird automatisch nach erfolgreicher Anmeldung zurückgesetzt.

### Session-Management
- Sessions werden in LocalStorage gespeichert
- Standard-Session-Dauer: 24 Stunden
- Automatische Weiterleitung bei abgelaufener Session
- Sichere Logout-Funktion

### Datenspeicherung
⚠️ **LocalStorage-Limitierungen**:
- Daten werden nur im Browser gespeichert
- Keine Server-seitige Datenpersistenz
- Daten können durch Browser-Cache-Löschung verloren gehen

Für Produktivumgebungen empfohlen:
- Backend-Server mit Datenbank (z.B. MongoDB, PostgreSQL)
- Server-seitige Session-Verwaltung
- HTTPS-Verschlüsselung

### Weitere Sicherheitsmaßnahmen
- ✅ Eingabevalidierung auf Client-Seite
- ✅ XSS-Schutz durch sichere DOM-Manipulation
- ✅ CSRF-Schutz durch Session-Validierung
- ⚠️ Für Produktion: Server-seitige Validierung erforderlich

## 🌐 Browser-Kompatibilität

Getestet und unterstützt in:
- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Opera (v76+)

Benötigte Browser-Features:
- LocalStorage API
- ES6+ JavaScript
- CSS Grid & Flexbox

## 📱 Responsive Breakpoints

- **Desktop**: > 768px
- **Tablet**: 480px - 768px
- **Mobile**: < 480px

## 🛠️ Technologie-Stack

- **HTML5**: Semantische Struktur
- **CSS3**: Modernes Styling (CSS Variables, Grid, Flexbox)
- **JavaScript (ES6+)**: Moderne JavaScript-Features
- **bcrypt.js**: Passwort-Hashing (lokal eingebunden)
- **Google reCAPTCHA v2**: Bot-Schutz
- **LocalStorage API**: Client-seitige Datenspeicherung

## 📝 Lizenz

Dieses Projekt ist Open Source. Verwenden Sie es frei für persönliche oder kommerzielle Projekte.

## 🤝 Beitragen

Verbesserungsvorschläge und Pull Requests sind willkommen!

## ⚠️ Haftungsausschluss

Diese Implementation verwendet LocalStorage für Demonstrationszwecke. Für Produktivumgebungen sollte:
- Ein Backend-Server implementiert werden
- Eine richtige Datenbank verwendet werden
- HTTPS-Verschlüsselung aktiviert sein
- Server-seitige Validierung implementiert werden
- Professionelle Session-Management-Lösungen verwendet werden

## 📞 Support

Bei Fragen oder Problemen öffnen Sie bitte ein Issue im Repository.

---

**Entwickelt mit ❤️ für sichere Web-Authentifizierung**
