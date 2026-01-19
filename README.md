# 🐝 Hive Panel - Sichere Login-Website mit Express.js

Eine vollständige, sichere Login-Website mit Express.js Backend, Google reCAPTCHA v2, bcrypt-Passwort-Verschlüsselung und intelligentem Rate-Limiting-System.

## 📋 Features

### Sicherheit
- ✅ **Express.js Backend**: Server-seitige Authentifizierung und Session-Management
- ✅ **Bcrypt-Passwort-Verschlüsselung**: Alle Passwörter werden mit bcrypt gehasht (niemals Klartext)
- ✅ **Server-seitige reCAPTCHA v2**: Schutz vor automatisierten Angriffen
- ✅ **Intelligentes Rate Limiting**: 5 Login-Versuche pro 15 Minuten
- ✅ **Session-Management mit Timeout**: Automatisches Logout nach 10 Minuten Inaktivität
- ✅ **CSRF-Schutz**: Token-basierte CSRF-Protection
- ✅ **Helmet Security Headers**: XSS, Clickjacking und andere Angriffe werden verhindert
- ✅ **Sichere Session-Store**: File-basierte Sessions mit automatischem Cleanup

### Design
- 📱 **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- 🎨 **Modernes UI**: Professionelles, minimalistisches Design
- ⚡ **Smooth Animations**: Flüssige Übergänge und Animationen
- 🌈 **Moderne Farbpalette**: Attraktives Blau/Lila-Farbschema

### Funktionalität
- 👤 **Automatische Admin-Erstellung**: Beim ersten Start wird automatisch ein Admin-Benutzer mit sicherem Passwort erstellt
- 🔐 **Sichere Authentifizierung**: Login mit Benutzername und Passwort
- 📊 **Dashboard**: Übersichtliches Dashboard nach erfolgreicher Anmeldung
- 🚪 **Logout-Funktion**: Sichere Abmeldung mit Session-Bereinigung
- ⏱️ **Session-Überwachung**: Automatische Überprüfung der Session-Gültigkeit

## 🚀 Installation & Setup

### 1. Repository klonen
```bash
git clone <repository-url>
cd Hive-panel
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren
Erstellen Sie eine `.env` Datei im Root-Verzeichnis (verwenden Sie `.env.example` als Vorlage):

```bash
cp .env.example .env
```

Bearbeiten Sie die `.env` Datei:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Session Configuration
# Generieren Sie einen sicheren Session-Secret mit:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=your_128_character_hex_session_secret_here

# reCAPTCHA Configuration (optional - leer lassen um reCAPTCHA zu deaktivieren)
RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
```

#### Session Secret generieren:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### reCAPTCHA konfigurieren (optional):
1. Besuchen Sie [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Registrieren Sie eine neue Website
3. Wählen Sie **reCAPTCHA v2** → "Ich bin kein Roboter"-Kontrollkästchen
4. Fügen Sie Ihre Domain hinzu (für lokale Tests: `localhost`)
5. Kopieren Sie den **Site Key** und **Secret Key** in die `.env` Datei

**Hinweis:** Wenn keine reCAPTCHA-Keys konfiguriert sind, wird der Bot-Schutz deaktiviert, aber die Website funktioniert weiterhin.

### 4. Server starten
```bash
npm start
```

Oder für Entwicklung mit automatischem Neustart:
```bash
npm run dev
```

Die Website ist nun unter `http://localhost:3000` erreichbar.

## 👥 Standard-Admin-Benutzer

Beim **ersten Start** wird automatisch ein Admin-Benutzer erstellt:
- **Benutzername**: `admin`
- **Passwort**: Ein sicheres, zufällig generiertes Passwort (mindestens 16 Zeichen)

Das Passwort wird **nur einmal** in der Konsole beim Serverstart angezeigt:

```
======================================================================
✅ Standard-Admin-Benutzer erstellt:
   Benutzername: admin
   Passwort: [Generiertes sicheres Passwort]
   
   ⚠️  WICHTIG: Ändern Sie das Passwort nach der ersten Anmeldung!
======================================================================
```

**⚠️ WICHTIG:** Notieren Sie sich das Passwort sofort! Es wird nicht erneut angezeigt.

## 📁 Projektstruktur

```
Hive-panel/
├── server.js                    # Express.js Server (Haupteinstiegspunkt)
├── package.json                 # NPM Dependencies
├── .env                         # Umgebungsvariablen (nicht in Git)
├── .env.example                 # Beispiel für .env
│
├── routes/                      # API-Routen
│   ├── auth.js                 # Login/Logout/Status Endpunkte
│   └── users.js                # Benutzerverwaltung
│
├── middleware/                  # Express Middleware
│   └── sessionValidation.js    # Session-Timeout und Validierung
│
├── html/utils/                  # Server-Utilities
│   ├── logger.js               # Winston Logger
│   ├── config.js               # Sicherheits-Konfiguration
│   ├── validateEnv.js          # Umgebungsvariablen-Validierung
│   ├── fileOperations.js       # Atomic File Operations
│   ├── recaptcha.js            # reCAPTCHA-Verifikation
│   └── loginAttempts.js        # Login-Versuch-Tracking
│
├── js/                          # Frontend JavaScript
│   ├── auth.js                 # Client-seitige Auth-Verwaltung
│   └── login.js                # Login-Formular-Logik
│
├── data/                        # Datenverzeichnis
│   └── users.json              # Benutzerdaten (nicht in Git)
│
├── sessions/                    # Session-Store (nicht in Git)
├── logs/                        # Server-Logs (nicht in Git)
│
├── index.html                   # Login-Seite
├── dashboard.html               # Dashboard
└── styles.css                   # CSS Styling
```

## 🔒 Sicherheitsfeatures

### Session-Management
- **Inaktivitäts-Timeout**: Sessions werden nach 10 Minuten Inaktivität automatisch beendet
- **Rolling Sessions**: Aktivität verlängert die Session-Dauer
- **Server-Restart-Protection**: Sessions werden bei Server-Neustart invalidiert
- **Secure Cookies**: httpOnly, sameSite=strict, secure in Production

### Rate Limiting
- **5 Login-Versuche** pro 15 Minuten
- IP-basiertes und Username-basiertes Tracking
- Automatisches Zurücksetzen nach erfolgreicher Anmeldung

### Passwort-Sicherheit
- ✅ Bcrypt-Hashing mit 10 Salt-Runden
- ✅ Mindestlänge: 16 Zeichen für Admin-Passwörter
- ✅ Automatische Generierung mit Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen
- ✅ Passwörter werden niemals im Klartext gespeichert oder geloggt

### Security Headers (Helmet)
- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)

