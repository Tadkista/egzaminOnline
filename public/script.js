// Konfiguracja API
const API_URL = 'http://localhost:3000/api';

// Zmienne globalne
let currentQuestion = 0;
let userAnswers = [];
let studentName = '';
let studentEmail = '';
let startTime;
let timerInterval;
let timeRemaining = 1800;
let currentExamData = null;
let viewingHistoricalExam = false;
let currentTest = null;
let sessionToken = null;

// Inicjalizacja przy załadowaniu strony
document.addEventListener('DOMContentLoaded', function () {
    loadAvailableTests();
    setupEventListeners();
});

// Konfiguracja listenerów zdarzeń
function setupEventListeners() {
    const startExamBtn = document.getElementById('startExamBtn');
    if (startExamBtn) {
        startExamBtn.addEventListener('click', startExam);
    }

    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', previousQuestion);
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', nextQuestion);
    }

    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printResults);
    }

    const restartBtn = document.getElementById('restartBtn');
    if (restartBtn) {
        restartBtn.addEventListener('click', restartExam);
    }

    const showHistoryBtnStart = document.getElementById('showHistoryBtnStart');
    if (showHistoryBtnStart) {
        showHistoryBtnStart.addEventListener('click', showHistory);
    }

    const showHistoryBtnResults = document.getElementById('showHistoryBtnResults');
    if (showHistoryBtnResults) {
        showHistoryBtnResults.addEventListener('click', showHistory);
    }

    // Nawigacja klawiszem Enter
    document.addEventListener('keydown', function (e) {
        if (e.key == 'Enter') {
            if (document.querySelector('.exam-screen').classList.contains('active')) {
                e.preventDefault();
                const nextBtn = document.getElementById('nextBtn');
                if (nextBtn && !nextBtn.disabled) {
                    nextQuestion();
                }
            }
        }
    });
}

// Pobranie dostępnych testów
async function loadAvailableTests() {
    try {
        const response = await fetch(`${API_URL}/tests`);
        const tests = await response.json();

        if (tests.length > 0) {
            // Domyślnie ładujemy pierwszy aktywny test
            currentTest = tests[0];
            const testResponse = await fetch(`${API_URL}/tests/${currentTest.id}`);
            const testData = await testResponse.json();
            document.getElementById('totalQuestions').textContent = testData.questions.length || "Brak danych";
            document.getElementById('examDuration').textContent = testData.duration_minutes+" minut" || "Brak danych";
            document.getElementById('passingThreshold').textContent = currentTest.passing_percentage+ "%" || "Brak danych";
        }
    } catch (error) {
        console.error('Błąd podczas ładowania testów:', error);
    }
}

