const API_URL = 'http://localhost:3000/api';

let currentAdmin = null;
let currentTestId = null;
let currentQuestionId = null;
let currentAnswerIndex = null;
let editMode = false;
let testData = {
    questions: []
};

document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    checkAdminSession();
});

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('adminPassword').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') login();
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            switchView(this.dataset.view);
        });
    });

    document.getElementById('addTestBtn').addEventListener('click', () => openTestModal());

    document.getElementById('saveTestBtn').addEventListener('click', saveTest);

    document.getElementById('addQuestionBtn').addEventListener('click', () => openQuestionModal());

    document.getElementById('saveQuestionBtn').addEventListener('click', saveQuestion);

    document.getElementById('addAnswerBtn').addEventListener('click', () => openAnswerModal());

    document.getElementById('saveAnswerBtn').addEventListener('click', saveAnswer);
}

// Sprawdzenie sesji administratora
function checkAdminSession() {
    const savedAdmin = localStorage.getItem('currentAdmin');
    if (savedAdmin) {
        currentAdmin = JSON.parse(savedAdmin);
        showAdminPanel();
    }
}

// Logowanie
async function login() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    if (!username || !password) {
        alert('Wypełnij wszystkie pola!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentAdmin = data.admin;
            localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
            showAdminPanel();
        } else {
            alert(data.error || 'Błąd logowania');
        }
    } catch (error) {
        console.error('Błąd logowania:', error);
        alert('Wystąpił błąd podczas logowania');
    }
}

// Wylogowanie
function logout() {
    currentAdmin = null;
    localStorage.removeItem('currentAdmin');
    document.querySelector('.login-screen').classList.add('active');
    document.querySelector('.admin-panel').classList.remove('active');
}

// Pokazanie panelu administratora
function showAdminPanel() {
    document.querySelector('.login-screen').classList.remove('active');
    document.querySelector('.admin-panel').classList.add('active');
    document.getElementById('adminName').textContent = currentAdmin.username;

    loadTests();
    loadSessions();
}

// Przełączanie widoków
function switchView(view) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.querySelector(`[data-view="${view}"]`).classList.add('active');

    document.querySelectorAll('.admin-view').forEach(v => {
        v.style.display = 'none';
    });

    document.getElementById(`${view}View`).style.display = 'block';

    if (view === 'tests') {
        loadTests();
    } else if (view === 'sessions') {
        loadSessions();
    }
}

// ==================== ZARZĄDZANIE TESTAMI ====================

