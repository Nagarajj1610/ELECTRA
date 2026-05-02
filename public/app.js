// GLOBAL STATE
let chatInput, sendBtn, chatMessages;
let currentLang = localStorage.getItem('lang') || 'en';
let chatHistory = [];
let exploredTopics = JSON.parse(localStorage.getItem('exploredTopics') || '[]');

const guidedSteps = ["What is an election?", "Who can vote?", "How to register?", "Finding booth", "Documents needed", "Using EVM", "VVPAT", "NOTA", "Results", "Myths"];
let currentStep = -1;

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    chatMessages = document.getElementById('chat-messages');

    if(sendBtn) sendBtn.onclick = handleChat;
    if(chatInput) chatInput.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); handleChat(); } };

    // Accessibility & CSP: Attach listeners (removing inline onclick)
    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) langBtn.onclick = toggleLanguage;

    document.querySelectorAll('nav[role="tablist"] [role="tab"]').forEach(tab => {
        tab.onclick = () => switchTab(tab.id.replace('tab-', ''));
    });

    const onboardFirst = document.getElementById('onboarding-first-voter');
    const onboardProc = document.getElementById('onboarding-process');
    if (onboardFirst) onboardFirst.onclick = () => startOnboarding('I am a first-time voter');
    if (onboardProc) onboardProc.onclick = () => startOnboarding('I want to understand the process');

    const guideBtn = document.getElementById('guided-journey-btn');
    if (guideBtn) guideBtn.onclick = startGuidedJourney;

    document.querySelectorAll('.chip-action').forEach(chip => {
        chip.onclick = () => sendQuickChip(chip.dataset.chip);
    });

    const startQuizBtn = document.getElementById('start-quiz-btn');
    if (startQuizBtn) startQuizBtn.onclick = () => startQuiz('Voting');

    const historyBtn = document.getElementById('toggle-history-btn');
    if (historyBtn) historyBtn.onclick = () => alert('History feature coming soon!');

    // Eligibility form
    const eligForm = document.getElementById('eligibility-form');
    if (eligForm) {
        eligForm.onsubmit = async (e) => {
            e.preventDefault();
            const res = await fetch('/api/eligibility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: document.getElementById('el-state').value,
                    age: document.getElementById('el-age').value,
                    citizenship: document.getElementById('el-citizenship').value
                })
            });
            const data = await res.json();
            const resultDiv = document.getElementById('eligibility-result');
            resultDiv.innerHTML = `<div class="p-4 rounded-2xl ${data.eligible ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}">
                <div class="font-bold mb-2">${data.eligible ? '✓ Eligible' : '✕ Not Eligible'}</div>
                <div class="text-sm">${data.reason}</div>
                ${data.eligible ? `<a href="${data.voterIdLink}" target="_blank" class="block mt-4 text-xs font-bold underline">Register Now on ECI Portal</a>` : ''}
            </div>`;
            resultDiv.classList.remove('hidden');
        };
    }

    checkOnboarding();
    updateProgress();
    const mythFab = document.getElementById('myth-fab');
    const mythModal = document.getElementById('myth-modal');
    const closeMyth = document.getElementById('close-myth');
    const mythInput = document.getElementById('myth-input');

    if (mythFab) {
        mythFab.onclick = () => {
            mythModal.classList.remove('hidden');
            if (mythInput) mythInput.focus();
        };
    }
    if (closeMyth) {
        closeMyth.onclick = () => {
            mythModal.classList.add('hidden');
            if (mythFab) mythFab.focus();
        };
    }

    // Escape key listener for modal
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape' && !mythModal.classList.contains('hidden')) {
            mythModal.classList.add('hidden');
            if (mythFab) mythFab.focus();
        }
    });
});

async function handleChat() {
    const text = chatInput.value.trim();
    if(!text) return;
    
    addMessage('user', text);
    chatInput.value = '';
    
    const typing = document.createElement('div');
    typing.className = 'text-[10px] text-gray-400 ml-4 animate-pulse';
    typing.innerText = 'ELECTRA is thinking...';
    chatMessages.appendChild(typing);
    scrollToBottom();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory, message: text, language: currentLang })
        });
        
        if (typing.parentNode) chatMessages.removeChild(typing);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let electraMsg = '';
        const bubble = addMessage('electra', '');
        
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        electraMsg += parsed.text;
                        bubble.innerHTML = formatText(electraMsg);
                        scrollToBottom();
                    } catch(e) {}
                }
            }
        }
        chatHistory.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: electraMsg }] });
    } catch (error) {
        if (typing.parentNode) chatMessages.removeChild(typing);
        addMessage('electra', 'Connection error. Please try again.');
    }
}