// Rozpoczęcie egzaminu
async function startExam() {
    studentName = document.getElementById('studentName').value.trim();
    studentEmail = document.getElementById('studentEmail').value.trim();

    if (!studentName || !studentEmail) {
        alert('Proszę wypełnić wszystkie pola!');
        return;
    }

    if (!currentTest) {
        alert('Brak dostępnych testów!');
        return;
    }

    try {
        // Pobranie szczegółów testu z pytaniami
        const testResponse = await fetch(`${API_URL}/tests/${currentTest.id}`);
        const testData = await testResponse.json();

        if (!testData.questions || testData.questions.length === 0) {
            alert('Ten test nie zawiera pytań!');
            return;
        }

        // Rozpoczęcie sesji egzaminacyjnej
        const sessionResponse = await fetch(`${API_URL}/sessions/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                testId: currentTest.id,
                studentName: studentName,
                studentEmail: studentEmail
            })
        });

        const sessionData = await sessionResponse.json();
        sessionToken = sessionData.sessionToken;

        // Przygotowanie danych egzaminu
        currentTest = testData;
        userAnswers = new Array(testData.questions.length).fill(null);
        viewingHistoricalExam = false;
        currentQuestion = 0;
        timeRemaining = testData.duration_minutes * 60;

        // Aktualizacja UI
        document.getElementById('totalQuestions').textContent = testData.questions.length;
        document.querySelector('.start-screen').classList.remove('active');
        document.querySelector('.exam-screen').classList.add('active');

        startTime = Date.now();
        startTimer();
        showQuestion();
    } catch (error) {
        console.error('Błąd podczas rozpoczynania egzaminu:', error);
        alert('Wystąpił błąd podczas rozpoczynania egzaminu. Spróbuj ponownie.');
    }
}

// Timer
function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        document.getElementById('timer').textContent = `${m}:${s < 10 ? '0' + s : s}`;

        if (timeRemaining <= 0) {
            finishExam();
        }
    }, 1000);
}

// Wyświetlenie pytania
function showQuestion() {
    const question = currentTest.questions[currentQuestion];

    document.getElementById('questionNumber').textContent = `Pytanie ${currentQuestion + 1} z ${currentTest.questions.length}`;
    document.getElementById('questionText').textContent = question.question_text;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    question.answers.forEach((answer, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'answer';
        input.id = `option${index}`;
        input.value = answer.id;

        if (userAnswers[currentQuestion] === answer.id) {
            input.checked = true;
            optionDiv.classList.add('selected');
        }

        input.addEventListener('change', function () {
            document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
            optionDiv.classList.add('selected');
            selectAnswer(answer.id);
        });

        const label = document.createElement('label');
        label.htmlFor = `option${index}`;
        label.className = 'option-label';
        label.textContent = answer.answer_text;

        optionDiv.appendChild(input);
        optionDiv.appendChild(label);
        optionsContainer.appendChild(optionDiv);

        optionDiv.addEventListener('click', function (e) {
            if (e.target !== input) {
                input.checked = true;
                input.dispatchEvent(new Event('change'));
            }
        });
    });

    updateProgress();
    updateNavigationButtons();
}

// Wybór odpowiedzi
async function selectAnswer(answerId) {
    userAnswers[currentQuestion] = answerId;

    // Zapisz odpowiedź na serwerze
    try {
        await fetch(`${API_URL}/sessions/${sessionToken}/answers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                questionId: currentTest.questions[currentQuestion].id,
                answerId: answerId
            })
        });
    } catch (error) {
        console.error('Błąd podczas zapisywania odpowiedzi:', error);
    }
}

// Aktualizacja paska postępu
function updateProgress() {
    const answeredCount = userAnswers.filter(a => a !== null).length;
    const percentage = (answeredCount / currentTest.questions.length) * 100;
    document.getElementById('progressBar').style.width = percentage + '%';
}

// Aktualizacja przycisków nawigacji
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.disabled = currentQuestion === 0;

    if (currentQuestion === currentTest.questions.length - 1) {
        nextBtn.textContent = 'Zakończ egzamin';
    } else {
        nextBtn.textContent = 'Następne';
    }
}

// Następne pytanie
function nextQuestion() {
    if (currentQuestion < currentTest.questions.length - 1) {
        currentQuestion++;
        showQuestion();
    } else {
        finishExam();
    }
}

// Poprzednie pytanie
function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion();
    }
}