// Ładowanie testów
async function loadTests() {
    try {
        const response = await fetch(`${API_URL}/admin/tests`);
        const tests = await response.json();

        const container = document.getElementById('testsList');

        if (tests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>Brak testów</h3>
                    <p>Rozpocznij od dodania pierwszego testu</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        tests.forEach(test => {
            const card = createTestCard(test);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Błąd podczas ładowania testów:', error);
    }
}

// Utworzenie karty testu
function createTestCard(test) {
    const card = document.createElement('div');
    card.className = 'test-card';

    const statusClass = test.is_active ? 'status-active' : 'status-inactive';
    const statusText = test.is_active ? 'Aktywny' : 'Nieaktywny';

    card.innerHTML = `
        <div class="test-card-header">
            <div class="test-card-title">
                <h3>${test.title}</h3>
                <p>${test.description || 'Brak opisu'}</p>
            </div>
            <div class="test-card-actions">
                <button class="btn btn-small" onclick="editTest(${test.id})">Edytuj</button>
                <button class="btn btn-small btn-secondary" onclick="deleteTest(${test.id})">Usuń</button>
            </div>
        </div>
        
        <div class="test-card-meta">
            <div class="meta-item">
                <span class="meta-label">Pytania</span>
                <span class="meta-value">${test.questions_count || 0}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Czas trwania</span>
                <span class="meta-value">${test.duration_minutes} min</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Próg zaliczenia</span>
                <span class="meta-value">${test.passing_percentage}%</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Liczba podejść</span>
                <span class="meta-value">${test.sessions_count || 0}</span>
            </div>
        </div>
        
        <span class="test-card-status ${statusClass}">${statusText}</span>
    `;

    return card;
}

// Otwarcie modala testu
async function openTestModal(testId = null) {
    const modal = document.getElementById('testModal');
    const title = document.getElementById('modalTitle');

    if (testId) {
        // Tryb edycji
        editMode = true;
        currentTestId = testId;
        title.textContent = 'Edytuj test';

        try {
            const response = await fetch(`${API_URL}/admin/tests/${testId}`);
            const test = await response.json();

            document.getElementById('testTitle').value = test.title;
            document.getElementById('testDescription').value = test.description || '';
            document.getElementById('testDuration').value = test.duration_minutes;
            document.getElementById('testPassingScore').value = test.passing_percentage;
            document.getElementById('testActive').value = test.is_active ? '1' : '0';

            testData = test;
            renderQuestionsList();
        } catch (error) {
            console.error('Błąd podczas ładowania testu:', error);
            alert('Błąd podczas ładowania testu');
            return;
        }
    } else {
        // Tryb dodawania
        editMode = false;
        currentTestId = null;
        title.textContent = 'Dodaj nowy test';

        document.getElementById('testTitle').value = '';
        document.getElementById('testDescription').value = '';
        document.getElementById('testDuration').value = 30;
        document.getElementById('testPassingScore').value = 60;
        document.getElementById('testActive').value = '1';

        testData = { questions: [] };
        renderQuestionsList();
    }

    modal.classList.add('active');
}

// Zamknięcie modala testu
function closeTestModal() {
    document.getElementById('testModal').classList.remove('active');
    testData = { questions: [] };
}

// Renderowanie listy pytań
function renderQuestionsList() {
    const container = document.getElementById('questionsList');

    if (!testData.questions || testData.questions.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">Brak pytań. Dodaj pierwsze pytanie.</p>';
        return;
    }

    container.innerHTML = '';

    testData.questions.forEach((question, index) => {
        if (question._deleted) return;

        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';

        const correctAnswers = question.answers ? question.answers.filter(a => a.is_correct && !a._deleted).length : 0;
        const totalAnswers = question.answers ? question.answers.filter(a => !a._deleted).length : 0;

        questionDiv.innerHTML = `
            <div class="question-item-header">
                <div class="question-item-text">
                    <strong>Pytanie ${index + 1}:</strong> ${question.question_text}
                    <div style="margin-top: 8px; font-size: 0.9em; color: #7f8c8d;">
                        Odpowiedzi: ${totalAnswers} 
                        (poprawnych: ${correctAnswers})
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon-small" onclick="editQuestion(${index})">✏️ Edytuj</button>
                    <button class="btn-icon-small delete" onclick="deleteQuestion(${index})">🗑️ Usuń</button>
                </div>
            </div>
        `;

        container.appendChild(questionDiv);
    });
}

// Zapisanie testu
async function saveTest() {
    const title = document.getElementById('testTitle').value.trim();
    const description = document.getElementById('testDescription').value.trim();
    const duration = parseInt(document.getElementById('testDuration').value);
    const passingScore = parseInt(document.getElementById('testPassingScore').value);
    const isActive = document.getElementById('testActive').value === '1';

    if (!title) {
        alert('Wpisz tytuł testu!');
        return;
    }

    if (duration < 1) {
        alert('Czas trwania musi być większy niż 0!');
        return;
    }

    if (passingScore < 0 || passingScore > 100) {
        alert('Próg zaliczenia musi być między 0 a 100!');
        return;
    }

    // Sprawdź czy próbujemy aktywować test
    if (isActive) {
        try {
            const response = await fetch(`${API_URL}/admin/tests`);
            const allTests = await response.json();
            
            // Znajdź inny aktywny test (pomijając edytowany test)
            const otherActiveTest = allTests.find(t => t.is_active && t.id !== currentTestId);
            
            if (otherActiveTest) {
                const confirmDeactivate = confirm(
                    `Test "${otherActiveTest.title}" jest już aktywny.\n\n` +
                    `Tylko jeden test może być aktywny jednocześnie.\n` +
                    `Czy chcesz dezaktywować "${otherActiveTest.title}" i aktywować ten test?`
                );
                
                if (!confirmDeactivate) {
                    return;
                }
                
                // Dezaktywuj poprzedni aktywny test
                await fetch(`${API_URL}/admin/tests/${otherActiveTest.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: otherActiveTest.title,
                        description: otherActiveTest.description,
                        duration_minutes: otherActiveTest.duration_minutes,
                        passing_percentage: otherActiveTest.passing_percentage,
                        is_active: false
                    })
                });
            }
        } catch (error) {
            console.error('Błąd podczas sprawdzania aktywnych testów:', error);
            alert('Wystąpił błąd podczas sprawdzania aktywnych testów');
            return;
        }
    }

    try {
        let testId = currentTestId;

        // Zapisz podstawowe dane testu
        if (editMode && currentTestId) {
            // Aktualizacja istniejącego testu
            await fetch(`${API_URL}/admin/tests/${currentTestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description,
                    duration_minutes: duration,
                    passing_percentage: passingScore,
                    is_active: isActive
                })
            });
        } else {
            // Utworzenie nowego testu
            const response = await fetch(`${API_URL}/admin/tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description,
                    duration_minutes: duration,
                    passing_percentage: passingScore
                })
            });

            const data = await response.json();
            testId = data.id;
        }

        // Zapisz pytania i odpowiedzi
        for (const question of testData.questions) {
            if (question.id && !question._deleted) {
                // Aktualizacja istniejącego pytania
                await fetch(`${API_URL}/admin/questions/${question.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question_text: question.question_text,
                        question_order: question.question_order
                    })
                });

                // Zaktualizuj odpowiedzi
                if (question.answers) {
                    for (const answer of question.answers) {
                        if (answer.id && !answer._deleted) {
                            await fetch(`${API_URL}/admin/answers/${answer.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    answer_text: answer.answer_text,
                                    is_correct: answer.is_correct,
                                    answer_order: answer.answer_order
                                })
                            });
                        } else if (!answer.id && !answer._deleted) {
                            // Nowa odpowiedź
                            await fetch(`${API_URL}/admin/questions/${question.id}/answers`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    answer_text: answer.answer_text,
                                    is_correct: answer.is_correct,
                                    answer_order: answer.answer_order
                                })
                            });
                        } else if (answer._deleted && answer.id) {
                            // Usuń odpowiedź
                            await fetch(`${API_URL}/admin/answers/${answer.id}`, {
                                method: 'DELETE'
                            });
                        }
                    }
                }
            } else if (!question.id && !question._deleted) {
                // Nowe pytanie
                const questionResponse = await fetch(`${API_URL}/admin/tests/${testId}/questions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question_text: question.question_text,
                        question_order: question.question_order
                    })
                });

                const questionData = await questionResponse.json();
                const newQuestionId = questionData.id;

                // Dodaj odpowiedzi
                if (question.answers) {
                    for (const answer of question.answers) {
                        if (!answer._deleted) {
                            await fetch(`${API_URL}/admin/questions/${newQuestionId}/answers`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    answer_text: answer.answer_text,
                                    is_correct: answer.is_correct,
                                    answer_order: answer.answer_order
                                })
                            });
                        }
                    }
                }
            } else if (question._deleted && question.id) {
                // Usuń pytanie
                await fetch(`${API_URL}/admin/questions/${question.id}`, {
                    method: 'DELETE'
                });
            }
        }

        alert('Test został zapisany pomyślnie!');
        closeTestModal();
        loadTests();
    } catch (error) {
        console.error('Błąd podczas zapisywania testu:', error);
        alert('Wystąpił błąd podczas zapisywania testu');
    }
}

