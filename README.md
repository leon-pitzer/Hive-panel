# [Hive] Hive Panel - Sichere Login-Website mit Express.js

Eine vollständige, sichere Login-Website mit Express.js Backend, Google reCAPTCHA v2, bcrypt-Passwort-Verschlüsselung und intelligentem Rate-Limiting-System.

## Features

### Sicherheit
- * **Express.js Backend**: Server-seitige Authentifizierung und Session-Management
- * **Bcrypt-Passwort-Verschlüsselung**: Alle Passwörter werden mit bcrypt gehasht (niemals Klartext)
- * **Server-seitige reCAPTCHA v2**: Schutz vor automatisierten Angriffen
- * **Intelligentes Rate Limiting**: 5 Login-Versuche pro 15 Minuten
- * **Session-Management mit Timeout**: Automatisches Logout nach 10 Minuten Inaktivität
- * **CSRF-Schutz**: Token-basierte CSRF-Protection
- * **Helmet Security Headers**: XSS, Clickjacking und andere Angriffe werden verhindert
- * **Sichere Session-Store**: File-basierte Sessions mit automatischem Cleanup
- * **E-Mail-Verschlüsselung**: AES-256-GCM Verschlüsselung für E-Mail-Adressen

### Design
- * **Responsive Design**: Optimiert für Desktop, Tablet und Mobile
- * **Modernes UI**: Professionelles, minimalistisches Design mit Lucide Icons
- * **Smooth Animations**: Flüssige Übergänge und Animationen
- * **Moderne Farbpalette**: Attraktives Blau/Lila-Farbschema
- * **Collapsible Sidebar**: Ausklappbare Seitenleiste mit localStorage-Persistenz

### Funktionalität
- * **Automatische Admin-Erstellung**: Beim ersten Start wird automatisch ein Admin-Benutzer mit sicherem Passwort erstellt
- * **Sichere Authentifizierung**: Login mit Benutzername und Passwort
- * **Dashboard**: Übersichtliches Dashboard nach erfolgreicher Anmeldung
- * **Account-Verwaltung**: Bearbeitung von Benutzername, Passwort, E-Mail und Anzeigename
- * **Passwort-Generator**: Eingebauter Generator für sichere Passwörter
- * **Logout-Funktion**: Sichere Abmeldung mit Session-Bereinigung
- * **Session-Überwachung**: Automatische Überprüfung der Session-Gültigkeit

## Installation & Setup

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

# Encryption Configuration
# Generieren Sie einen sicheren Encryption-Key mit:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

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

## [Admin] Standard-Admin-Benutzer

Beim **ersten Start** wird automatisch ein Admin-Benutzer erstellt:
- **Benutzername**: `admin`
- **Passwort**: Ein sicheres, zufällig generiertes Passwort (mindestens 16 Zeichen)

Das Passwort wird **nur einmal** in der Konsole beim Serverstart angezeigt:

```
======================================================================
[OK] Standard-Admin-Benutzer erstellt:
   Benutzername: admin
   Passwort: [Generiertes sicheres Passwort]
   
   [!] WICHTIG: Ändern Sie das Passwort nach der ersten Anmeldung!
======================================================================
```

**[!] WICHTIG:** Notieren Sie sich das Passwort sofort! Es wird nicht erneut angezeigt.

## [Files] Projektstruktur

