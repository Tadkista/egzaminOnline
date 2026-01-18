# FAQ - Najczęściej Zadawane Pytania

## Instalacja i Konfiguracja

### 1. Jak zainstalować system?

Wykonaj kroki z pliku `QUICK_START.md`:
```bash
npm install
# Skonfiguruj bazę danych
mysql -u root -p < database/schema.sql
# Utwórz plik .env
npm start
```

### 2. Jaka wersja Node.js jest wymagana?

Minimalna wersja to Node.js 14.x, zalecana 18.x lub nowsza.

### 3. Czy mogę użyć innej bazy danych niż MySQL?

System jest zaprojektowany dla MySQL, ale możesz dostosować go do PostgreSQL lub innej bazy SQL modyfikując zapytania w `server/server.js`.

### 4. Jak zmienić port serwera?

Edytuj plik `.env` i zmień wartość `PORT=3000` na wybraną.

### 5. Nie mogę połączyć się z bazą danych

Sprawdź:
- Czy MySQL jest uruchomiony: `sudo systemctl status mysql`
- Poprawność danych w `.env`
- Czy użytkownik ma uprawnienia: `GRANT ALL ON exam_system.* TO 'root'@'localhost';`

## Panel Użytkownika

### 6. Czy mogę wrócić do poprzedniego pytania?

Tak, użyj przycisku "Poprzednie" podczas egzaminu.

### 7. Co się stanie jeśli czas się skończy?

Egzamin zostanie automatycznie zakończony i odpowiedzi zostaną sprawdzone.

### 8. Czy mogę zobaczyć poprawne odpowiedzi podczas egzaminu?

Nie, poprawne odpowiedzi są widoczne tylko po zakończeniu egzaminu w przeglądzie odpowiedzi.

### 9. Jak długo są przechowywane wyniki?

Wyniki są przechowywane:
- Na serwerze (baza danych) - bez limitu czasu
- W przeglądarce (localStorage) - do wyczyszczenia cache

### 10. Czy mogę powtórzyć egzamin?

Tak, możesz rozpocząć nowy egzamin w dowolnym momencie.

## Panel Administracyjny

### 11. Jak zmienić hasło administratora?

Opcja 1 - Bezpośrednio w bazie:
```sql
UPDATE admins SET password_hash = 'nowe_haslo' WHERE username = 'admin';
```

