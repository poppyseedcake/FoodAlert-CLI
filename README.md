# FoodAlert

Aplikacja konsolowa (CLI) w Node.js + TypeScript, która cyklicznie sprawdza oferty w serwisie **Foodsi** (polski odpowiednik Too Good To Go) dla wielu użytkowników i powiadamia o zmianach stanów magazynowych.

## Funkcje

- zarządzanie wieloma kontami Foodsi (wspólny dashboard CLI)
- cykliczne sprawdzanie ofert (konfigurowalny interwał per użytkownik + globalny default)
- alerty o zdarzeniach: nowa oferta, uzupełnienie, wyprzedanie, zmiana ilości
- filtrowanie powiadomień: ulubione / ignorowane restauracje
- pełna historia bieżących ofert per użytkownik
- hasła przechowywane lokalnie w SQLite (plaintext — known limitation)

## Wymagania

- Node.js 20+
- npm

## Setup

```bash
npm install
npm run dev
```

Pierwsze uruchomienie tworzy plik `foodalert.sqlite` w katalogu projektu (ścieżkę można nadpisać przez `FOODALERT_DB_PATH`).

## Migracje bazy danych

```bash
npm run db:generate   # generuje nowy plik migracji po zmianie src/db/schema.ts
npm run db:migrate    # ręcznie uruchamia migracje
```

`npm run dev` wykonuje migracje automatycznie przy starcie.

## Testy

```bash
npm test          # jednorazowe uruchomienie vitest
npm run test:watch # tryb watch
npm run typecheck # tsc --noEmit
npm run verify   # typecheck + testy
```

## Architektura

Warstwowa architektura z wyraźnym podziałem odpowiedzialności:

```
src/
├── cli/          # interfejs użytkownika (Inquirer)
├── domain/       # typy domenowe + stałe (niezależne od reszty)
├── db/           # klient SQLite + schemat Drizzle
├── users/        # repozytorium użytkowników
├── restaurants/  # repozytorium restauracji + listy ulubionych/ignorowanych
├── offers/       # repozytorium ofert + stan per user
├── foodsi/       # klient zewnętrznego API Foodsi
├── alerts/       # czyste funkcje: diff stanu + decyzja o powiadomieniu
├── notifications/# drukowanie powiadomień (Console)
├── watcher/      # orkiestracja: fetch → diff → notyfikacja + cykliczność
└── utils/        # formatowanie dat i cen
```

**Zależności idą z góry na dół**: `cli → watcher → foodsi / offers / restaurants → db → schema`.

Kluczowe abstrakcje:
- `UserProfile` (pełne dane, w tym hasło) vs `UserDisplay` (tylko `id` + `name`) — notifier widzi tylko drugie
- `AlertEvent` to discriminated union (`new-offer` / `re-stocked` / `sold-out` / `stock-change`)
- `Provider` to string literal (`'foodsi'`) — w przyszłości łatwo dodać kolejne

## Dodawanie nowego providera (np. TooGoodToGo)

Checklist:
1. Nowy folder `src/<provider>/` z `client.ts`, `types.ts`, `mapOffer.ts` wzorowany na `foodsi/`
2. Rozszerzyć `Provider` w `src/domain/types.ts`
3. Dodać provider do `restaurants.provider` / `offers.provider` (drizzle schema nie wymaga zmian — kolumna to `text`)
4. `WatcherService` wywołać oba klienty; wynik zlać do wspólnej listy `OfferInput`
5. Powiadomienia pozostają bez zmian (korzystają z `OfferInput`)

## Znane ograniczenia

- **Hasła plaintext** w SQLite — świadoma decyzja na obecnym etapie
- **Spoofowane nagłówki Androida** w `foodsiClient.ts` — jeśli Foodsi zaktualizuje apkę mobilną, trzeba zaktualizować `FOODSI_HEADERS`
- **Brak retry/backoff** przy błędach sieci — pojedynczy błąd kończy przebieg dla danego użytkownika
- **CLI bez sesji HTTP** — logowanie do Foodsi odbywa się per-fetch (tokeny nie są cache'owane)
