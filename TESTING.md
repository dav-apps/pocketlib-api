# Tests

Voraussetzung: Node.js 24 und `npm ci`. Nach der Installation einmal
`npx prisma generate` ausführen. Tests laden die lokale `.env` nicht.

Prisma CLI, Client und PostgreSQL-Adapter verwenden Version 7.10.0.
`prisma.config.ts` lädt für CLI-Befehle die `.env` und konfiguriert `DATABASE_URL`.
Die Client-Generierung benötigt keine Datenbankverbindung und erzeugt die nicht
eingecheckten TypeScript-Dateien unter `src/generated/prisma`.
Nach `npm ci` und Schemaänderungen muss `npx prisma generate` vor Typecheck,
Tests und Build ausgeführt werden; `prisma db push` generiert den Client nicht mehr.
Beim Deployment wird der generierte Client mit nach `dist` kompiliert.

Alle Anwendungseinstiege und Datenbanktests verwenden `createPrismaClient` aus
`src/prisma.ts` mit dem PostgreSQL-Adapter. Die Laufzeit benötigt eine direkte
PostgreSQL-URL in `DATABASE_URL`; Tests übergeben ausdrücklich die validierte
Test-URL. Der URL-Parameter `schema` wird übernommen. Der Adapter verwendet den
`pg`-Pool (standardmäßig maximal 10 Verbindungen), mit einem Verbindungs- und
Pool-Wartezeitlimit von 5 Sekunden. Prisma-6-spezifische URL-Parameter wie
`connection_limit` und `pool_timeout` konfigurieren diesen Pool nicht mehr;
abweichende Pool-Einstellungen müssen in der Factory gesetzt werden.
TLS wird durch `pg` geprüft; private Zertifizierungsstellen müssen im
Deployment als vertrauenswürdig konfiguriert sein.

Apollo Server 5 verwendet `@as-integrations/express4` für die Express-Anbindung.
GraphQL bleibt auf der neuesten 16.x-Version: Apollo Server 5.5.1 und
`graphql-request` 7.4.0 unterstützen laut ihren Peer-Abhängigkeiten GraphQL 17
noch nicht. Vor einem Wechsel auf 17 müssen beide Pakete diese Version unterstützen.

## Schnelle Tests

```sh
npm test
npm run typecheck
npm run build
```

`npm test` führt Validierungs-, GraphQL-Berechtigungs-, HTTP- und Adaptertests aus.
Es werden weder PostgreSQL noch Redis oder Zugangsdaten benötigt. HTTP-Tests
öffnen kurzlebige lokale Ports. Externe HTTP-Verbindungen sind durch Nock
gesperrt; DAV-Antworten werden in den betreffenden Tests kontrolliert ersetzt.

```sh
npm run test:watch
npm run test:coverage
```

Der Coverage-Bericht liegt unter `coverage/index.html`. Es gibt zunächst keine
globale Mindestquote; entscheidend sind die getesteten Geschäftsregeln.

## Vollständiger Testlauf mit PostgreSQL und Redis

Mit Docker und Docker Compose:

```sh
npm run test:services:up
npm run test:all
npm run test:services:down
```

Die PostgreSQL-16-Testinstanz lauscht ausschließlich auf `127.0.0.1:55432`.
Redis 7 lauscht auf `127.0.0.1:56379`, verwendet Datenbank 15 und das
Testpasswort `pocketlib_test`. Beide Dienste sind ausschließlich für Tests
bestimmt. PostgreSQL-Daten liegen im temporären Dateisystem des Containers;
Redis-Persistenz ist deaktiviert. Es wird kein
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
Diese Datenbank muss ausschließlich für Tests reserviert sein: Die Suiten löschen
ihre Verlags-, Buch-, VLB- und Webhook-Testdaten vor und nach den Tests.
Redis lässt sich über `TEST_REDIS_URL` konfigurieren; erlaubt sind nur lokale
Adressen, Datenbank 15, das Testpasswort und keine URL-Parameter. Cachetests
löschen Schlüssel unter `pocketlib:cache:v2:*`. Die Dienste dürfen nicht von
mehreren Testläufen gleichzeitig verwendet werden.

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

