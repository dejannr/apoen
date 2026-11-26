# DO MILION — Codex MVP: master instrukcija v1.1

## Zadatak za Codex (obavezno)

Ti si odgovoran za implementaciju potpuno funkcionalnog lokalnog MVP-a, a ne samo za plan, wireframe ili statički prototip. Ovaj Markdown je samostalan izvor istine, izveden iz master HTML specifikacije v1.1; ne traži prethodni PDF. Prvo pregledaj postojeći repozitorijum, sačuvaj korisničke izmene, zatim implementiraj po fazama iz §15. Ako je prazan, inicijalizuj projekat. Koristi Next.js App Router, React, TypeScript strict, Tailwind, Motion, Prisma, PostgreSQL, Auth.js, Zod, Vitest i Playwright. Samo localhost; nema Docker-a, DigitalOcean-a, produkcijskog deploymenta ili native aplikacije.

**Najvažniji zahtev: data-driven.** Nijedno stvarno pitanje, opcija, tačan odgovor, sezonska tema, prag, collectible, slika predmeta, kategorija, reward ladder ili limit konkretnog pitanja ne sme biti hardkodiran u aplikaciji. Seed je demo, ne runtime izvor. Dodavanje novog sadržaja mora raditi kroz DB i admin/CLI, bez izmena koda, migracija, builda, restarta ili reseed-a. Novi tip mehanike van postojeća četiri zahteva razvoj; to nije deo zahteva. DB sadržaj se priprema u DRAFT, validira i publikuje; po objavi sadržaj je zamrznut radi fer igre. Korisnički nalog nema avatar. Novčanice imaju paletu stvarnih srpskih apoena, ali originalnu virtuelnu grafiku.

### Način rada

1. Pregledaj repozitorijum i postojeće konfiguracije; napravi kratak plan i nastavi sa implementacijom, ne zaustavljaj se na planu. Ne traži potvrdu za radne default-e iz §15; ako naiđeš na stvaran konflikt ili nedostupnu zavisnost, dokumentuj blocker. Ne prepisuj korisničke tajne i ne briši postojeću bazu.
2. Uvedi šemu sa svim tabelama, SQL ograničenjima, migracijama i idempotentnim seed-om; proveri verzije paketa i pinuj kompatibilne verzije. Ne koristi mock/localStorage kao zamenu za DB. Implementiraj scoring kao čiste funkcije, server-side transakcije i autorizaciju, zatim UI i admin.
3. Realizuj sva četiri moda, dva poluvremena, banku sa pojedinačnim novčanicama, jednu rang-listu, trenutni collectible, trajnu kolekciju i istoriju. Implementiraj sve API ugovore i generičke prikaze, DB asset upload i content CLI. Obezbedi local worker, test clock samo za testove, local reset mail i PWA.
4. Implementiraj testove iz §14 uključujući konkurentne zahteve, idempotency, tajne podatke, granice vremena i data-driven test bez restarta/builda. Pokreni lint, typecheck, unit, integration, E2E i production build lokalno kada okruženje to dozvoli. Ne tvrdi da su testovi prošli ako nisu izvršeni. Ako PostgreSQL nije dostupan, prijavi tačan blocker i komande koje korisnik treba da izvrši.
5. Isporuči repozitorijum sa radnim README, .env.example, migracijama, seed-om, content CLI, testovima, dokumentovanim dev/test komandama i instrukcijom kako korisnik kroz pgAdmin/SQL ili admin panel dodaje novu sezonu, slike, pragove i dnevni set. Ne pravi dodatne MVP funkcije koje nisu navedene. U finalnom izveštaju navedi implementirane stavke, test rezultate, nedostatke i sve pretpostavke.

### Dijagram ključnih zavisnosti

```mermaid
flowchart TD
    Browser[Responsive React / PWA] --> App[Next.js routes i server services]
    Admin[Admin panel ili SQL draft + CLI] --> App
    App --> Engine[Scoring i sezonski engine]
    Engine --> PG[(Lokalni PostgreSQL)]
    App --> PG
    Worker[Lokalni worker: timeout / rollover] --> Engine
    PG --> Data[Sezone / tiers / assets / pitanja / pravila]
    PG --> Ledger[Attempts / banknotes / totals / collection]
```

```mermaid
erDiagram
    USERS ||--o{ ATTEMPTS : plays
    USERS ||--o{ PASSWORD_RESET_TOKENS : owns
    SEASONS ||--o{ DAILY_SETS : schedules
    DAILY_SETS ||--o{ CHALLENGES : contains
    CATEGORIES ||--o{ CHALLENGES : categorizes
    CHALLENGES ||--o{ CHALLENGE_OPTIONS : defines
    CHALLENGES ||--o{ ATTEMPTS : attempted
    ATTEMPTS ||--o{ ATTEMPT_ACTIONS : logs
    ATTEMPTS ||--o| BANKNOTES : awards
    USERS ||--o{ BANKNOTES : owns
    SEASONS ||--o{ BANKNOTES : groups
    SEASONS ||--o{ COLLECTIBLE_TIERS : defines
    MEDIA_ASSETS ||--o{ COLLECTIBLE_TIERS : illustrates
    USERS ||--o{ SEASON_TOTALS : earns
    SEASONS ||--o{ SEASON_TOTALS : aggregates
    USERS ||--o{ USER_COLLECTIBLES : collects
    SEASONS ||--o{ USER_COLLECTIBLES : closes
    COLLECTIBLE_TIERS ||--o{ USER_COLLECTIBLES : locks
    USERS ||--o{ ADMIN_AUDIT : acts
```

Sledi puna specifikacija sa poljima svih 17 tabela, API ugovorima, pravilima, prikazima, testovima i radnim default-ima. Tabele i numerički primeri su ugovor za ponašanje ili označeni seed/predlog, nikad hardkodirani sadržaj u runtime-u.

---

## 01 · Cilj, obuhvat i odluke

DO MILION je dnevna web kviz igra za Srbiju. Igrač rešava osam izazova, osvaja virtuelne dinarske novčanice, gradi svoju mesečnu banku i takmiči se na jednoj rang-listi. Svi u jednoj sezoni unapređuju istu vrstu kolekcionarskog predmeta. Cilj je da se zaradi milion dinara, ali rezultat može biti i veći. Nema stvarnog novca, uloga, isplate, kupovine predmeta, avatara, trgovanja, dodatnih pokušaja ni pay-to-win funkcija.

Ovaj dokument spaja funkcionalnu specifikaciju v6.0 i tehničku v1.0, uz naknadno dogovorenu web/PWA platformu. Ranije pominjanje mobilne native aplikacije je zastarelo. Dokument je radni ugovor za implementaciju lokalne verzije, a ne opis već izrađenog softvera. Vizuelni prikazi su wireframe predlozi, ne finalni dizajn.

### Obavezno: sadržaj se menja isključivo kroz bazu (data-driven)

**Usvojeno:** nakon izrade MVP-a, dodavanje novog dana, pitanja, opcija, tačnih odgovora, pravila bodovanja, trajanja, oblasti, mesečne teme, kolekcionarskog predmeta, grafike i praga ne zahteva izmenu izvornog koda, migraciju šeme, novi build ili restart aplikacije. PostgreSQL je jedini autoritativni izvor sadržaja; admin panel je interfejs nad istom bazom, ne drugi izvor podataka. Seed služi isključivo početnom punjenju i testovima.

Dozvoljeno je unositi redove direktno u PostgreSQL (SQL/pgAdmin) u DRAFT stanju, a objaviti ih kroz isti validacioni servis (admin panel ili lokalni content CLI). Ne zaobilaziti publish validaciju direktnim UPDATE statusa. Svi objavljeni podaci ostaju zamrznuti radi jednakih uslova i istorije; novi sadržaj se priprema unapred. Nova pravila igre van četiri postojeća formata, nova funkcionalnost ili promena samog modela zahtevaju razvoj — ne predstavljati da je svaka proizvoljna promena moguća samo podacima.

```
SQL / pgAdmin | ili admin panel | → | PostgreSQL DRAFT | → | Validacija + publish | → | Generički engine + UI | Novi sadržaj bez rebuilda, restarta i novih fajlova u repozitorijumu.
```

| Status | Značenje |
| --- | --- |
| **Usvojeno** | Pravilo koje je korisnik već odobrio. |
| **Predlog** | Konkretna implementaciona odluka za localhost, može se promeniti pre razvoja. |
| **Van obuhvata** | Ne implementirati u ovoj fazi. |

| Tema | Status i pravilo |
| --- | --- |
| Naziv, platforma | Usvojeno: DO MILION; web responsive + PWA, bez native aplikacija. |
| Dnevni sadržaj | Usvojeno: 8 istih izazova za sve; dva poluvremena po 4; četiri formata. |
| Raspored | Predlog: po jedan od svakog formata u poluvremenu; oba dostupna od 00:00, drugo se otključava završetkom prvog. |
| Novac | Usvojeno: 9 dozvoljenih apoena; najviše jedna novčanica po pitanju, ili nula; fleksibilne tabele nagrada. |
| Na ivici | Usvojeno: odstupanje određuje apoen; predlog: apsolutno odstupanje u oba smera, opciona stroga granica po pitanju. |
| Vreme | Predlog: 60 / 45 / 60 / 75 sekundi za četiri formata; ukupno po izazovu. |
| Sezone | Usvojeno: jedna vrsta predmeta mesečno, automatsko unapređenje, istorija banaka i trajna kolekcija. |
| Pragovi | Usvojeno: proizvoljan broj nivoa po mesecu, pragovi/nazivi/slike iz DB. Predlog seed-a: 0 / 25k / 75k / 150k / 300k / 550k / 850k / 1m. |
| Profil | Usvojeno: nadimak, bez avatara. |
| Stack | Usvojeno: Next.js, React, Tailwind, lokalni PostgreSQL, bez Dockera. Dodatni alati prema tehničkoj specifikaciji. |
| Infrastruktura | Van obuhvata: DigitalOcean, Caddy, Let's Encrypt, systemd, produkcijski deployment. |

```
8 izazova | → | Novčanice | → | Moja banka | → | Rang-lista + predmet | → | Nova sezona | Osnovna petlja proizvoda · svakodnevna igra i mesečni napredak
```

## 02 · Pravila dnevne igre i vremena

| Period | Maksimalni iznos | Maksimalni broj novčanica |
| --- | --- | --- |
| Izazov | 5.000 | 1 |
| Poluvreme | 20.000 | 4 |
| Dan | 40.000 | 8 |
| 28 dana | 1.120.000 | 224 |
| 29 dana | 1.160.000 | 232 |
| 30 dana | 1.200.000 | 240 |
| 31 dan | 1.240.000 | 248 |

Početne oblasti (seed u categories): geografija, sport, istorija, film i serije, muzika, nauka, automobili, opšte znanje; nove oblasti dodaju se kroz DB. Ne mora svaki dan imati svih osam oblasti (predlog uredničke slobode). Svi odgovori su unapred ponuđeni, bez slobodnog teksta. Izazov je celina, a korak je pojedinačna akcija unutar izazova. Samo celina donosi novčanicu.

**Predložena pravila dostupnosti:** dan je kalendarski datum po Europe/Belgrade, od lokalne ponoći do sledeće lokalne ponoći; vremenske oznake u bazi su UTC (`timestamptz`). Ne dodavati fiksnih 24h pri računanju kraja dana zbog promene sata. Set ima status objavljen i validan, inače ekran „Današnji kviz još nije dostupan”. Prvo poluvreme se igra redom, od pozicije 1 do 4; drugo od 5 do 8. Nema preskakanja aktivnog izazova osim eksplicitnog odustajanja sa nulom. Između poluvremena pauza bez tajmera; igrač može odmah nastaviti ili se vratiti kasnije tog dana. Propušteni dani se ne nadoknađuju. Početak izazova je eksplicitno dugme, ne otvaranje stranice. Ne pokretati novi izazov ako je dan zatvoren. Rok pokušaja je minimum između početka + limita i kraja dana. Na isteku dana nezapočeta pitanja ostaju neodigrana; započeta se razrešavaju po timeout pravilima. Nema prenosa pokušaja u novi dan.

```
00:00 · dan otvoren | → | 1. poluvreme | 1–4 | → | Pauza / rezultat | → | 2. poluvreme | 5–8 | → | Gotovo / do sutra | Predlog: oba poluvremena istog dana, drugo posle prvog; nema obaveznog termina u 18h.
```

| Stanje dnevne igre (izvedeno) | Uslov | UI akcija |
| --- | --- | --- |
| UNAVAILABLE | Nema objavljenog seta / dan zatvoren | Povratak na početnu |
| READY\_H1 | Set postoji, prvo pitanje nije pokrenuto | Započni 1. poluvreme |
| IN\_H1 | Najmanje jedan pokušaj u prvom delu, nisu svi završeni | Nastavi / vrati aktivni izazov |
| BREAK | Prva četiri terminalna, drugo nije počelo | Rezultat prvog dela; započni drugo |
| IN\_H2 | Drugo počelo, nisu svi završeni | Nastavi |
| COMPLETED | Svih osam terminalnih | Dnevni rezultat |

