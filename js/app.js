const app = document.getElementById('app');

// --- ЗАЩИТА 0: Пароль (можно менять здесь) ---
const APP_PASSWORD = 'Книга2026';

// Глобальное состояние приложения (с версионностью для будущих обновлений)
let state = {
    version: 1.7,
    view: 'upload',
    chapters: [],
    currentChapter: 0,
    maxUnlockedChapter: 0,
    goal: '',
    userData: {}, 
    review: '', 
    feedback: '',
    scrollMemory: 0,
    lastReadChapter: 0,
    lastReadScroll: 0,
    bookmarks: [], 
    tocReturnView: 'chapter', 
    library: [] 
};

// --- ЗАЩИТА 0.1: Экран блокировки ---
function checkPassword() {
    // Если уже авторизованы в этой сессии — сразу запускаем приложение
    if (sessionStorage.getItem('bookAuth') === 'true') {
        init();
        return;
    }

    // Защита от повторного создания оверлея
    if (document.getElementById('password-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'password-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #f9f7f1; display: flex; flex-direction: column;
        align-items: center; justify-content: center; z-index: 9999;
        font-family: inherit; padding: 20px; box-sizing: border-box;
    `;
    overlay.innerHTML = `
        <div style="max-width: 400px; width: 100%; text-align: center;">
            <h1 style="color: #245b47; margin-bottom: 10px;">🔒 Доступ закрыт</h1>
            <p style="color: #666; margin-bottom: 25px;">Введите пароль, чтобы открыть книгу</p>
            <input type="password" id="password-input" placeholder="Пароль" autocomplete="off"
                   style="width: 100%; padding: 14px; font-size: 16px; border: 1px solid #ccc; border-radius: 12px; margin-bottom: 15px; box-sizing: border-box;">
            <button id="password-submit" style="width: 100%; padding: 14px; background: #245b47; color: white; border: none; border-radius: 12px; font-size: 16px; cursor: pointer;">Войти</button>
            <p id="password-error" style="color: #a43d2b; margin-top: 15px; min-height: 20px;"></p>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('password-input');
    const submit = document.getElementById('password-submit');
    const error = document.getElementById('password-error');

    const tryLogin = () => {
        if (input.value === APP_PASSWORD) {
            sessionStorage.setItem('bookAuth', 'true');
            overlay.remove();
            init();
        } else {
            error.textContent = 'Неверный пароль. Попробуйте ещё раз.';
            input.value = '';
            input.focus();
        }
    };

    submit.addEventListener('click', tryLogin);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryLogin();
    });
    input.focus();
}

// --- ЗАЩИТА 1: Безопасный парсинг данных ---
function init() {
    const saved = localStorage.getItem('bookAppState');
    if (saved) {
        try { 
            const parsedData = JSON.parse(saved); 
            state = { ...state, ...parsedData }; 
            
            if (state.chapters && state.chapters.length > 0) document.getElementById('toc-btn').style.display = 'block';
            if (!state.bookmarks) state.bookmarks = [];
            if (!state.library) state.library = [];
            if (!state.tocReturnView) state.tocReturnView = 'chapter';

            if (state.view === 'chapter' && state.lastReadChapter !== undefined) {
                state.currentChapter = state.lastReadChapter;
                state.scrollMemory = state.lastReadScroll || 0;
            }
        } catch (e) { 
            console.error("Критическая ошибка загрузки данных. Сброс состояния.", e); 
            alert("Произошла ошибка при загрузке сохранений. Попробуем начать заново.");
            localStorage.removeItem('bookAppState');
            state.view = 'upload';
        }
    }
    render();
}

// --- ЗАЩИТА 2: Безопасное сохранение (защита от переполнения памяти) ---
function save() {
    try {
        localStorage.setItem('bookAppState', JSON.stringify(state));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("⚠️ Хранилище браузера переполнено! Пожалуйста, удалите старые книги из Библиотеки, чтобы освободить место.");
        } else {
            console.error("Ошибка сохранения:", e);
        }
    }
}

