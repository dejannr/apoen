# apoen

Lokalna web/PWA kviz igra za Srbiju. Specifikacija je u `DO_MILION_CODEX_MVP_v1_1.md`.

## Lokalno pokretanje

Potrebni su Node.js 24 LTS, npm i PostgreSQL. Docker se ne koristi.

1. Napravi lokalne baze i rolu kao u §13 specifikacije ili koristi već pripremljenu izolovanu bazu ovog projekta.
2. Kopiraj `.env.example` u `.env`, postavi PostgreSQL URL-ove, `AUTH_SECRET`, `RATE_LIMIT_SECRET` i seed lozinku.
3. Pokreni `npm ci`, `npx prisma generate`, `npm run db:deploy`, `npm run db:seed`.
4. Pokreni `./start.sh` — skripta primeni eventualne migracije i pokrene web aplikaciju i worker zajedno. `Ctrl+C` zaustavlja oba procesa.
5. Otvori `http://localhost:3000`.

Skripta ne radi seed automatski. Na praznoj bazi jednom pokreni `npm run db:seed` pre `./start.sh`. Za pomoć pokreni `./start.sh --help`.

U pripremljenoj lokalnoj bazi početni admin je `admin@example.test` sa lozinkom `LocalAdmin-2026!Change`. Promeni vrednost `SEED_ADMIN_PASSWORD` u `.env` pre ponovnog seed-a; idempotentni seed ne prepisuje već postojeće lozinke. Seed sadrži pilot pitanja za lokalnu proveru, ne finalno urednički sadržaj.

Nemoj usmeriti migraciju na bazu koja sadrži podatke koje želiš da sačuvaš. Razvojna, testna i shadow baza treba da budu odvojene. `.env` sadrži lokalne tajne i nije deo repozitorijuma.

## Provere

- `npm run lint`
- `npm run typecheck`
- `npm run test` — unit i integration testovi; koristi `TEST_DATABASE_URL` iz `.env`.
- `npm run test:integration` — PostgreSQL šema, ograničenja, konkurentni startovi i konkurentni završeci.
- `npm run test:e2e` — Playwright browser testovi; Chromium je potrebno instalirati jednom sa `npx playwright install chromium`.
- `npm run build`
- `npx prisma migrate status`

Za seed u testnu bazu, postavi `DATABASE_URL` na `TEST_DATABASE_URL`, pa izvrši `npm run db:deploy` i `npm run db:seed`. Nikad ne koristi komandu koja briše bazu za testiranje.

## Unos i objava sadržaja

Sadržaj prvo kreiraj kao draft. Administrator kroz `/admin/assets` upravlja slikama koje se čuvaju u bazi, a kroz `/admin/sets` pravi sezonu sa proizvoljnim tier pragovima, dnevni draft i izazove u jednom od četiri formata. Polja konfiguracije, nagrada i opcija su JSON; sandbox pregled simulira nagrade i timeout bez pravljenja pokušaja ili upisa u banku. `/admin/categories` uređuje oblasti, `/admin/statistics` prikazuje rezultate, a budući neodigrani set može da se otkaže. Admin API i lokalni CLI dele servis za validaciju i objavu. Objavljen sadržaj i slike zaključavaju PostgreSQL okidači.

Direktan unos draft redova kroz pgAdmin/SQL je podržan. Za objavu koristi administratorski panel ili CLI; nemoj ručno menjati `status` objavljenog sadržaja.

```sh
npm run content:asset -- --file /putanja/do/slike.webp
npm run content:validate -- --season <uuid>
npm run content:publish -- --season <uuid>
npm run content:validate -- --date YYYY-MM-DD
npm run content:publish -- --date YYYY-MM-DD
```

Nova sezona mora imati tier redni broj 1 sa pragom 0 i rastuće pragove, u granicama maksimalne zarade tog meseca. Dnevni set mora imati osam izazova, po jedan od sva četiri formata u svakom poluvremenu. Publish servis proverava dostižnost najviše nagrade, apoene, odgovore i format-specifična pravila.

## Lokalni reset lozinke

`MAIL_MODE=local` piše link u `.local-mail.log` (gitignore). Endpoint uvek vraća generički odgovor. Reset token je jednokratan, čuva se kao hash i važi 30 minuta.

## Poznate granice

Aplikacija je lokalni MVP. Nema produkcijskog deploymenta, pravne politike/retention sistema, pravila za incidente nakon objave, niti stvarnog SMTP-a. Prisma paketi su pinovani na kompatibilan 6.x skup; pre svakog većeg ažuriranja pokreni kompletnu migraciju, testove i `npm audit`.