## 03 · Četiri formata: potpuna logika

### Zajednički ugovor

Konfiguracija svakog izazova je verzionisana i zamrznuta pre objavljivanja. Nagrade su celobrojni dinari iz skupa `{0,10,20,50,100,200,500,1000,2000,5000}`. Svako pitanje mora imati matematički dostižan nivo od 5.000 (predlog za ravnopravnost dana), ali ne mora koristiti sve apoene. Nivoi mogu imati istu nagradu; mogu početi sa nulom. Veći uspeh ne sme davati manju nagradu. Tabela nagrada i cilj su javni; vrednosti odgovora i ključ tačnosti su privatni. Ovim se precizira raniji predlog da se pravila bodovanja ne šalju: korisnik mora videti obećanu nagradu, ali nikada ključ odgovora.

Svaki format dobija `publicConfig`, tajne opcije, `rewardRules`, `timeLimitSec`, `schemaVersion`. Isti scoring kod koriste igra, admin validacija i testovi. Sva četiri engine-a su čiste determinističke funkcije bez direktnog pristupa bazi; servis upravlja transakcijama.

### 3.1 · Na ivici (EDGE)

Primer: „Izaberi tri države čija je ukupna površina najbliža 500.000 km².” Osam ponuđenih država, skrivene površine. Igrač može menjati izbor dok ne potvrdi, mora izabrati tačno K različitih opcija. UI prikazuje broj izabranih, cilj, jedinicu, tabelu tolerancija; ne prikazuje zbir pre potvrde. Server proverava pripadnost opcija, tačno K i duplikate. `sum = Σ value`; `delta = abs(sum-target)`; procentualna tolerancija: `delta*10000 ≤ target*bps` (1% = 100 bps). Za računanje koristiti skalirane cele brojeve/BigInt, bez floating-point grešaka; cilj mora biti pozitivan. Ako je `direction=UNDER_ONLY` i zbir iznad cilja, rezultat je nula; default `ABSOLUTE`.

| Opseg odstupanja (primer) | Nagrada |
| --- | --- |
| Tačno 0% | 5.000 |
| >0 do 1% | 2.000 |
| >1 do 5% | 1.000 |
| >5 do 10% | 500 |
| >10 do 20% | 100 |
| >20% | 0 |

Primer (ilustrativni podaci): zbir 497.000 ili 503.000 = odstupanje 3.000 / 500.000 = 0,6%, nagrada 2.000; zbir 550.000 = 10%, 500; 600.001 = više od 20%, 0. Pravilo je prvo odgovarajuće rastuće `maxDeviationBps` sa uključivom granicom; `fallbackReward=0`. Administrator može izabrati i apsolutne jedinice (`ABS_UNITS`) uz isto pravilo. Nezavršen pokušaj na isteku = 0. Ne postoji parcijalno bodovanje selekcije. Urednik proverava sve kombinacije (predlog do 12 opcija) i potvrđuje da 5.000 može biti osvojeno, čak i kada najviši interval nije tačno nula.

```
{"mode":"EDGE","publicConfig":{"pickCount":3,"target":"500000","unit":"km²","scale":1,"direction":"ABSOLUTE"},"rewardRules":{"metric":"PERCENT_BPS","bands":[[0,5000],[100,2000],[500,1000],[1000,500],[2000,100]],"fallback":0},"timeLimitSec":60}
```

### 3.2 · Koliko si siguran? (CONFIDENCE)

Primer: „Koje države izlaze na Sredozemno more?” Deset opcija; igrač označi onoliko za koliko je siguran. Nema proveravanja tokom označavanja; može ukloniti bilo koju opciju pre potvrde. Nagrada prikazana prema broju označenih je samo potencijalna. Ako bilo koja označena ima `isCorrect=false`, nagrada je 0; inače se nagrada određuje prema broju označenih. Neizabrani tačni odgovori ne kažnjavaju se. Prazan izbor nije potvrdiv; timeout ili odustajanje = 0. Nema parcijalnog otkrivanja odgovora.

| Tačnih označenih (bez greške) | Nagrada (primer) |
| --- | --- |
| 0–2 | 0 |
| 3–4 | 200 |
| 5 | 500 |
| 6 | 1.000 |
| 7 | 2.000 |
| 8+ | 5.000 |

```
{"mode":"CONFIDENCE","publicConfig":{"minSelect":1},"rewardRules":{"metric":"COUNT","minCountBands":[[0,0],[3,200],[5,500],[6,1000],[7,2000],[8,5000]]},"timeLimitSec":45}
```

Pragovi su uključivi od donje granice: uzima se najveći `minCount ≤ count`. Admin proverava da postoji najmanje osam tačnih opcija u ovom primeru i najmanje jedna netačna. Predlog 4–12 opcija u konfiguraciji, bez fiksiranja broja tačnih. Šest tačnih i nijedna netačna = 1.000; osam označenih od kojih je jedna netačna = 0.

### 3.3 · Ne prekidaj niz (ORDER)

Primer: poređaj osam filmova od najstarijeg do najnovijeg. Igrač bira sledeći najmanji rang među preostalim stavkama (ili najveći ako je `DESC`). Svaki izbor je konačan; server odmah javlja da li je ispravan i uklanja potvrđenu stavku. Posle uspešnog koraka može uzeti trenutnu novčanicu ili nastaviti izborom sledeće stavke. Pogrešan izbor završava izazov sa 0; prethodne potencijalne nagrade nisu u banci. Poslednji ispravan korak automatski završava sa 5.000. Vrednosti se ne šalju unapred; urednik mora osigurati jedinstvene rangove, nedvosmislen kriterijum (npr. godina prve premijere). Poslednja preostala stavka i dalje se potvrđuje eksplicitno.

| Ispravnih koraka | Nagrada (primer) |
| --- | --- |
| 0 | 0 |
| 1–2 | 100 |
| 3 | 200 |
| 4 | 500 |
| 5 | 1.000 |
| 6–7 | 2.000 |
| 8 | 5.000 |

```
{"mode":"ORDER","publicConfig":{"direction":"ASC","criterion":"Godina prve premijere"},"rewardRules":{"metric":"COUNT","minCountBands":[[0,0],[1,100],[3,200],[4,500],[5,1000],[6,2000],[8,5000]]},"timeLimitSec":60}
```

### 3.4 · Veće ili manje (HIGH\_LOW)

Primer: „Titanik traje 195 minuta. Da li sledeći film traje duže ili kraće?” Predlog: referenca je fiksna za celo pitanje (moguća naknadna konfiguracija pokretne reference, nije deo MVP-a). Server šalje javnu referencu i samo trenutno ponuđenu stavku; vrednost te stavke je tajna. Igrač bira GREATER ili LESS. Ispravna odluka podiže broj koraka; sledeća stavka se otkriva tek po uspehu. Može da stane ili nastavi. Greška završava sa 0; završni uspešan korak automatski daje 5.000. Urednik bira 2–12 koraka, predlog šest; nijedna vrednost ne sme biti jednaka referenci. Referenca i opcije imaju istu jedinicu i skalu.

| Ispravnih koraka | Nagrada (primer) |
| --- | --- |
| 0 | 0 |
| 1 | 100 |
| 2 | 200 |
| 3 | 500 |
| 4 | 1.000 |
| 5 | 2.000 |
| 6 | 5.000 |

```
{"mode":"HIGH_LOW","publicConfig":{"referenceLabel":"Titanik","referenceValue":"195","unit":"min","scale":1,"referenceStrategy":"FIXED"},"rewardRules":{"metric":"COUNT","minCountBands":[[0,0],[1,100],[2,200],[3,500],[4,1000],[5,2000],[6,5000]]},"timeLimitSec":75}
```

```
ACTIVE | 0 koraka | → | Tačan korak | potencijalni apoen | → | Odluka igrača | UZMI NOVAC | → završetak + jedna novčanica | NASTAVI | → novi korak; greška = 0 | ISTEK | → dostignuti apoen (predlog) | Stanje risk formata ORDER i HIGH_LOW. Greška u bilo kom koraku pre konačnog zaustavljanja poništava potencijalnu nagradu.
```

### 3.5 · Tajmeri, završetak i ponovni ulazak

| Format | Predloženi limit | Na isteku |
| --- | --- | --- |
| Na ivici | 60 s | 0 ako nije potvrđeno |
| Koliko si siguran? | 45 s | 0 ako nije potvrđeno |
| Ne prekidaj niz | 60 s ukupno | Automatski trenutna potencijalna nagrada |
| Veće ili manje | 75 s ukupno | Automatski trenutna potencijalna nagrada |

Ukupno 8 minuta za osam pitanja ako se svi limiti iskoriste (bez animacija/pauza). Server je autoritet. UI dobija `serverNow`, `startedAt`, `expiresAt`; odbrojavanje bazira na monotonom `performance.now()` i procenjenom offsetu, osvežava nakon povratka u tab, ne zavisi od lokalnog sata. Server koristi vreme dobijeno nakon zaključavanja pokušaja; akcija na `now >= expiresAt` se ne primenjuje. Timeout se razrešava tačno jednom, pri sledećem API pozivu ili periodičnom job-u. Osvežavanje stranice, zatvaranje browsera, gubitak mreže i prelazak na drugi uređaj ne pauziraju vreme. Nepotvrđeni izbori EDGE/CONFIDENCE mogu ostati u memoriji taba, nisu bodovani; reload ih briše (predlog). Potvrđeni koraci risk formata se obnavljaju sa servera. Eksplicitno odustajanje, nakon dijaloga, uvek je 0; korisnik sa osvojenim potencijalom može umesto toga uzeti novac.

## 04 · Banka, sezone, kolekcija i rangiranje

| Apoen RSD | Paleta prema stvarnim novčanicama | Osnova (HEX) | Tekst / okvir | Detalj |
| --- | --- | --- | --- | --- |
| 10 | Oker, braon, zelena | #d8bb75 | #79572c | #84915e |
| 20 | Zelena, oker | #a9c691 | #315c3c | #d2bb79 |
| 50 | Ljubičasta, oker | #c5a9d8 | #694582 | #d5b980 |
| 100 | Plava, oker, zelena | #a7c8e9 | #315b8a | #a5ad76 |
| 200 | Braoncrvena, plava | #d5a09a | #873f43 | #8ca9ca |
| 500 | Plavozelena, zelena, žuta, braon | #a5cdc1 | #356c60 | #d9c17d |
| 1.000 | Crvena, oker, plavozelena | #e1a3a0 | #92393c | #b4b99b |
| 2.000 | Sivomaslinasta, narandžasta, plava | #bfc5a1 | #576044 | #d9a55f |
| 5.000 | Zelena, ljubičasta, žuta | #bfa8d3 | #624783 | #b7c78a |

Apoeni su virtuelni i imaju originalnu stilizovanu grafiku jasno obeleženu „DO MILION · VIRTUELNO”, ne kopije stvarnih banknota. Boje odgovaraju paletama srpskih dinara prema Narodnoj banci Srbije; HEX vrednosti iz tabele su približne dizajnerske vrednosti, ne zvanični NBS kodovi. Ista paleta po apoenu koristi se svuda: rezultat, animacija, banka, reward ladder i pregled. Broj i oznaka RSD uvek ostaju vidljivi; ne oslanjati se samo na boju. Svaka pozitivna nagrada stvara jedan red u banknotes . Nikada se ne pravi novčanica od 0. Nikada se ne menjaju ili spajaju apoeni. Pet osvojenih novčanica 5.000, 2.000, 5.000, 1.000, 2.000 = 15.000. Grafičke gomile mogu biti stilizovane, a broj po apoenu i suma moraju biti precizni.

```
PALETA SVIH DEVET APOENA | 10 | 20 | 50 | 100 | 200 | 500 | 1.000 | 2.000 | 5.000 | Ilustrativne virtuelne novčanice, bez kopiranja stvarnog dizajna. | Referenca boja | Narodna banka Srbije — novčanice u opticaju
```

```
MOJA BANKA · PRIMER | 15.000 | RSD | 5.000 | 2.000 | 5.000 | 1.000 | 2.000 | 5 pojedinačnih novčanica · bez ukrupnjavanja | 5.000 × 2 | 10.000 | 2.000 × 2 | 4.000 | 1.000 × 1 | 1.000
```

Banka prikazuje zbir, ukupan broj novčanica, grafičke gomile po apoenu, tabelu svih devet apoena (i nule), dnevne prilive i izbor prethodnog meseca za vlasnika. Istorija je read-only. Novčanica animacijom ulazi u banku tek kada server potvrdi finalni rezultat. Ako animacija nije odgledana, novac je svejedno sačuvan. Prikaz stanja se preuzima sa servera, ne uvećava slepo lokalno. Ukupno stanje i rangiranje se ažuriraju posle svakog završenog pitanja (predlog), ne samo poluvremena.

### Sezona i pragovi

