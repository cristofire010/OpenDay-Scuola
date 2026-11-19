# OpenVolta — Open Day di Fisica

Sito per l'open day del laboratorio di fisica. I ragazzi inquadrano un QR, inseriscono il nome e la dimensione del gruppo, scelgono una o più tappe sulla mappa (oppure si fanno sorprendere) e ricevono un biglietto con tutor e indicazioni. I tutor vedono i gruppi assegnati e tutte le tappe del loro giro.

## Come funziona

| Pagina | Chi la usa | Cosa fa |
| --- | --- | --- |
| `/` | partecipanti | Benvenuto, mappa interattiva, scelta di più laboratori e assegnazione del tutor |
| `/join` | QR precedenti | Reindirizza alla nuova schermata, mantenendo la tappa eventualmente preselezionata |
| `/assegnazione/[id]` | partecipanti | Biglietto con giro, tutor, indicazioni, QR con il codice breve e il codice stampato sotto |
| `/tutor` | tutor (nome utente + password) | I propri gruppi (massimo due) con i laboratori di ciascun giro; l’arrivo si segna scansionando il QR con lo scanner integrato (fotocamera o codice scritto) e a fine giro il tutor chiude il turno, con conferma. Il gruppo chiuso sparisce dall’elenco e il suo QR non viene più accettato |
| `/archivio` | regia | I turni terminati: QR, tappe e tutor. Si possono riaprire o eliminare subito; dopo 30 giorni spariscono da soli |
| `/tutor/scan/[id]` | tutor (nome utente + password) | Conferma l'arrivo da un vecchio biglietto con il link |
| `/staff` | regia (password) | Occupazione live, QR generale e per postazione |
| `/admin` | regia (password) | Area riservata: crea e gestisce gli account dei tutor |
| `/accesso` | tutor | Accesso con nome utente e password (schermata separata da quella riservata) |

## Avvio in locale

1. Servono Node 22+ e un database Postgres.
2. `pnpm install`
3. Per Neon, esegui `neon deploy` per scrivere le connessioni in `.env.local`. Configura anche `STAFF_PASSWORD` e `SESSION_SECRET`.
4. `pnpm db:setup` crea le tabelle e carica le sei postazioni; usa `DATABASE_URL_UNPOOLED` per le migrazioni quando disponibile. Si può rilanciare quando cambi `lib/experiments.json`: aggiorna testi e tutor senza toccare iscritti e capienze.
5. Apri l’area riservata digitando `admin` e crea gli account dei tutor da `/admin` (vedi sotto).
6. `pnpm dev`

I QR contengono l’indirizzo da cui è stata aperta la pagina, così funzionano dai telefoni sulla stessa rete. Se apri il sito da `localhost` (o stampi un biglietto dal PC) il QR usa automaticamente l’IP di rete della macchina e la porta del server. `SITE_URL` serve solo quando il sito ha un dominio: se contiene un indirizzo IP viene ignorato, perché gli IP di rete cambiano.

## Sicurezza

- `/staff` e `/tutor` richiedono login (cookie firmato, 12 ore). Lo staff può fare tutto ciò che fa un tutor.
- I tutor hanno un account personale con nome utente e password (hash scrypt); le password si generano e si cambiano dall’area riservata, mai in chiaro nel database.
- La conferma di arrivo la fa solo un tutor autenticato e solo per i gruppi del proprio giro; i partecipanti non possono più segnarsi da soli.
- La sezione di regia non compare nel sito: nessun link a `/staff` o `/admin`. L’accesso tutor (`/accesso`) e l’accesso riservato sono due schermate separate: quella riservata si apre solo digitando `admin` da una pagina pubblica e chiede la password di `STAFF_PASSWORD`.
- Un cookie per dispositivo evita doppie iscrizioni con lo stesso nome e limita a 4 le iscrizioni da uno stesso telefono (utile per fratelli).
- Rate limit su Postgres: 150 iscrizioni ogni 10 minuti per rete (la rete della scuola è condivisa, quindi il limite è largo) e 10 tentativi di login ogni 5 minuti.

## Contenuti

Il QR del biglietto contiene solo un codice di otto caratteri (es. `K7M2-P9QX`), non un indirizzo web: si legge con lo scanner dentro l'area tutor (`components/tutor/qr-scanner.tsx`), che usa la fotocamera del telefono oppure la foto del QR. Il decoder è `public/vendor/jsqr.js` (jsQR 1.4.0, Apache-2.0): sta nel progetto, quindi funziona anche senza internet.

Esperimenti, aule e indicazioni stanno in `lib/experiments.json`. I tutor che accompagnano i gruppi sono gli account creati da `/admin`: il nome dell’account è quello assegnato ai giri e mostrato sul biglietto. I nomi `guide` in `lib/experiments.json` sono segnaposto delle postazioni, non account. Le tre linee (blu, arancione, verde) corrispondono alle aule: **la segnaletica a terra deve avere gli stessi colori**. La mappa presente è uno schema inventato su due piani, non una planimetria ufficiale: posizione, corridoi e scale vanno verificati con la scuola prima dell'evento. I nomi tutor in `lib/experiments.json` sono segnaposto da sostituire con quelli definitivi. La dimensione massima di un gruppo è in `lib/experiments.ts`, la capienza di ogni laboratorio nella colonna `capacity` di `open_day_stations`.

Non ci sono turni: ogni gruppo occupa un posto in ciascun laboratorio scelto, fino alla capienza del laboratorio. L'assegnazione sceglie un tutor attivo che abbia meno di due gruppi (e non più di dodici persone in tutto) e preferisce chi ha già un gruppo con le stesse tappe, o con al massimo due laboratori di differenza; a parità, prende quello con meno persone. Le regole stanno in `lib/tutor-matching.ts`. Dopo aver aggiunto o cambiato la migrazione `db/migrations/`, esegui `pnpm db:setup`.