function addMessage(sender, text) {
    if (!chatMessages) return null;
    const div = document.createElement('div');
    div.className = `flex w-full ${sender === 'user' ? 'justify-end' : 'justify-start'} fade-in mb-4`;
    const bubble = document.createElement('div');
    bubble.className = sender === 'user' ? 'bubble-user' : 'bubble-electra';
    bubble.classList.add('max-w-[85%]');
    bubble.innerHTML = formatText(text);
    div.appendChild(bubble);
    chatMessages.appendChild(div);
    scrollToBottom();
    return bubble;
}

function scrollToBottom() {
    const main = document.getElementById('main-content');
    if(main) main.scrollTop = main.scrollHeight;
}

function formatText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-navy">$1</span>')
                .replace(/\n/g, '<br>');
}

function sendQuickChip(text) { 
    if(chatInput) { chatInput.value = text; handleChat(); }
}

function switchTab(tabId) {
    document.querySelectorAll('section[id^="content-"]').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`content-${tabId}`);
    if(target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    
    const tabBtn = document.getElementById(`tab-${tabId}`);
    if(tabBtn) {
        tabBtn.classList.add('active');
        tabBtn.setAttribute('aria-selected', 'true');
    }
    
    if(tabId === 'timeline') loadTimeline();
    if(tabId === 'maps' && !map) initMap();
}

let map;
/**
 * Initializes Google Maps using the embedded API key from data attributes.
 */