Sezona je kalendarski mesec u vremenskoj zoni Srbije. Na početku nova aktivna banka ima 0; stari podaci ostaju. U svakom mesecu svi igrači imaju zajedničku temu iz seasons.collectible\_theme. Primeri tema (satovi, automobili, kuće, patike, jahte, telefoni, motori, vile, nakit, avioni, odela) su samo sadržaj koji admin unosi u DB; ne postoje hardkodirani meseci, tipovi, imena ili slike u aplikaciji. Predmet se ne kupuje, ne troši novac i ne utiče na rang.

| Minimum dinara | Primer nivoa za sat | Dodatno |
| --- | --- | --- |
| 0 | Osnovni sat | Početni prikaz |
| 25.000 | Digitalni sat | Nivo 2 |
| 75.000 | Sportski sat | Nivo 3 |
| 150.000 | Automatski sat | Nivo 4 |
| 300.000 | Luksuzni sat | Nivo 5 |
| 550.000 | Zlatni sat | Nivo 6 |
| 850.000 | Ekskluzivni sat | Nivo 7 |
| 1.000.000 | Najređi kolekcionarski sat | Nivo 8 |

```
0 | 25k | 75k | 150k | 300k | 550k | 850k | 1M | Redosled nivoa (ne proporcionalna skala). Pragovi su predlog za pilot-test.
```

Trenutni nivo = najveći prag koji ne prelazi mesečni zbir. Prikaz napretka ka sledećem nivou: `(total-currentThreshold)/(nextThreshold-currentThreshold)`, ograničen na 0–100%. Na poslednjem nivou prikazuje „Najviši nivo”, bez gornjeg ograničenja zarade. Prelazak više pragova u jednom pitanju prikazuje finalni nivo. Predlog: trajni predmet na kraju sezone dobijaju korisnici sa najmanje jednim završenim pokušajem (i ako su osvojili 0); neaktivni nalozi ne dobijaju besplatnu kolekciju. Tokom sezone predmet je privremeni prikaz, ne upisuje se kao trajna kolekcija pre zatvaranja. Zaključan predmet, naziv i grafika ostaju nepromenjeni.

#### Dinamički izbor nagrade i slike

Pri svakom učitavanju dashboarda, banke, kolekcije ili javnog profila, server nalazi tekući kalendarski mesec po Europe/Belgrade, učitava njegovu PUBLISHED sezonu, zbir ulogovanog (ili traženog javnog) igrača i sve redove collectible\_tiers sortirane po threshold\_amount. Ako nema season\_totals, zbir je 0. Generička kartica koristi tier\_name, description, asset\_alt i URL generisan iz asset\_id. Nema switch-a po mesecu ili tipu predmeta. Broj nivoa je proizvoljan; nivo 0 je obavezan, svi ostali pragovi su podesivi i 1.000.000 nije obavezan prag. Prag ne sme preći teorijski maksimum za dati mesec. Primer u gornjoj tabeli je seed/pilot, ne pravilo.

```
Server clock | Europe/Belgrade | → | seasons | aktuelni mesec | → | season_totals | zbir igrača | → | collectible_tiers | MAX dostižan prag | → | media_assets | slika + opis | Aktuelni predmet je izveden prikaz; trajni predmet nastaje tek pri zatvaranju sezone.
```

```
-- $1 = ID aktivne sezone, $2 = ID igrača (iz sesije ili javnog profila)
WITH balance AS (
  SELECT COALESCE((SELECT total_amount FROM season_totals
                    WHERE season_id=$1 AND user_id=$2),0) AS total
)
SELECT t.*, b.total
FROM collectible_tiers t CROSS JOIN balance b
WHERE t.season_id=$1 AND t.threshold_amount<=b.total
ORDER BY t.threshold_amount DESC LIMIT 1;
-- Sledeći nivo: threshold_amount > total, ASC LIMIT 1.
-- Nedostajuća sezona: stanje pripreme, bez izmišljene nagrade.
```

SQL primer pretpostavlja prethodno validiranu i objavljenu sezonu. API vraća currentTier, nextTier (ili null), progress, totalAmount i season metadata u konzistentnom snapshotu. Po dodeli novčanice server ponovo računa tier; klijent samo prikazuje dobijeni DTO. Ne čuvati kopiju trenutnog tier-a na korisniku niti ažurirati polje nivoa ručno. Pri zatvaranju sezone tier\_id i finalni zbir/plasman se trajno upisuju u user\_collectibles; slike su immutable.

### Rang-lista

Jedna mesečna rang-lista, ne posebne liste po kategoriji ili poluvremenu. Uključuje igrače sa najmanje jednim terminalnim pokušajem u sezoni, i sa 0. Sortiranje po `total_amount DESC`, za isti zbir isti plasman (`RANK()`: 1,2,2,4); sekundarno stabilno po normalizovanom nadimku i ID. Sopstveni red uvek se prikazuje, čak i izvan prve strane. Za prestizanje sledećeg višeg zbira potrebno je najmanje `higherTotal - ownTotal + 10` jer su svi apoeni deljivi sa 10; za izjednačenje samo razlika. Prvi igrač vidi da je vodeći; izjednačeni vodeći imaju istu poziciju. Predlog 25 redova po strani, server-side paginacija sa `asOf` vremenom; pri osveženju pozicije mogu da se pomere. Istorijski rezultat je deo profila, ne nova aktivna rang-lista. Na kraju sezone čuva se finalni plasman i zbir.

## 05 · UX, navigacija i izgled ekrana

Predlog vizuelnog identiteta: duboka tamnoplava podloga, svetao tekst, topli zlatni akcent za UI (ne za boje apoena), zelena/crvena samo kao dodatni signal uspeha/greške. Font system UI ili lokalni font sa srpskim slovima; bez spoljnog učitavanja za lokalni MVP. Desktop sadržaj max 1280 px; tablet 768–1023 px, mobilni ispod 768 px, desktop ≥1024 px. Koristiti fluidne gridove, safe-area na mobilnom, minimum 44 px dodirnih kontrola, bez horizontalnog skrolovanja na 320 px (osim tabela u sopstvenom kontejneru). Iznosi `Intl.NumberFormat('sr-Latn-RS')`; iznos uvek označen kao virtuelni dinar u kontekstu.

```
DO | MILION | Početna　 Kviz　 Banka　 Rang-lista　 Kolekcija | moj_nadimak | DNEVNI KVIZ · 12. januar | Danas ideš do miliona. | 1. poluvreme · 0/4 | Započni poluvreme → | 2. poluvreme · zaključano | MOJA BANKA | 150.000 RSD | 5.000 | 2.000 | 5.000 | Plasman #42 | JANUAR · SATOVI | ◷ | Automatski sat | Do luksuznog: 150.000 RSD | RANG-LISTA | 1. igrač_01　 985.000 | 2. igrač_02　 920.000 | 42. ti　 150.000 | DO MILION | ☰ | MOJA BANKA | 150.000 RSD | #42 · Automatski sat | DANAS · 0/8 | Prvo poluvreme | Započni | Drugo · zaključano | Dom　Kviz　Banka　Rang　Profil
```

Wireframe 01 · desktop i mobilna početna. Podaci su ilustrativni, kontrole na maketama nisu funkcionalne.

| Ruta | Sadržaj i ponašanje |
| --- | --- |
| `/` | Javna početna: naziv, objašnjenje, pravila, prijava/registracija; prijavljeni ide na dashboard. |
| `/login`, `/register` | Email, lozinka, nadimak pri registraciji; validacija, prikaz grešaka, link ka resetu. Bez avatara. |
| `/forgot-password`, `/reset-password` | Zahtev za reset, jednokratni token; lokalni mail adapter; generički odgovor. |
| `/dashboard` | Mesečni zbir, plasman, predmet i napredak, status oba poluvremena, CTA za sledeće pitanje, datum. |
| `/kviz` | Dnevni pregled, osam pozicija, statusi, nastavak aktivnog pokušaja. |
| `/kviz/[attemptId]` | Header: broj pitanja, poluvreme, tajmer; prompt, opcije, potencijalna nagrada, akcije; bez otkrivanja budućih opcija. |
| `/kviz/rezultat` | Izvedeni rezultat trenutnog poluvremena ili dana; 4/8 izazova, pojedinačne nagrade, zbir, nastavak ili banka. |
| `/banka` | Gomile, brojevi po apoenima, zbir, istorija meseci; prazan ekran ako 0. |
| `/rang-lista` | Mesečni plasman, tabela, sopstveni red, razlika do višeg zbira; paginacija. |
| `/kolekcija` | Trenutni predmet i prethodni završeni predmeti grupisani po godini/mesecu; prazno stanje. |
| `/profil` | Privatni profil, istorija, podešavanja naloga; link ka javnom profilu. |
| `/igrac/[nickname]` | Javni nadimak, tekući zbir i plasman, kolekcija, sažetak istorije; bez emaila i detalja pojedinačnih odgovora. |
| `/pravila` | Opšta pravila, virtuelni novac, pravila svakog formata, vreme, timeout, rangiranje. |
| `/offline` | Jasno upozorenje da je za igru potrebna veza sa serverom; pokušaj ponovo. |
| `/admin/*` | Zaštićeni panel, samo ADMIN. |

### Komponente ekrana kviza

```
1/8 · NA IVICI | 00:42 | Izaberi 3 države | Cilj: 500.000 km² · 2/3 | ✓ Francuska | Italija | ✓ Grčka | Poljska | Portugal | Austrija | Potvrdi · izaberi još jednu | 2/8 · KOLIKO SI SIGURAN? | 00:31 | Ko izlazi na Sredozemno more? | ✓ Grčka | Austrija | ✓ Italija | Belgija | Potencijalno: 0 RSD · jedna greška = 0 | Potvrdi izbor | 3/8 · NE PREKIDAJ NIZ | 00:39 | Izaberi najstariji film | 2 koraka tačno · 100 RSD | Film A | Film B | Film C | Film D | Uzmi 100 RSD | Izborom filma nastavljaš niz | 4/8 · VEĆE ILI MANJE | 00:52 | Titanik · 195 min | Da li film B traje duže ili kraće? | ↑ VEĆE | ↓ MANJE | 3 koraka · 500 RSD | Uzmi 500 RSD
```

Wireframe 02 · primeri svih formata. Prikaz opcija je skraćen radi ilustracije, sadržaj nije predlog stvarnih pitanja.

Komponente: `AppShell`, `DesktopNav`, `MobileNav`, `GameHeader`, `HalfCard`, `QuizProgress`, `Countdown`, `QuestionRenderer`, `RewardLadder`, `OptionGrid`, `RiskControls`, `RewardResult`, `Banknote`, `BankStack`, `MoneyCounter`, `CollectibleCard`, `TierProgress`, `LeaderboardTable`, `SeasonSelector`, `EmptyState`, `ErrorState`, `OfflineBanner`, `ConfirmDialog`, `Toast`. Server Components za početno učitavanje i privatne podatke, Client Components za tajmer, selekcije, Motion i forme. React lokalni state/reducer za UI; ne treba globalni store za MVP. Server snapshot je izvor istine, client state ne čuva novac ili tačne odgovore. Podaci privatnih stranica `no-store`, osvežavanje nakon mutacije.

CollectibleCard i TierProgress su generički: renderuju tekst/sliku iz DTO-a i dinamičke pragove. Banknote dobija denomination i koristi jedinstvenu paletu iz §04 (CSS/token map, ne nth-child). Pitanja, opcije, reward ladder i tajmeri dolaze iz konfiguracije konkretnog izazova; četiri postojeća renderer-a biraju se po mode-u. Novi sadržaj ne sme zahtevati dodavanje komponenti po pitanju, mesecu ili predmetu. Za mutable sadržaj koristiti server-side no-store/dynamic reads; keširati samo immutable assete po ID-u. Posle admin publish-a novo učitavanje vidi podatke bez restarta.

Animacija novčanice (predlog 450–700ms): potvrđen odgovor → kartica rezultata → jedna novčanica animirana do banke → broj ažuriran na server snapshot. Ako `prefers-reduced-motion`, odmah prikazati rezultat bez leta. Korisnik može preskočiti animaciju. Greška = jasna poruka bez lažne novčanice. Upgrade predmeta = jedan nenametljiv prikaz novog nivoa, zatim nastavak. Obavezna stanja: skeleton, prazno, učitavanje, greška sa retry, gubitak mreže, istek, 401, 403, 404, konflikt drugog taba. Dugmad onemogućena dok zahtev traje; fokus na sledeću logičnu kontrolu; tajmer ne najavljuje svaku sekundu čitaču ekrana, samo važne pragove (10s, 0s). Ne koristiti isključivo boju za tačno/netačno.

## 06 · Tehnološka arhitektura — localhost