// Edycja testu
async function editTest(testId) {
    await openTestModal(testId);
}

// Usunięcie testu
async function deleteTest(testId) {
    if (!confirm('Czy na pewno chcesz usunąć ten test? Wszystkie powiązane pytania i sesje egzaminacyjne również zostaną usunięte.')) {
        return;
    }

    try {
        await fetch(`${API_URL}/admin/tests/${testId}`, {
            method: 'DELETE'
        });

        alert('Test został usunięty');
        loadTests();
    } catch (error) {
        console.error('Błąd podczas usuwania testu:', error);
        alert('Wystąpił błąd podczas usuwania testu');
    }
}

// ==================== ZARZĄDZANIE PYTANIAMI ====================

// Otwarcie modala pytania
function openQuestionModal(questionIndex = null) {
    const modal = document.getElementById('questionModal');
    const title = document.getElementById('questionModalTitle');

    if (questionIndex !== null) {
        // Tryb edycji
        currentQuestionId = questionIndex;
        const question = testData.questions[questionIndex];

        title.textContent = 'Edytuj pytanie';
        document.getElementById('questionText').value = question.question_text;
        document.getElementById('questionOrder').value = question.question_order || questionIndex + 1;

        renderAnswersList(question.answers || []);
    } else {
        // Tryb dodawania
        currentQuestionId = null;
        title.textContent = 'Dodaj pytanie';

        document.getElementById('questionText').value = '';
        document.getElementById('questionOrder').value = testData.questions.filter(q => !q._deleted).length + 1;

        renderAnswersList([]);
    }

    modal.classList.add('active');
}

// Zamknięcie modala pytania
function closeQuestionModal() {
    document.getElementById('questionModal').classList.remove('active');
}

