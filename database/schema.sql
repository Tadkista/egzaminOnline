-- Baza danych systemu egzaminacyjnego
CREATE DATABASE IF NOT EXISTS exam_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE exam_system;

-- Tabela testów
CREATE TABLE IF NOT EXISTS tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    passing_percentage INT NOT NULL DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela pytań
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    INDEX idx_test_id (test_id),
    INDEX idx_question_order (question_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela odpowiedzi
CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    answer_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_question_id (question_id),
    INDEX idx_answer_order (answer_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela sesji egzaminacyjnych
CREATE TABLE IF NOT EXISTS exam_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id INT NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    score_percentage DECIMAL(5,2) NULL,
    correct_answers INT NULL,
    total_questions INT NULL,
    time_taken_seconds INT NULL,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    INDEX idx_test_id (test_id),
    INDEX idx_session_token (session_token),
    INDEX idx_student_email (student_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela odpowiedzi uczestników
CREATE TABLE IF NOT EXISTS user_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_id INT NOT NULL,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_session_question (session_id, question_id),
    INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela administratorów
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dane przykładowe
INSERT INTO tests (title, description, duration_minutes, passing_percentage) VALUES
('Testowanie Oprogramowania - Advanced', 'Egzamin zaawansowany z testowania oprogramowania', 30, 60);

SET @test_id = LAST_INSERT_ID();

-- Przykładowe pytania
INSERT INTO questions (test_id, question_text, question_order) VALUES
(@test_id, 'Co to jest test regresji?', 1),
(@test_id, 'Która z poniższych technik jest techniką white-box?', 2),
(@test_id, 'Co oznacza skrót ISTQB?', 3),
(@test_id, 'Który z poniższych nie jest poziomem testowania?', 4),
(@test_id, 'Co to jest coverage w testowaniu?', 5),
(@test_id, 'Która metodyka jest agile?', 6),
(@test_id, 'Co to jest bug?', 7),
(@test_id, 'Która z poniższych nie jest metryką jakości?', 8),
(@test_id, 'Co to jest test case?', 9),
(@test_id, 'Który z poniższych jest narzędziem do automatyzacji testów?', 10);

-- Odpowiedzi dla pytania 1
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Co to jest test regresji?' AND test_id = @test_id), 'Test sprawdzający czy nowe zmiany nie zepsuły istniejącej funkcjonalności', true, 1),
((SELECT id FROM questions WHERE question_text = 'Co to jest test regresji?' AND test_id = @test_id), 'Test wydajnościowy aplikacji', false, 2),
((SELECT id FROM questions WHERE question_text = 'Co to jest test regresji?' AND test_id = @test_id), 'Test bezpieczeństwa danych', false, 3),
((SELECT id FROM questions WHERE question_text = 'Co to jest test regresji?' AND test_id = @test_id), 'Test zgodności z wymaganiami', false, 4);

-- Odpowiedzi dla pytania 2
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Która z poniższych technik jest techniką white-box?' AND test_id = @test_id), 'Analiza ścieżek wykonania kodu', true, 1),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych technik jest techniką white-box?' AND test_id = @test_id), 'Testowanie eksploracyjne', false, 2),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych technik jest techniką white-box?' AND test_id = @test_id), 'Testowanie na podstawie przypadków użycia', false, 3),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych technik jest techniką white-box?' AND test_id = @test_id), 'Testowanie akceptacyjne', false, 4);

-- Odpowiedzi dla pytania 3
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Co oznacza skrót ISTQB?' AND test_id = @test_id), 'International Software Testing Qualifications Board', true, 1),
((SELECT id FROM questions WHERE question_text = 'Co oznacza skrót ISTQB?' AND test_id = @test_id), 'International System Testing Quality Board', false, 2),
((SELECT id FROM questions WHERE question_text = 'Co oznacza skrót ISTQB?' AND test_id = @test_id), 'Internet Software Testing Quality Bureau', false, 3),
((SELECT id FROM questions WHERE question_text = 'Co oznacza skrót ISTQB?' AND test_id = @test_id), 'Integrated Software Test Quality Base', false, 4);

-- Odpowiedzi dla pytania 4
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Który z poniższych nie jest poziomem testowania?' AND test_id = @test_id), 'Test wersji', true, 1),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych nie jest poziomem testowania?' AND test_id = @test_id), 'Test jednostkowy', false, 2),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych nie jest poziomem testowania?' AND test_id = @test_id), 'Test integracyjny', false, 3),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych nie jest poziomem testowania?' AND test_id = @test_id), 'Test systemowy', false, 4);