// Автосохранение при скролле (с защитой от переключения контекста)
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (state.view === 'chapter') {
        const chapterAtScrollStart = state.currentChapter;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (state.view === 'chapter' && state.currentChapter === chapterAtScrollStart) {
                state.lastReadChapter = state.currentChapter;
                state.lastReadScroll = window.scrollY;
                save();
            }
        }, 500); 
    }
});

window.addEventListener('beforeunload', () => {
    if (state.view === 'chapter') {
        state.lastReadChapter = state.currentChapter;
        state.lastReadScroll = window.scrollY;
        save();
    }
});

window.toggleToc = function() {
    if (state.view === 'toc') {
        const returnView = state.tocReturnView || 'chapter';
        go(returnView);
    } else {
        state.tocReturnView = state.view;
        if (state.view === 'chapter') {
            state.scrollMemory = window.scrollY;
            state.lastReadChapter = state.currentChapter;
            state.lastReadScroll = window.scrollY;
        }
        go('toc');
    }
}

function go(view) {
    if (state.view === 'chapter' && view === 'toc') {
        state.scrollMemory = window.scrollY;
        state.lastReadChapter = state.currentChapter;
        state.lastReadScroll = window.scrollY;
    }
    
    state.view = view;
    save();
    
    const appDiv = document.getElementById('app');
    appDiv.style.opacity = '0';
    appDiv.style.transition = 'opacity 0.2s ease';
    
    setTimeout(() => {
        render(); 
        appDiv.style.opacity = '1';
        
        setTimeout(() => {
            if (view === 'chapter' && state.scrollMemory) {
                window.scrollTo(0, state.scrollMemory);
                state.scrollMemory = 0; 
                save(); 
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 50); 
    }, 200);
}

function esc(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getCurData() {
    if (!state.userData[state.currentChapter]) {
        state.userData[state.currentChapter] = {
            note: '', idea: '', link: '', task: '', date: '', criterion: '', done: false, report: '', lesson: ''
        };
    }
    return state.userData[state.currentChapter];
}

function field(key, title, placeholder = '', type = 'area') {
    const isGlobal = ['goal', 'review', 'feedback'].includes(key);
    const val = isGlobal ? state[key] : getCurData()[key];

    return `<label>${title}</label>
    ${type === 'area' 
        ? `<textarea oninput="updateState('${key}', this.value)" placeholder="${placeholder}">${esc(val)}</textarea>`
        : `<input type="${type}" value="${esc(val)}" oninput="updateState('${key}', this.value)" placeholder="${placeholder}">`
    }`;
}

window.updateState = function(key, val) {
    const isGlobal = ['goal', 'review', 'feedback'].includes(key);
    if (isGlobal) {
        state[key] = val;
    } else {
        getCurData()[key] = val;
    }
    save();
}

// --- ЗАЩИТА 3: Безопасный переход по главам (проверка границ) ---
window.goToChapter = function(idx) {
    const total = state.chapters.length;
    if (idx < 0 || idx >= total) return;
    state.currentChapter = idx;
    state.scrollMemory = 0; 
    go('chapter');
}

// --- ЗАЩИТА 4: Валидация загружаемого файла ---
window.handleFileUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
        alert("Файл слишком большой. Для MVP мы поддерживаем файлы до 2 МБ.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        if (!content || content.trim().length === 0) {
            alert("Файл пуст или не содержит текста.");
            return;
        }

        let chapters = content.split('---').map(c => c.trim()).filter(c => c.length > 0);
        if (chapters.length === 0) chapters = [content.trim()];

        state.chapters = chapters;
        state.currentChapter = 0;
        state.maxUnlockedChapter = 0;
        state.userData = {}; 
        state.scrollMemory = 0;
        state.bookmarks = []; 
        
        document.getElementById('toc-btn').style.display = 'block';
        go('goal');
    };
    reader.onerror = function() {
        alert("Ошибка при чтении файла. Возможно, он поврежден.");
    };
    reader.readAsText(file);
}

window.resetApp = function() {
    if (confirm('Вы уверены? Весь прогресс текущей книги будет удален (библиотека сохранится).')) {
        state.view = 'upload';
        state.chapters = [];
        state.currentChapter = 0;
        state.maxUnlockedChapter = 0;
        state.goal = '';
        state.userData = {}; 
        state.review = ''; 
        state.feedback = '';
        state.scrollMemory = 0;
        state.lastReadChapter = 0;
        state.lastReadScroll = 0;
        state.bookmarks = []; 
        
        document.getElementById('toc-btn').style.display = 'none';
        save();
        go('upload');
    }
}

window.exportData = function() {
    let text = `=== МОЙ КОНСПЕКТ ===\n`;
    text += `Цель: ${state.goal || 'Не указана'}\n\n`;
    let hasData = false;
    for (let i = 0; i < state.chapters.length; i++) {
        const data = state.userData[i];
        if (data && (data.note || data.report || data.idea)) {
            hasData = true;
            text += `--- ГЛАВА ${i + 1} ---\n`;
            if(data.note) text += `📝 Заметка: ${data.note}\n`;
            if(data.idea) text += `💡 Осмысление: ${data.idea}\n`;
            if(data.task) text += `🎯 Задача: ${data.task} (до ${data.date})\n`;
            if(data.report) text += `✅ Отчет: ${data.report}\n`;
            if(data.lesson) text += `🏆 Вывод: ${data.lesson}\n`;
            text += `\n`;
        }
    }
    if (!hasData) {
        alert("Вы еще не написали ни одной заметки или отчета.");
        return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Мой_конспект_книги.txt';
    a.click();
    URL.revokeObjectURL(url);
};

window.addBookmark = function() {
    const currentScroll = window.scrollY;
    const currentChapter = state.currentChapter;
    if (!state.chapters[currentChapter]) return;

    const textSnippet = state.chapters[currentChapter].substring(0, 25).replace(/\n/g, ' ').trim() + '...';
    const label = `Глава ${currentChapter + 1}: ${textSnippet}`;
    
    const exists = state.bookmarks.some(b => b.chapter === currentChapter && Math.abs(b.scroll - currentScroll) < 50);
    if (exists) return; 
    
    state.bookmarks.push({ chapter: currentChapter, scroll: currentScroll, label: label });
    save();
    render(); 
};

window.removeCurrentBookmark = function() {
    const currentScroll = window.scrollY;
    const currentChapter = state.currentChapter;
    const index = state.bookmarks.findIndex(b => b.chapter === currentChapter && Math.abs(b.scroll - currentScroll) < 50);
    if (index !== -1) {
        state.bookmarks.splice(index, 1);
        save();
        render();
    }
};

window.removeBookmark = function(index) {
    state.bookmarks.splice(index, 1);
    save();
    render();
};

window.goToBookmark = function(index) {
    const bm = state.bookmarks[index];
    if (bm && bm.chapter >= 0 && bm.chapter < state.chapters.length) {
        state.currentChapter = bm.chapter;
        state.scrollMemory = bm.scroll; 
        go('chapter');
    }
};

window.saveToLibrary = function() {
    if (!state.goal) {
        alert("Пожалуйста, укажите цель перед сохранением.");
        return;
    }
    
    const bookSnapshot = {
        id: Date.now(),
        title: state.goal || "Книга без названия",
        date: new Date().toLocaleDateString(),
        chapters: state.chapters,
        userData: state.userData,
        bookmarks: state.bookmarks,
        goal: state.goal,
        review: state.review,
        maxUnlockedChapter: state.maxUnlockedChapter
    };
    
    state.library.push(bookSnapshot);
    
    state.view = 'upload';
    state.chapters = [];
    state.currentChapter = 0;
    state.maxUnlockedChapter = 0;
    state.goal = '';
    state.userData = {}; 
    state.review = ''; 
    state.feedback = '';
    state.scrollMemory = 0;
    state.lastReadChapter = 0;
    state.lastReadScroll = 0;
    state.bookmarks = [];
    document.getElementById('toc-btn').style.display = 'none';
    
    save();
    render();
};

window.loadFromLibrary = function(idx) {
    const book = state.library[idx];
    if (!book) return;
    
    if (!book.chapters || book.chapters.length === 0) {
        alert("Эта книга повреждена и не может быть загружена.");
        return;
    }

    state.chapters = book.chapters;
    state.userData = book.userData || {};
    state.bookmarks = book.bookmarks || [];
    state.goal = book.goal || '';
    state.review = book.review || '';
    state.maxUnlockedChapter = book.maxUnlockedChapter || (book.chapters.length - 1);
    
    state.currentChapter = 0; 
    
    state.view = 'toc'; 
    state.tocReturnView = 'chapter';
    
    document.getElementById('toc-btn').style.display = 'block';
    save();
    render();
};

window.deleteFromLibrary = function(idx) {
    if (confirm('Удалить эту книгу из библиотеки?')) {
        state.library.splice(idx, 1);
        save();
        render();
    }
};

function render() {
    let html = '';
    const total = state.chapters.length;
    
    const safeChapterIndex = Math.max(0, Math.min(state.currentChapter, total)); 
    const progress = total > 0 ? Math.round((safeChapterIndex / total) * 100) : 0;
    
    const data = getCurData();

    if (state.view === 'upload') {
        let libraryHtml = '';
        if (state.library && state.library.length > 0) {
            libraryHtml = `<div style="margin-top: 30px;"><h3>📚 Моя библиотека</h3>`;
            state.library.forEach((book, idx) => {
                libraryHtml += `
                    <div class="card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 12px;">
                        <div onclick="loadFromLibrary(${idx})" style="cursor: pointer; flex-grow: 1;">
                            <strong>${esc(book.title)}</strong><br>
                            <small class="muted">Сохранено: ${book.date}</small>
                        </div>
                        <span onclick="deleteFromLibrary(${idx})" style="cursor: pointer; color: #a43d2b; font-size: 20px; padding: 0 10px;" title="Удалить из библиотеки">✖</span>
                    </div>
                `;
            });
            libraryHtml += `</div>`;
        }

        html = `
            <div class="cover">
                <small>ТРЕНАЖЕР ЧТЕНИЯ</small>
                <h1>Сначала понять.<br>Потом применить.</h1>
                <p>Загрузите книгу, чтобы начать путь.</p>
            </div>
            <div class="card">
                <h2>Загрузите свою книгу (.txt)</h2>
                <p class="muted">Разделяйте главы тремя дефисами (---) в файле.</p>
                <div class="file-upload">
                    <input type="file" accept=".txt" onchange="handleFileUpload(event)" style="border:none; background:transparent;">
                </div>
            </div>
            ${libraryHtml}
        `;
    }

    if (state.view === 'toc') {
        let list = '';
        state.chapters.forEach((ch, idx) => {
            const isUnlocked = idx <= state.maxUnlockedChapter;
            const isCurrent = idx === state.currentChapter;
            list += `
            <div class="card" style="opacity: ${isUnlocked ? 1 : 0.5}; margin-bottom: 10px; cursor: ${isUnlocked ? 'pointer' : 'default'}; border: ${isCurrent ? '2px solid #245b47' : 'none'}; animation-delay: ${idx * 0.05}s;" 
                 onclick="${isUnlocked ? `goToChapter(${idx})` : ''}">
                <h3 style="margin:0;">${isUnlocked ? '📖' : '🔒'} Глава ${idx + 1}</h3>
                <p class="muted" style="margin-top:5px;">${isCurrent ? 'Текущая глава' : (isUnlocked ? 'Доступна' : 'Закрыта')}</p>
            </div>`;
        });
        
        let bookmarksHtml = '';
        if (state.bookmarks.length > 0) {
            bookmarksHtml = `<div style="margin-top: 25px;"><h3>🔖 Мои закладки</h3>`;
            state.bookmarks.forEach((bm, idx) => {
                bookmarksHtml += `
                    <div class="card" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 12px;">
                        <span onclick="goToBookmark(${idx})" style="cursor: pointer; flex-grow: 1; font-size: 15px;">
                            ${esc(bm.label)}
                        </span>
                        <span onclick="removeBookmark(${idx})" style="cursor: pointer; color: #a43d2b; font-size: 20px; padding: 0 10px;" title="Удалить закладку">✖</span>
                    </div>
                `;
            });
            bookmarksHtml += `</div>`;
        }

        html = `
            <h1>Оглавление</h1>
            ${list}
            ${bookmarksHtml}
            
            <button onclick="go('${state.tocReturnView || 'chapter'}')" class="secondary" style="margin-top:20px;">Вернуться назад</button>
            
            <button onclick="exportData()" class="secondary" style="margin-top:20px; color: #245b47; border: 1px solid #245b47; background: transparent;">
                📥 Скачать мой конспект
            </button>

            <button onclick="resetApp()" class="secondary" style="margin-top:10px; color: #a43d2b; border: 1px solid #a43d2b; background: transparent;">
                🗑️ Сбросить прогресс
            </button>
        `;
    }

    if (state.view === 'goal') {
        html = `
            <p class="muted">Подготовка к чтению</p>
            <h1>Зачем тебе эта книга?</h1>
            <div class="card">
                <p class="muted">Задания будут связаны с твоей реальной жизнью.</p>
                ${field('goal', 'Моя текущая цель', 'Что хочешь изменить или внедрить?')}
                <button onclick="if(state.goal.length < 5) return alert('Напишите цель подробнее'); go('chapter')">Начать чтение</button>
            </div>
        `;
    }

    if (state.view === 'chapter') {
        if (state.currentChapter < 0 || state.currentChapter >= total) {
            state.currentChapter = Math.max(0, total - 1);
            if (total === 0) { go('upload'); return; }
        }

        const text = state.chapters[state.currentChapter] || "Текст главы не найден.";
        const currentScroll = window.scrollY;
        const isBookmarkedHere = state.bookmarks.some(b => b.chapter === state.currentChapter && Math.abs(b.scroll - currentScroll) < 50);
        
        html = `
            <p class="muted">Глава ${state.currentChapter + 1} из ${total} · Чтение</p>
            <progress value="${progress}" max="100"></progress>
            
            <div style="text-align: right; margin-bottom: -10px; position: relative; z-index: 10;">
                <span onclick="${isBookmarkedHere ? 'removeCurrentBookmark()' : 'addBookmark()'}" style="cursor: pointer; font-size: 24px; user-select: none;" title="${isBookmarkedHere ? 'Удалить закладку здесь' : 'Поставить закладку здесь'}">
                    ${isBookmarkedHere ? '🔖' : '📑'}
                </span>
            </div>

            <div class="card reading">${esc(text).replace(/\n/g, '<br><br>')}</div>
            ${field('note', 'Моя заметка', 'Что показалось важным?')}
            <button onclick="go('reflect')">Прочитано → осмыслить</button>
        `;
    }

    if (state.view === 'reflect') {
        html = `
            <p class="muted">Глава ${state.currentChapter + 1} · Осмысление</p>
            <h1>Что ты забираешь с собой?</h1>
            <div class="card">
                ${field('idea', 'Основная мысль своими словами', 'О чем эта глава?')}
                ${field('link', 'Как это связано с моей целью?', 'Где это пригодится?')}
                <button onclick="if(!getCurData().idea || !getCurData().link) return alert('Заполните оба поля'); go('task')">Сформулировать действие</button>
            </div>
            <button class="secondary" onclick="go('chapter')">Вернуться к тексту</button>
        `;
    }

    if (state.view === 'task') {
        html = `
            <p class="muted">Глава ${state.currentChapter + 1} · Практика</p>
            <h1>Одна конкретная задача</h1>
            <div class="card">
                ${field('task', 'Что я сделаю?', 'Конкретное действие')}
                ${field('date', 'До какого дня?', '', 'date')}
                ${field('criterion', 'Как пойму, что задача выполнена?', 'Критерий успеха')}
                <button onclick="if(!getCurData().task || !getCurData().date || !getCurData().criterion) return alert('Заполните все поля'); go('locked')">Сохранить задачу</button>
            </div>
            <button class="secondary" onclick="go('reflect')">Назад</button>
        `;
    }

    if (state.view === 'locked') {
        html = `
            <p class="muted">Мой маршрут</p>
            <h1>Сначала — действие</h1>
            <div class="card">
                <span class="pill">ГЛАВА ${state.currentChapter + 1} · ЗАДАЧА</span>
                <h2>${esc(data.task)}</h2>
                <p>Срок: ${esc(data.date)}</p>
                <p class="muted">Критерий: ${esc(data.criterion)}</p>
                <button onclick="go('report')">Заполнить отчёт</button>
            </div>
            <div class="card" style="opacity: 0.6;">
                <h2>🔒 Глава ${state.currentChapter + 2}</h2>
                <p>Закрыта. Выполните задачу и сдайте отчет, чтобы продолжить.</p>
                <button disabled>Читать главу ${state.currentChapter + 2}</button>
            </div>
        `;
    }

    if (state.view === 'report') {
        html = `
            <p class="muted">Глава ${state.currentChapter + 1} · Отчёт</p>
            <h1>Что получилось на практике?</h1>
            <div class="card">
                <p>${esc(data.task)}</p>
                <label style="display:flex; gap:10px; align-items:center; margin-bottom:15px;">
                    <input type="checkbox" style="width:20px; margin:0;" ${data.done ? 'checked' : ''} onchange="updateState('done', this.checked)">
                    Я выполнил задачу
                </label>
                ${field('report', 'Что сделал и какой результат?', 'Опишите факты')}
                ${field('lesson', 'Какой вывод я делаю?', 'Что изменю в следующий раз?')}
                <button onclick="
                    const d = getCurData();
                    if(!d.done) return alert('Подтвердите выполнение');
                    if(!d.report || !d.lesson) return alert('Заполните поля отчета');
                    
                    if (state.currentChapter >= state.maxUnlockedChapter) {
                        state.maxUnlockedChapter = state.currentChapter + 1;
                    }
                    state.currentChapter++;
                    go('success');
                ">Завершить этап → Открыть следующую</button>
            </div>
        `;
    }

    if (state.view === 'success') {
        const isFinished = state.currentChapter >= total;
        const prevData = state.userData[state.currentChapter - 1] || { lesson: '' };
        
        html = `
            <div class="success" style="margin-top:28px">
                <span class="pill">ЭТАП ЗАВЕРШЁН</span>
                <h1>Ты не просто прочитал.<br>Ты применил.</h1>
            </div>
            <div class="card">
                <h2>Мой вывод</h2>
                <p>${esc(prevData.lesson)}</p>
            </div>
            <button onclick="
                if(${isFinished}) { go('review'); } 
                else { go('chapter'); }
            ">${isFinished ? 'Завершить книгу' : 'Читать следующую главу'}</button>
        `;
    }

    if (state.view === 'review') {
        html = `
            <h1>Книга прочитана!</h1>
            <div class="card">
                ${field('review', 'Ваша рецензия на книгу', 'Кому она пригодится?')}
                ${field('feedback', 'Отзыв о тренажере', 'Что понравилось, что улучшить?')}
                <button onclick="if(!state.review) return alert('Напишите рецензию'); go('end')">Завершить</button>
            </div>
        `;
    }

    if (state.view === 'end') {
        html = `
            <div class="success">
                <h1>Результат остался.</h1>
                <p>Спасибо за работу!</p>
            </div>
            <div class="card">
                <h2>Твоя цель была:</h2>
                <p>${esc(state.goal)}</p>
            </div>
            
            <button onclick="saveToLibrary()" style="margin-bottom: 15px;">📚 Сохранить в библиотеку</button>
            
            <button onclick="resetApp()" class="secondary" style="color: #a43d2b; border: 1px solid #a43d2b; background: transparent;">
                🗑️ Удалить и начать новую
            </button>
        `;
    }

    app.innerHTML = html;
}

// --- ЗАПУСК: сначала проверка пароля, потом init() ---
checkPassword();