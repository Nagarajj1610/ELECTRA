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

    checkOnboarding();
    updateProgress();
    
    // Myth modal logic
    const mythFab = document.getElementById('myth-fab');
    const mythModal = document.getElementById('myth-modal');
    const closeMyth = document.getElementById('close-myth');
    if(mythFab) mythFab.onclick = () => mythModal.classList.remove('hidden');
    if(closeMyth) closeMyth.onclick = () => mythModal.classList.add('hidden');
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
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const tabBtn = document.getElementById(`tab-${tabId}`);
    if(tabBtn) tabBtn.classList.add('active');
    
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
            btn.onclick = () => { currentStep++; if(currentStep < 10) updateStep(); else currentStep = -1; };
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
        card.onclick = () => { switchTab('chat'); sendQuickChip(`Tell me about ${item.stage}.`); };
        container.appendChild(card);
    });
}

function startOnboarding(selection) { localStorage.setItem('onboarded', 'true'); document.getElementById('onboarding').classList.add('hidden'); sendQuickChip(selection); }
function checkOnboarding() { if (!localStorage.getItem('onboarded')) document.getElementById('onboarding').classList.remove('hidden'); }
function updateProgress() { document.getElementById('progress-text').innerText = `EXPLORED ${exploredTopics.length} OF 8 TOPICS`; }

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