| Sloj | Izbor / zadatak |
| --- | --- |
| Runtime | Node.js LTS koji podržava odabrane Next.js i Prisma verzije; zaključati u `.nvmrc` i lockfile. |
| Web | Next.js App Router + React + TypeScript (strict). |
| Stil / animacija | Tailwind CSS + Motion (`motion/react`); Rive nije potreban za MVP. |
| Backend | Next.js Route Handlers za igru i JSON API; Server Actions za admin/forme gde je korisno; isti servisni sloj. |
| DB | Lokalni PostgreSQL na 127.0.0.1:5432, bez Dockera. |
| ORM | Prisma + SQL migracije za CHECK, kompozitne FK i indekse koje schema ne izražava. |
| Auth | Auth.js Credentials + JWT sesija (predlog), sopstvena registracija i reset; Argon2id. |
| Validacija | Zod, diskriminisane šeme za formate, validacija na serveru. |
| PWA | Manifest + service worker + lokalne ikone; samo online kviz. |
| Testovi | Vitest za engine, integracija sa odvojenom PG bazom, Playwright za E2E. |
| Kod | Git, npm, ESLint, Prettier; GitHub opciono lokalnoj fazi. |

```
Browser / instalirani PWA | React · Tailwind · Motion · tajmer · interakcije | ↕ HTTP · localhost:3000 · session cookie | Next.js App Router | Server Components · Route Handlers · Server Actions · Auth.js | ↓ proveri korisnika / validiraj input | Game services | Attempt · scoring · wallet · leaderboard · season | Admin services | Editor · validation · publishing · audit | Local worker | Timeout · rollover · reconciliation | ↕ Prisma + parametrizovani SQL · transakcije | PostgreSQL · 127.0.0.1:5432 | Izvor istine · FK · UNIQUE · CHECK · row locks | Jedan modularni Next.js monolit, jedan PostgreSQL; worker je opcioni lokalni proces, ali koristi iste domenske servise.
```

Granice: browser nikada ne pristupa bazi. `server-only` moduli sadrže ORM, scoring i privatne podatke; nikada ih ne importovati u client bundle. Server Component ne prosleđuje ceo DB red u client props, već eksplicitni public DTO. Svi ulazi su nepoverljivi. Lokalni worker nije novi API niti mikroservis, pokreće se u istom repozitorijumu. Ne koristiti Redis, message broker, WebSocket, posebni NestJS servis ili Docker za MVP. Rang-lista može koristiti osvežavanje na zahtev i povratak fokusa; live push nije potreban.

### Predlog strukture repozitorijuma

```
do-milion/
├── src/
│   ├── app/
│   │   ├── (public)/page.tsx, pravila/, igrac/[nickname]/
│   │   ├── (auth)/login/, register/, forgot-password/, reset-password/
│   │   ├── (game)/layout.tsx, dashboard/, kviz/, banka/, rang-lista/,
│   │   │             kolekcija/, profil/
│   │   ├── admin/                 # zasebni layout, role check
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── api/game/, attempts/, bank/, leaderboard/, profile/, admin/
│   │   └── offline/, error.tsx, not-found.tsx, layout.tsx, globals.css
│   ├── components/{layout,quiz,bank,collectibles,leaderboard,ui}/
│   ├── domain/{scoring,types,rewards,calendar}/  # pure functions
│   ├── server/
│   │   ├── db.ts, auth.ts, authorization.ts, clock.ts
│   │   ├── game/{start,action,finish,expire,progress}.ts
│   │   ├── bank/, leaderboard/, seasons/, assets/, categories/, admin/, accounts/, jobs/
│   │   └── dto/, validation/, errors/, rate-limit/
│   └── lib/{format,api-client,pwa}/
├── prisma/schema.prisma, migrations/, seed.ts
├── public/{manifest.webmanifest,sw.js,icons/,assets/}
├── scripts/{worker.ts,verify-ledger.ts,content-cli.ts, seed-demo.ts}
├── tests/{unit,integration,e2e,fixtures}/
├── .env.example, .gitignore, .nvmrc, package.json, package-lock.json
└── README.md
```

## 07 · Model baze podataka — potpuni predlog MVP šeme

Konvencije: UUID PK (generisan u DB ili aplikaciji dosledno), `timestamptz` za instants, `date` za kalendarski play\_date, `int` za dinare i brojače, `bigint` za skalirane numeričke vrednosti, `jsonb` za verzionisane konfiguracije/akcije; `text` za stringove uz validaciju dužine. NN znači NOT NULL, `?` znači nullable. FK podrazumevano RESTRICT na istorijskim podacima; zavisne autentifikacione pomoćne tabele mogu CASCADE pri brisanju, dok se igrači sa istorijom deaktiviraju. Sve promene kroz Prisma migracije, ne ručno menjanje šeme. `created_at` default DB now; `updated_at` ažurirati u servisu. Imena snake\_case u DB, camelCase u TS kroz `@map`/`@@map`.

**Data-driven šema (17 tabela):** sadržaj se dodaje INSERT/UPDATE redova u DRAFT stanju, ne migracijama. Migracije menjaju samo strukturu. Zaštititi objavljene challenges, challenge\_options, collectible\_tiers, seasons (osim validnih statusnih prelaza) i media\_assets DB triggerima ili ograničenim privilegijama; servis validira publish unutar transakcije, uključujući redove unete direktnim SQL-om. Za content CLI obezbediti dry-run, validaciju i objavu preko istih servisa kao admin panel. Ne zaobilaziti zaštitu korišćenjem DB superusera za uobičajeni unos.

**Implementacioni predlog:** media\_assets (bytea) i categories su dve dodatne tabele u odnosu na v1.0. U običnom runtime-u baza nije superuser. DRAFT unos i publish koriste različite dozvole: samo validacioni servis / content CLI sme promeniti status na PUBLISHED; DB zaštita odbija izmene objavljenih redova. Dokumentovati grantove i pravila za ručni SQL unos; ne izlagati SQL browseru.

```
users | 1 → N | attempts | N ← 1 | challenges | N ← 1 | daily_sets | N ← 1 | seasons | attempts | 1 → N | attempt_actions | · | challenges | 1 → N | challenge_options | attempts | 1 → 0..1 | banknotes | N → 1 | seasons | 1 → N | collectible_tiers | users + seasons | 1 → 0..1 | season_totals | · | users + seasons | 1 → 0..1 | user_collectibles | N → 1 | collectible_tiers | users | 1 → N | password_reset_tokens | · | users (ADMIN) | 1 → N | admin_audit | categories | 1 → N | challenges | · | media_assets | 1 → N | collectible_tiers | ER šema · kardinalnosti; potpuni FK i ograničenja navedeni ispod. Auth JWT sesije nemaju DB tabelu.
```

### 7.1 · Enumi i zajednički tipovi

| Tip | Vrednosti |
| --- | --- |
| UserRole | PLAYER, ADMIN |
| UserStatus | ACTIVE, SUSPENDED, DISABLED |
| SeasonStatus | DRAFT, PUBLISHED, CLOSED |
| SetStatus | DRAFT, PUBLISHED, CANCELLED (samo pre početka dana) |
| Mode | EDGE, CONFIDENCE, ORDER, HIGH\_LOW |
| AttemptStatus | ACTIVE, COMPLETED, FAILED, EXPIRED, ABANDONED |
| ActionKind | SUBMIT\_SELECTION, PICK\_NEXT, COMPARE, CASH\_OUT, ABANDON, TIMEOUT |
| EndReason | SUBMITTED, WRONG, CASHED\_OUT, MAX\_STEPS, TIMEOUT, ABANDONED |

Statusi sezona i setova ne zavise od broja otvorenih browsera. `PUBLISHED` sezona je aktivna samo unutar datuma; buduća je zakazana. Nema odvojenog statusa ACTIVE za sezonu. CLOSED znači da je finalizacija završena. Terminalni statusi pokušaja su svi osim ACTIVE.

### 7.2 · Nalozi, autentifikacija i bezbednost

#### users

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| email | text | NN, UNIQUE; normalizovan trim/lowercase |
| nickname | text | NN, prikaz, 3–24 znaka, slova/brojevi/\_ |
| nickname\_key | text | NN, UNIQUE; Unicode NFC + lowercase, zabrana rezervisanih reči |
| password\_hash | text | NN, Argon2id; nikad u DTO |
| role | UserRole | NN, PLAYER default, admin preko seed-a |
| status | UserStatus | NN, ACTIVE default |
| session\_version | int | NN, default 0, ≥0; opoziv JWT |
| created\_at | timestamptz | NN |
| updated\_at | timestamptz | NN |
| last\_login\_at | timestamptz | ? |

Nema `avatar`, `image` ni polja za karakter. Predlog: nadimak se ne menja tokom MVP-a, da istorijske rang-liste i javne adrese ostanu stabilne. Email je privatan. Auth.js Credentials sa JWT strategijom ne zahteva Auth.js DB adapter; registracija, hash i reset su sopstveni server moduli. Auth.js standardni adapter je alternativna opcija kasnije ako se uvede OAuth, a ne dodatna obavezna šema sada.

#### password\_reset\_tokens

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| user\_id | uuid | FK users, NN |
| token\_hash | text | NN, UNIQUE, SHA-256 nasumičnog tokena |
| created\_at | timestamptz | NN |
| expires\_at | timestamptz | NN, > created\_at, predlog 30 min |
| used\_at | timestamptz | ?; jednokratni token |

Indeks `(user_id, expires_at)`. Reset u transakciji zaključava token i nalog, ažurira hash lozinke, povećava `session_version`, označava sve aktivne reset tokene iskorišćenim. Email-verifikacija nije obavezna za localhost MVP (predlog); mail adapter samo za lokalni pregled linka, nikada u javnom response-u.

#### rate\_limits

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| scope | text | deo PK, npr. LOGIN, RESET, ACTION |
| subject\_key | text | deo PK, HMAC identiteta/IP, ne sirovi IP |
| window\_start | timestamptz | deo PK |
| count | int | NN, ≥0 |
| expires\_at | timestamptz | NN, indeks za čišćenje |

Atomični UPSERT brojača; lokalni PG je dovoljan bez Redis-a. Za login odvojeno brojati IP i hash emaila. Ne zaključavati trajno naloge samo zbog spoljnog broja neuspelih zahteva.

### 7.3 · Sadržaj i kalendar

#### seasons

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| year, month | int, int | NN, UNIQUE(year,month), month 1–12 |
| starts\_at, ends\_at | timestamptz | NN, start < end; lokalne granice meseca |
| status | SeasonStatus | NN, DRAFT default |
| collectible\_theme | text | NN, npr. Satovi |
| created\_by | uuid | FK users, NN (admin) |
| created\_at, updated\_at | timestamptz | NN |
| published\_at, closed\_at | timestamptz | ? |

Periodi se ne preklapaju (SQL exclusion constraint nad tstzrange). Admin uređuje temu i pragove u DRAFT; PUBLISHED i CLOSED su immutable za sadržaj. Publish validira najmanje jedan nivo sa pragom 0, jedinstvene strogo rastuće pragove i uzastopne tier\_no, proizvoljan broj nivoa, dostižne pragove do teorijskog maksimuma meseca, postojeće validne assete i kalendarske granice. Ne zahtevati tačno osam nivoa ni prag 1m.

#### media\_assets

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK; ID verzije asseta |
| sha256 | text | NN, UNIQUE; hash bytes; deduplikacija |
| mime\_type | text | NN, CHECK PNG / JPEG / WebP |
| bytes | bytea | NN, neizmenjivo; max 5 MiB |
| byte\_size | int | NN, CHECK 1 byte ≤ byte\_size ≤ 5 MiB i jednak octet\_length(bytes) |
| width\_px, height\_px | int, int | NN, 1–4096, provereno dekodiranjem |
| created\_by | uuid | FK users, NN (admin) |
| created\_at | timestamptz | NN |

Slike kolekcionarskih predmeta su sadržaj u PostgreSQL-u, ne fajlovi u public/assets. Upload dekodira i ponovo enkodira dozvoljene raster formate, uklanja metapodatke, proverava dimenzije, veličinu i hash. SVG, HTML, spoljne adrese i izvršni sadržaj nisu dozvoljeni. Asset je immutable; za novu sliku se kreira novi red. Direktan SQL unos bytes zahteva validaciju pre publish-a (isti servis proverava i direktno unete assete). GET /api/assets/:id služi samo objavljene slike povezane sa PUBLISHED/CLOSED sezonama; admin preview za DRAFT je autorizovan i no-store. Nema izmena izvornog koda ili novih fajlova pri dodavanju slike. FK RESTRICT sprečava gubitak istorijskih slika.

#### collectible\_tiers

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| season\_id | uuid | FK seasons, NN |
| tier\_no | int | NN, ≥1; UNIQUE(season\_id,tier\_no) |
| threshold\_amount | int | NN, ≥0 i deljivo sa 10; UNIQUE(season\_id,threshold\_amount) |
| tier\_name | text | NN |
| description | text | NN, može biti prazan |
| asset\_id | uuid | NN, FK media\_assets(id), RESTRICT |
| asset\_alt | text | NN, pristupačnost |
| created\_at | timestamptz | NN |

UNIQUE(id,season\_id) za kompozitni FK iz user\_collectibles. Indeks (season\_id,threshold\_amount DESC) za dinamički izbor. tier\_no je redni broj (bez fiksnog maksimuma), threshold\_amount jedinstven unutar sezone. Slika se dobija preko asset\_id i GET /api/assets/:id, ne preko putanje u repozitorijumu. Nakon publish-a tier, opis i referenca na immutable asset ne mogu se menjati; istorijski predmeti ostaju tačni.