```
Hive-panel/
├── server.js                    # Express.js Server (Haupteinstiegspunkt)
├── package.json                 # NPM Dependencies
├── .env                         # Umgebungsvariablen (nicht in Git)
├── .env.example                 # Beispiel für .env
│
├── routes/                      # API-Routen
│   ├── auth.js                 # Login/Logout/Status Endpunkte
│   ├── users.js                # Benutzerverwaltung
│   └── account.js              # Account-Management Endpunkte
│
├── middleware/                  # Express Middleware
│   └── sessionValidation.js    # Session-Timeout und Validierung
│
├── html/                        # HTML-Seiten
│   ├── account.html            # Account-Verwaltungsseite
│   └── utils/                  # Server-Utilities
│       ├── logger.js           # Winston Logger
│       ├── config.js           # Sicherheits-Konfiguration
│       ├── validateEnv.js      # Umgebungsvariablen-Validierung
│       ├── fileOperations.js   # Atomic File Operations
│       ├── recaptcha.js        # reCAPTCHA-Verifikation
│       ├── loginAttempts.js    # Login-Versuch-Tracking
│       └── encryption.js       # AES-256-GCM E-Mail-Verschlüsselung
│
├── js/                          # Frontend JavaScript
│   ├── auth.js                 # Client-seitige Auth-Verwaltung
│   ├── login.js                # Login-Formular-Logik
│   ├── sidebar.js              # Sidebar-Funktionalität mit localStorage
│   └── account.js              # Account-Verwaltung und Passwort-Generator
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

## [Security] Sicherheitsfeatures

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
- * Bcrypt-Hashing mit 10 Salt-Runden
- * Mindestlänge: 16 Zeichen für Admin-Passwörter
- * Automatische Generierung mit Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen
- * Passwörter werden niemals im Klartext gespeichert oder geloggt
- * Integrierter Passwort-Generator für sichere Passwörter

### E-Mail-Verschlüsselung
- * AES-256-GCM Verschlüsselung für E-Mail-Adressen
- * Serverseitige Verschlüsselung mit ENCRYPTION_KEY
- * Schutz sensibler Benutzerdaten

### Security Headers (Helmet)
- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)

### Logging
- Separate Logs für allgemeine Events und Security-Events
- Automatische Log-Rotation (max 5MB pro Datei)
- Detaillierte Login-Attempt-Logs

## [API] API-Endpunkte

### Authentication
- `POST /api/auth/login` - Login mit Username, Password und optional reCAPTCHA
- `POST /api/auth/logout` - Logout (Session beenden)
- `GET /api/auth/status` - Aktuellen Auth-Status abrufen

### Account Management
- `GET /api/account/info` - Account-Informationen abrufen
- `PUT /api/account/username` - Benutzername ändern
- `PUT /api/account/password` - Passwort ändern
- `PUT /api/account/email` - E-Mail-Adresse ändern (verschlüsselt gespeichert)
- `PUT /api/account/displayname` - Anzeigename ändern

### Configuration
- `GET /api/csrf-token` - CSRF-Token abrufen
- `GET /api/recaptcha-config` - reCAPTCHA-Konfiguration (Site Key)

## [Tech] Technologie-Stack

### Backend
- **Express.js** - Web-Framework
- **bcrypt** - Passwort-Hashing
- **express-session** + **session-file-store** - Session-Management
- **helmet** - Security Headers
- **express-rate-limit** - Rate Limiting
- **winston** - Logging
- **csurf** - CSRF-Protection
- **dotenv** - Umgebungsvariablen
- **crypto** - AES-256-GCM E-Mail-Verschlüsselung

### Frontend
- **HTML5** - Semantische Struktur
- **CSS3** - Modernes Styling
- **Vanilla JavaScript** - Keine Frameworks
- **Fetch API** - HTTP-Requests
- **Lucide Icons** - Moderne Icon-Bibliothek
- **localStorage** - Persistente Sidebar-Zustand

## [Dev] Entwicklung

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

## [!] Produktions-Deployment

Für den Produktionseinsatz:

1. **NODE_ENV auf production setzen:**
```env
NODE_ENV=production
```

2. **Sicheren SESSION_SECRET generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

3. **Sicheren ENCRYPTION_KEY generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. **reCAPTCHA aktivieren** (Site Key und Secret Key konfigurieren)

5. **HTTPS verwenden:** Der Server erzwingt HTTPS in der Produktion

6. **Reverse Proxy einrichten** (z.B. nginx) für:
   - SSL/TLS-Terminierung
   - Load Balancing
   - Static File Caching

7. **Process Manager verwenden** (z.B. PM2):
```bash
npm install -g pm2
pm2 start server.js --name hive-panel
pm2 save
pm2 startup
```

## [Contribute] Beitragen

Verbesserungsvorschläge und Pull Requests sind willkommen!

## [Support] Support

Bei Fragen oder Problemen öffnen Sie bitte ein Issue im Repository.

---

**Entwickelt mit Sorgfalt für sichere Web-Authentifizierung**

