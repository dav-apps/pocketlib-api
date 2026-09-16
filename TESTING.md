# Tests

Voraussetzung: Node.js 24 und `npm ci`. Nach der Installation einmal
`npx prisma generate` ausführen. Tests laden die lokale `.env` nicht.

## Schnelle Tests

```sh
npm test
npm run typecheck
npm run build
```

`npm test` führt Validierungs-, GraphQL-Berechtigungs- und HTTP-Tests aus.
Es werden weder PostgreSQL noch Redis oder Zugangsdaten benötigt. HTTP-Tests
öffnen kurzlebige lokale Ports. Externe HTTP-Verbindungen sind durch Nock
gesperrt; DAV-Antworten werden in den betreffenden Tests kontrolliert ersetzt.

```sh
npm run test:watch
npm run test:coverage
```

Der Coverage-Bericht liegt unter `coverage/index.html`. Es gibt zunächst keine
globale Mindestquote; entscheidend sind die getesteten Geschäftsregeln.

## Integrationstests mit PostgreSQL

Mit Docker und Docker Compose:

```sh
npm run test:db:up
npm run test:integration
npm run test:db:down
```

Die PostgreSQL-16-Testinstanz lauscht ausschließlich auf `127.0.0.1:55432`.
Ihre Daten liegen im temporären Dateisystem des Containers. Es wird kein
persistentes Volume angelegt. Die Hauptversion sollte später mit der
Deployment-Datenbank abgestimmt werden.

`test:integration` baut vor dem Testlauf das Schema mit `prisma db push` auf.
Das ist die vorläufige Lösung, solange das Projekt keine eingecheckten
Prisma-Migrationen enthält. Die Prisma-CLI kann dabei melden, dass sie `.env`
einliest; die Datenbank-URL wird jedoch vorher ausdrücklich auf die validierte
Test-URL gesetzt und kann dadurch nicht aus `.env` übernommen werden.

Alternativ kann eine selbst gestartete lokale PostgreSQL-Instanz verwendet werden:

```sh
TEST_DATABASE_URL=postgresql://pocketlib_test:pocketlib_test@127.0.0.1:55433/pocketlib_test npm run test:integration
```

Die Vorbereitung und die Tests ignorieren `DATABASE_URL`. Sie akzeptieren nur
lokale URLs mit Datenbank **und Benutzer** `pocketlib_test`, ohne URL-Parameter.
Diese Datenbank muss ausschließlich für Tests reserviert sein: Die aktuelle
Suite löscht ihre Publisher-Datensätze vor und nach den Tests.
Integrationstestdateien laufen sequenziell; neue Suiten müssen ihre eigenen
Testdaten ebenfalls zurücksetzen und dabei Fremdschlüssel berücksichtigen.

## Aufbau und Erweiterung

-  `src/schema.ts`: gemeinsames Schema einschließlich Auth-Direktive.
-  `src/app.ts`: `createApp(dependencies)` registriert die tatsächlichen Routen
   und GraphQL-Middleware, ohne Clients zu verbinden oder einen Port zu öffnen.
-  `server.ts`: Produktionsstart, Konfiguration und Verbindung der Clients.
-  `tests/unit`: Grenzwerte und Rollenmatrix der Auth-Direktive.
-  `tests/http`: HTTP-Authentifizierung, anonymer Upload und App-Isolation.
-  `tests/integration`: tatsächliches Anwendungsschema und PostgreSQL; eigene
   Verlagsdaten, erlaubte Änderungen und abgelehnte Zugriffe ohne Datenänderung.

`createApp` liefert `app`, `server` und `httpServer`. Tests müssen
`await server.stop()` aufrufen und selbst erstellte Datenbank-/Redis-Clients
anschließend schließen. Die Factory besitzt diese übergebenen Clients nicht.

Bei `executeOperation` wird der Context direkt übergeben. Solche Tests prüfen
nicht die Tokenverarbeitung der HTTP-Middleware; dafür gibt es eigene HTTP-Tests.
GraphQL-Fehler anhand von `errors[].extensions.code` prüfen, nicht nur anhand
des HTTP-Status. Bei abgelehnten Schreibzugriffen zusätzlich den unveränderten
Datenbankzustand prüfen.

Weitere Ausbaustufen: Release-Statuswechsel, Checkout, Webhook-Wiederholungen,
Upload-Verarbeitung und Redis-Caching. Die erste Stufe verwendet deaktiviertes
Caching; Redis-Verhalten ist dadurch noch nicht abgedeckt.