#### daily\_sets

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| season\_id | uuid | FK seasons, NN |
| play\_date | date | NN, UNIQUE |
| status | SetStatus | NN, DRAFT default |
| created\_by | uuid | FK users, NN |
| created\_at, updated\_at | timestamptz | NN |
| published\_at | timestamptz | ? |

UNIQUE(id,season\_id). Indeks `(season_id,play_date)`. Datum mora biti u mesecu sezone (validacija servisa i po potrebi trigger). Jedan set po danu. Publish je atomski, tačno 8 validnih izazova, pozicije 1–8, po jedan format u poluvremenu prema radnom pravilu. Objavljeni set nije izmenjiv; budući može biti otkazan pre dana, pa administrator kroz auditovanu DRAFT izmenu vraća set u planiranje (bez pokušaja); ne pravi drugi red istog datuma. Tokom dana nema promena sadržaja ili nagrada.

#### categories

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| slug | text | NN, UNIQUE, stabilan |
| name | text | NN, prikaz |
| is\_active | boolean | NN, default true |
| created\_at, updated\_at | timestamptz | NN |

Početne oblasti su seed redovi. Administrator može dodati novu oblast bez izmene koda. Slug i naziv se ne menjaju kada su korišćeni u objavljenom sadržaju; deaktivacija utiče samo na nove draftove. FK RESTRICT čuva istoriju. Nema TypeScript enuma kategorija.

#### challenges

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| daily\_set\_id, season\_id | uuid, uuid | NN, kompozitni FK (daily\_set\_id,season\_id) |
| position | int | NN, 1–8; UNIQUE(daily\_set\_id,position) |
| half | int | NN, CHECK 1 za 1–4; 2 za 5–8 |
| mode | Mode | NN |
| category\_id | uuid | NN, FK categories(id), RESTRICT |
| title, prompt | text, text | NN, plain text, bez HTML |
| public\_config | jsonb | NN, schema validirana po mode-u |
| reward\_rules | jsonb | NN, dozvoljeni apoeni, validirani pragovi |
| schema\_version | int | NN, default 1 |
| time\_limit\_sec | int | NN, predlog CHECK 15–180 |
| explanation | text | NN, privatno do dozvoljenog reveal-a |
| source\_refs | jsonb | NN, niz izvora/URL, datum i definicija podatka; admin only |
| created\_at, updated\_at | timestamptz | NN |

UNIQUE(id,season\_id); indeks `(daily_set_id,half,position)`. Ne skladištiti tajne u public\_config. Opcije i scoring su immutable kad set postane PUBLISHED. Nagrade su JSON zbog različitih tipova pravila, ali validacija radi pre publish-a; ledger ima DB CHECK za apoene.

#### challenge\_options

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| challenge\_id | uuid | FK challenges, NN |
| label | text | NN, javno ime opcije |
| sort\_order | int | NN, ≥1; UNIQUE(challenge\_id,sort\_order) |
| numeric\_value | bigint | ?; EDGE / HIGH\_LOW, skalirana jedinica |
| correct\_flag | boolean | ?; CONFIDENCE |
| order\_rank | int | ?; ORDER, jedinstven pozitivan rang po izazovu |
| explanation | text | ?; privatni detalj |

CHECK da je tačno jedno od numeric\_value/correct\_flag/order\_rank non-null; mode usklađenost validira publish. UNIQUE(challenge\_id,order\_rank) dopušta više NULL. ID opcije je nasumičan i ne sadrži tajne. sort\_order je redosled prikaza, ne tačan redosled. HIGH\_LOW sort\_order određuje korake; ostali isti redosled za sve (predlog, bez nasumičnosti).

### 7.4 · Pokušaji, akcije i novčanice

#### attempts

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| user\_id | uuid | FK users, NN |
| challenge\_id, season\_id | uuid, uuid | NN; kompozitni FK challenges(id,season\_id) |
| status | AttemptStatus | NN, ACTIVE default |
| started\_at, expires\_at | timestamptz | NN, start < expires |
| finished\_at | timestamptz | ?; terminalno obavezno |
| end\_reason | EndReason | ?; terminalno obavezno |
| correct\_count | int | NN, default 0, ≥0 |
| state\_json | jsonb | NN, server state po formatu; npr. acceptedOptionIds / currentStep |
| revision | int | NN, default 0, ≥0 |
| final\_reward | int | ? dok ACTIVE; terminalno 0 ili dozvoljeni apoen |
| created\_at | timestamptz | NN |

UNIQUE(user\_id,challenge\_id) — samo jedan pokušaj; UNIQUE(id,user\_id,season\_id) — kompozitni FK ledger-a. Parcijalni UNIQUE(user\_id) WHERE status='ACTIVE' — jedan aktivni pokušaj po igraču (pre starta razrešiti istekli). Indeksi `(status,expires_at)`, `(user_id,season_id)`, `(season_id,status)`. CHECK ACTIVE ⇔ `finished_at`, `final_reward`, `end_reason` svi NULL; terminalni ⇔ svi non-null; `finished_at >= started_at`. `FAILED` i `ABANDONED` imaju final\_reward=0. `EXPIRED` može imati nagradu samo prema mode pravilima. `revision` raste za svaku prihvaćenu akciju uključujući timeout. Ne čuvati klijentski sat kao autoritet.

#### attempt\_actions

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| attempt\_id | uuid | FK attempts, NN |
| sequence\_no | int | NN, ≥1; UNIQUE(attempt\_id,sequence\_no) |
| request\_id | uuid | NN, UNIQUE(attempt\_id,request\_id); idempotency key |
| kind | ActionKind | NN |
| payload | jsonb | NN, minimalna validirana akcija |
| request\_hash | text | NN, hash kanonizovanog payload-a + expectedRevision |
| response\_snapshot | jsonb | NN, isključivo bezbedan DTO za replay |
| created\_at | timestamptz | NN, serversko vreme |

Samo prihvaćene akcije (uključujući timeout) se upisuju; neuspešni HTTP zahtevi nisu koraci. Replay identičnog zahteva vraća zabeleženi bezbedni odgovor, drugačiji payload za isti request\_id = 409. Klijent zatim može GET aktuelno stanje ako je replay star. Ne logovati lozinke, session cookie ili sirove tajne odgovore. Timeout request\_id kreira server; worker i API ne mogu duplirati zbog row lock-a.

#### banknotes

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| attempt\_id | uuid | NN, UNIQUE |
| user\_id, season\_id | uuid, uuid | NN, kompozitni FK (attempt\_id,user\_id,season\_id) ka attempts |
| denomination | int | NN, CHECK IN (10,20,50,100,200,500,1000,2000,5000) |
| earned\_at | timestamptz | NN, vreme terminalnog razrešenja |

Indeks `(user_id,season_id,denomination)` i `(season_id,user_id)`. Append-only: bez UPDATE/DELETE u aplikaciji; migracije i održavanje odvojeno. FK garantuje isti nalog i sezonu. Denomination mora odgovarati attempts.final\_reward; servis i reconciliation proveravaju invariant, predlog deferred constraint trigger kao dodatni DB guard. Ako worker razreši istek posle ponoći, sezona i dnevni zbir se određuju iz challenge, nikada iz earned\_at.

#### season\_totals

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| user\_id | uuid | FK users, deo PK |
| season\_id | uuid | FK seasons, deo PK |
| total\_amount | int | NN, default 0, ≥0, deljivo sa 10 |
| completed\_count | int | NN, default 0, 0–248 (terminalni pokušaji) |
| final\_rank | int | ?; >0 kada sezona CLOSED |
| updated\_at | timestamptz | NN |

Indeks `(season_id,total_amount DESC,user_id)`. Keš/projekcija ledger-a, nikad primarni izvor. Jedan red nastaje i pri prvom terminalnom rezultatu od 0; uvećanje `completed_count` samo jednom po pokušaju. Zbir i brojač ažurirati u istoj transakciji. Pre zatvaranja sezone proveriti ledger vs. totals. `int` je dovoljan za ograničene mesečne zbirove. Nema globalnog lifetime balance-a.

#### user\_collectibles

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| user\_id, season\_id | uuid, uuid | kompozitni PK, FK users i seasons |
| tier\_id | uuid | NN, kompozitni FK (tier\_id,season\_id) |
| awarded\_at | timestamptz | NN |
| final\_amount | int | NN, ≥0 |
| final\_rank | int | NN, >0 |

Jedan trajni predmet po korisniku i sezoni, samo nakon finalizacije. Tier i asset su immutable; `final_amount` i `final_rank` su snapshot. Istorija banke se izvodi iz ledger-a, nije potrebna tabela sa kopijom svih banknota.

### 7.5 · Admin audit i pomoćni poslovi

#### admin\_audit

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| actor\_id | uuid | FK users, NN |
| action | text | NN, npr. CREATE, EDIT, VALIDATE, PUBLISH, CANCEL, SUSPEND |
| entity\_type | text | NN |
| entity\_id | uuid | NN, generička referenca; bez FK zbog više tipova |
| details | jsonb | NN, bez tajni i lozinki; sažetak izmena |
| created\_at | timestamptz | NN |

Indeks `(entity_type,entity_id,created_at)`, `(actor_id,created_at)`. Upis u istoj transakciji kao admin mutacija. Ne brisati audit iz UI-a.

#### job\_runs

| Polje | Tip | Ograničenja / svrha |
| --- | --- | --- |
| id | uuid | PK |
| job\_type | text | NN, EXPIRE, CLOSE\_SEASON, RECONCILE, CLEANUP |
| job\_key | text | NN, npr. season UUID ili vremenski slot; UNIQUE(job\_type,job\_key) |
| status | text | NN, RUNNING/SUCCEEDED/FAILED |
| started\_at | timestamptz | NN |
| finished\_at | timestamptz | ? |
| details | jsonb | NN, bez privatnih podataka |

Job log nije garancija exactly-once; DB brave i idempotentne domenske funkcije jesu. Ponoviti FAILED/stale RUNNING posao. Bez posebne tabele dnevnog napretka: izvodi se iz attempts. Bez posebne leaderboard tabele: season\_totals je projekcija. Bez posebne auth\_sessions tabele pri JWT strategiji. Ukupno 17 tabela uključujući pomoćne.

## 08 · API ugovor, DTO i greške

API je same-origin JSON pod `/api`. Za privatne rute `Cache-Control: private, no-store`. Mutacije: auth, aktivan nalog, Origin/CSRF provera, schema validacija, role i vlasništvo, rate limit; ne oslanjati se na middleware kao jedinu autorizaciju. Server Components mogu pozvati servis direktno bez internog HTTP-a, ali koriste identične provere. Svaki request ima correlation ID; greške bez stack trace-a. ISO 8601 UTC vremena; `playDate` lokalni YYYY-MM-DD; iznosi integer. ID string UUID. BigInt vrednosti u JSON kao string.

| Metod i putanja | Ulaz / ponašanje |
| --- | --- |
| POST `/api/auth/register` | email, nickname, password; 201 ili validaciona greška |
| `/api/auth/[...nextauth]` | Auth.js login/logout/session i CSRF tok |
| POST `/api/auth/forgot-password` | email; uvek generički 202 za validan format |
| POST `/api/auth/reset-password` | token, password; jednokratno; 204 |
| GET `/api/game/today` | status dana, season, dve polovine sa javnim metapodacima i terminalnim rezultatima, nextChallengeId/activeAttemptId |
| POST `/api/attempts/start` | challengeId; 201 nov, 200 postojeći isti pokušaj; ne menja rok |
| GET `/api/attempts/:id` | snapshot vlasnika; ako je istekao, atomarno razreši pre odgovora (namenska iznimka od read-only, bez javnog keširanja) |
| POST `/api/attempts/:id/action` | requestId, expectedRevision, kind, payload; SUBMIT\_SELECTION, PICK\_NEXT, COMPARE |
| POST `/api/attempts/:id/finish` | requestId, expectedRevision, kind CASH\_OUT ili ABANDON; isti domenski proces |
| GET `/api/game/result?date=YYYY-MM-DD` | sopstveni dnevni rezultat, H1/H2 status i suma |
| GET `/api/bank?season=UUID` | own bank totals, denominations, daySummary, totalNotes; default aktivna sezona |
| GET `/api/bank/history` | sopstveni prethodni meseci i sažeci |
| GET `/api/leaderboard?page=1` | samo aktivna sezona, rows, me, gap, asOf, totalRows |
| GET `/api/profile/me` | privatni podaci, aktivna sezona, istorija i kolekcija |
| GET `/api/profile/:nickname` | javni podaci i kolekcija, bez privatne banke i emaila |
| GET `/api/collectibles` | sopstveni trenutni nivo, sledeći prag i trajna kolekcija |
| GET `/api/health` | lokalno stanje aplikacije i DB konekcije, bez tajni; 200/503 |
| GET /api/assets/:id | Javna immutable PNG/JPEG/WebP slika objavljenog ili istorijskog tier-a; ETag SHA-256, Content-Type i nosniff; 404 za neobjavljen asset. |
| GET /api/admin/assets/:id | Autorizovan preview draft slike, private/no-store. |
| POST /api/admin/assets | ADMIN multipart raster upload; validacija, normalizacija, DB bytea; vraća assetId i metadata. |
| GET/POST /api/admin/categories; PATCH /api/admin/categories/:id | ADMIN lista, kreiranje, deaktivacija; bez brisanja korišćene kategorije. |