// Renderowanie listy odpowiedzi
function renderAnswersList(answers = []) {
    const container = document.getElementById('answersList');

    const activeAnswers = answers.filter(a => !a._deleted);

    if (activeAnswers.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">Brak odpowiedzi. Dodaj przynajmniej jedną odpowiedź.</p>';
        container.dataset.answers = JSON.stringify([]);
        return;
    }

    container.innerHTML = '';
    container.dataset.answers = JSON.stringify(answers);

    activeAnswers.forEach((answer, index) => {
        const actualIndex = answers.indexOf(answer);
        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-item';

        answerDiv.innerHTML = `
            <div class="answer-item-header">
                <div class="answer-item-text">
                    ${answer.answer_text}
                    ${answer.is_correct ? '<span class="answer-correct-badge">POPRAWNA</span>' : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-icon-small" onclick="editAnswer(${actualIndex})">✏️ Edytuj</button>
                    <button class="btn-icon-small delete" onclick="deleteAnswer(${actualIndex})">🗑️ Usuń</button>
                </div>
            </div>
        `;

        container.appendChild(answerDiv);
    });
}

// Zapisanie pytania
function saveQuestion() {
    const text = document.getElementById('questionText').value.trim();
    const order = parseInt(document.getElementById('questionOrder').value);

    if (!text) {
        alert('Wpisz treść pytania!');
        return;
    }

    const container = document.getElementById('answersList');
    const answers = JSON.parse(container.dataset.answers || '[]');

    const activeAnswers = answers.filter(a => !a._deleted);

    if (activeAnswers.length < 2) {
        alert('Pytanie musi mieć przynajmniej 2 odpowiedzi!');
        return;
    }

    const correctAnswers = activeAnswers.filter(a => a.is_correct);
    if (correctAnswers.length === 0) {
        alert('Przynajmniej jedna odpowiedź musi być poprawna!');
        return;
    }

    const question = {
        question_text: text,
        question_order: order,
        answers: answers
    };

    if (currentQuestionId !== null) {
        // Edycja istniejącego pytania
        if (testData.questions[currentQuestionId].id) {
            question.id = testData.questions[currentQuestionId].id;
        }
        testData.questions[currentQuestionId] = question;
    } else {
        // Dodanie nowego pytania
        testData.questions.push(question);
    }

    renderQuestionsList();
    closeQuestionModal();
}

// Edycja pytania
function editQuestion(index) {
    openQuestionModal(index);
}

// Usunięcie pytania
function deleteQuestion(index) {
    if (!confirm('Czy na pewno chcesz usunąć to pytanie?')) return;

    if (testData.questions[index].id) {
        testData.questions[index]._deleted = true;
    } else {
        testData.questions.splice(index, 1);
    }

    renderQuestionsList();
}

// ==================== ZARZĄDZANIE ODPOWIEDZIAMI ====================

// Otwarcie modala odpowiedzi
function openAnswerModal(answerIndex = null) {
    const modal = document.getElementById('answerModal');
    const title = document.getElementById('answerModalTitle');

    if (answerIndex !== null) {
        // Tryb edycji
        currentAnswerIndex = answerIndex;
        const container = document.getElementById('answersList');
        const answers = JSON.parse(container.dataset.answers || '[]');
        const answer = answers[answerIndex];

        title.textContent = 'Edytuj odpowiedź';
        document.getElementById('answerText').value = answer.answer_text;
        document.getElementById('answerIsCorrect').checked = answer.is_correct;
    } else {
        // Tryb dodawania
        currentAnswerIndex = null;
        title.textContent = 'Dodaj odpowiedź';

        document.getElementById('answerText').value = '';
        document.getElementById('answerIsCorrect').checked = false;
    }

    modal.classList.add('active');
}

// Zamknięcie modala odpowiedzi
function closeAnswerModal() {
    document.getElementById('answerModal').classList.remove('active');
}

// Zapisanie odpowiedzi
function saveAnswer() {
    const text = document.getElementById('answerText').value.trim();
    const isCorrect = document.getElementById('answerIsCorrect').checked;

    if (!text) {
        alert('Wpisz treść odpowiedzi!');
        return;
    }

    const container = document.getElementById('answersList');
    const answers = JSON.parse(container.dataset.answers || '[]');

    if (currentAnswerIndex !== null) {
        // Edycja istniejącej odpowiedzi
        answers[currentAnswerIndex].answer_text = text;
        answers[currentAnswerIndex].is_correct = isCorrect;
    } else {
        // Dodanie nowej odpowiedzi
        answers.push({
            answer_text: text,
            is_correct: isCorrect,
            answer_order: answers.length + 1
        });
    }

    renderAnswersList(answers);
    closeAnswerModal();
}