Opcja 2 - Użyj bcrypt (zalecane w produkcji):
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('nowe_haslo', 10);
// Zaktualizuj w bazie
```

### 12. Jak dodać nowego administratora?

```sql
INSERT INTO admins (username, password_hash, email) 
VALUES ('nowy_admin', 'haslo', 'email@example.com');
```

### 13. Czy mogę edytować test po tym jak ktoś już go rozwiązał?

Tak, ale:
- Zmiana pytań/odpowiedzi nie wpłynie na już zakończone sesje
- Nowe sesje będą używać zaktualizowanych pytań

### 14. Jak usunąć wszystkie dane testowe?

```sql
TRUNCATE TABLE user_answers;
TRUNCATE TABLE exam_sessions;
-- Opcjonalnie:
TRUNCATE TABLE answers;
TRUNCATE TABLE questions;
TRUNCATE TABLE tests;
```

### 15. Czy mogę eksportować wyniki do CSV?

Obecnie nie ma tej funkcji, ale możesz:
- Użyć zapytania SQL do eksportu
- Dodać własną funkcję eksportu w `admin-script.js`

## Pytania i Odpowiedzi

### 16. Ile odpowiedzi może mieć pytanie?

Teoretycznie nieograniczoną liczbę, ale zalecane jest 2-6 odpowiedzi dla czytelności.

### 17. Czy mogę mieć więcej niż jedną poprawną odpowiedź?

Obecnie system obsługuje tylko jedną poprawną odpowiedź na pytanie (single choice). Możesz rozszerzyć system o multiple choice.

### 18. Jak zmienić kolejność pytań?

W panelu administracyjnym podczas edycji pytania zmień pole "Kolejność".

### 19. Czy pytania są losowane?

Nie, pytania są wyświetlane w kolejności określonej w polu `question_order`.

### 20. Jak dodać obrazy do pytań?

Obecnie system obsługuje tylko tekst. Aby dodać obrazy:
1. Umieść obrazy w folderze `public/images/`
2. W treści pytania użyj znacznika HTML: `<img src="/images/nazwa.jpg" alt="opis">`

## Bezpieczeństwo

### 21. Czy odpowiedzi są bezpieczne przed oszustwami?

Tak:
- Poprawne odpowiedzi nie są wysyłane do przeglądarki
- Walidacja odbywa się tylko na serwerze
- Użytkownik nie ma dostępu do tokena weryfikacji

### 22. Jak zabezpieczyć panel administracyjny w produkcji?

1. Użyj prawdziwego hashowania hasła (bcrypt)
2. Zaimplementuj JWT dla sesji
3. Dodaj HTTPS
4. Użyj strong passwords
5. Ograniczy dostęp IP do panelu admina

### 23. Czy dane są szyfrowane?

Połączenie HTTP nie jest szyfrowane. W produkcji użyj HTTPS (certyfikat SSL/TLS).

### 24. Jak często powinienem robić backup bazy?

Zalecane codziennie lub przed każdą większą zmianą:
```bash
mysqldump -u root -p exam_system > backup_$(date +%Y%m%d).sql
```

## Wydajność

### 25. Ile jednoczesnych użytkowników obsługuje system?

Zależy od serwera, ale podstawowa konfiguracja obsługuje:
- ~50-100 jednoczesnych użytkowników
- ~1000 zapytań na minutę

Dla większej skali użyj:
- Load balancer
- Database connection pooling (już zaimplementowane)
- Redis dla cache

### 26. Czy mogę hostować na shared hosting?

Nie, potrzebujesz serwera z obsługą Node.js (VPS, dedykowany serwer, lub cloud).

### 27. Jakie są wymagania sprzętowe?

Minimalne:
- 512 MB RAM
- 1 vCPU
- 10 GB przestrzeni dyskowej

Zalecane:
- 2 GB RAM
- 2 vCPU
- 20 GB przestrzeni dyskowej

## Rozwój i Customizacja

### 28. Jak zmienić wygląd systemu?

Edytuj pliki CSS:
- `public/style.css` - panel użytkownika
- `public/admin-style.css` - panel admina

### 29. Jak dodać nowy typ pytania (np. prawda/fałsz)?

1. Rozszerz schemat bazy o pole `question_type`
2. Dostosuj formularz w `admin.html`
3. Dodaj logikę renderowania w `script.js`

### 30. Czy mogę zintegrować system z inną aplikacją?

Tak, system ma REST API które możesz użyć z dowolnej aplikacji:
- Dokumentacja API w `README.md`
- Wszystkie endpointy zwracają JSON

### 31. Jak dodać email z wynikami?

Zainstaluj nodemailer:
```bash
npm install nodemailer
```

Dodaj w `server.js` po zakończeniu egzaminu:
```javascript
const nodemailer = require('nodemailer');
// Konfiguracja i wysłanie email
```

### 32. Czy mogę użyć MongoDB zamiast MySQL?

Możesz, ale wymaga to przepisania wszystkich zapytań SQL na MongoDB queries (mongoose).

## Licencja i Wsparcie

### 33. Jaka jest licencja systemu?

MIT License - możesz swobodnie używać, modyfikować i dystrybuować.

### 34. Gdzie zgłosić błąd?

W razie problemów sprawdź:
1. Logi serwera (console)
2. Logi MySQL
3. Console w przeglądarce (F12)

### 35. Czy mogę używać systemu komercyjnie?

Tak, licencja MIT pozwala na użytek komercyjny bez ograniczeń.

## Problemy Techniczne

### 36. "Error: Cannot find module 'express'"

```bash
npm install
```

### 37. "EADDRINUSE: Port 3000 is already in use"

```bash
# Zmień port w .env lub zabij proces:
kill $(lsof -t -i:3000)
```

### 38. "Access denied for user 'root'@'localhost'"

```bash
mysql -u root -p
# Następnie:
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'twoje_haslo';
FLUSH PRIVILEGES;
```

### 39. Strona nie ładuje się poprawnie

1. Sprawdź czy serwer działa: `curl http://localhost:3000`
2. Sprawdź logi serwera
3. Wyczyść cache przeglądarki (Ctrl+Shift+R)

### 40. CORS error w konsoli

Upewnij się że w `server.js` jest:
```javascript
app.use(cors());
```

I że wywołujesz API z tego samego portu lub skonfiguruj CORS dla specific origins.