// Zakończenie egzaminu
async function finishExam() {
    clearInterval(timerInterval);

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    try {
        // Wysłanie żądania zakończenia egzaminu do serwera
        const response = await fetch(`${API_URL}/sessions/${sessionToken}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timeTakenSeconds: timeTaken
            })
        });

        const results = await response.json();

        // Przygotowanie danych do wyświetlenia
        const examData = {
            id: Date.now(),
            studentName: studentName,
            studentEmail: studentEmail,
            date: new Date().toISOString(),
            score: results.scorePercentage,
            correctAnswers: results.correctAnswers,
            totalQuestions: results.totalQuestions,
            timeTaken: timeTaken,
            testTitle: currentTest.title,
            detailedResults: results.detailedResults
        };

        // Zapisz w localStorage dla historii
        saveExamToHistory(examData);

        // Wyświetl wyniki
        displayResults(examData);

    } catch (error) {
        console.error('Błąd podczas kończenia egzaminu:', error);
        alert('Wystąpił błąd podczas kończenia egzaminu. Spróbuj ponownie.');
    }
}

// Zapisanie egzaminu do historii
function saveExamToHistory(examData) {
    let history = JSON.parse(localStorage.getItem('examHistory') || '[]');
    history.unshift(examData);

    // Zachowaj tylko ostatnie 50 egzaminów
    if (history.length > 50) {
        history = history.slice(0, 50);
    }

    localStorage.setItem('examHistory', JSON.stringify(history));
}

// Wyświetlenie wyników
function displayResults(examData) {
    document.querySelector('.exam-screen').classList.remove('active');
    document.querySelector('.results-screen').classList.add('active');

    const scorePercentage = examData.score;
    const passed = scorePercentage >= (currentTest?.passing_percentage || 60);

    document.getElementById('scorePercentage').textContent = scorePercentage.toFixed(0) + '%';
    document.getElementById('resultName').textContent = examData.studentName;
    document.getElementById('resultEmail').textContent = examData.studentEmail;
    document.getElementById('correctAnswers').textContent = `${examData.correctAnswers} / ${examData.totalQuestions}`;
    document.getElementById('wrongAnswers').textContent = examData.totalQuestions - examData.correctAnswers;

    const minutes = Math.floor(examData.timeTaken / 60);
    const seconds = examData.timeTaken % 60;
    document.getElementById('timeTaken').textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;

    const resultMessage = document.getElementById('resultMessage');
    if (passed) {
        resultMessage.textContent = 'Gratulacje! Zdałeś egzamin!';
        resultMessage.style.color = '#27ae60';
    } else {
        resultMessage.textContent = 'Niestety, nie udało się zdać egzaminu.';
        resultMessage.style.color = '#e74c3c';
    }

    // Wyświetl przegląd odpowiedzi
    displayAnswerReview(examData.detailedResults);
}

// Wyświetlenie przeglądu odpowiedzi
function displayAnswerReview(detailedResults) {
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.innerHTML = '';

    detailedResults.forEach((result, index) => {
        const reviewDiv = document.createElement('div');
        reviewDiv.className = 'review-question';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'review-question-header';
        headerDiv.textContent = `Pytanie ${index + 1}`;
        reviewDiv.appendChild(headerDiv);

        const textDiv = document.createElement('div');
        textDiv.className = 'review-question-text';
        textDiv.textContent = result.questionText;
        reviewDiv.appendChild(textDiv);

        // Wyświetl wszystkie odpowiedzi
        result.allAnswers.forEach(answer => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'review-option';

            let optionText = answer.answer_text;

            // Oznacz poprawną odpowiedź
            if (answer.is_correct) {
                optionDiv.classList.add('correct');
                optionText += ' ';
                const correctLabel = document.createElement('span');
                correctLabel.className = 'review-label correct-answer';
                correctLabel.textContent = 'Poprawna';
                optionDiv.appendChild(document.createTextNode(optionText));
                optionDiv.appendChild(correctLabel);
            }
            // Oznacz odpowiedź użytkownika (jeśli niepoprawna)
            else if (result.userAnswerId === answer.id) {
                optionDiv.classList.add('incorrect');
                optionDiv.classList.add('user-answer');
                optionText += ' ';
                const yourLabel = document.createElement('span');
                yourLabel.className = 'review-label wrong-answer';
                yourLabel.textContent = 'Twoja odpowiedź';
                optionDiv.appendChild(document.createTextNode(optionText));
                optionDiv.appendChild(yourLabel);
            } else {
                optionDiv.textContent = optionText;
            }

            reviewDiv.appendChild(optionDiv);
        });

        reviewContainer.appendChild(reviewDiv);
    });
}

// Drukowanie wyników
function printResults() {
    const includeReview = document.getElementById('includeReview').checked;

    if (!includeReview) {
        document.querySelector('.answers-review').style.display = 'none';
    }

    window.print();

    if (!includeReview) {
        document.querySelector('.answers-review').style.display = 'block';
    }
}

// Restart egzaminu
function restartExam() {
    document.querySelector('.results-screen').classList.remove('active');
    document.querySelector('.start-screen').classList.add('active');

    document.getElementById('studentName').value = studentName;
    document.getElementById('studentEmail').value = studentEmail;

    currentQuestion = 0;
    userAnswers = [];
    sessionToken = null;
    currentTest = null;

    loadAvailableTests();
}

// Wyświetlenie historii
async function showHistory() {
    document.querySelector('.start-screen').classList.remove('active');
    document.querySelector('.exam-screen').classList.remove('active');
    document.querySelector('.results-screen').classList.remove('active');

    let historyScreen = document.querySelector('.history-screen');
    if (!historyScreen) {
        historyScreen = createHistoryScreen();
        document.querySelector('.content').appendChild(historyScreen);
    }

    historyScreen.classList.add('active');

    // Pobierz historię z serwera i localStorage
    await loadHistoryData();
    updateHistoryDisplay();
}

// Utworzenie ekranu historii
function createHistoryScreen() {
    const historyScreen = document.createElement('div');
    historyScreen.className = 'history-screen';
    historyScreen.innerHTML = `
        <h2>Historia egzaminów</h2>
        
        <div class="history-controls">
            <div class="sort-controls">
                <label for="sortBy">Sortuj według:</label>
                <select id="sortBy">
                    <option value="date-desc">Najnowsze</option>
                    <option value="date-asc">Najstarsze</option>
                    <option value="score-desc">Najlepsze wyniki</option>
                    <option value="score-asc">Najgorsze wyniki</option>
                </select>
            </div>
            
            <div class="group-controls">
                <label for="groupBy">Grupuj według:</label>
                <select id="groupBy">
                    <option value="none">Brak grupowania</option>
                    <option value="date">Data</option>
                    <option value="result">Wynik (zdane/niezdane)</option>
                </select>
            </div>
        </div>
        
        <div id="historyContainer"></div>
        
        <div class="action-buttons">
            <button class="btn btn-secondary view-history-btn" onclick="backToStart()">Powrót do startu</button>
        </div>
    `;

    const sortBy = historyScreen.querySelector('#sortBy');
    const groupBy = historyScreen.querySelector('#groupBy');

    sortBy.addEventListener('change', updateHistoryDisplay);
    groupBy.addEventListener('change', updateHistoryDisplay);

    return historyScreen;
}

// Załadowanie danych historii
async function loadHistoryData() {
    if (!studentEmail) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/history/${encodeURIComponent(studentEmail)}`);
        const serverHistory = await response.json();

        // Połącz z lokalną historią (usuń duplikaty)
        const localStorageHistory = JSON.parse(localStorage.getItem('examHistory') || '[]');
        const localFiltered = localStorageHistory.filter(local =>
            !serverHistory.some(server => server.id === local.id)
        );

        const combinedHistory = [...serverHistory, ...localFiltered];
        localStorage.setItem('examHistory', JSON.stringify(combinedHistory));
    } catch (error) {
        console.error('Błąd podczas ładowania historii z serwera:', error);
    }
}