// Edycja odpowiedzi
function editAnswer(index) {
    openAnswerModal(index);
}

// Usunięcie odpowiedzi
function deleteAnswer(index) {
    if (!confirm('Czy na pewno chcesz usunąć tę odpowiedź?')) return;

    const container = document.getElementById('answersList');
    const answers = JSON.parse(container.dataset.answers);

    if (answers[index].id) {
        answers[index]._deleted = true;
    } else {
        answers.splice(index, 1);
    }

    renderAnswersList(answers);
}

// ==================== SESJE EGZAMINACYJNE ====================

// Ładowanie sesji
async function loadSessions() {
    try {
        const response = await fetch(`${API_URL}/admin/sessions`);
        const sessions = await response.json();

        const container = document.getElementById('sessionsTable');

        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>Brak sesji egzaminacyjnych</h3>
                    <p>Sesje pojawią się tutaj gdy ktoś rozpocznie egzamin</p>
                </div>
            `;
            return;
        }

        // Wypełnij filtr testów
        const testFilter = document.getElementById('sessionTestFilter');
        const uniqueTests = [...new Set(sessions.map(s => s.test_title))];
        testFilter.innerHTML = '<option value="">Wszystkie testy</option>';
        uniqueTests.forEach(title => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            testFilter.appendChild(option);
        });

        // Wyrenderuj tabelę
        renderSessionsTable(sessions);

        // Dodaj listenery dla filtrów
        document.getElementById('sessionSearch').removeEventListener('input', filterSessions);
        document.getElementById('sessionTestFilter').removeEventListener('change', filterSessions);
        
        document.getElementById('sessionSearch').addEventListener('input', filterSessions);
        document.getElementById('sessionTestFilter').addEventListener('change', filterSessions);
    } catch (error) {
        console.error('Błąd podczas ładowania sesji:', error);
    }
}

// Renderowanie tabeli sesji
function renderSessionsTable(sessions) {
    const container = document.getElementById('sessionsTable');
    if (!container) return;

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Uczestnik</th>
                    <th>Email</th>
                    <th>Test</th>
                    <th>Data</th>
                    <th>Wynik</th>
                    <th>Czas</th>
                    <th>Akcje</th>
                </tr>
            </thead>
            <tbody>
                ${sessions.map(session => {
                    const threshold = session.passing_percentage || 60;
                    const score = Number(session.score_percentage) || 0;

                    // Logika kolorowania
                    const scoreClass = score >= 80 ? 'score-excellent' : 
                    score >= threshold ? 'score-passed' : 'score-failed';

                    const minutes = Math.floor(session.time_taken_seconds / 60);
                    const seconds = (session.time_taken_seconds % 60).toString().padStart(2, '0');

                    return `
                        <tr>
                            <td>${session.student_name}</td>
                            <td>${session.student_email}</td>
                            <td>${session.test_title}</td>
                            <td>${new Date(session.completed_at).toLocaleString('pl-PL')}</td>
                            <td>
                                <span class="score-badge ${scoreClass}">
                                    ${score.toFixed(2)}%
                                    (${session.correct_answers}/${session.total_questions})
                                </span>
                            </td>
                            <td>${minutes}:${seconds}</td>
                            <td>
                                <button class="btn btn-small btn-remove" onclick="removesession(${session.id})">Usuń</button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}
// Usuwanie sesji
async function removesession(sessionId) {
    if (!confirm('Czy na pewno chcesz usunąć tę sesję?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const data = await response.json();
            alert('Sesja została usunięta');
            loadSessions(); // Odświeżamy tabelę
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Nieznany błąd serwera' }));
            alert('Błąd: ' + errorData.error);
        }
    } catch (error) {
        console.error('Błąd połączenia:', error);
        alert('Wystąpił błąd podczas próby usunięcia sesji.');
    }
}
// Filtrowanie sesji
async function filterSessions() {
    const searchTerm = document.getElementById('sessionSearch').value.toLowerCase();
    const testFilter = document.getElementById('sessionTestFilter').value;

    try {
        const response = await fetch(`${API_URL}/admin/sessions`);
        let sessions = await response.json();

        // Filtruj po wyszukiwaniu
        if (searchTerm) {
            sessions = sessions.filter(s =>
                s.student_name.toLowerCase().includes(searchTerm) ||
                s.student_email.toLowerCase().includes(searchTerm)
            );
        }

        // Filtruj po teście
        if (testFilter) {
            sessions = sessions.filter(s => s.test_title === testFilter);
        }

        renderSessionsTable(sessions);
    } catch (error) {
        console.error('Błąd podczas filtrowania sesji:', error);
    }
}