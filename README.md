# FoodAlert

FoodAlert to proste CLI do śledzenia ofert z Foodsi dla wielu użytkowników. Aplikacja zapisuje ostatni stan ofert w lokalnej bazie SQLite i wypisuje alerty, gdy pojawia się nowa oferta, oferta wraca na stan albo zmienia się liczba sztuk.

![Główne menu](docs/assets/foodalert-main-menu.svg)

![Dodawanie użytkownika](docs/assets/foodalert-add-user.svg)

![Przykładowe oferty](docs/assets/foodalert-offers-sample.svg)

## Co robi aplikacja

- obsługuje wiele kont Foodsi w jednym CLI
- pozwala uruchomić pojedynczy fetch albo cykliczne sprawdzanie ofert
- zapisuje bieżące oferty per użytkownik
- zgłasza zmiany dostępności ofert w konsoli
- pozwala zarządzać listą ulubionych i ignorowanych restauracji
- pozwala włączyć powiadomienia tylko dla ulubionych restauracji

## Szybki start

Wymagania:

- Node.js 20+
- npm

Instalacja i start:

```bash
npm install
npm run dev
```

Przy pierwszym uruchomieniu aplikacja utworzy lokalną bazę `foodalert.sqlite` w katalogu projektu.

Jeśli chcesz użyć innej ścieżki do bazy:

```bash
FOODALERT_DB_PATH=/sciezka/do/foodalert.sqlite npm run dev
```

## Jak korzystać

Po uruchomieniu zobaczysz interaktywne menu w terminalu.

1. Wejdź w `Users` i dodaj konto Foodsi.
2. Uruchom `Run once for user`, żeby pobrać pierwszy stan ofert.
3. Wejdź w `Offers`, żeby zobaczyć zapisane aktualne oferty dla wybranego użytkownika.
4. Wejdź w `Restaurants`, żeby dodać restauracje do `favorites` albo `ignored`.
5. Wejdź w `Settings`, jeśli chcesz ustawić własny interwał sprawdzania albo włączyć tryb `only favorites`.
6. Uruchom `Watch one user` albo `Watch all users`, żeby aplikacja sprawdzała oferty cyklicznie.
7. Użyj `Status`, żeby podejrzeć aktywne watchery, i `Stop watchers`, żeby je zatrzymać.

Alerty pojawiają się bezpośrednio w konsoli. Aplikacja wykrywa:

- nową ofertę
- powrót oferty na stan
- wyprzedanie
- zmianę liczby dostępnych sztuk

## Najważniejsze komendy

```bash
npm run dev
npm run build
npm test
npm run typecheck
npm run verify
```

Migracje:

```bash
npm run db:generate
npm run db:migrate
```

`npm run dev` uruchamia migracje automatycznie przy starcie.

## Jak to jest zbudowane

Projekt jest podzielony na kilka prostych warstw:

- `src/cli` - menu i interakcja z użytkownikiem
- `src/watcher`, `src/alerts`, `src/foodsi` - pobieranie ofert, wykrywanie zmian i planowanie cyklicznych sprawdzeń
- `src/db`, `src/users`, `src/restaurants`, `src/offers` - zapis stanu w SQLite przez Drizzle ORM

Najważniejszy przepływ wygląda tak:

1. CLI wybiera użytkownika albo startuje watcher.
2. `WatcherService` loguje się do Foodsi i pobiera oferty.
3. Snapshot ofert trafia do SQLite.
4. `Alert Derivation` porównuje nowy stan z poprzednim.
5. Powiadomienia są wypisywane w konsoli.

## Ograniczenia

- hasła Foodsi są obecnie trzymane lokalnie w SQLite w postaci jawnej
- integracja zależy od prywatnego API Foodsi i nagłówków mobilnej aplikacji
- bez poprawnych danych logowania i dostępu do API fetch się nie powiedzie

## Dalszy materiał

- krótki opis domeny: [CONTEXT.md](CONTEXT.md)
- decyzje architektoniczne: [docs/adr](docs/adr)
