
        let currentLang = localStorage.getItem('lang') || 'en';
        let chatHistory = [];
        let map;
        let activeTab = 'chat';
        let quizData = [];
        let currentQuizIndex = 0;
        let score = 0;

        document.addEventListener('DOMContentLoaded', () => {
            initLanguage();
            loadTimeline();
            setTimeout(() => {
                const splash = document.getElementById('splash');
                if(splash) { splash.style.opacity = '0'; setTimeout(() => splash.style.display = 'none', 800); }
            }, 2500);
        });

        function initLanguage() {
            const btn = document.getElementById('lang-toggle');
            if(!btn) return;
            btn.innerText = currentLang === 'en' ? 'EN' : 'HI';
            if (currentLang === 'hi') {
                document.getElementById('welcome-msg').innerText = "नमस्ते! मैं इलेक्ट्रा हूँ। आज मैं आपकी क्या मदद कर सकती हूँ?";
                btn.classList.add('bg-blue-900', 'text-white');
            }
            btn.onclick = () => {
                currentLang = currentLang === 'en' ? 'hi' : 'en';
                localStorage.setItem('lang', currentLang);
                location.reload();
            };
        }

        function switchTab(tabId) {
            document.querySelectorAll('section[id^="content-"]').forEach(s => s.classList.add('hidden'));
            document.getElementById(`content-${tabId}`).classList.remove('hidden');
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active', 'text-navy', 'font-bold'));
            const tabBtn = document.getElementById(`tab-${tabId}`);
            if(tabBtn) tabBtn.classList.add('tab-active');
            
            const headerTitle = document.getElementById('header-title');
            if(headerTitle) {
                if(tabId === 'admin') { headerTitle.innerText = 'ADMIN DASHBOARD'; headerTitle.classList.add('text-red-600'); }
                else { headerTitle.innerText = 'ELECTRA'; headerTitle.classList.remove('text-red-600'); }
            }
            activeTab = tabId;
            if(tabId === 'maps' && !map) initMap();
        }

        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const chatMessages = document.getElementById('chat-messages');

        if(sendBtn) sendBtn.onclick = handleChat;
        if(chatInput) chatInput.onkeypress = (e) => e.key === 'Enter' && handleChat();

        async function handleChat() {
            const text = chatInput.value.trim();
            if(!text) return;
            addMessage('user', text);
            chatInput.value = '';
            document.getElementById('typing-indicator').classList.remove('hidden');
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ history: chatHistory, message: text, language: currentLang })
                });
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let electraMsg = '';
                const bubble = addMessage('electra', '');
                document.getElementById('typing-indicator').classList.add('hidden');
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') break;
                            try {
                                const parsed = JSON.parse(data);
                                electraMsg += parsed.text;
                                bubble.innerHTML = formatText(electraMsg);
                                chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
                            } catch(e) {}
                        }
                    }
                }
                chatHistory.push({ role: 'user', parts: [{ text }] });
                chatHistory.push({ role: 'model', parts: [{ text: electraMsg }] });
            } catch (error) {
                document.getElementById('typing-indicator').classList.add('hidden');
                addMessage('electra', 'Connection error. Please try again.');
            } finally {
                document.getElementById('typing-indicator').classList.add('hidden');
            }
        }

        function addMessage(sender, text) {
            const div = document.createElement('div');
            div.className = `p-3 max-w-[90%] text-xs stagger-fade-in ${sender === 'user' ? 'chat-bubble-user self-end ml-auto' : 'chat-bubble-electra self-start'}`;
            div.innerHTML = formatText(text);
            chatMessages.appendChild(div);
            chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
            return div;
        }

        function formatText(text) {
            // Safely render text: escape HTML first, then apply safe markdown-like formatting
            const escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return escaped
                .replace(/\*\*(.*?)\*\*/g, '<span class="jargon-term">$1</span>')
                .replace(/\n/g, '<br>');
        }
        function sendQuickChip(text) { chatInput.value = text; handleChat(); }

        async function loadTimeline() {
            const res = await fetch('/api/timeline');
            const data = await res.json();
            const container = document.getElementById('timeline-container');
            data.forEach((item, i) => {
                const card = document.createElement('div');
                card.className = "p-3 bg-white border border-gray-100 rounded-xl";
                card.innerHTML = `<div class="text-[8px] font-bold text-orange-600 mb-1">${item.date}</div><div class="text-sm font-bold mb-1">${item.stage}</div><p class="text-[10px] text-gray-500">${item.detail}</p>`;
                container.appendChild(card);
            });
        }

        document.getElementById('eligibility-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Checking...";
            btn.disabled = true;
            try {
                const res = await fetch('/api/eligibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: document.getElementById('el-state').value, age: parseInt(document.getElementById('el-age').value), citizenship: document.getElementById('el-citizen').value }) });
                const data = await res.json();
                const resultDiv = document.getElementById('eligibility-result');
                resultDiv.className = `mt-6 p-4 rounded-xl text-xs ${data.eligible ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`;
                resultDiv.innerHTML = `<div class="font-bold text-sm mb-1">${data.eligible ? '✅ Eligible!' : '❌ Not Eligible'}</div><p class="text-gray-600">${data.reason}</p>`;
                resultDiv.classList.remove('hidden');
            } catch (err) { alert('Failed to check eligibility. Please try again.'); }
            finally { btn.innerText = originalText; btn.disabled = false; }
        };

        async function initMap() {
            const res = await fetch('/api/maps/key');
            const { key } = await res.json();
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=onMapLoaded`;
            script.async = true;
            document.head.appendChild(script);
        }
        window.onMapLoaded = () => { if(typeof google !== 'undefined') map = new google.maps.Map(document.getElementById('map'), { center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, disableDefaultUI: true }); };

        const pinBtn = document.getElementById('pincode-btn');
        if(pinBtn) pinBtn.onclick = async () => {
            const pincode = document.getElementById('pincode-input').value;
            const res = await fetch('/api/maps/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pincode }) });
            const data = await res.json();
            document.getElementById('constituency-info').innerHTML = `📍 ${data.lokSabha}, ${data.state}`;
            document.getElementById('constituency-info').classList.remove('hidden');
        };

        async function startQuiz(topic) {
            document.getElementById('quiz-intro').classList.add('hidden');
            document.getElementById('quiz-container').classList.remove('hidden');
            const res = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
            quizData = await res.json();
            if(!quizData || quizData.length === 0 || quizData[0].question.includes('Error')) { alert('Error generating quiz.'); location.reload(); return; }
            currentQuizIndex = 0; score = 0; showQuestion();
        }

        function showQuestion() {
            const q = quizData[currentQuizIndex];
            document.getElementById('quiz-progress').innerText = `Q${currentQuizIndex+1}/5`;
            document.getElementById('quiz-bar').style.width = `${(currentQuizIndex+1)*20}%`;
            document.getElementById('quiz-question').innerText = q.question;
            const opts = document.getElementById('quiz-options');
            opts.innerHTML = '';
            q.options.forEach((o, i) => {
                const btn = document.createElement('button');
                btn.className = "w-full p-3 text-left border rounded-xl text-xs";
                btn.innerText = o;
                btn.onclick = () => {
                    const btns = opts.querySelectorAll('button');
                    btns.forEach(b => b.disabled = true);
                    if(i === q.correct) { btn.classList.add('bg-green-50', 'border-green-500'); score += 20; }
                    else { btn.classList.add('bg-red-50', 'border-red-500'); btns[q.correct].classList.add('bg-green-50'); }
                    document.getElementById('quiz-explanation').innerText = q.explanation;
                    document.getElementById('quiz-explanation').classList.remove('hidden');
                    document.getElementById('quiz-next').classList.remove('hidden');
                };
                opts.appendChild(btn);
            });
            document.getElementById('quiz-explanation').classList.add('hidden');
            document.getElementById('quiz-next').classList.add('hidden');
        }

        const nextBtn = document.getElementById('quiz-next');
        if(nextBtn) nextBtn.onclick = () => {
            currentQuizIndex++;
            if(currentQuizIndex < 5) showQuestion();
            else {
                document.getElementById('quiz-container').classList.add('hidden');
                document.getElementById('quiz-final').classList.remove('hidden');
                document.getElementById('final-score').innerText = score;
            }
        };

        const mythBtn = document.getElementById('myth-fab');
        if(mythBtn) mythBtn.onclick = () => {
            const modal = document.getElementById('myth-modal');
            modal.classList.remove('hidden');
            modal.style.opacity = '0';
            setTimeout(() => modal.style.opacity = '1', 10);
        };
        const closeMyth = document.getElementById('close-myth');
        if(closeMyth) closeMyth.onclick = () => {
            const modal = document.getElementById('myth-modal');
            modal.style.opacity = '0';
            setTimeout(() => modal.classList.add('hidden'), 300);
        };
        const verifyBtn = document.getElementById('verify-myth');
        if(verifyBtn) verifyBtn.onclick = async () => {
            const claim = document.getElementById('myth-input').value.trim();
            if(!claim) return;
            const btnText = document.getElementById('myth-btn-text');
            const loader = document.getElementById('myth-loader');
            const resDiv = document.getElementById('myth-result');
            
            verifyBtn.disabled = true;
            btnText.innerText = 'Analyzing...';
            loader.classList.remove('hidden');
            resDiv.classList.add('hidden');

            try {
                const res = await fetch('/api/mythbust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim }) });
                const data = await res.json();
                resDiv.className = `mt-4 p-4 rounded-2xl text-xs ${data.verdict === 'TRUE' ? 'bg-green-50 border-green-100 text-green-800' : data.verdict === 'FALSE' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`;
                resDiv.innerHTML = `<div class="font-bold text-sm mb-1">Verdict: ${data.verdict}</div><p>${data.explanation}</p>${data.source ? `<div class="mt-2 text-[10px] opacity-70">Source: ${data.source}</div>` : ''}`;
                resDiv.classList.remove('hidden');
            } catch (e) { alert('Verification failed.'); }
            finally {
                verifyBtn.disabled = false;
                btnText.innerText = 'Verify Claim';
                loader.classList.add('hidden');
            }
        };

        async function loadAdminStats() {
            const pass = document.getElementById('admin-pass').value;
            const res = await fetch('/api/admin/stats', { headers: { 'x-admin-password': pass } });
            if(!res.ok) return alert('Bad password');
            const stats = await res.json();
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.remove('hidden');
            document.getElementById('stat-queries').innerText = stats.queries;
            document.getElementById('stat-myths').innerText = stats.mythBusts;
        }

        function setupSpeech() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;
            const recognition = new SpeechRecognition();
            recognition.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            const voiceBtn = document.getElementById('voice-btn');
            if (!voiceBtn) return;
            voiceBtn.onclick = () => {
                recognition.start();
                voiceBtn.classList.add('text-red-500');
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('chat-input').value = transcript;
                voiceBtn.classList.remove('text-red-500');
                handleChat();
            };
            recognition.onerror = () => voiceBtn.classList.remove('text-red-500');
            recognition.onend = () => voiceBtn.classList.remove('text-red-500');
        }
        // Initialize speech on load
        document.addEventListener('DOMContentLoaded', setupSpeech);
    