-- Odpowiedzi dla pytania 5
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Co to jest coverage w testowaniu?' AND test_id = @test_id), 'Miara pokazująca jaka część kodu została przetestowana', true, 1),
((SELECT id FROM questions WHERE question_text = 'Co to jest coverage w testowaniu?' AND test_id = @test_id), 'Liczba znalezionych błędów', false, 2),
((SELECT id FROM questions WHERE question_text = 'Co to jest coverage w testowaniu?' AND test_id = @test_id), 'Czas potrzebny na wykonanie testów', false, 3),
((SELECT id FROM questions WHERE question_text = 'Co to jest coverage w testowaniu?' AND test_id = @test_id), 'Koszt przeprowadzenia testów', false, 4);

-- Odpowiedzi dla pytania 6
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Która metodyka jest agile?' AND test_id = @test_id), 'Scrum', true, 1),
((SELECT id FROM questions WHERE question_text = 'Która metodyka jest agile?' AND test_id = @test_id), 'Waterfall', false, 2),
((SELECT id FROM questions WHERE question_text = 'Która metodyka jest agile?' AND test_id = @test_id), 'V-Model', false, 3),
((SELECT id FROM questions WHERE question_text = 'Która metodyka jest agile?' AND test_id = @test_id), 'Spiral', false, 4);

-- Odpowiedzi dla pytania 7
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Co to jest bug?' AND test_id = @test_id), 'Błąd w oprogramowaniu powodujący nieprawidłowe działanie', true, 1),
((SELECT id FROM questions WHERE question_text = 'Co to jest bug?' AND test_id = @test_id), 'Nowa funkcjonalność w aplikacji', false, 2),
((SELECT id FROM questions WHERE question_text = 'Co to jest bug?' AND test_id = @test_id), 'Wersja testowa oprogramowania', false, 3),
((SELECT id FROM questions WHERE question_text = 'Co to jest bug?' AND test_id = @test_id), 'Dokumentacja techniczna', false, 4);

-- Odpowiedzi dla pytania 8
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Która z poniższych nie jest metryką jakości?' AND test_id = @test_id), 'Rozmiar zespołu', true, 1),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych nie jest metryką jakości?' AND test_id = @test_id), 'Gęstość defektów', false, 2),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych nie jest metryką jakości?' AND test_id = @test_id), 'Pokrycie kodu testami', false, 3),
((SELECT id FROM questions WHERE question_text = 'Która z poniższych nie jest metryką jakości?' AND test_id = @test_id), 'Liczba krytycznych błędów', false, 4);

-- Odpowiedzi dla pytania 9
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Co to jest test case?' AND test_id = @test_id), 'Zestaw warunków i kroków do przetestowania określonej funkcjonalności', true, 1),
((SELECT id FROM questions WHERE question_text = 'Co to jest test case?' AND test_id = @test_id), 'Rodzaj błędu w aplikacji', false, 2),
((SELECT id FROM questions WHERE question_text = 'Co to jest test case?' AND test_id = @test_id), 'Narzędzie do automatyzacji', false, 3),
((SELECT id FROM questions WHERE question_text = 'Co to jest test case?' AND test_id = @test_id), 'Środowisko testowe', false, 4);

-- Odpowiedzi dla pytania 10
INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES
((SELECT id FROM questions WHERE question_text = 'Który z poniższych jest narzędziem do automatyzacji testów?' AND test_id = @test_id), 'Selenium', true, 1),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych jest narzędziem do automatyzacji testów?' AND test_id = @test_id), 'Photoshop', false, 2),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych jest narzędziem do automatyzacji testów?' AND test_id = @test_id), 'Microsoft Word', false, 3),
((SELECT id FROM questions WHERE question_text = 'Który z poniższych jest narzędziem do automatyzacji testów?' AND test_id = @test_id), 'Adobe Reader', false, 4);

-- Domyślny administrator (hasło: admin123)
INSERT INTO admins (username, password_hash, email) VALUES
('admin', '$2a$10$rqQqB5g5X3X3X3X3X3X3XeK7j7j7j7j7j7j7j7j7j7j7j7j7j7j7j', 'admin@example.com');