Dnevni pregled ne otkriva prompt/opcije pre početka (predlog za fer igru), samo redni broj, mode, category i status. Aktivni attempt DTO daje javni prompt, tabelu nagrada, trenutno vidljive opcije i server deadline. `GET /api/game/today` može servisno razrešiti istekli sopstveni pokušaj; nema keširanja niti prefetch-a tih mutirajućih čitanja. Bolji strogo REST alternativni ugovor je eksplicitni POST reconcile pre GET, ali u ovom MVP-u izabrana je lazy expiry uz worker.

Za GET /api/collectibles i dashboard: currentTier i nextTier su objekti {id, tierNo, thresholdAmount, name, description, assetId, assetUrl, assetAlt} ili null; nextTier=null na poslednjem nivou. season={id,year,month,theme}; totalAmount integer, progress 0–1 ili null kada nema sledećeg nivoa. history sadrži finalAmount, finalRank i zaključani tier za svaku CLOSED sezonu. Sve dolazi iz baze; DTO nikada ne pretpostavlja broj nivoa niti tip predmeta.

#### Primer početka i odgovora

```
POST /api/attempts/start
Content-Type: application/json

{"challengeId":"<uuid>"}
```

```
{"attemptId":"<uuid>","challengeId":"<uuid>","status":"ACTIVE","revision":0,"half":1,"position":1,"mode":"EDGE","prompt":"Izaberi 3 države…","serverNow":"2026-01-12T10:00:00.000Z","expiresAt":"2026-01-12T10:01:00.000Z","correctCount":0,"potentialReward":0,"canCashOut":false,"publicConfig":{"pickCount":3,"target":"500000","unit":"km²","direction":"ABSOLUTE"},"rewardRules":{"metric":"PERCENT_BPS","bands":[[0,5000],[100,2000],[500,1000]],"fallback":0},"options":[{"id":"<uuid1>","label":"Država A"},{"id":"<uuid2>","label":"Država B"},{"id":"<uuid3>","label":"Država C"}],"result":null}
```

Primer je skraćen radi čitljivosti; realni DTO sadrži sve vidljive opcije i punu tabelu nagrada. `potentialReward` za EDGE/CONFIDENCE je 0 na serveru pre potvrde; frontend sme da prikaže procenu nagrade prema javnom broju selekcija za CONFIDENCE, ali ne da je upiše u banku.

```
{"requestId":"<uuid>","expectedRevision":0,"kind":"SUBMIT_SELECTION","payload":{"optionIds":["<uuid1>","<uuid2>","<uuid3>"]}}
```

```
{"attemptId":"<uuid>","status":"COMPLETED","revision":1,"serverNow":"2026-01-12T10:00:42.000Z","result":{"reward":2000,"banknoteId":"<uuid>","reason":"SUBMITTED","finishedAt":"2026-01-12T10:00:42.000Z"},"bank":{"seasonId":"<uuid>","totalAmount":152000,"totalNotes":61},"collectible":{"currentTier":{"id":"<uuid>","tierNo":4,"thresholdAmount":150000,"name":"Automatski sat","description":"Primer","assetId":"<uuid>","assetUrl":"/api/assets/<uuid>","assetAlt":"Automatski sat"},"nextTier":{"id":"<uuid>","tierNo":5,"thresholdAmount":300000,"name":"Luksuzni sat","description":"Primer","assetId":"<uuid>","assetUrl":"/api/assets/<uuid>","assetAlt":"Luksuzni sat"},"progress":0.013333,"upgraded":false},"next":{"challengeId":"<uuid>","dailyState":"IN_H1"}}
```

| Action kind | Payload | Dozvoljeno stanje |
| --- | --- | --- |
| SUBMIT\_SELECTION | optionIds: uuid[] | ACTIVE EDGE / CONFIDENCE; finalno |
| PICK\_NEXT | optionId: uuid | ACTIVE ORDER, preostala opcija |
| COMPARE | choice: GREATER/LESS, step: int | ACTIVE HIGH\_LOW, step mora odgovarati serveru |
| CASH\_OUT | {} | ACTIVE ORDER/HIGH\_LOW nakon najmanje 1 tačnog koraka; nagrada može biti 0 |
| ABANDON | {} | bilo koji ACTIVE, 0 |
| TIMEOUT | interno, {} | samo server, istekao rok |

Predlog prikazivanja rešenja: odmah se prikazuje iznos i status; za risk formate tačnost koraka je neophodna mehanici i ne može se sakriti. Ne prikazivati konkretne skrivene vrednosti, preostale odgovore ili kompletan ključ istog dana. Kompletno objašnjenje može se prikazati vlasniku pokušaja nakon zatvaranja dana (npr. `GET /api/attempts/:id/review`, proveriti datum); neodigrani nemaju pravo naknadnog igranja. Deljenje odgovora među igračima nije potpuno sprečivo.

| HTTP | Kod | Ponašanje klijenta |
| --- | --- | --- |
| 400 | INVALID\_INPUT | Greška polja, bez promene pokušaja |
| 401 | UNAUTHENTICATED | Prijava, povratak na stranicu |
| 403 | FORBIDDEN / ACCOUNT\_INACTIVE | Prikaz zabrane; ne pokušavati zaobići |
| 404 | NOT\_FOUND | Nema entiteta ili nije vlasnik privatnog pokušaja |
| 409 | OUT\_OF\_ORDER / HALF\_LOCKED / ACTIVE\_ATTEMPT\_EXISTS | Osveži dnevni snapshot |
| 409 | REVISION\_CONFLICT / IDEMPOTENCY\_CONFLICT | GET trenutno stanje; ne ponavljaj drugi payload sa istim ID |
| 409 | DAY\_CLOSED / SEASON\_CLOSED | Prikaži završetak, nema novih pokušaja |
| 422 | CONTENT\_INVALID | Admin dobija listu validacionih grešaka |
| 429 | RATE\_LIMITED | Retry-After; tajmer se ne pauzira |
| 503 | SERVICE\_UNAVAILABLE | Mrežna greška, retry istim requestId |

Na validnu akciju koja zakasni: server terminalno razrešava timeout i vraća 200 sa EXPIRED snapshotom, ne dodeljuje nagradu na osnovu zakasnele akcije. Na terminalni pokušaj ponovljeni isti request vraća replay; nova akcija vraća aktuelni terminalni rezultat uz oznaku `alreadyFinished`, bez efekta. JSON greška: `{"error":{"code":"REVISION_CONFLICT","message":"Pokušaj je već ažuriran.","requestId":"..."}}`.

## 09 · Backend algoritmi, transakcije i konzistentnost

### 9.1 · Start i stanje pokušaja

```
POST start | → | Auth + season gate | → | Lock korisnika | → | Provera dana i redosleda | → | INSERT / postojeći | Start je idempotentan po user_id + challenge_id. Nema ponovnog startovanja tajmera.
```

1. Učitaj user i proveri status, identitet se izvodi iz sesije. Počni DB transakciju.
2. Zaključaj sezonu deljenom bravom (`FOR SHARE`) radi koordinacije sa rollover-om; zatim korisnika `FOR UPDATE` radi paralelnih startova. U svim mutacijama redosled zaključavanja je sezona → korisnik → pokušaj → zbir, uz sortirane ID kada ima više redova.
3. Koristi DB vreme (`clock_timestamp()` posle brave), proveri da je sezona objavljena, challenge pripada današnjem setu, datum nije istekao. Ako postoji pokušaj za isti challenge, vrati postojeći bez novog roka; zatvoren dan može dobiti samo GET istorije, ne start. Razreši istekli aktivni pokušaj iste sezone pre prelaska; worker / rollover razrešava stare sezone.
4. Izvedi sledeći redni broj na osnovu terminalnih prethodnih pokušaja. Proveri da nema drugog aktivnog pokušaja i da je drugi deo otključan.
5. Kreiraj ACTIVE pokušaj, revision 0, istek min(now+limit, endOfDay), početni state. Unique constraint je dodatna zaštita. Vrati javni DTO.

### 9.2 · Akcija i finalizacija

```
API akcija | auth + Zod | DB brave | sezona / user / attempt | Replay, revision | i rok | Scoring | server only | Terminalno? | Završi attempt | + jedna nota ili 0 | Ažuriraj zbir | + action log | COMMIT | javni rezultat | Sačuvaj korak | + COMMIT / snapshot | DA | NE | Jedna transakcija. Nijedna UI animacija se ne pokreće kao nagrada pre uspešnog commit-a.
```

```
applyAction(userId, attemptId, input):
  validate request envelope and auth
  TX begin
    lock season FOR SHARE, user FOR UPDATE, attempt FOR UPDATE
    assert owner, active user
    if matching requestId exists:
      assert same requestHash; return stored safe snapshot
    if terminal: return authoritative terminal result
    now = DB clock_timestamp()
    if now >= expiresAt: expire and finalize using server state
    else:
      assert season permits play; assert expectedRevision == revision
      validate action against mode and current state
      transition = engine.evaluate(frozenChallenge, state, action)
      if terminal: finalize(transition.reward, reason)
      else: update state, correctCount, revision
    append accepted action with safe response snapshot
  TX commit
  return safe DTO
```

`finalize` nikada ne prima iznos od browsera. Proverava terminalno stanje, dozvoljeni apoen, zatim ažurira attempts (status, reason, final\_reward, finished\_at, revision), upisuje tačno jednu banknote samo ako reward>0, UPSERT season\_totals (`total_amount += reward`, `completed_count += 1`). Na neuspeh bilo kog upisa rollback svega. `INSERT banknotes ON CONFLICT DO NOTHING` se ne sme koristiti za slepo povećanje zbira; konflikt znači invariant violation ili replay koji je prethodno prepoznat. Ako worker finalizuje, loguje TIMEOUT, ne korisničku zakasnelu akciju. Server response snapshot se gradi unutar transakcije; u slučaju izgubljenog odgovora retry sa istim requestId dobija isti ishod. Kada treba ponovo učitati banku, klijent koristi GET za sveže stanje. Ako dva taba pošalju različite akcije za istu reviziju, samo jedna uspeva; druga dobija konflikt ili finalni snapshot.

### 9.3 · Pokušaj state machine

| Od | Događaj | Do | Nagrada |
| --- | --- | --- | --- |
| Ne postoji | Validan start | ACTIVE | još nema |
| ACTIVE | Ispravna parcijalna risk akcija | ACTIVE | potencijal, ne ledger |
| ACTIVE | SUBMIT\_SELECTION | COMPLETED ili FAILED ako CONFIDENCE ima grešku | pravilo ili 0 |
| ACTIVE | Pogrešan ORDER/HIGH\_LOW | FAILED | 0 |
| ACTIVE | CASH\_OUT / poslednji tačan korak | COMPLETED | trenutni nivo |
| ACTIVE | Timeout | EXPIRED | prema formatu |
| ACTIVE | ABANDON | ABANDONED | 0 |
| Terminalno | Bilo koja nova akcija / retry | Isto | bez novog upisa |

EDGE koji je van tolerancije može biti COMPLETED sa 0; CONFIDENCE sa premalo ispravnih ali bez greške takođe COMPLETED sa 0. Status nije sinonim za pozitivan iznos.

### 9.4 · Lokalni worker i kraj sezone

Worker (`npm run worker`) svakih 5 sekundi pretražuje ACTIVE attempts sa expires\_at≤DB now, ograničava batch npr. 100. Kandidati se biraju bez zaključavanja pa svaki razrešava servis uz propisan redosled brava; dva worker-a bezbedno rade isti kandidat (drugi vidi terminalno). Na pokretanju i periodično (npr. 30 s) proveri se da li je neka objavljena sezona prošla ends\_at. Lazy expiry na čitanju i startu obezbeđuje korektnost kada worker nije pokrenut. Nova sezona se ne aktivira brisanjem starih redova: određuje se na osnovu lokalnog datuma i objavljenog statusa.

```
01. kraj meseca | → | Ekskluzivna brava sezone | → | Razreši istekle | → | Proveri ledger | → | RANK + kolekcija | → | CLOSED | Nova sezona ima nezavisne zbirove. Stari ledger ostaje čitljiv; rollover se može ponoviti bez duplih nagrada.
```

Predlog za MVP: finalizacija jedne sezone u jednoj transakciji sa `FOR UPDATE` season row. Završi preostale ACTIVE pokušaje (svi rokovi su najkasnije na ends\_at; isti finalizer bez ponovnog zaključavanja sezone, korisnici sortirani), proveri sumu i brojače, izračunaj `RANK()` po total\_amount, upiši final\_rank za sve učesnike, upiši user\_collectibles prema najvećem dostižnom tier-u, označi CLOSED. Ako invariant ne važi, rollback i job FAILED, ne prikrivati razliku. Ponovni poziv za CLOSED je no-op. Rollover ne zavisi od toga da li je administrator već kreirao sledeći set; ako nova sezona nedostaje, dashboard prikazuje stanje pripreme bez mogućnosti igranja. Završavanje prethodne sezone prioritet je pre startovanja prvog izazova novog meseca. U localhost dev režimu dozvoljen je kontrolisani testni clock, ali nikada kroz javni endpoint.