### Logging
- Separate Logs für allgemeine Events und Security-Events
- Automatische Log-Rotation (max 5MB pro Datei)
- Detaillierte Login-Attempt-Logs

## 🌐 API-Endpunkte

### Authentication
- `POST /api/auth/login` - Login mit Username, Password und optional reCAPTCHA
- `POST /api/auth/logout` - Logout (Session beenden)
- `GET /api/auth/status` - Aktuellen Auth-Status abrufen

### Configuration
- `GET /api/csrf-token` - CSRF-Token abrufen
- `GET /api/recaptcha-config` - reCAPTCHA-Konfiguration (Site Key)

## 🛠️ Technologie-Stack

### Backend
- **Express.js** - Web-Framework
- **bcrypt** - Passwort-Hashing
- **express-session** + **session-file-store** - Session-Management
- **helmet** - Security Headers
- **express-rate-limit** - Rate Limiting
- **winston** - Logging
- **csurf** - CSRF-Protection
- **dotenv** - Umgebungsvariablen

### Frontend
- **HTML5** - Semantische Struktur
- **CSS3** - Modernes Styling
- **Vanilla JavaScript** - Keine Frameworks
- **Fetch API** - HTTP-Requests

## 📝 Entwicklung

### Server im Development-Modus starten
```bash
npm run dev
```

Dies startet den Server mit nodemon, der automatisch bei Dateiänderungen neustartet.

### Logs anzeigen
Logs werden in das `logs/` Verzeichnis geschrieben:
- `logs/combined.log` - Alle Logs
- `logs/error.log` - Nur Fehler
- `logs/security.log` - Security-Events (Login-Versuche, etc.)

### Umgebungen
- `development` - Ausführliche Logs in der Konsole, kein HTTPS-Enforcement
- `production` - Reduzierte Logs, HTTPS-Enforcement, secure Cookies

## ⚠️ Produktions-Deployment

Für den Produktionseinsatz:

1. **NODE_ENV auf production setzen:**
```env
NODE_ENV=production
```

2. **Sicheren SESSION_SECRET generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

3. **reCAPTCHA aktivieren** (Site Key und Secret Key konfigurieren)

4. **HTTPS verwenden:** Der Server erzwingt HTTPS in der Produktion

5. **Reverse Proxy einrichten** (z.B. nginx) für:
   - SSL/TLS-Terminierung
   - Load Balancing
   - Static File Caching

6. **Process Manager verwenden** (z.B. PM2):
```bash
npm install -g pm2
pm2 start server.js --name hive-panel
pm2 save
pm2 startup
```

## 🤝 Beitragen

Verbesserungsvorschläge und Pull Requests sind willkommen!

## 📞 Support

Bei Fragen oder Problemen öffnen Sie bitte ein Issue im Repository.

---

**Entwickelt mit ❤️ für sichere Web-Authentifizierung**