## Uploads, Cache, Abfragen und Systemtests (dritte Stufe)

-  `tests/integration/uploads.test.ts`: echte PNG-, JPEG- und PDF-Dateien,
   Abmessungen, Blurhash, Seitenzahlen, beschädigte Dateien, Berechtigungen,
   Entwürfe und fehlgeschlagene Dateiübertragungen. DAV bleibt simuliert.
-  `tests/integration/cache.test.ts`: echtes Redis, Schlüsselbildung, TTL,
   BigInt/Date, öffentliche und authentifizierte Zugriffe, Fehlerbehandlung
   und Invalidierung nach GraphQL-Mutationen.
-  `tests/integration/queries.test.ts`: Buchsuche, kombinierte Filter,
   Sichtbarkeit, Review-Rechte, Pagination sowie Verlags- und Kategorieabfragen.
-  `tests/adapters`: echte DAV-, Lulu-, VLB- und S3-Clients gegen kontrollierte
   HTTP-Antworten. Diese Vertragstests ersetzen keine Tests gegen Live-Anbieter.
-  `tests/system`: startet den gebauten `dist/server.js` als separaten Prozess
   mit echter Testdatenbank und Redis. Prüft GraphQL, Cache und die registrierten
   Upload-/Webhook-Routen. Ausgehende HTTP-Aufrufe des Prozesses sind gesperrt.

Einzelne Stufen:

```sh
npm run test:integration
npm run test:system
```

`test:all` umfasst Typecheck, schnelle Tests, Integrationstests und Systemtests
inklusive Build. Docker stellt die beiden Datendienste bereit; Node.js und die
Tests laufen auf dem Host. Unter Linux benötigt `canvas` gegebenenfalls die
nativen Build-Pakete aus `.github/workflows/tests.yml`.

Der öffentliche Cache verwendet versionierte Schlüssel und eine Laufzeit von
24 Stunden. Authentifizierte Zugriffe umgehen ihn. GraphQL-Mutationen und
Uploads invalidieren den Cache. Bei Redis-Fehlern werden Abfragen weiterhin aus
der Datenbank beantwortet. Schlägt eine Invalidierung fehl, können alte Einträge
nach Wiederherstellung bis zum Ablauf ihrer Laufzeit bestehen bleiben.

Dateidatensätze werden erst nach erfolgreicher Übertragung angelegt oder
aktualisiert. Remote-Dateispeicher und PostgreSQL bleiben getrennte Systeme:
Ein Datenbankfehler nach erfolgreicher Übertragung kann eine Remote-Datei
zurücklassen. Bei fehlgeschlagenem Upload für ein veröffentlichtes Buch kann
bereits ein neuer Entwurf existieren; die veröffentlichte Version bleibt erhalten.

## Continuous Integration

`.github/workflows/tests.yml` führt bei Pull Requests, Pushes auf `dev`, `main`,
`master` und `test/**` sowie manuell alle Stufen mit Node.js 24 aus. Der Workflow
installiert aus dem Lockfile, generiert Prisma, startet die Compose-Dienste und
lädt den Coverage-Bericht als Artefakt hoch. Die Coverage umfasst die schnelle
Suite; Integration und System werden separat ausgeführt. Der erste tatsächliche
GitHub-Lauf erfolgt nach dem Push dieser Konfiguration.

## Kritische Geschäftsabläufe (zweite Stufe)

`npm run test:integration` umfasst zusätzlich:

-  Buchstatuswechsel, Eigentümer-/Adminrechte und Ablehnung ohne Änderungen;
-  Entwürfe bei Änderungen veröffentlichter Bücher und fehlgeschlagene DAV-Anlage;
-  Veröffentlichungen mit PDF-Metadaten, ungültige Seitenzahlen/-maße und
   konkurrierende Veröffentlichungsversuche;
-  Checkout für Käufer und Autoren, Centbeträge, Versandregeln, fehlende Daten
   und Fehlerantworten von DAV, VLB und Lulu;
