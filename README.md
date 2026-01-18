# System Egzaminacyjny Online

Kompletny system egzaminacyjny z panelem administracyjnym, bazą danych i walidacją odpowiedzi po stronie serwera.

## Funkcjonalności

### Panel Użytkownika
- Rozpoczęcie egzaminu z wprowadzeniem danych osobowych
- Dynamiczne pytania pobierane z bazy danych
- Timer odliczający czas
- Pasek postępu
- Nawigacja między pytaniami
- Zapis odpowiedzi na serwerze
- Walidacja odpowiedzi po stronie serwera
- Wyświetlanie wyników z przeglądem odpowiedzi
- Historia ukończonych egzaminów
- Drukowanie wyników

### Panel Administracyjny
- Logowanie admina
- Zarządzanie testami (dodawanie, edycja, usuwanie)
- Zarządzanie pytaniami i odpowiedziami
- Widok sesji egzaminacyjnych
- Filtrowanie i wyszukiwanie wyników
- Statystyki testów

## Wymagania

- Node.js (v14 lub nowszy)
- MySQL (v5.7 lub nowszy)
- npm lub yarn

## Instalacja

### 1. Instalacja zależności

```bash
npm install
```

### 2. Konfiguracja bazy danych

Utwórz bazę danych MySQL:

```bash
mysql -u root -p
```

Następnie wykonaj skrypt SQL:

```bash
mysql -u root -p < database/schema.sql
```

Lub zaimportuj plik `database/schema.sql` używając phpMyAdmin lub innego narzędzia.

### 3. Konfiguracja środowiska

Skopiuj plik `.env.example` jako `.env` i dostosuj parametry:

```bash
cp .env.example .env
```

Edytuj plik `.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=twoje_haslo
DB_NAME=exam_system
PORT=3000
```

### 4. Uruchomienie serwera

Tryb produkcyjny:
```bash
npm start
```

Tryb deweloperski (z automatycznym restartem):
```bash
npm run dev
```

Serwer uruchomi się na `http://localhost:3000`

## Dostęp do aplikacji

### Panel Użytkownika
```
http://localhost:3000/
```

### Panel Administracyjny
```
http://localhost:3000/admin.html
```

**Domyślne dane logowania:**
- Login: `admin`
- Hasło: `admin123`

## Struktura projektu

```
exam-system/
├── database/
│   └── schema.sql              # Schemat bazy danych z przykładowymi danymi
├── server/
│   ├── server.js               # Główny plik serwera Express
│   └── db-config.js            # Konfiguracja połączenia z bazą
├── public/
│   ├── index.html              # Panel użytkownika
│   ├── script.js               # Logika panelu użytkownika
│   ├── admin.html              # Panel administracyjny
│   ├── admin-script.js         # Logika panelu administracyjnego
│   ├── style.css               # Style dla użytkownika
│   └── admin-style.css         # Style dla panelu admina
├── package.json
├── .env.example
└── README.md
```

## API Endpoints

### Publiczne (dla użytkowników)

- `GET /api/tests` - Lista aktywnych testów
- `GET /api/tests/:id` - Szczegóły testu (bez poprawnych odpowiedzi)
- `POST /api/sessions/start` - Rozpoczęcie sesji egzaminacyjnej
- `POST /api/sessions/:token/answers` - Zapisanie odpowiedzi
- `POST /api/sessions/:token/complete` - Zakończenie egzaminu
- `GET /api/history/:email` - Historia egzaminów użytkownika

### Administracyjne (wymagają logowania)

- `POST /api/admin/login` - Logowanie administratora
- `GET /api/admin/tests` - Lista wszystkich testów
- `GET /api/admin/tests/:id` - Szczegóły testu z pytaniami
- `POST /api/admin/tests` - Utworzenie nowego testu
- `PUT /api/admin/tests/:id` - Aktualizacja testu
- `DELETE /api/admin/tests/:id` - Usunięcie testu
- `POST /api/admin/tests/:testId/questions` - Dodanie pytania
- `PUT /api/admin/questions/:id` - Aktualizacja pytania
- `DELETE /api/admin/questions/:id` - Usunięcie pytania
- `POST /api/admin/questions/:questionId/answers` - Dodanie odpowiedzi
- `PUT /api/admin/answers/:id` - Aktualizacja odpowiedzi
- `DELETE /api/admin/answers/:id` - Usunięcie odpowiedzi
- `GET /api/admin/sessions` - Lista sesji egzaminacyjnych

## Baza danych

### Tabele

1. **tests** - Testy egzaminacyjne
2. **questions** - Pytania przypisane do testów
3. **answers** - Odpowiedzi do pytań
4. **exam_sessions** - Sesje egzaminacyjne
5. **user_answers** - Odpowiedzi użytkowników
6. **admins** - Administratorzy systemu

## Bezpieczeństwo

- Odpowiedzi są sprawdzane tylko po stronie serwera
- Użytkownicy nie mają dostępu do poprawnych odpowiedzi przed zakończeniem testu
- Sesje egzaminacyjne są chronione tokenami
- Panel administracyjny wymaga uwierzytelnienia

## Rozwój

### Dodawanie nowych funkcjonalności

1. Modyfikuj schemat bazy danych w `database/schema.sql`
2. Dodaj endpointy API w `server/server.js`
3. Zaktualizuj interfejs w plikach HTML/JS

### Zmiana hasła administratora

W produkcji zaleca się zmianę hasła administratora i użycie prawdziwego hashowania bcrypt:

```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('nowe_haslo', 10);
// Zaktualizuj password_hash w tabeli admins
```

## Rozwiązywanie problemów

### Problem z połączeniem do bazy danych

1. Sprawdź czy MySQL działa: `systemctl status mysql`
2. Zweryfikuj dane w pliku `.env`
3. Upewnij się, że baza została utworzona: `mysql -u root -p -e "SHOW DATABASES;"`

### Port już używany

Jeśli port 3000 jest zajęty, zmień PORT w pliku `.env`

### CORS errors

Upewnij się, że w `server.js` CORS jest poprawnie skonfigurowany

## Licencja

MIT

## Wsparcie

W razie problemów lub pytań, sprawdź logi serwera lub bazę danych.
