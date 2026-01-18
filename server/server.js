const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const dbConfig = require('./db-config');

const app = express();
const PORT = process.env.PORT || 3000;

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
            SELECT COUNT(*) as correct_count
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

        // Pobierz szczegółowe wyniki
        const [detailedResults] = await pool.query(`
            SELECT 
                q.id as question_id,
                q.question_text,
                q.question_order,
                ua.answer_id as user_answer_id,
                a_user.answer_text as user_answer_text,
                a_user.is_correct as user_answer_correct,
                a_correct.id as correct_answer_id,
                a_correct.answer_text as correct_answer_text
            FROM questions q
            LEFT JOIN user_answers ua ON q.id = ua.question_id AND ua.session_id = ?
            LEFT JOIN answers a_user ON ua.answer_id = a_user.id
            LEFT JOIN answers a_correct ON q.id = a_correct.question_id AND a_correct.is_correct = true
            WHERE q.test_id = ?
            ORDER BY q.question_order
        `, [sessionId, testId]);

        // Pobierz wszystkie odpowiedzi dla każdego pytania
        const questionsWithAnswers = [];
        for (let result of detailedResults) {
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
                userAnswerText: result.user_answer_text,
                userAnswerCorrect: result.user_answer_correct,
                correctAnswerId: result.correct_answer_id,
                correctAnswerText: result.correct_answer_text,
                allAnswers: allAnswers
            });
        }

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
app.get('/api/history/:email', async (req, res) => {
    try {
        const [history] = await pool.query(`
            SELECT 
                es.id,
                es.student_name AS studentName,
                es.student_email AS studentEmail,
                es.completed_at AS date,
                es.score_percentage AS score,
                es.correct_answers AS correctAnswers,
                es.total_questions AS totalQuestions,
                es.time_taken_seconds AS timeTaken,
                t.title AS testTitle,
                t.passing_percentage AS passingThreshold
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

// ==================== ENDPOINTY ADMIN ====================

// Logowanie administratora (uproszczone - w produkcji użyj JWT)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [admin] = await pool.query(
            'SELECT id, username, password_hash, email FROM admins WHERE username = ?',
            [username]
        );

        if (admin.length === 0) {
            return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
        }

        // W produkcji użyj bcrypt.compare()
        const isValid = password === 'admin123'; // Uproszczone dla demo

        if (!isValid) {
            return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
        }

        // Zaktualizuj ostatnie logowanie
        await pool.query(
            'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [admin[0].id]
        );

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
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log(`Panel użytkownika: http://localhost:${PORT}`);
    console.log(`Panel administratora: http://localhost:${PORT}/admin.html`);
});