async function initMap() {
    try {
        const appData = document.getElementById('app-data');
        const key = appData ? appData.dataset.mapsKey : '';
        if (!key || key.startsWith('__')) {
            console.warn('Maps key not replaced or missing.');
        }
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=onMapLoaded`;
        script.async = true;
        document.head.appendChild(script);
    } catch (e) {
        console.error('Failed to init map:', e);
    }
}

window.onMapLoaded = () => {
    if(typeof google !== 'undefined') {
        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 20.5937, lng: 78.9629 },
            zoom: 5,
            styles: [{ "featureType": "all", "elementType": "all", "stylers": [{ "saturation": -100 }] }],
            disableDefaultUI: true
        });

        document.getElementById('pincode-btn').onclick = async () => {
            const pin = document.getElementById('pincode-input').value;
            if(pin.length !== 6) return;
            const res = await fetch('/api/maps/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pincode: pin })
            });
            const data = await res.json();
            if(data.lat) {
                const pos = { lat: data.lat, lng: data.lng };
                map.setCenter(pos);
                map.setZoom(14);
                new google.maps.Marker({ position: pos, map });
                const info = document.getElementById('constituency-info');
                info.innerHTML = `<strong>Constituency:</strong> ${data.constituency}<br><strong>State:</strong> ${data.state}`;
                info.classList.remove('hidden');
            }
        };
    }
};

function startGuidedJourney() {
    currentStep = 0;
    updateStep();
}

function updateStep() {
    if (currentStep < 0 || currentStep >= guidedSteps.length) return;
    sendQuickChip(`Step ${currentStep + 1}: ${guidedSteps[currentStep]}. Explain this.`);
    setTimeout(() => {
        const bubbles = document.querySelectorAll('.bubble-electra');
        const last = bubbles[bubbles.length - 1];
        if (last) {
            const btn = document.createElement('button');
            btn.className = "mt-4 block text-[10px] font-bold text-navy underline";
            btn.innerText = currentStep < 9 ? "Continue Journey" : "Complete!";
            btn.addEventListener('click', () => { 
                currentStep++; 
                if(currentStep < 10) updateStep(); 
                else currentStep = -1; 
            });
            last.appendChild(btn);
        }
    }, 3000);
}

async function loadTimeline() {
    const res = await fetch('/api/timeline');
    const data = await res.json();
    const container = document.getElementById('timeline-container');
    if(!container) return;
    container.innerHTML = '';
    data.forEach((item) => {
        const card = document.createElement('button');
        card.className = "w-full text-left p-4 bg-white border border-gray-100 rounded-2xl mb-3";
        card.innerHTML = `<div class="text-[10px] font-bold text-orange-600">${item.date}</div><div class="text-sm font-bold">${item.stage}</div><p class="text-[10px] text-gray-500">${item.detail}</p>`;
        card.addEventListener('click', () => { 
            switchTab('chat'); 
            sendQuickChip(`Tell me about ${item.stage}.`); 
        });
        container.appendChild(card);
    });
}

function startOnboarding(selection) { localStorage.setItem('onboarded', 'true'); document.getElementById('onboarding').classList.add('hidden'); sendQuickChip(selection); }
function checkOnboarding() { if (!localStorage.getItem('onboarded')) document.getElementById('onboarding').classList.remove('hidden'); }
function updateProgress() { document.getElementById('progress-text').innerText = `EXPLORED ${exploredTopics.length} OF 8 TOPICS`; }

let quizData = [];
let quizIndex = 0;
let quizScore = 0;

async function startQuiz(topic) {
    const intro = document.getElementById('quiz-intro');
    const container = document.getElementById('quiz-container');
    intro.classList.add('hidden');
    container.classList.remove('hidden');
    container.innerHTML = '<div class="text-center py-8 animate-pulse text-navy font-bold">Gemini is generating your quiz...</div>';

    try {
        const res = await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, score: quizScore })
        });
        quizData = await res.json();
        quizIndex = 0;
        showQuizQuestion();
    } catch (e) {
        container.innerHTML = '<div class="text-red-600 font-bold">Failed to load quiz. Please try again.</div>';
    }
}

function showQuizQuestion() {
    const q = quizData[quizIndex];
    const container = document.getElementById('quiz-container');
    container.innerHTML = `
        <div class="text-lg font-bold text-navy mb-4">${q.question}</div>
        <div class="space-y-2" id="quiz-options">
            ${q.options.map((opt, i) => `
                <button onclick="checkQuizAnswer(${i})" class="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all border border-transparent">
                    ${opt}
                </button>
            `).join('')}
        </div>
        <div id="quiz-explanation" class="hidden p-4 rounded-2xl mt-4 text-sm"></div>
        <button id="quiz-next" class="hidden w-full py-4 bg-navy text-white rounded-2xl mt-4">Next Question</button>
    `;
}

window.checkQuizAnswer = (idx) => {
    const q = quizData[quizIndex];
    const options = document.querySelectorAll('#quiz-options button');
    const explanation = document.getElementById('quiz-explanation');
    const nextBtn = document.getElementById('quiz-next');

    options.forEach(b => b.disabled = true);
    if (idx === q.correct) {
        options[idx].classList.add('bg-green-100', 'border-green-500');
        quizScore += 20;
    } else {
        options[idx].classList.add('bg-red-100', 'border-red-500');
        options[q.correct].classList.add('bg-green-100', 'border-green-500');
    }

    explanation.innerHTML = `<strong>${idx === q.correct ? 'Correct!' : 'Incorrect.'}</strong> ${q.explanation}`;
    explanation.className = `p-4 rounded-2xl mt-4 text-sm ${idx === q.correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`;
    explanation.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => {
        quizIndex++;
        if (quizIndex < quizData.length) showQuizQuestion();
        else {
            const container = document.getElementById('quiz-container');
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">🎉</div>
                    <h3 class="text-2xl font-bold text-navy mb-2">Quiz Complete!</h3>
                    <p class="text-gray-500 mb-6">Your Voter Readiness Score: ${quizScore}%</p>
                    <button onclick="switchTab('chat')" class="w-full py-4 bg-navy text-white rounded-2xl font-bold">Return to Chat</button>
                </div>
            `;
            if (quizScore >= 80 && !exploredTopics.includes('Quiz Master')) {
                exploredTopics.push('Quiz Master');
                updateProgress();
            }
        }
    };
};

function toggleLanguage() {
    const lang = currentLang === 'en' ? 'hi' : 'en';
    currentLang = lang;
    localStorage.setItem('lang', lang);
    const htmlRoot = document.getElementById('html-root');
    if (htmlRoot) htmlRoot.lang = lang === 'hi' ? 'hi' : 'en';
    
    // Update UI or reload
    const btn = document.getElementById('lang-toggle-btn');
    if(btn) btn.innerText = lang === 'en' ? 'EN' : 'हि';
    
    // For a real app, you'd translate the UI here. For this fix, we ensure the attribute is set.
    console.log(`Language toggled to: ${lang}`);
}

window.toggleLanguage = toggleLanguage;
window.startOnboarding = startOnboarding;
window.switchTab = switchTab;
window.startGuidedJourney = startGuidedJourney;
window.sendQuickChip = sendQuickChip;
window.toggleHistory = () => alert('History feature coming soon!');

// Ensure lang is set on load
const htmlRootOnLoad = document.getElementById('html-root');
if (htmlRootOnLoad) htmlRootOnLoad.lang = currentLang === 'hi' ? 'hi' : 'en';
