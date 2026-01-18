# Szybki Start - System Egzaminacyjny

## 1. Instalacja (5 minut)

### Krok 1: Zainstaluj zależności
```bash
cd exam-system
npm install
```

### Krok 2: Utwórz bazę danych
```bash
# Zaloguj się do MySQL
mysql -u root -p

# Wykonaj skrypt (będąc w katalogu exam-system)
source database/schema.sql
```

Lub zaimportuj plik `database/schema.sql` przez phpMyAdmin.

### Krok 3: Skonfiguruj połączenie
Utwórz plik `.env` w głównym katalogu:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=twoje_haslo_mysql
DB_NAME=exam_system
PORT=3000
```

### Krok 4: Uruchom serwer
```bash
npm start
```

## 2. Pierwsze kroki

### Panel Administracyjny
1. Otwórz: `http://localhost:3000/admin.html`
2. Zaloguj się:
   - Login: `admin`
   - Hasło: `admin123`
3. Dodaj nowy test lub edytuj istniejące przykładowe pytania

### Panel Użytkownika  
1. Otwórz: `http://localhost:3000`
2. Wpisz swoje dane
3. Rozpocznij egzamin

## 3. Baza danych zawiera już przykładowe dane!

✅ 1 test: "Testowanie Oprogramowania - Advanced"
✅ 10 pytań z odpowiedziami
✅ 1 konto administratora

## 4. Ważne funkcje

### Użytkownik:
- Pytania pobierane z bazy danych
- Odpowiedzi walidowane na serwerze
- Historia egzaminów zapisywana lokalnie i na serwerze
- Timer i pasek postępu
- Przegląd odpowiedzi po zakończeniu

### Administrator:
- Pełne zarządzanie testami
- Dodawanie/edycja/usuwanie pytań i odpowiedzi
- Widok wszystkich sesji egzaminacyjnych
- Statystyki i filtrowanie wyników

## 5. Rozwiązywanie problemów

**Problem z MySQL:**
```bash
# Sprawdź czy MySQL działa
sudo systemctl status mysql

# Jeśli nie działa, uruchom:
sudo systemctl start mysql
```

**Port zajęty:**
Zmień PORT w pliku `.env` na inny (np. 3001)

**Błąd połączenia:**
Sprawdź dane logowania MySQL w pliku `.env`

## 6. Struktura projektu

```
exam-system/
├── database/schema.sql      ← Schemat bazy danych
├── server/
│   ├── server.js           ← Główny serwer Node.js
│   └── db-config.js        ← Konfiguracja DB
├── public/
│   ├── index.html          ← Panel użytkownika
│   ├── admin.html          ← Panel administratora
│   ├── script.js           ← Logika użytkownika
│   └── admin-script.js     ← Logika administratora
└── package.json
```

## 7. Gotowe do użycia!

🎓 Panel użytkownika: http://localhost:3000
🔧 Panel admina: http://localhost:3000/admin.html

---

## Dodatkowe informacje

Szczegółowa dokumentacja dostępna w pliku `README.md`