#### Provera ledger-a i rangiranje (SQL obrasci)

```
-- Izvor istine za jednu banku
SELECT denomination, COUNT(*) AS note_count,
       SUM(denomination) AS amount
FROM banknotes WHERE user_id = $1 AND season_id = $2
GROUP BY denomination ORDER BY denomination DESC;

-- Jedna rang-lista, stabilan redosled za izjednačene
WITH ranked AS (
  SELECT user_id, total_amount,
         RANK() OVER (ORDER BY total_amount DESC) AS rank
  FROM season_totals WHERE season_id = $1 AND completed_count > 0
)
SELECT r.*, u.nickname FROM ranked r JOIN users u ON u.id = r.user_id
ORDER BY r.rank, u.nickname_key, u.id LIMIT $2 OFFSET $3;
```

Sopstveni rank i razlika do sledećeg višeg zbira računaju se nad celim skupom, ne samo stranicom. Paginacija, count i me u jednoj read-only REPEATABLE READ transakciji za konzistentan response. Banka popunjava nedostajuće apoene nulama. Reconciliation poredi `SUM(banknotes.denomination)`, broj terminalnih attempts, final\_reward i banknotes vezu. Ni red sa nulom ni stanje bez pokušaja ne stvaraju lažnu banknotu. Suspenzija sprečava igru i login, ali ne briše istorijske rezultate; korekcije/diskvalifikacije nisu definisane u MVP-u (admin nema dugme za menjanje novca).

## 10 · Administratorski panel i priprema sadržaja

```
DO MILION / ADMIN | Sezone　 Dnevni setovi　 Izazovi　 Statistika | Dnevni set · 12. januar | DRAFT · 8/8 izazova · 2 poluvremena | H1 / 1 · Na ivici | Validno | H1 / 2 · Koliko si siguran? | Validno | H1 / 3 · Ne prekidaj niz | Validno | H1 / 4 · Veće ili manje | Validno | H2 / 5–8 · četiri formata | Validno | Objavi set · zaključaj konfiguraciju
```

| Stranica | Funkcija |
| --- | --- |
| `/admin` | Sažetak datuma, nedostajućih setova, status sezone, poslova i validacije |
| `/admin/seasons` | Kreiraj mesec, slobodna tema, proizvoljan broj pragova/nivoa i DB slike, preview, publish; read-only nakon objave. |
| `/admin/daily-sets` | Kalendar, statusi DRAFT/PUBLISHED/CANCELLED, filtriranje i planiranje unapred |
| `/admin/daily-sets/[id]` | Uređivanje osam slotova, redosled i formati, preview, validate, publish |
| `/admin/challenges/[id]` | Editor odabranog formata, prompt, kategorija, opcije, tajne vrednosti, reward band editor, limit, izvori, obrazloženje |
| `/admin/statistics` | Broj pokušaja, stopa završetka, prosečna nagrada po modu, timeout i raspodela apoena |
| `/admin/users` | Pretraga nadimka, status; suspenzija/reaktivacija uz audit; bez editovanja novca |
| `/admin/audit` | Read-only spisak admin izmena, filteri, actor i datum |
| `/admin/jobs` | Lokalni status timeout/rollover/reconcile, rezultat validacije; ponovi bezbedan posao |
| /admin/assets | Upload i izbor DB slika, preview, metadata i korišćenje; immutable, bez fajlova u kodu. |
| /admin/categories | Dodavanje i deaktiviranje oblasti iz DB; bez izmene koda. |

Admin rute mutacija (predlog JSON API za interaktivni editor, Server Actions mogu biti tanki adapteri): POST `/api/admin/seasons`, PATCH `/api/admin/seasons/:id`, PUT `/api/admin/seasons/:id/tiers`, POST `/api/admin/seasons/:id/publish`; POST `/api/admin/sets`, PATCH `/api/admin/sets/:id`, PUT `/api/admin/sets/:id/challenges/:position`, POST `/api/admin/sets/:id/validate`, POST `/api/admin/sets/:id/publish`, POST `/api/admin/sets/:id/cancel`; GET `/api/admin/stats`, PATCH `/api/admin/users/:id/status`, GET `/api/admin/audit`, POST `/api/admin/jobs/:type/run`. Sve proveravaju role i status u bazi. Draft izmena šalje `updatedAt` ili revision za optimističku konkurentnost; publikuje se poslednja validirana verzija unutar transakcije, ponovna validacija obavezna. Bez javne registracije admina, admin preko lokalnog seed-a.

Admin mora biti sposoban da pripremi sledeći mesec sa sasvim novom temom i proizvoljnim brojem nivoa, uploaduje nove slike, unese nove kategorije i pitanja svih postojećih formata, promeni nagrade i trajanje u draftu — bez izmene bilo kog fajla aplikacije. Alternativno, direktan unos podataka u PostgreSQL kroz SQL/pgAdmin i isti publish CLI. Objavljivanje ne zahteva rebuild, reseed ni restart. Preview i validation čitaju stvarne DB redove. Nema hardkodirane liste sezona, nagrada, pitanja ili tema u kodu. Greška nakon publish-a nije razlog za tihu promenu uslova; pripremiti sadržaj u DRAFT unapred.

#### Workflow urednika

1. Kreirati DRAFT sezonu i proizvoljan broj nivoa, obavezno prag 0; uneti naziv, opis, alt i asset\_id za svaki nivo. Upload slika u DB ili kontrolisan SQL import; proveriti pragove i assete, pa publish.
2. Kreirati datum u okviru sezone, popuniti osam slotova i po jedno pitanje svakog formata u obe polovine. Uneti tačno definisane izvore, jedinice i datum relevantnosti podataka.
3. Validirati format-specifične podatke, reward rules, trajanje, maksimum i duplikate. EDGE: enumeracija kombinacija; CONFIDENCE: dovoljno tačnih; ORDER: jedinstveni rangovi; HIGH\_LOW: bez jednakosti. Za sve: svaka nagrada dozvoljena, monotonost, najviša dostižna 5.000, najmanje dva smisleno različita moguća ishoda, prompt i opcije čitljivi, nema otkrivanja ključa u tekstu.
4. Preview koristi odvojen sandbox bez stvarnih pokušaja i ledger-a, može simulirati sve korake, rezultat i timeout. Urednik ručno proverava izvore; AI sme predlagati, ali ne publikuje i nije runtime scorer.
5. Publish zaključava set i config; zakazani datum ga čini dostupnim bez ručne objave na dan igranja. Audit. Za grešku nakon početka dana nema tihog menjanja sadržaja ili već dodeljene nagrade; označiti problem i rešiti incident posebnim pravilom pre produkcije (otvoreno).

## 11 · Auth, privatnost, fer igra i bezbednost

Registracija: email validan i jedinstven (do 254 znaka), nadimak 3–24 znaka, Unicode slova/brojevi i donja crta, bez nepristojnih/rezervisanih imena (minimalna denylist), lozinka 12–128 znakova, ne trimovati lozinku. Hash Argon2id sa bibliotečkim salt-om i OWASP razumnim parametrima (npr. 19 MiB, t=2, p=1 kao minimum za proveru). Nikad plaintext ili reverzibilna enkripcija. Login generička greška, bez potvrde da email postoji. Auth.js Credentials `authorize` poziva account service; JWT sadrži userId i sessionVersion, ne lozinku/email za javni DTO. Na svakoj privilegovanoj operaciji proveriti aktuelni status, role i verziju iz baze; odjava briše kolačić, reset/suspenzija invalidira postojeće sesije. Predlog sesija 7 dana; admin iste provere, kraći period opcioni. HttpOnly, SameSite=Lax, Secure u HTTPS okruženju; localhost HTTP dev konfiguracija odvojena. CSRF zaštita Auth.js i Origin provera sopstvenih mutacija. JSON Content-Type obavezan za API mutacije; nema CORS wildcard-a.

| Rizik | Obavezna zaštita |
| --- | --- |
| Izmena nagrade u DevTools | Browser šalje izbor, ne iznos; server engine + DB ograničenja |
| Ponovni start / dupli klik | UNIQUE user+challenge, ACTIVE partial index, revision i idempotency |
| Tajne vrednosti u bundle-u | server-only, whitelist DTO, test HTML/RSC/network, no-store |
| Lažni tajmer | DB clock i expiresAt; klijentski countdown samo prikaz |
| Tuđi pokušaj / IDOR | Ownership na svakom GET/POST; 404 za tuđi privatni entitet |
| SQL injection / XSS | Prisma parametri, bez interpolacije raw SQL, React escaping, plain text, CSP bez blanket unsafe eval u produkciji |
| Brute force / bot | Rate limits, generičke auth greške; početni pragovi podesivi |
| Admin eskalacija | DB role check; nema role u register payload; audit |
| Mrežni retry / konkurentnost | Transakcije, stabilan requestId, row locks i revision |
| Deljenje rešenja | Ograničeni tajmeri, delayed reveal, bez unapred poslatih odgovora; ostaje rizik |
| Lični podaci | Javno samo nadimak, zbir, rang i kolekcija; ne objavljivati email/privatne odgovore |

Predloženi limiti: login 5 neuspeha/15 min po nalogu i 30/15 min po IP; reset 3/h po emailu, 20/h po IP; start 30/min po korisniku; action 120/min po korisniku (dovoljno za niz); read API 120/min po korisniku/IP. Pragovi se podešavaju testovima. Ne brojati identičan idempotentni retry kao novu game akciju; rate limiter i dalje može ograničiti ukupni HTTP saobraćaj. Server log: correlation ID, route, status, duration, userId samo gde treba; bez cookies, plaintext lozinki i odgovora. Lokalni seed isključivo izmišljeni korisnici. Produkcijska pravna politika i retention nisu finalizovani; u MVP-u nema uvoza stvarnih ličnih podataka.

## 12 · PWA, responsive i offline politika

Manifest: `name` i `short_name` DO MILION, `start_url=/dashboard`, `scope=/`, `display=standalone`, `theme_color` i `background_color` prema dizajnu, PNG 192×192 i 512×512, maskable ikona; Apple touch icon. Next.js može generisati manifest kroz `app/manifest.ts` ili koristiti statički `public/manifest.webmanifest`, ne oba. Service worker registruje samo jedan scope. Lokalni `http://localhost:3000` se u podržanim browserima tretira kao secure context za SW; obični LAN HTTP na telefonu najčešće ne, pa desktop/mobile responsive test preko browser emulacije ili lokalnog HTTPS-a kasnije. Bez DigitalOcean ili Caddy podešavanja u ovom dokumentu.

Strategija: verzionisani cache za statičke hashed JS/CSS i javne ikone/grafiku, offline shell bez ličnih podataka; API, auth, RSC i navigacije privatnih stranica network-only; nikada cache POST, personalizovane HTML ili snapshot pitanja. Na neuspeh navigacije prikaži `/offline` javni fallback. Service worker ne sme odgovoriti HTML-om na JSON API. Ne koristiti background sync za quiz akcije, jer vreme i redosled moraju biti server-authoritative. Nema offline bodovanja; ako veza nestane, prikaži offline poruku i zadrži tajmer; po povratku GET snapshot. Ako je odgovor neizvestan, retry identičan requestId ili GET. Nova SW verzija obaveštava korisnika i aktivira se između izazova (ne forsirati reload tokom aktivnog tajmera). Očisti stare cache verzije, nikad ne skladišti tajne u cache. Logout briše client state. Instaliranje PWA je mogućnost zavisna od browsera, ne uslov igranja.

Dozvoljeno je keširati javne immutable slike sa /api/assets/:id (ID verzije i hash); draft preview, admin i svi mutable API odgovori ostaju network-only/no-store. Nova slika ima novi ID, pa se ne može prikazati stara verzija zbog cache-a.

## 13 · Lokalna instalacija i razvojni tok (bez Dockera)

Potrebno: lokalno instalirani Node.js LTS, npm, PostgreSQL, Git i editor. Izabrati međusobno kompatibilne verzije Next.js, React, Prisma i Auth.js i pinovati ih na početku implementacije; dokument namerno ne izmišlja aktuelne verzije. Lokalni PostgreSQL sluša na loopback adresi. Odvojena razvojna i testna baza, nikad superuser u DATABASE\_URL. Nema Caddy, Let's Encrypt, systemd, DigitalOcean ni deployment skripti.

```
-- Izvršiti u psql kao lokalni administrator; primer, promeniti lozinku.
CREATE ROLE do_milion_dev LOGIN PASSWORD 'change-this-local-only';
CREATE DATABASE do_milion_dev OWNER do_milion_dev;
CREATE DATABASE do_milion_test OWNER do_milion_dev;
CREATE DATABASE do_milion_shadow OWNER do_milion_dev;
```

