const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const dbConfig = require('./db-config');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Pool połączeń z bazą danych
const pool = mysql.createPool(dbConfig);

// ==================== ENDPOINTY API ====================

// Pobranie listy aktywnych testów
app.get('/api/tests', async (req, res) => {
    try {
        const [tests] = await pool.query(
            'SELECT id, title, description, duration_minutes, passing_percentage FROM tests WHERE is_active = true'
        );
        res.json(tests);
    } catch (error) {
        console.error('Błąd podczas pobierania testów:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Pobranie szczegółów testu (bez poprawnych odpowiedzi)
app.get('/api/tests/:id', async (req, res) => {
    try {
        const [test] = await pool.query(
            'SELECT id, title, description, duration_minutes, passing_percentage FROM tests WHERE id = ? AND is_active = true',
            [req.params.id]
        );

        if (test.length === 0) {
            return res.status(404).json({ error: 'Test nie został znaleziony' });
        }

        const [questions] = await pool.query(`
            SELECT q.id, q.question_text, q.question_order
            FROM questions q
            WHERE q.test_id = ?
            ORDER BY q.question_order
        `, [req.params.id]);

        // Dla każdego pytania pobierz odpowiedzi (bez informacji o poprawności)
        for (let question of questions) {
            const [answers] = await pool.query(`
                SELECT id, answer_text, answer_order
                FROM answers
                WHERE question_id = ?
                ORDER BY answer_order
            `, [question.id]);
            question.answers = answers;
        }

        res.json({
            ...test[0],
            questions
        });
    } catch (error) {
        console.error('Błąd podczas pobierania testu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Rozpoczęcie nowej sesji egzaminacyjnej
app.post('/api/sessions/start', async (req, res) => {
    try {
        const { testId, studentName, studentEmail } = req.body;

        if (!testId || !studentName || !studentEmail) {
            return res.status(400).json({ error: 'Brakuje wymaganych danych' });
        }

        // Sprawdź czy test istnieje
        const [test] = await pool.query(
            'SELECT id, duration_minutes FROM tests WHERE id = ? AND is_active = true',
            [testId]
        );

        if (test.length === 0) {
            return res.status(404).json({ error: 'Test nie został znaleziony' });
        }

        // Wygeneruj unikalny token sesji
        const sessionToken = crypto.randomBytes(32).toString('hex');

        // Utwórz nową sesję
        const [result] = await pool.query(
            'INSERT INTO exam_sessions (test_id, student_name, student_email, session_token) VALUES (?, ?, ?, ?)',
            [testId, studentName, studentEmail, sessionToken]
        );

        res.json({
            sessionId: result.insertId,
            sessionToken,
            durationMinutes: test[0].duration_minutes
        });
    } catch (error) {
        console.error('Błąd podczas rozpoczynania sesji:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Zapisanie odpowiedzi użytkownika
app.post('/api/sessions/:sessionToken/answers', async (req, res) => {
    try {
        const { sessionToken } = req.params;
        const { questionId, answerId } = req.body;

        // Sprawdź czy sesja istnieje i nie została zakończona
        const [session] = await pool.query(
            'SELECT id, completed_at FROM exam_sessions WHERE session_token = ?',
            [sessionToken]
        );

        if (session.length === 0) {
            return res.status(404).json({ error: 'Sesja nie została znaleziona' });
        }

        if (session[0].completed_at) {
            return res.status(400).json({ error: 'Sesja została już zakończona' });
        }

        // Zapisz odpowiedź (jeśli już istnieje, zostanie zaktualizowana)
        await pool.query(
            `INSERT INTO user_answers (session_id, question_id, answer_id) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE answer_id = ?, answered_at = CURRENT_TIMESTAMP`,
            [session[0].id, questionId, answerId, answerId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas zapisywania odpowiedzi:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Zakończenie egzaminu i obliczenie wyników
app.post('/api/sessions/:sessionToken/complete', async (req, res) => {
    try {
        const { sessionToken } = req.params;
        const { timeTakenSeconds } = req.body;

        // Pobierz sesję
        const [session] = await pool.query(
            'SELECT id, test_id, completed_at FROM exam_sessions WHERE session_token = ?',
            [sessionToken]
        );

        if (session.length === 0) {
            return res.status(404).json({ error: 'Sesja nie została znaleziona' });
        }

        if (session[0].completed_at) {
            return res.status(400).json({ error: 'Sesja została już zakończona' });
        }

        const sessionId = session[0].id;
        const testId = session[0].test_id;

        // Pobierz wszystkie pytania z testu
        const [questions] = await pool.query(
            'SELECT id FROM questions WHERE test_id = ?',
            [testId]
        );

        const totalQuestions = questions.length;

        // Oblicz poprawne odpowiedzi
        const [correctAnswersResult] = await pool.query(`
            SELECT COUNT(DISTINCT ua.question_id) as correct_count
            FROM user_answers ua
            JOIN answers a ON ua.answer_id = a.id
            WHERE ua.session_id = ? AND a.is_correct = true
        `, [sessionId]);

        const correctAnswers = correctAnswersResult[0].correct_count;
        const scorePercentage = (correctAnswers / totalQuestions * 100).toFixed(2);

        // Zaktualizuj sesję
        await pool.query(
            `UPDATE exam_sessions 
             SET completed_at = CURRENT_TIMESTAMP, 
                 score_percentage = ?, 
                 correct_answers = ?, 
                 total_questions = ?,
                 time_taken_seconds = ?
             WHERE id = ?`,
            [scorePercentage, correctAnswers, totalQuestions, timeTakenSeconds, sessionId]
        );

        // Pobierz szczegółowe wyniki - NAPRAWIONE: usunięto duplikaty
        const [questions2] = await pool.query(`
            SELECT DISTINCT
                q.id as question_id,
                q.question_text,
                q.question_order,
                ua.answer_id as user_answer_id
            FROM questions q
            LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.session_id = ?
            WHERE q.test_id = ?
            ORDER BY q.question_order
        `, [sessionId, testId]);

        // Pobierz wszystkie odpowiedzi dla każdego pytania
        const questionsWithAnswers = [];
        const processedQuestions = new Set(); // Dodatkowa ochrona przed duplikatami

        for (let result of questions2) {
            // Sprawdź czy pytanie już zostało przetworzone
            if (processedQuestions.has(result.question_id)) {
                console.log('Pominięto duplikat pytania:', result.question_id);
                continue;
            }
            processedQuestions.add(result.question_id);

            const [allAnswers] = await pool.query(`
                SELECT id, answer_text, is_correct, answer_order
                FROM answers
                WHERE question_id = ?
                ORDER BY answer_order
            `, [result.question_id]);

            questionsWithAnswers.push({
                questionId: result.question_id,
                questionText: result.question_text,
                questionOrder: result.question_order,
                userAnswerId: result.user_answer_id,
                allAnswers: allAnswers
            });
        }

        console.log('Liczba pytań zwróconych:', questionsWithAnswers.length);

        res.json({
            success: true,
            scorePercentage: parseFloat(scorePercentage),
            correctAnswers,
            totalQuestions,
            detailedResults: questionsWithAnswers
        });
    } catch (error) {
        console.error('Błąd podczas kończenia egzaminu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
// Pobranie historii egzaminów uczestnika (server.js)
// Dodaj te endpointy do server.js (ZAMIAST istniejącego endpointu /api/history/:email)

// Pobranie historii egzaminów uczestnika z progiem zaliczenia
app.get('/api/history/:email', async (req, res) => {
    try {
        const [history] = await pool.query(`
            SELECT 
                es.id,
                es.student_name,
                es.student_email,
                es.started_at,
                es.completed_at,
                es.score_percentage,
                es.correct_answers,
                es.total_questions,
                es.time_taken_seconds,
                t.title as test_title,
                t.passing_percentage
            FROM exam_sessions es
            JOIN tests t ON es.test_id = t.id
            WHERE es.student_email = ? AND es.completed_at IS NOT NULL
            ORDER BY es.completed_at DESC
        `, [req.params.email]);

        res.json(history);
    } catch (error) {
        console.error('Błąd podczas pobierania historii:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Pobranie szczegółów konkretnego egzaminu z historii
app.get('/api/history/details/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;

        // Pobierz podstawowe informacje o sesji
        const [session] = await pool.query(`
            SELECT 
                es.id,
                es.student_name,
                es.student_email,
                es.started_at,
                es.completed_at,
                es.score_percentage,
                es.correct_answers,
                es.total_questions,
                es.time_taken_seconds,
                es.test_id,
                t.title as test_title,
                t.passing_percentage
            FROM exam_sessions es
            JOIN tests t ON es.test_id = t.id
            WHERE es.id = ? AND es.completed_at IS NOT NULL
        `, [sessionId]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Sesja nie została znaleziona' });
        }

        const sessionData = session[0];

        // Pobierz szczegółowe wyniki (wszystkie pytania i odpowiedzi) - NAPRAWIONE
        const [questions] = await pool.query(`
            SELECT DISTINCT
                q.id as question_id,
                q.question_text,
                q.question_order,
                ua.answer_id as user_answer_id
            FROM questions q
            LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.session_id = ?
            WHERE q.test_id = ?
            ORDER BY q.question_order
        `, [sessionId, sessionData.test_id]);

        // Dla każdego pytania pobierz wszystkie odpowiedzi
        const detailedResults = [];
        const processedQuestions = new Set();

        for (let question of questions) {
            // Sprawdź czy pytanie już zostało przetworzone
            if (processedQuestions.has(question.question_id)) {
                console.log('Pominięto duplikat pytania w historii:', question.question_id);
                continue;
            }
            processedQuestions.add(question.question_id);

            const [allAnswers] = await pool.query(`
                SELECT 
                    id,
                    answer_text,
                    is_correct,
                    answer_order
                FROM answers
                WHERE question_id = ?
                ORDER BY answer_order
            `, [question.question_id]);

            detailedResults.push({
                questionId: question.question_id,
                questionText: question.question_text,
                questionOrder: question.question_order,
                userAnswerId: question.user_answer_id,
                allAnswers: allAnswers
            });
        }

        console.log('Liczba pytań w historii:', detailedResults.length);

        res.json({
            ...sessionData,
            detailed_results: detailedResults
        });
    } catch (error) {
        console.error('Błąd podczas pobierania szczegółów egzaminu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usunięcie egzaminu z historii
app.delete('/api/history/:id', async (req, res) => {
    const sessionId = req.params.id;
    
    console.log('=== DELETE /api/history/:id ===');
    console.log('Session ID z URL:', sessionId);
    console.log('Typ Session ID:', typeof sessionId);
    
    const connection = await pool.getConnection();
    
    try {
        // Sprawdź czy sesja istnieje
        const [checkSession] = await connection.query(
            'SELECT id, completed_at FROM exam_sessions WHERE id = ?',
            [sessionId]
        );
        
        console.log('Znaleziono sesji:', checkSession.length);
        if (checkSession.length > 0) {
            console.log('Sesja:', checkSession[0]);
        }

        await connection.beginTransaction();

        // Usuń odpowiedzi powiązane z sesją
        const [deleteAnswers] = await connection.query(
            'DELETE FROM user_answers WHERE session_id = ?', 
            [sessionId]
        );
        console.log('Usunięto odpowiedzi:', deleteAnswers.affectedRows);
        
        // Usuń sesję (nawet jeśli nie została ukończona)
        const [result] = await connection.query(
            'DELETE FROM exam_sessions WHERE id = ?', 
            [sessionId]
        );

        console.log('Usunięto sesji:', result.affectedRows);

        if (result.affectedRows === 0) {
            await connection.rollback();
            console.log('BŁĄD: Nie znaleziono sesji do usunięcia');
            return res.status(404).json({ error: 'Egzamin nie został znaleziony' });
        }

        await connection.commit();
        console.log('Egzamin usunięty pomyślnie');
        
        res.json({ 
            success: true, 
            message: 'Egzamin został usunięty z historii',
            deletedId: sessionId 
        });
    } catch (error) {
        await connection.rollback();
        console.error('BŁĄD podczas usuwania egzaminu:', error);
        res.status(500).json({ error: 'Wystąpił błąd podczas usuwania egzaminu: ' + error.message });
    } finally {
        connection.release();
    }
});

// ==================== ENDPOINTY ADMIN ====================

// Logowanie administratora (uproszczone - w produkcji użyj JWT)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('=== PRÓBA LOGOWANIA ===');
        console.log('Username:', username);
        console.log('Password length:', password ? password.length : 0);

        // Użyj LOWER() aby username był case-insensitive
        const [admin] = await pool.query(
            'SELECT id, username, password_hash, email FROM admins WHERE LOWER(username) = LOWER(?)',
            [username]
        );

        console.log('Znaleziono adminów:', admin.length);

        if (admin.length === 0) {
            console.log('Błąd: Nie znaleziono użytkownika');
            return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
        }

        console.log('Admin ID:', admin[0].id);
        console.log('Admin username:', admin[0].username);
        console.log('Password_hash exists:', !!admin[0].password_hash);
        console.log('Password_hash value:', admin[0].password_hash);
        console.log('Password_hash starts with $2:', admin[0].password_hash ? admin[0].password_hash.startsWith('$2') : false);

        // Sprawdź czy hasło jest w bazie (zahashowane) czy domyślne
        let isValid = false;
        
        // Jeśli password_hash jest NULL, pusty lub nie zaczyna się od $2 (bcrypt), użyj domyślnego hasła
        if (!admin[0].password_hash || !admin[0].password_hash.startsWith('$2')) {
            console.log('Używam domyślnego hasła admin123');
            // Domyślne hasło dla demo
            isValid = password === 'admin123';
            console.log('Porównanie z admin123:', isValid);
        } else {
            console.log('Używam bcrypt do weryfikacji');
            // Hasło zahashowane bcrypt
            isValid = await bcrypt.compare(password, admin[0].password_hash);
            console.log('Wynik bcrypt.compare:', isValid);
        }

        console.log('Hasło poprawne:', isValid);

        if (!isValid) {
            console.log('Błąd: Nieprawidłowe hasło');
            return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
        }

        // Zaktualizuj ostatnie logowanie
        await pool.query(
            'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [admin[0].id]
        );

        console.log('Logowanie zakończone sukcesem');

        res.json({
            success: true,
            admin: {
                id: admin[0].id,
                username: admin[0].username,
                email: admin[0].email
            }
        });
    } catch (error) {
        console.error('Błąd podczas logowania:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Zmiana hasła administratora
app.post('/api/admin/change-password', async (req, res) => {
    try {
        const { adminId, currentPassword, newPassword } = req.body;

        if (!adminId || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Brakuje wymaganych danych' });
        }

        // Pobierz dane administratora
        const [admin] = await pool.query(
            'SELECT id, username, password_hash FROM admins WHERE id = ?',
            [adminId]
        );

        if (admin.length === 0) {
            return res.status(404).json({ error: 'Administrator nie został znaleziony' });
        }

        // Sprawdź obecne hasło
        let isCurrentPasswordValid = false;
        
        // Jeśli password_hash jest NULL, pusty lub nie zaczyna się od $2 (bcrypt), użyj domyślnego hasła
        if (!admin[0].password_hash || !admin[0].password_hash.startsWith('$2')) {
            // Domyślne hasło
            isCurrentPasswordValid = currentPassword === 'admin123';
        } else {
            // Hasło zahashowane bcrypt
            isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin[0].password_hash);
        }

        if (!isCurrentPasswordValid) {
            return res.status(401).json({ error: 'Obecne hasło jest nieprawidłowe' });
        }

        // Walidacja nowego hasła
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Nowe hasło musi mieć minimum 8 znaków' });
        }

        if (!/[A-Z]/.test(newPassword)) {
            return res.status(400).json({ error: 'Nowe hasło musi zawierać przynajmniej jedną wielką literę' });
        }

        if (!/[a-z]/.test(newPassword)) {
            return res.status(400).json({ error: 'Nowe hasło musi zawierać przynajmniej jedną małą literę' });
        }

        if (!/[0-9]/.test(newPassword)) {
            return res.status(400).json({ error: 'Nowe hasło musi zawierać przynajmniej jedną cyfrę' });
        }

        // Zahashuj nowe hasło
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Zaktualizuj hasło w bazie
        await pool.query(
            'UPDATE admins SET password_hash = ? WHERE id = ?',
            [newPasswordHash, adminId]
        );

        res.json({
            success: true,
            message: 'Hasło zostało zmienione pomyślnie'
        });
    } catch (error) {
        console.error('Błąd podczas zmiany hasła:', error);
        res.status(500).json({ error: 'Błąd serwera podczas zmiany hasła' });
    }
});

// Pobranie wszystkich testów (dla admina)
app.get('/api/admin/tests', async (req, res) => {
    try {
        const [tests] = await pool.query(`
            SELECT 
                t.*,
                COUNT(DISTINCT q.id) as questions_count,
                COUNT(DISTINCT es.id) as sessions_count
            FROM tests t
            LEFT JOIN questions q ON t.id = q.test_id
            LEFT JOIN exam_sessions es ON t.id = es.test_id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `);
        res.json(tests);
    } catch (error) {
        console.error('Błąd podczas pobierania testów:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Pobranie szczegółów testu z pytaniami i odpowiedziami (dla admina)
app.get('/api/admin/tests/:id', async (req, res) => {
    try {
        const [test] = await pool.query('SELECT * FROM tests WHERE id = ?', [req.params.id]);

        if (test.length === 0) {
            return res.status(404).json({ error: 'Test nie został znaleziony' });
        }

        const [questions] = await pool.query(`
            SELECT * FROM questions WHERE test_id = ? ORDER BY question_order
        `, [req.params.id]);

        for (let question of questions) {
            const [answers] = await pool.query(`
                SELECT * FROM answers WHERE question_id = ? ORDER BY answer_order
            `, [question.id]);
            question.answers = answers;
        }

        res.json({
            ...test[0],
            questions
        });
    } catch (error) {
        console.error('Błąd podczas pobierania testu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Utworzenie nowego testu
app.post('/api/admin/tests', async (req, res) => {
    try {
        const { title, description, duration_minutes, passing_percentage } = req.body;

        const [result] = await pool.query(
            'INSERT INTO tests (title, description, duration_minutes, passing_percentage) VALUES (?, ?, ?, ?)',
            [title, description, duration_minutes, passing_percentage]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Błąd podczas tworzenia testu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Aktualizacja testu
app.put('/api/admin/tests/:id', async (req, res) => {
    try {
        const { title, description, duration_minutes, passing_percentage, is_active } = req.body;

        await pool.query(
            `UPDATE tests 
             SET title = ?, description = ?, duration_minutes = ?, passing_percentage = ?, is_active = ?
             WHERE id = ?`,
            [title, description, duration_minutes, passing_percentage, is_active, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas aktualizacji testu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usunięcie testu
app.delete('/api/admin/tests/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tests WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas usuwania testu:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Dodanie pytania do testu
app.post('/api/admin/tests/:testId/questions', async (req, res) => {
    try {
        const { question_text, question_order } = req.body;

        const [result] = await pool.query(
            'INSERT INTO questions (test_id, question_text, question_order) VALUES (?, ?, ?)',
            [req.params.testId, question_text, question_order]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Błąd podczas dodawania pytania:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Aktualizacja pytania
app.put('/api/admin/questions/:id', async (req, res) => {
    try {
        const { question_text, question_order } = req.body;

        await pool.query(
            'UPDATE questions SET question_text = ?, question_order = ? WHERE id = ?',
            [question_text, question_order, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas aktualizacji pytania:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usunięcie pytania
app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM questions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas usuwania pytania:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Dodanie odpowiedzi do pytania
app.post('/api/admin/questions/:questionId/answers', async (req, res) => {
    try {
        const { answer_text, is_correct, answer_order } = req.body;

        const [result] = await pool.query(
            'INSERT INTO answers (question_id, answer_text, is_correct, answer_order) VALUES (?, ?, ?, ?)',
            [req.params.questionId, answer_text, is_correct, answer_order]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Błąd podczas dodawania odpowiedzi:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Aktualizacja odpowiedzi
app.put('/api/admin/answers/:id', async (req, res) => {
    try {
        const { answer_text, is_correct, answer_order } = req.body;

        await pool.query(
            'UPDATE answers SET answer_text = ?, is_correct = ?, answer_order = ? WHERE id = ?',
            [answer_text, is_correct, answer_order, req.params.id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas aktualizacji odpowiedzi:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usunięcie odpowiedzi
app.delete('/api/admin/answers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM answers WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Błąd podczas usuwania odpowiedzi:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Pobranie wszystkich sesji egzaminacyjnych z progiem zaliczenia z tabeli testów
app.get('/api/admin/sessions', async (req, res) => {
    try {
        const [sessions] = await pool.query(`
            SELECT 
                es.*,
                t.title as test_title,
                t.passing_percentage as passing_percentage
            FROM exam_sessions es
            JOIN tests t ON es.test_id = t.id
            WHERE es.completed_at IS NOT NULL
            ORDER BY es.completed_at DESC
            LIMIT 100
        `);
        res.json(sessions);
    } catch (error) {
        console.error('Błąd podczas pobierania sesji:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Pobranie szczegółów pojedynczej sesji
app.get('/api/admin/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        
        // Pobierz podstawowe dane sesji
        const [sessions] = await pool.query(`
            SELECT 
                es.*,
                t.title as test_title,
                t.passing_percentage as passing_percentage
            FROM exam_sessions es
            JOIN tests t ON es.test_id = t.id
            WHERE es.id = ?
        `, [sessionId]);
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Sesja nie została znaleziona' });
        }
        
        const session = sessions[0];
        
        // Pobierz odpowiedzi użytkownika wraz z pytaniami
        const [userAnswers] = await pool.query(`
            SELECT 
                ua.question_id,
                ua.answer_id,
                q.question_text,
                q.question_order
            FROM user_answers ua
            JOIN questions q ON ua.question_id = q.id
            WHERE ua.session_id = ?
            ORDER BY q.question_order
        `, [sessionId]);
        
        // Dla każdego pytania pobierz wszystkie odpowiedzi
        const detailedResults = [];
        for (let userAnswer of userAnswers) {
            const [answers] = await pool.query(`
                SELECT id, answer_text, is_correct, answer_order
                FROM answers
                WHERE question_id = ?
                ORDER BY answer_order
            `, [userAnswer.question_id]);
            
            detailedResults.push({
                questionText: userAnswer.question_text,
                userAnswerId: userAnswer.answer_id,
                allAnswers: answers
            });
        }
        
        // Przygotuj pełne dane sesji
        const sessionData = {
            ...session,
            detailed_results: detailedResults
        };
        
        res.json(sessionData);
    } catch (error) {
        console.error('Błąd podczas pobierania szczegółów sesji:', error);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Usunięcie sesji egzaminacyjnej
app.delete('/api/admin/sessions/:id', async (req, res) => {
    const sessionId = req.params.id;
    
    console.log('Próba usunięcia sesji o ID:', sessionId);
    
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        // Usuń odpowiedzi powiązane z sesją
        await connection.query('DELETE FROM user_answers WHERE session_id = ?', [sessionId]);
        
        // Usuń sesję
        const [result] = await connection.query('DELETE FROM exam_sessions WHERE id = ?', [sessionId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            console.log('Sesja nie znaleziona, ID:', sessionId);
            return res.status(404).json({ error: 'Sesja nie została znaleziona' });
        }

        await connection.commit();
        console.log('Sesja usunięta pomyślnie, ID:', sessionId);
        
        res.json({ 
            success: true, 
            message: 'Sesja została usunięta',
            deletedId: sessionId 
        });
    } catch (error) {
        await connection.rollback();
        console.error('Błąd podczas usuwania sesji:', error);
        res.status(500).json({ error: 'Wystąpił błąd podczas usuwania sesji' });
    } finally {
        connection.release();
    }
});

// Start serwera
app.listen(PORT, HOST, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log(`Panel użytkownika: http://localhost:${PORT}`);
    console.log(`Panel administratora: http://localhost:${PORT}/admin.html`);
});