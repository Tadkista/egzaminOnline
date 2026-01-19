const mysql = require('mysql2/promise');
const dbConfig = require('./db-config');

async function resetAdminPassword() {
    let connection;
    
    try {
        console.log('Łączenie z bazą danych...');
        connection = await mysql.createConnection(dbConfig);
        
        console.log('Sprawdzanie użytkowników admin...');
        
        // Sprawdź czy istnieje 'admin' lub 'Admin'
        const [admins] = await connection.query(
            'SELECT id, username, password_hash FROM admins WHERE LOWER(username) = ?',
            ['admin']
        );
        
        if (admins.length === 0) {
            console.log('⚠️  Użytkownik "admin" nie istnieje. Tworzę nowego...');
            await connection.query(
                'INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)',
                ['admin', 'admin@example.com', null]
            );
            console.log('✅ Utworzono użytkownika "admin"');
        } else {
            console.log('📋 Znaleziono użytkownika:');
            console.log('   ID:', admins[0].id);
            console.log('   Username:', admins[0].username);
            console.log('   Password_hash:', admins[0].password_hash ? 'Zahashowane (bcrypt)' : 'NULL (domyślne hasło)');
            
            // Jeśli username to 'Admin', zmień na 'admin'
            if (admins[0].username !== 'admin') {
                console.log('\n🔄 Zmieniam username z "' + admins[0].username + '" na "admin"...');
                await connection.query(
                    'UPDATE admins SET username = ? WHERE id = ?',
                    ['admin', admins[0].id]
                );
                console.log('✅ Username zaktualizowany');
            }
        }
        
        console.log('\n🔐 Resetowanie hasła do domyślnego...');
        const [result] = await connection.query(
            'UPDATE admins SET password_hash = NULL WHERE LOWER(username) = ?',
            ['admin']
        );
        
        if (result.affectedRows > 0) {
            console.log('✅ Hasło zostało zresetowane pomyślnie!');
            console.log('\n📌 Dane logowania:');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            console.log('\n⚠️  WAŻNE: Uruchom ponownie serwer (node server.js)');
        } else {
            console.log('⚠️  Nie udało się zresetować hasła');
        }
        
    } catch (error) {
        console.error('❌ Błąd:', error.message);
        console.error('\n💡 Sprawdź:');
        console.error('   1. Czy MySQL działa');
        console.error('   2. Czy plik db-config.js ma poprawne dane');
        console.error('   3. Czy baza danych "exam_system" istnieje');
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Rozłączono z bazą danych');
        }
    }
}

// Uruchom funkcję
resetAdminPassword();