Shadow baza služi Prisma migrate dev ako korisnik nema CREATEDB. U testnom config-u koristiti zaseban shadow ili samo primenjivati migracije, nikad dev bazu. U `.gitignore` uključiti `.env*` osim `.env.example`.

```
DATABASE_URL=postgresql://do_milion_dev:change-this-local-only@127.0.0.1:5432/do_milion_dev
SHADOW_DATABASE_URL=postgresql://do_milion_dev:change-this-local-only@127.0.0.1:5432/do_milion_shadow
TEST_DATABASE_URL=postgresql://do_milion_dev:change-this-local-only@127.0.0.1:5432/do_milion_test
AUTH_SECRET=replace-with-random-secret
AUTH_URL=http://localhost:3000
APP_TIMEZONE=Europe/Belgrade
APP_ORIGIN=http://localhost:3000
MAIL_MODE=local
RATE_LIMIT_SECRET=replace-with-another-random-secret
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=replace-with-local-password
```

Tajne generisati kriptografski (npr. `openssl rand -base64 32`). Ne stavljati ih u `NEXT_PUBLIC_*`. Prisma verzija određuje da li datasource konfiguracija ide u schema.prisma ili prisma.config.ts; implementacija mora učitati lokalne env vrednosti za CLI i worker. Navedeni su ciljni nazivi env promenljivih, ne već podešen repozitorijum.

```
# Kada repozitorijum bude implementiran:
npm ci
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev            # http://localhost:3000
# Drugi terminal:
npm run worker
# Provere:
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run start          # lokalna provera production build-a i PWA
```

db:seed je idempotentan: kreira lokalnog admina, demo igrače bez avatara, aktuelnu i prethodnu sezonu, osam pitanja za testni datum, demo kategorije i raster asset placeholder-e kao bytea redove u PostgreSQL-u. Za determinističke E2E testove odvojen seed sa fiksnim Clock servisom i DB izolacijom; ne menjati sistemski sat. Dev seed ne menja postojeće lozinke/objavljene podatke bez eksplicitnog reset command-a. Reset DB dozvoljen samo na jasno označenoj dev/test bazi, uz potvrdu. Mail adapter lokalno beleži reset link u privatni dev inbox/log, ne u javni API; bez realnog SMTP slanja. NPM skripte su ugovor koji developer implementira, ne komande koje trenutno postoje.

#### Održavanje sadržaja bez koda

Implementirati lokalni CLI koji poziva iste domenske servise i učitava DATABASE\_URL. Sledeće su ciljne komande; nisu već implementirane. DRAFT redove korisnik može pripremiti kroz admin panel, SQL ili pgAdmin. CLI ne prepisuje objavljeni sadržaj, ne pokreće migracije i ne zahteva restart.

```
npm run content:validate -- --season <uuid>
npm run content:publish -- --season <uuid>
npm run content:validate -- --date YYYY-MM-DD
npm run content:publish -- --date YYYY-MM-DD
# DRAFT sliku moguće uvesti iz lokalnog fajla kao DB bytes (bez kopiranja u repo):
npm run content:asset -- --file /path/to/reward.webp
```

## 14 · Testiranje i kriterijumi prihvatanja

| Oblast | Konkretni testovi |
| --- | --- |
| EDGE | Tačno, granica 1%, 5%, 10%, 20%, tik preko, obe strane cilja, UNDER\_ONLY, duplikati, previše/malo izbora, nepoznat ID, BigInt |
| CONFIDENCE | Nula/1/2/3/4/5/6/7/8 tačnih, jedna netačna poništava, duplikat, nepoznat ID, preskočeni apoeni |
| ORDER | Najmanji preostali, DESC, greška posle 4 koraka, cash-out, zadnji automatski, istekao rok, nema jednakih rangova |
| HIGH\_LOW | Veće/manje, pogrešan step, cash-out, finalni korak, timeout, jednakost odbijena pri publish-u |
| Vreme | 1 ms pre roka, tačno rok, posle; reload; dva taba; DST mart/oktobar; ponoć i kraj meseca |
| API | 401/403/404/409/422/429, nepoznata polja, nevalidan JSON, CSRF, tuđi attempt, bez tajnih vrednosti |
| Konkurentnost | 20 paralelnih startova → jedan pokušaj; 20 finish zahteva → jedna novčanica; dve različite akcije iste revizije; timeout vs finish; retry nakon izgubljenog response-a |
| Ledger | 5k+2k+5k+1k+2k=15k i 5 nota; nula bez note; zbir isti kao rang; rollback simuliran pri upisu zbira |
| Sezona | Prelaz 28/29/30/31 dana; tier granice; neaktivni bez nagrade; aktivni sa nulom dobija osnovni nivo; dva rollover-a isti rezultat; istorija nepromenjena |
| Rang-lista | 1,2,2,4; me izvan stranice; gap do višeg zbira; stabilan redosled; nula; neaktivni izostavljeni |
| Admin | Ne-admin odbijen; nevalidan set ne može publish; max 5k dostižan; frozen set nepromenljiv; audit; preview bez ledger-a; novi mesec i proizvoljan broj tier-ova; validacija asseta i kategorija; DB sadržaj bez rebuilda. |
| Auth | Dupli email/nadimak; generičke greške; hash nije plaintext; reset jednokratan; opoziv sesije; suspendovan nalog |
| UI | 320/390/768/1024/1440 px, tastatura, kontrast, reduced motion, nema avatara, 4 formata, dva poluvremena, sve prazne i error varijante |
| PWA | Manifest i ikone, SW scope, cache samo statika; offline bez igre; privatni response nikad cache; update između izazova |
| Data-driven (blokirajući) | Na pokrenutoj aplikaciji kroz SQL/admin kreirati novu sezonu sa novom temom, tri ili pet nivoa, pragovima različitim od seed-a, novom DB slikom i kategorijom; dodati sledeći set i per-question nagrade/tajmer; validirati/publish; bez izmene fajlova, migracije, rebuilda, reseed-a ili restarta. Proveriti izbor trenutnog i sledećeg tier-a, upgrade, novi dan, novu sliku, istorijski snapshot i prikaz na svim uređajima. |
| Boje apoena | Svih devet odgovara paleti §04; isti apoen u proizvoljnoj poziciji stack-a ima istu paletu; cifra čitljiva i bez boje; animacija/ladder/banka koriste isti token. |
| Sadržaj i integritet | DRAFT nije vidljiv igraču; nevalidan direktan SQL draft ne prolazi publish; nulti prag obavezan, proizvoljan broj nivoa; FK i immutable zaštita istorije; nepoznat/oversize/malformed asset odbijen; draft asset nije javno dostupan. |

### End-to-end scenario za ručnu proveru

Registruj demo igrača → pokreni prvo poluvreme → na EDGE osvoji 5.000 → CONFIDENCE 2.000 → ORDER 0 zbog greške → HIGH\_LOW uzmi 1.000 → pauza prikazuje 8.000 i tri novčanice → zatvori tab → nastavi drugo poluvreme → osvoji 5.000, 2.000, 0, 0 → dnevni zbir 15.000 i pet novčanica → proveri da 5.000×2, 2.000×2, 1.000×1, rang isti kao zbir → osveži stranicu, pokušaj ponovnog starta i replay, stanje ne raste → pomeri testni clock na sledeći dan i novi set → pređi prag 25.000 i proveri digitalni sat → simuliraj kraj sezone → finalni predmet u kolekciji, stara banka sačuvana, nova 0 → javni profil bez avatara, emaila i privatnih odgovora. Navedeni rezultati zahtevaju namenski fixture; ne predstavljaju stvarna pitanja.

## 15 · Redosled implementacije i granice obuhvata

| Faza | Isporuka | Završeno kada |
| --- | --- | --- |
| 1 · Temelj | Next.js, TS, Tailwind, PG/Prisma, migracije, seed, Auth.js, layout | Login/register/reset, role i lokalna baza rade; nema avatara |
| 2 · Domenski engine | Četiri pure scorera, reward validation, clock, start/action/finish | Unit i concurrency testovi prolaze; nijedan dupli pokušaj/nagrada |
| 3 · Igra | Dnevni set, poluvremena, sva četiri interfejsa, timer, rezultat | Osam pitanja od početka do kraja na svim ekranima |
| 4 · Ekonomija | Ledger, banka, totals, rang-lista, tiers, rollover, kolekcija | Invarianti, istorija i zatvaranje sezone rade |
| 5 · Admin | Sezone, kalendar, editori, validacija, preview, publish, audit | Admin može sam pripremiti kompletan budući dan, mesec, pragove i slike kroz DB, bez izmene koda |
| 6 · UX/PWA | Finalniji asseti, Motion, responsive, offline i instalacija | E2E, responsive i PWA testovi; bez tajnih podataka u cache-u |
| 7 · Lokalni QA | Test fixtures, worker, reconciliation, dokumentacija | Sve prihvatne tačke iz §14 prolaze na čistoj lokalnoj bazi |

Ne započinjati produkcijski deployment, DigitalOcean, Caddy, Let's Encrypt, Docker, mobilne native aplikacije, oglase, monetizaciju, chat, prijatelje, PvP, shop, trgovanje ili dodatne rang-liste. Ne koristiti AI za runtime ocenjivanje. Grafika predmeta za demo je placeholder upisan u DB kao media\_assets; stvarni novi predmeti i slike dodaju se kroz bazu. Grafika novčanica je originalna, stilizovana, sa obaveznom paletom iz §04. Mehanika i prikaz proizvoljnog broja nivoa moraju biti potpuni.

### Odluke za korisničku potvrdu (radni defaulti već definisani)

| Tema | Predlog u ovom dokumentu |
| --- | --- |
| Drugo poluvreme | Odmah posle prvog, do ponoći; nije zaključano do 18h |
| Redosled | Fiksan po 1–8, bez preskakanja osim odustajanja |
| Na ivici | Apsolutno odstupanje, opciono UNDER\_ONLY po pitanju |
| Risk timeout | Automatski uzima dostignutu nagradu; ostala dva formata bez potvrde 0 |
| Veće/manje | Fiksna referenca tokom jednog izazova |
| Nagrade | Svako pitanje ima dostižnih 5.000; fleksibilni pragovi i apoeni |
| Tier pragovi | Usvojeno: pragovi, broj nivoa, tema i asseti iz DB; 0/25k/75k/150k/300k/550k/850k/1m samo pilot seed. |
| Kolekcija | Samo učesnici sa bar jednim terminalnim pokušajem; i nula dobija osnovni predmet |
| Rangiranje | RANK, isti zbir isti plasman, uključuje učesnike sa nulom |
| Rešenja | Kompletna tek posle dana, risk feedback neophodan odmah |
| Auth | Email/lozinka + Auth.js JWT; lokalni reset, bez OAuth i obavezne verifikacije emaila za MVP |
| Vizuelni stil | Tamnoplavo/zlatno kao UI predlog; apoeni obavezno u bojama srpskih dinara prema §04; bez avatara. |
| Incident nakon publish-a | Nema tihe izmene; politika diskvalifikacije/korekcije pre produkcije |

**Definicija završetka lokalne verzije:** korisnik može od registracije do trajne mesečne kolekcije proći ceo ciklus bez ručne intervencije programera; admin može kreirati i objaviti dnevni sadržaj kroz panel; sve nagrade su proverljive u PostgreSQL-u i nijedan kritični test nije neuspešan. Ovaj dokument ne garantuje odsustvo svake buduće greške niti je zamena za implementaciju, migracije i testove.

**Dodatni obavezni kriterijum:** kompletan novi mesec, njegove slike i pragovi, nova oblast, dnevni set, opcije, tajmeri i nagrade dodaju se bez izmene koda, migracije, rebuilda, restarta ili reseed-a. Dokazati automatizovanim testom i opisati postupak u README.

## 16 · Izvori i verzija dokumenta

- DO MILION — Kompletna specifikacija igre, v6.0 (dostavljeni PDF, 6 strana).
- DO MILION — Tehnička specifikacija, v1.0 (dostavljeni PDF, 6 strana).
- Naknadni dogovor iz razgovora: responsive web + PWA, lokalni PostgreSQL, bez Dockera; u ovom dokumentu bez deploymenta.
- NBS — [Novčanice u opticaju](https://www.nbs.rs/sr/novac-i-placanja/novcanice/) (referenca za palete apoena; HEX su ilustrativne vrednosti).

Ovo je master specifikacija v1.1 za lokalnu implementaciju. Tehničke odluke, šema, DTO, wireframe prikazi i podrazumevani limiti koji nisu ranije izričito potvrđeni predstavljaju predloge. Izvorni dokumenti su sažeti i usklađeni; produkcijski delovi tehničkog PDF-a namerno su izostavljeni.

Izmene v1.1: realne palete dinarskih apoena; eksplicitna data-driven arhitektura; proizvoljan broj mesečnih nagrada; DB asseti i kategorije; dinamički izbor tier-a; admin/CLI, API, ER model i testovi usklađeni. Ostala pravila, tamna tema i struktura 16 poglavlja zadržani. Radni defaulti koji nisu potvrđeni ostaju predlozi, ali se koriste za implementaciju MVP-a dok se ne promene.