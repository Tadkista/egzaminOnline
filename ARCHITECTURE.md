# Architektura Systemu Egzaminacyjnego

## Diagram Architektury

```
┌─────────────────────────────────────────────────────────────────┐
│                         KLIENT (Przeglądarka)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐        │
│  │   Panel Użytkownika  │      │  Panel Administratora │        │
│  │   (index.html)       │      │   (admin.html)        │        │
│  │   script.js          │      │   admin-script.js     │        │
│  │   style.css          │      │   admin-style.css     │        │
│  └──────────────────────┘      └──────────────────────┘        │
│           │                              │                        │
│           └──────────────┬───────────────┘                        │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │ HTTP/REST API
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│                      SERWER (Node.js + Express)                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API Endpoints                          │    │
│  │                                                           │    │
│  │  Publiczne:                    Administracyjne:          │    │
│  │  • GET /api/tests              • POST /admin/login       │    │
│  │  • GET /api/tests/:id          • GET /admin/tests        │    │
│  │  • POST /sessions/start        • POST /admin/tests       │    │
│  │  • POST /sessions/:token/...   • PUT /admin/tests/:id    │    │
│  │  • POST /sessions/:token/...   • DELETE /admin/tests/:id │    │
│  │  • GET /history/:email         • ... (CRUD questions)    │    │
│  │                                • ... (CRUD answers)       │    │
│  │                                • GET /admin/sessions      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                        │
│                          │ mysql2 driver                          │
│                          │                                        │
└──────────────────────────▼────────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────────┐
│                    BAZA DANYCH (MySQL)                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  tests   │  │ questions │  │ answers  │  │ exam_sessions│  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────┘  │
│       │             │               │               │            │
│       └─────────────┴───────────────┴───────────────┘            │
│                                                                   │
│  ┌──────────────┐  ┌──────────┐                                 │
│  │ user_answers │  │  admins  │                                 │
│  └──────────────┘  └──────────┘                                 │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Przepływ Danych

### Rozpoczęcie Egzaminu (Użytkownik)

```
1. Użytkownik otwiera index.html
   ↓
2. Browser pobiera dostępne testy (GET /api/tests)
   ↓
3. Użytkownik wypełnia dane i klika "Rozpocznij"
   ↓
4. Browser wysyła POST /api/sessions/start
   ↓
5. Serwer tworzy sesję w bazie danych
   ↓
6. Serwer zwraca session_token
   ↓
7. Browser pobiera pytania (bez poprawnych odpowiedzi)
   ↓
8. Użytkownik odpowiada na pytania
   ↓
9. Każda odpowiedź jest zapisywana (POST /sessions/:token/answers)
   ↓
10. Po zakończeniu: POST /sessions/:token/complete
   ↓
11. Serwer oblicza wynik i zwraca szczegóły
```

### Zarządzanie Testami (Administrator)

```
1. Admin otwiera admin.html
   ↓
2. Logowanie (POST /api/admin/login)
   ↓
3. Browser pobiera listę testów (GET /admin/tests)
   ↓
4. Admin dodaje/edytuje test
   ↓
5. Browser wysyła dane (POST/PUT /admin/tests/:id)
   ↓
6. Serwer zapisuje w bazie danych
   ↓
7. Admin dodaje pytania i odpowiedzi
   ↓
8. Browser wysyła dane (POST /admin/questions/:id/answers)
   ↓
9. Serwer zapisuje w bazie danych
```

## Bezpieczeństwo

### Warstwy Zabezpieczeń

1. **Separacja danych**
   - Użytkownicy nie mają dostępu do poprawnych odpowiedzi
   - API zwraca różne dane dla użytkowników i adminów

2. **Walidacja po stronie serwera**
   - Wszystkie odpowiedzi sprawdzane tylko na serwerze
   - Niemożliwe oszukanie przez modyfikację kodu przeglądarki

3. **Tokeny sesji**
   - Każda sesja ma unikalny token
   - Token wymagany do zapisania odpowiedzi

4. **Uwierzytelnianie admina**
   - Panel administracyjny wymaga logowania
   - (W produkcji: JWT + bcrypt)

## Technologie

### Frontend
- **HTML5** - Struktura interfejsu
- **CSS3** - Style i responsywność
- **Vanilla JavaScript** - Logika aplikacji
- **Fetch API** - Komunikacja z serwerem

### Backend
- **Node.js** - Runtime środowisko
- **Express.js** - Framework webowy
- **mysql2** - Driver bazy danych
- **CORS** - Obsługa cross-origin requests

### Baza Danych
- **MySQL** - Relacyjna baza danych
- **InnoDB** - Engine z obsługą transakcji
- **UTF8MB4** - Kodowanie znaków

## Pliki i Ich Роль

### Backend
- `server/server.js` - Główna logika serwera, wszystkie endpointy API
- `server/db-config.js` - Konfiguracja połączenia z bazą danych

### Frontend - Użytkownik
- `public/index.html` - Interfejs użytkownika
- `public/script.js` - Logika egzaminu, komunikacja z API
- `public/style.css` - Style dla użytkownika

### Frontend - Administrator
- `public/admin.html` - Panel administracyjny
- `public/admin-script.js` - Zarządzanie testami i pytaniami
- `public/admin-style.css` - Style dla admina

### Baza Danych
- `database/schema.sql` - Pełny schemat z przykładowymi danymi
- `database/schema_empty.sql` - Tylko struktura, bez danych

### Konfiguracja
- `package.json` - Zależności projektu
- `.env` - Konfiguracja środowiska (nie w repo)
- `.env.example` - Przykładowa konfiguracja

## Rozszerzalność

System jest zaprojektowany modularnie i można łatwo dodać:

1. **Więcej typów pytań** - wielokrotny wybór, prawda/fałsz, otwarte
2. **Kategorie testów** - organizacja testów w grupy
3. **Certyfikaty** - generowanie PDF po zdaniu
4. **System punktowy** - różne wagi pytań
5. **Limity prób** - ograniczenie liczby podejść
6. **Analityka** - statystyki i raporty
7. **Email notifications** - powiadomienia o wynikach
8. **Multi-tenancy** - obsługa wielu organizacji