-  Webhooks über HTTP mit echtem PostgreSQL: Signaturen, fehlerhafte Payloads,
   doppelte und parallele Zustellungen, App-Neustart, E-Mail-Teilausfälle und
   verspätete Lulu-Statusmeldungen.

DAV, Lulu, Stripe, VLB, Dateispeicher und E-Mail-Versand werden in diesen
Integrationstests kontrolliert ersetzt. Die gezielten Veröffentlichungs-Grenzfalltests verwenden simulierte
Parserergebnisse; die Upload-Suite ergänzt Tests mit tatsächlichen PDF-Dateien.
Ein separater Adaptertest prüft mit dem echten Resend-SDK, dass der
Idempotenzschlüssel im ausgehenden HTTP-Header ankommt.

## Deployment der Webhook-Korrekturen

Vor dem Deployment muss die additive Tabelle `WebhookEffect` angelegt werden.
Für die derzeitige Datenbankverwaltung ohne Prisma-Migrationshistorie liegt die
SQL-Datei `prisma/changes/20260916_webhook_effect.sql` bei. Sie ist im bestehenden
Deployment-Prozess gegen die beabsichtigte Datenbank anzuwenden; anschließend
muss der Prisma-Client aus dem aktualisierten Schema generiert werden.
Die Testdatenbank erhält die Tabelle automatisch über `test:db:prepare`.

DAV verlangt weiterhin `WEBHOOK_KEY`; fehlt der konfigurierte Schlüssel, werden
Requests jetzt abgelehnt. Lulu prüft `Lulu-HMAC-SHA256` gegen die unveränderten
Request-Bytes. Dafür kann `LULU_WEBHOOK_SECRET` auf das **rohe Lulu-API-Secret**
gesetzt werden. Ohne diese Variable extrahiert der Server das Secret aus dem
bereits verwendeten `LULU_AUTH_KEY` (Base64 von `client_id:client_secret`). Ohne
verfügbares Secret werden Lulu-Requests abgelehnt. Grundlage ist die
[offizielle Lulu-Spezifikation](https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml).

Erfolgreich versendete DAV-E-Mails werden einzeln dauerhaft in PostgreSQL
vermerkt. Transaktionsgebundene Advisory Locks serialisieren parallele
Zustellungen auch über mehrere API-Prozesse. Erst nach erfolgreichem Versand
wird die jeweilige Markierung geschrieben. Bei Teilausfällen wird beim nächsten
Webhook nur die fehlende E-Mail erneut gesendet. Die Tabelle darf nicht wie ein
Cache geleert werden, da sonst der dauerhafte Wiederholungsschutz entfällt.

Zusätzlich erhalten E-Mails stabile Resend-Idempotenzschlüssel. Resend hält diese
laut [Dokumentation](https://resend.com/docs/dashboard/emails/idempotency-keys)
24 Stunden vor. Das deckt auch den Fall ab, dass Resend eine E-Mail angenommen
hat, aber die lokale Bestätigung wegen eines Absturzes fehlt. **Eine absolute
Exactly-once-Garantie besteht nicht:** Bleibt dieser unklare Zustand länger als
24 Stunden bestehen, muss vor einer erneuten Zustellung der Versandstatus
geprüft werden. Ändert sich während eines unklaren Versands der E-Mail-Inhalt,
kann Resend die Wiederholung mit demselben Schlüssel ablehnen; auch dann ist
Abgleich nötig.

Lulu-Statusänderungen werden pro Bestellung serialisiert. Ein bereits als
`SHIPPED` gemeldeter Auftrag wird durch verspätete Produktionsmeldungen nicht
auf `PREPARATION` zurückgesetzt. Nicht unterstützte Statuswerte werden ohne
Statusänderung quittiert. Die Locks haben ein Transaktionszeitlimit von 30
Sekunden; Providerfehler führen zu HTTP 502, damit der Absender erneut zustellen
kann. Externe API-Schreibzugriffe und PostgreSQL bilden keine gemeinsame
Transaktion: Bei DAV-Anlage eines Release-Objekts mit anschließendem lokalen
Datenbankfehler kann beispielsweise ein externes Objekt zurückbleiben.