// Aktualizacja wyświetlania historii
function updateHistoryDisplay() {
    const container = document.getElementById('historyContainer');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem('examHistory') || '[]');

    if (history.length === 0) {
        container.innerHTML = '<div class="no-history">Brak zapisanych egzaminów</div>';
        return;
    }

    const sortBy = document.getElementById('sortBy')?.value || 'date-desc';
    const groupBy = document.getElementById('groupBy')?.value || 'none';

    // Sortowanie
    let sortedHistory = [...history];
    switch (sortBy) {
        case 'date-desc':
            sortedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            sortedHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'score-desc':
            sortedHistory.sort((a, b) => b.score - a.score);
            break;
        case 'score-asc':
            sortedHistory.sort((a, b) => a.score - b.score);
            break;
    }

    container.innerHTML = '';

    // Grupowanie
    if (groupBy === 'none') {
        const grid = document.createElement('div');
        grid.className = 'history-grid';

        sortedHistory.forEach(exam => {
            grid.appendChild(createHistoryCard(exam));
        });

        container.appendChild(grid);
    } else if (groupBy === 'date') {
        const grouped = {};
        sortedHistory.forEach(exam => {
            const date = new Date(exam.date);
            const key = date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(exam);
        });

        Object.keys(grouped).forEach(key => {
            const header = document.createElement('div');
            header.className = 'history-group-header';
            header.textContent = key;
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'history-grid';
            grouped[key].forEach(exam => {
                grid.appendChild(createHistoryCard(exam));
            });
            container.appendChild(grid);
        });
    } else if (groupBy === 'result') {
        const passed = sortedHistory.filter(e => e.score >= 60);
        const failed = sortedHistory.filter(e => e.score < 60);

        if (passed.length > 0) {
            const header = document.createElement('div');
            header.className = 'history-group-header';
            header.textContent = 'Zdane';
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'history-grid';
            passed.forEach(exam => {
                grid.appendChild(createHistoryCard(exam));
            });
            container.appendChild(grid);
        }

        if (failed.length > 0) {
            const header = document.createElement('div');
            header.className = 'history-group-header';
            header.textContent = 'Niezdane';
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'history-grid';
            failed.forEach(exam => {
                grid.appendChild(createHistoryCard(exam));
            });
            container.appendChild(grid);
        }
    }
}
// Utworzenie karty historii
function createHistoryCard(exam) {
    console.log(exam); 
    const card = document.createElement('div');
    card.className = 'history-card';

    // Pobranie wartości z obiektu przesłanego z bazy
    const scoreValue = exam.score !== undefined ? Number(exam.score) : 0;
    const threshold = exam.passingThreshold !== undefined ? Number(exam.passingThreshold) : 60;

    const scoreClass = scoreValue >= 80 ? 'excellent' : 
    scoreValue >= threshold ? 'passed' : 'failed';

    card.innerHTML = `
        <div class="history-card-score ${scoreClass}">${scoreValue.toFixed(0)}%</div>
        <div class="history-card-name">${exam.studentName || 'Anonimowy uczestnik'}</div>
        <div class="history-card-date">${exam.date ? new Date(exam.date).toLocaleString('pl-PL') : 'Brak daty'}</div>
        <div class="history-card-details">
            ${exam.correctAnswers || 0}/${exam.totalQuestions || 0} poprawnych<br>
            <strong>${exam.testTitle || 'Egzamin'}</strong><br>
            <small>Próg zaliczenia: ${threshold}%</small>
        </div>
        <div class="history-card-actions">
            <button class="btn-icon btn-view" title="Zobacz szczegóły">👁️</button>
            <button class="btn-icon btn-delete" title="Usuń">🗑️</button>
        </div>
    `;

    // Obsługa zdarzeń
    const viewBtn = card.querySelector('.btn-view');
    const deleteBtn = card.querySelector('.btn-delete');

    if (viewBtn) {
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewExamDetails(exam.id);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteExam(exam.id);
        });
    }

    card.addEventListener('click', () => viewExamDetails(exam.id));

    return card;
}

// Wyświetlenie szczegółów egzaminu z historii
function viewExamDetails(examId) {
    const history = JSON.parse(localStorage.getItem('examHistory') || '[]');
    const exam = history.find(e => e.id == examId);

    if (!exam) {
        alert('Nie znaleziono egzaminu');
        return;
    }

    currentExamData = exam;
    viewingHistoricalExam = true;

    document.querySelector('.history-screen').classList.remove('active');
    displayResults(exam);
}

// Usunięcie egzaminu z historii
function deleteExam(examId) {
    if (!confirm('Czy na pewno chcesz usunąć ten egzamin?')) return;

    let history = JSON.parse(localStorage.getItem('examHistory') || '[]');
    history = history.filter(e => e.id !== examId);
    localStorage.setItem('examHistory', JSON.stringify(history));

    updateHistoryDisplay();
}

// Powrót do ekranu startowego
function backToStart() {
    document.querySelector('.history-screen').classList.remove('active');
    document.querySelector('.results-screen').classList.remove('active');
    document.querySelector('.start-screen').classList.add('active');
}
