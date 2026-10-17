// ==========================================
// 1. DATE UTILIZATOR ȘI CONFIGURĂRI
// ==========================================
let currentMemberId = null; 
let currentDept = '';  
let currentUserName = '';
let currentUserGooglePic = 'icon-192.png';
let profileCacheBuster = new Date().getTime(); 

const API_URL = 'https://app.euroavia-bucuresti.ro/api/server.php';
let userSavedEvents = [];
let departmentMembersLoaded = false;

// Variabile pentru Paginare (Infinite Scroll)
let postsOffset = 0;
let isFetchingPosts = false;
let hasMorePosts = true;

// Variabilă pentru filtrarea postărilor pe departament
let isDeptFilterActive = false;

// ==========================================
// 2. LOGICA DE AUTENTIFICARE GOOGLE & AUTO-LOGIN
// ==========================================
window.onload = async function () {
    const btnWrapper = document.getElementById("googleButton");

    // --- ASCULTĂTOR DE SCROLL PENTRU INFINITE SCROLL ---
    const contentArea = document.getElementById('contentArea');
    if (contentArea) {
        contentArea.addEventListener('scroll', function() {
            if (document.getElementById('tab-posts').classList.contains('active')) {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
                    loadPosts(false); 
                }
            }
        });
    }

    // --- VERIFICARE SESIUNE SALVATĂ (AUTO-LOGIN) ---
    const savedSession = localStorage.getItem('euroavia_session');
    if (savedSession) {
        try {
            const data = JSON.parse(savedSession);
            currentMemberId = data.id;
            currentDept = data.departament;
            currentUserName = data.nume_complet;
            currentUserGooglePic = data.pic;

            // Ascundem ecranul de login și arătăm aplicația
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            document.getElementById('menuUserName').innerText = currentUserName;

            // Setăm poza de profil
            const profileImg = document.getElementById('menuProfilePic');
            profileImg.src = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
            profileImg.onerror = function() { this.onerror = null; this.src = currentUserGooglePic; };

            setupDynamicTabs();
            loadDashboardData(); 

            const firstTabBtn = document.querySelector('.bottom-nav .nav-item');
            switchTab('tasks', 'Dashboard', firstTabBtn);
            
            return; // Oprim execuția aici, nu mai randăm butoanele Google
        } catch (e) {
            localStorage.removeItem('euroavia_session'); // Dacă datele sunt corupte, le ștergem
        }
    }

    // --- AUTENTIFICARE NOUĂ (CAPACITOR SAU WEB) ---
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        btnWrapper.innerHTML = `
            <button onclick="nativeGoogleLogin()" style="width: 100%; padding: 12px; font-size: 16px; background: white; color: #555; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; gap: 12px; font-family: Roboto, sans-serif; font-weight: 500; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" width="20" alt="G Logo">
                Conectare cu Google
            </button>
        `;

        try {
            const { GoogleAuth } = window.Capacitor.Plugins;
            if (GoogleAuth) {
                GoogleAuth.initialize({
                    clientId: '440151498628-lh87c1pfc7asgrohle857uls25jvnkvu.apps.googleusercontent.com',
                    scopes: ['profile', 'email'],
                    grantOfflineAccess: true,
                });
            }
        } catch (err) {
            console.warn("Eroare la inițializarea pluginului GoogleAuth:", err);
        }
    } else {
        try {
            google.accounts.id.initialize({
                client_id: "440151498628-lh87c1pfc7asgrohle857uls25jvnkvu.apps.googleusercontent.com",
                callback: handleCredentialResponse,
                hosted_domain: "euroavia-bucuresti.ro",
                auto_select: false 
            });
            google.accounts.id.renderButton(
                btnWrapper,
                { theme: "outline", size: "large", text: "continue_with" }
            );
        } catch (e) {
            btnWrapper.innerHTML = "<p style='color:red; text-align:center;'>Eroare la încărcarea modulului Web Google.</p>";
        }
    }
};

async function nativeGoogleLogin() {
    try {
        const { GoogleAuth } = window.Capacitor.Plugins;
        if (!GoogleAuth) {
            alert("Eroare critică: Plugin-ul GoogleAuth nu a fost compilat în acest APK.");
            return;
        }
        const googleUser = await GoogleAuth.signIn();
        const fakeResponseObj = { credential: googleUser.authentication.idToken };
        handleCredentialResponse(fakeResponseObj);
    } catch (error) {
        alert("Eroare la logare: " + (error.message || JSON.stringify(error)));
    }
}

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    const emailUser = responsePayload.email;
    const numeUser = responsePayload.name;

    if (emailUser.endsWith('@euroavia-bucuresti.ro')) {
        currentUserGooglePic = responsePayload.picture || 'icon-192.png';
        const googlePicUrl = responsePayload.picture || '';
        const fetchUrl = `${API_URL}?action=get_user_info&email=${encodeURIComponent(emailUser)}&google_pic=${encodeURIComponent(googlePicUrl)}`;
        
        fetch(fetchUrl, { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentMemberId = data.id;
                currentDept = data.departament;
                currentUserName = data.nume_complet || numeUser;

                // Salvăm sesiunea pentru a nu mai cere login data viitoare
                const sessionData = {
                    id: currentMemberId,
                    departament: currentDept,
                    nume_complet: currentUserName,
                    pic: currentUserGooglePic,
                    email: emailUser
                };
                localStorage.setItem('euroavia_session', JSON.stringify(sessionData));

            } else {
                currentMemberId = 1;
                currentDept = 'Vizitator';
                currentUserName = numeUser;
            }

            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            document.getElementById('menuUserName').innerText = currentUserName;
            
            const profileImg = document.getElementById('menuProfilePic');
            profileImg.src = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
            profileImg.onerror = function() {
                this.onerror = null;
                this.src = currentUserGooglePic;
            };
            
            setupDynamicTabs();
            loadDashboardData(); 

            const firstTabBtn = document.querySelector('.bottom-nav .nav-item');
            switchTab('tasks', 'Dashboard', firstTabBtn);
        })
        .catch(error => {
            alert("Eroare de conexiune la preluarea datelor contului.");
        });

    } else {
        alert("Eroare de acces: Te rugăm să folosești exclusiv adresa de email @euroavia-bucuresti.ro!");
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const { GoogleAuth } = window.Capacitor.Plugins;
            if (GoogleAuth) GoogleAuth.signOut();
        } else {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.revoke(emailUser, done => { });
        }
    }
}

function decodeJwtResponse(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// ==========================================
// 3. LOGICA DE NAVIGARE, MENIU LATERAL ȘI COMUTARE
// ==========================================
function toggleSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    sideMenu.classList.toggle('open');
    overlay.classList.toggle('open');
}

function openAppDetails() {
    toggleSideMenu(); 
    switchTab('app-details', 'Detalii Aplicație', null); 
}

function setupDynamicTabs() {
    const orgaTextLabel = document.getElementById('nav-orga-text');
    if (currentDept === 'Tehnic') {
        orgaTextLabel.innerText = 'Trainer';
    } else {
        orgaTextLabel.innerText = 'ORGA';
    }
}

function switchTab(tabId, title, element) {
    document.getElementById('topBarTitle').innerText = title;

    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(nav => nav.classList.remove('active'));
    if (element) element.classList.add('active');

    const toggleBtn = document.getElementById('toggleTasksMeetingsBtn');
    const addPostBtn = document.getElementById('addPostBtn');
    const filterPostsBtn = document.getElementById('filterPostsBtn');
    
    if (toggleBtn) toggleBtn.style.display = (tabId === 'tasks') ? 'block' : 'none';
    if (addPostBtn) addPostBtn.style.display = (tabId === 'posts') ? 'flex' : 'none';
    if (filterPostsBtn) filterPostsBtn.style.display = (tabId === 'posts') ? 'flex' : 'none';
    
    if (tabId === 'members') loadDepartmentMembers();
    
    if (tabId === 'posts' && postsOffset === 0) {
        loadPosts(true);
    }
}

let showingTasks = true;
function toggleTasksMeetings() {
    const tasksView = document.getElementById('tasksView');
    const meetingsView = document.getElementById('meetingsView');
    const toggleBtn = document.getElementById('toggleTasksMeetingsBtn');
    
    if (showingTasks) {
        tasksView.style.display = 'none'; meetingsView.style.display = 'block';
        toggleBtn.innerText = 'Task-uri'; showingTasks = false;
    } else {
        tasksView.style.display = 'block'; meetingsView.style.display = 'none';
        toggleBtn.innerText = 'Ședințe'; showingTasks = true;
    }
}

// ==========================================
// 4. LOGICA PENTRU PROFIL (VIEW & EDIT)
// ==========================================
function openUserProfile() {
    toggleSideMenu(); 
    switchTab('profile', 'Profilul Tău', null);
    toggleProfileEditMode(false); 
    
    document.getElementById('profilePageName').innerText = currentUserName;
    document.getElementById('profilePageDept').innerText = currentDept;

    const viewImg = document.getElementById('profilePageImg');
    viewImg.src = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
    viewImg.onerror = function() {
        this.onerror = null;
        this.src = currentUserGooglePic; 
    };

    document.getElementById('profilePageBio').innerHTML = '<i>Se încarcă...</i>';
    fetch(`${API_URL}?action=get_user_profile&member_id=${currentMemberId}`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const bioText = data.bio || '';
            document.getElementById('profilePageBio').innerText = bioText.trim() !== '' ? bioText : 'Nu ai adăugat nicio descriere încă.';
            document.getElementById('profileBioInput').value = bioText; 
        }
    }).catch(err => {
        document.getElementById('profilePageBio').innerText = 'Eroare la încărcarea datelor.';
    });

    // Încărcăm postările proprii în profil
    loadProfilePosts();
}

function toggleProfileEditMode(isEdit) {
    document.getElementById('profileViewMode').style.display = isEdit ? 'none' : 'block';
    document.getElementById('profileEditMode').style.display = isEdit ? 'block' : 'none';
}

function saveUserProfile(e) {
    e.preventDefault();
    const bioText = document.getElementById('profileBioInput').value;
    const fileInput = document.getElementById('profileImageInput');
    
    const btnSubmit = document.getElementById('btnSaveProfile');
    btnSubmit.innerText = 'Se salvează...';
    btnSubmit.disabled = true;

    const sendData = (base64Image) => {
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_user_profile',
                member_id: currentMemberId,
                bio: bioText,
                image: base64Image
            })
        })
        .then(res => res.json())
        .then(data => {
            btnSubmit.innerText = 'Salvează';
            btnSubmit.disabled = false;

            if (data.success) {
                document.getElementById('profilePageBio').innerText = bioText.trim() !== '' ? bioText : 'Nu ai adăugat nicio descriere încă.';
                profileCacheBuster = new Date().getTime();
                const newPicUrl = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
                
                const updateImageFallback = (imgId) => {
                    const img = document.getElementById(imgId);
                    img.src = newPicUrl;
                    img.onerror = function() { this.onerror = null; this.src = currentUserGooglePic; };
                };

                updateImageFallback('profilePageImg');
                updateImageFallback('menuProfilePic');

                // Resetăm inputul și aspectul butonului
                fileInput.value = '';
                if(typeof updateFileName === 'function') updateFileName(fileInput, 'profileMediaLabel');
                
                toggleProfileEditMode(false); 
                
                if (document.getElementById('tab-members').classList.contains('active')) {
                    departmentMembersLoaded = false;
                    loadDepartmentMembers();
                } else {
                    departmentMembersLoaded = false; 
                }

            } else {
                alert('Eroare la salvare: ' + data.message);
            }
        })
        .catch(err => {
            btnSubmit.innerText = 'Salvează';
            btnSubmit.disabled = false;
            alert('Eroare de rețea. Datele nu s-au putut salva.');
        });
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) { sendData(uploadEvent.target.result); };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        sendData(null);
    }
}

// ==========================================
// 5. DASHBOARD (TASK / ȘEDINȚE)
// ==========================================
function loadDashboardData() {
    const tasksContainer = document.getElementById('tasksContainer');
    const meetingsContainer = document.getElementById('meetingsContainer');

    fetch(`${API_URL}?member_id=${currentMemberId}&departament=${currentDept}`, { method: 'GET' })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            renderTasks(data.date_dashboard.taskuri);
            renderMeetings(data.date_dashboard.sedinte);
            userSavedEvents = data.date_dashboard.evenimente_salvate || [];
            renderSavedEventsOrForm();
        }
    });
}

function renderTasks(tasks) {
    const tasksContainer = document.getElementById('tasksContainer');
    tasksContainer.innerHTML = ''; 
    const now = new Date();
    const viitoare = tasks.filter(task => {
        if (!task.deadline) return true; 
        return new Date(task.deadline) >= now; 
    });
    
    if (viitoare.length === 0) {
        tasksContainer.innerHTML = '<p class="placeholder-text">Nu ai niciun task activ momentan.</p>';
        return;
    }

    viitoare.forEach(task => {
        let deadlineHtml = '';
        if (task.deadline) {
            const dateObj = new Date(task.deadline);
            const formattedDate = dateObj.toLocaleDateString('ro-RO') + ' la ' + dateObj.toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'});
            deadlineHtml = `<span class="badge deadline-badge">⏳ Expira pe: ${formattedDate}</span>`;
        } else deadlineHtml = `<span class="badge deadline-badge-none">Fără termen limită</span>`;
        
        tasksContainer.innerHTML += `
            <div class="card">
                <h3>${task.titlu}</h3>
                <p>${task.descriere || 'Fără detalii suplimentare.'}</p>
                ${deadlineHtml}
            </div>`;
    });
}

function renderMeetings(meetings) {
    const meetingsContainer = document.getElementById('meetingsContainer');
    meetingsContainer.innerHTML = ''; 
    const now = new Date();
    const viitoare = meetings.filter(meeting => new Date(meeting.data_sedintei) >= now);

    if (viitoare.length === 0) {
        meetingsContainer.innerHTML = '<p class="placeholder-text">Nu ai nicio ședință programată curând.</p>';
        return;
    }

    viitoare.forEach(meeting => {
        const dateObj = new Date(meeting.data_sedintei);
        const formattedDate = dateObj.toLocaleDateString('ro-RO') + ' la ora ' + dateObj.toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'});

        let locationHtml = meeting.tip_sedinta === 'online' 
            ? `<a href="${meeting.link_online}" target="_blank" class="action-btn" style="padding: 8px 12px; font-size:13px;">Intră pe Link</a>` 
            : `<p class="location-text"><strong>Locație:</strong> ${meeting.locatie_offline}</p>`;

        meetingsContainer.innerHTML += `
            <div class="card">
                <h3>${meeting.titlu}</h3>
                <p style="margin-bottom: 10px;">${formattedDate}</p>
                ${locationHtml}
            </div>`;
    });
}

// ==========================================
// 6. EVENIMENTE
// ==========================================
function renderSavedEventsOrForm() {
    const formContainer = document.getElementById('eventsFormContainer');
    const savedContainer = document.getElementById('savedEventsContainer');
    const btnEdit = document.getElementById('btnEditEvents');

    if (userSavedEvents.length > 0) {
        formContainer.style.display = 'none';
        savedContainer.style.display = 'block';
        btnEdit.style.display = 'block';
        
        savedContainer.innerHTML = '';
        userSavedEvents.forEach(ev => {
            const title = formatEventName(ev);
            savedContainer.innerHTML += `
                <div class="card event-card" onclick="toggleEventDetails('${ev}', this)">
                    <div class="event-card-header">
                        <h3>${title}</h3>
                        <i class="material-icons expand-icon">expand_more</i>
                    </div>
                    <div class="event-details-content" style="display: none;">
                        <p class="placeholder-text" style="text-align:left; margin:0;">Se încarcă detaliile...</p>
                    </div>
                </div>`;
        });
    } else showEventsForm();
}

function showEventsForm() {
    document.getElementById('eventsFormContainer').style.display = 'block';
    document.getElementById('savedEventsContainer').style.display = 'none';
    document.getElementById('btnEditEvents').style.display = 'none';
    renderEventsForm(currentDept);
}

function formatEventName(key) {
    const names = {
        'aircraft_workshop': 'Aircraft Workshop', 'drone_workshop': 'Drone Workshop',
        'rocket_workshop': 'Rocket Workshop', 'head_start_session': 'Head Start Session',
        'aeroconnect': 'Aeroconnect', 'aerocamp': 'Aerocamp',
        'wintercamp': 'Wintercamp', 'eurocupa': 'Eurocupa'
    };
    return names[key] || key;
}

function toggleEventDetails(eventName, cardElement) {
    const contentDiv = cardElement.querySelector('.event-details-content');
    const icon = cardElement.querySelector('.expand-icon');

    if (contentDiv.style.display === 'block') {
        contentDiv.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; return;
    }
    contentDiv.style.display = 'block'; icon.style.transform = 'rotate(180deg)';

    if (!contentDiv.dataset.loaded) {
        fetch(`${API_URL}?action=get_event_details&event=${eventName}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                let html = `
                    <div class="event-leaders">
                        <p><strong>Supervizor:</strong> ${data.supervizor}</p>
                        <p><strong>Coordonator:</strong> ${data.coordonator}</p>
                    </div>
                    <h4 style="margin-top: 15px; margin-bottom: 10px; color:#003366;">Membri Înscriși:</h4>
                    <ul class="participants-list">`;
                
                if (data.membri.length > 0) {
                    data.membri.forEach(m => { html += `<li><b>${m.nume}</b> <span>${m.departament}</span></li>`; });
                } else html += `<li><span style="background:transparent; color:#999; font-weight:normal; padding:0;">Niciun membru înscris.</span></li>`;
                
                html += `</ul>`;
                contentDiv.innerHTML = html; contentDiv.dataset.loaded = "true"; 
            } else contentDiv.innerHTML = `<p style="color:red;">Eroare: ${data.message}</p>`;
        })
        .catch(err => contentDiv.innerHTML = `<p style="color:red;">Eroare de rețea la preluarea datelor.</p>`);
    }
}

function renderEventsForm(dept) {
    const container = document.getElementById('eventsFormContainer');
    let formHtml = `<form id="submitEventsForm" onsubmit="submitEventsForm(event)">`;

    if (dept === 'Tehnic') {
        formHtml += `
            <div class="event-form-group">
                <p>Aircraft Workshop</p>
                <label class="event-label"><input type="checkbox" name="aircraft_workshop" value="Da"> Vreau să particip la Aircraft Workshop</label>
            </div>
            <div class="event-form-group">
                <p>Alege al doilea eveniment (doar unul):</p>
                <label class="event-label"><input type="radio" name="second_event" value="rocket_workshop" required> Rocket Workshop</label>
                <label class="event-label"><input type="radio" name="second_event" value="drone_workshop" required> Drone Workshop</label>
            </div>`;
    } else if (dept === 'IT') {
        formHtml += `
            <div class="event-form-group">
                <p>Alege maxim 2 evenimente:</p>
                <label class="event-label"><input type="checkbox" name="it_event" value="drone_workshop" onchange="checkMax2(this)"> Drone Workshop</label>
                <label class="event-label"><input type="checkbox" name="it_event" value="rocket_workshop" onchange="checkMax2(this)"> Rocket Workshop</label>
                <label class="event-label"><input type="checkbox" name="it_event" value="aeroconnect" onchange="checkMax2(this)"> Aeroconnect</label>
            </div>`;
    } else if (dept === 'Marketing' || dept === 'Events') {
        formHtml += `
            <div class="event-form-group">
                <p>Workshop obligatoriu (doar unul):</p>
                <label class="event-label"><input type="radio" name="orga_workshop" value="rocket_workshop" required> Rocket Workshop</label>
                <label class="event-label"><input type="radio" name="orga_workshop" value="drone_workshop" required> Drone Workshop</label>
            </div>
            <div class="event-form-group">
                <p>Alte evenimente (alege oricâte):</p>
                <label class="event-label"><input type="checkbox" name="other_event" value="head_start_session"> Head Start Session</label>
                <label class="event-label"><input type="checkbox" name="other_event" value="aeroconnect"> Aeroconnect</label>
                <label class="event-label"><input type="checkbox" name="other_event" value="aerocamp"> Aerocamp</label>
                <label class="event-label"><input type="checkbox" name="other_event" value="wintercamp"> Wintercamp</label>
                <label class="event-label"><input type="checkbox" name="other_event" value="eurocupa"> Eurocupa</label>
            </div>`;
    } else if (dept === 'Legal and Business Operations') {
        formHtml += `
            <div class="event-form-group">
                <p>Alege evenimentele la care vrei să participi:</p>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="drone_workshop"> Drone Workshop</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="rocket_workshop"> Rocket Workshop</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="head_start_session"> Head Start Session</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="aeroconnect"> Aeroconnect</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="aerocamp"> Aerocamp</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="wintercamp"> Wintercamp</label>
                <label class="event-label"><input type="checkbox" name="lbo_event" value="eurocupa"> Eurocupa</label>
            </div>`;
    } else { container.innerHTML = `<p>Nu există setări de evenimente pentru departamentul tău.</p>`; return; }

    formHtml += `<button type="submit" class="action-btn" style="width: 100%;">Salvează Opțiunile</button></form>`;
    container.innerHTML = formHtml;
}

function checkMax2(checkbox) {
    const checkedBoxes = document.querySelectorAll('input[name="it_event"]:checked');
    if (checkedBoxes.length > 2) { checkbox.checked = false; alert('Poți alege maxim 2 evenimente pentru departamentul IT!'); }
}

function submitEventsForm(e) {
    e.preventDefault();
    let payload = { member_id: currentMemberId, departament: currentDept, selections: {} };

    if (currentDept === 'Tehnic') {
        payload.selections.aircraft_workshop = document.querySelector('input[name="aircraft_workshop"]').checked ? 'Da' : null;
        let sec = document.querySelector('input[name="second_event"]:checked');
        payload.selections.second_event = sec ? sec.value : null;
    } else if (currentDept === 'IT') {
        let checks = document.querySelectorAll('input[name="it_event"]:checked');
        ['drone_workshop', 'rocket_workshop', 'aeroconnect'].forEach(ev => payload.selections[ev] = false);
        checks.forEach(cb => payload.selections[cb.value] = true);
    } else if (currentDept === 'Marketing' || currentDept === 'Events') {
        let workshop = document.querySelector('input[name="orga_workshop"]:checked');
        payload.selections.drone_workshop = (workshop && workshop.value === 'drone_workshop');
        payload.selections.rocket_workshop = (workshop && workshop.value === 'rocket_workshop');
        ['head_start_session', 'aeroconnect', 'aerocamp', 'wintercamp', 'eurocupa'].forEach(ev => payload.selections[ev] = false);
        document.querySelectorAll('input[name="other_event"]:checked').forEach(cb => payload.selections[cb.value] = true);
    } else if (currentDept === 'Legal and Business Operations') {
        ['drone_workshop', 'rocket_workshop', 'head_start_session', 'aeroconnect', 'aerocamp', 'wintercamp', 'eurocupa'].forEach(ev => payload.selections[ev] = false);
        document.querySelectorAll('input[name="lbo_event"]:checked').forEach(cb => payload.selections[cb.value] = true);
    }

    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => { if(data.success) loadDashboardData(); else alert('Eroare la salvare: ' + data.message); })
    .catch(err => alert('Eroare de rețea. Datele nu au putut fi salvate.'));
}

// ==========================================
// 7. MEMBRI
// ==========================================
function loadDepartmentMembers() {
    if (departmentMembersLoaded) return; 

    const containerMembri = document.getElementById('departmentMembersContainer');
    const containerLideri = document.getElementById('leadersContainer');
    
    fetch(`${API_URL}?action=get_department_members&departament=${currentDept}`)
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            renderLeaders(data.supervizor, data.coordonator, containerLideri);
            renderMembersList(data.membri, containerMembri);
            departmentMembersLoaded = true;
        }
    });
}

function renderLeaders(sup, coord, container) {
    let html = '';
    if(sup) {
        const nume = sup.nume ? `${sup.nume} ${sup.prenume}` : sup.email;
        html += `
            <div class="leader-card supervisor-card" ${sup.id ? `onclick="openUserProfileModal(${sup.id})" style="cursor:pointer;"` : ''}>
                <div class="leader-badge">Supervizor</div>
                <h3>${nume}</h3>
                <p><i class="material-icons">email</i> <a href="mailto:${sup.email}" style="color:#555; text-decoration:none;" onclick="event.stopPropagation();">${sup.email}</a></p>
                ${sup.telefon ? `<p><i class="material-icons">phone</i> <a href="tel:${sup.telefon}" style="color:#555; text-decoration:none;" onclick="event.stopPropagation();">${sup.telefon}</a></p>` : ''}
            </div>`;
    }
    if(coord) {
        const nume = coord.nume ? `${coord.nume} ${coord.prenume}` : coord.email;
        html += `
            <div class="leader-card coordinator-card" ${coord.id ? `onclick="openUserProfileModal(${coord.id})" style="cursor:pointer;"` : ''}>
                <div class="leader-badge">Coordonator</div>
                <h3>${nume}</h3>
                <p><i class="material-icons">email</i> <a href="mailto:${coord.email}" style="color:#555; text-decoration:none;" onclick="event.stopPropagation();">${coord.email}</a></p>
                ${coord.telefon ? `<p><i class="material-icons">phone</i> <a href="tel:${coord.telefon}" style="color:#555; text-decoration:none;" onclick="event.stopPropagation();">${coord.telefon}</a></p>` : ''}
            </div>`;
    }
    if(!sup && !coord) html = '<p class="placeholder-text">Nu au fost setați lideri pentru acest departament.</p>';
    container.innerHTML = html;
}

function renderMembersList(membri, container) {
    if(membri.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Nu există alți membri înregistrați în departament.</p>';
        return;
    }
    
    let html = '<div class="members-grid">';
    membri.forEach(m => {
        const initialaNume = m.nume ? m.nume.charAt(0).toUpperCase() : '';
        const initialaPrenume = m.prenume ? m.prenume.charAt(0).toUpperCase() : '';
        const picUrl = `${API_URL}?action=get_profile_pic&member_id=${m.id}&t=${profileCacheBuster}`;
        
        html += `
            <div class="member-item" onclick="openUserProfileModal(${m.id})" style="cursor:pointer; transition: 0.2s;">
                <img src="${picUrl}" alt="${initialaNume}${initialaPrenume}" 
                     style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid #003366;" 
                     onerror="this.onerror=null; this.outerHTML='<div class=\\'member-avatar\\'>${initialaNume}${initialaPrenume}</div>';">
                
                <div class="member-info">
                    <h4>${m.nume} ${m.prenume}</h4>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==========================================
// 8. JOCUL QUIZ: SINGLEPLAYER & 1V1 BATTLE
// ==========================================
const allQuizQuestions = [
    { q: "Ce forță aerodinamică se opune în mod direct greutății aeronavei?", options: ["Tracțiunea", "Portanța", "Rezistența la înaintare", "Frecarea"], answer: 1, category: "Aerodinamică", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Airfoil_lift_and_drag.svg/512px-Airfoil_lift_and_drag.svg.png" },
    { q: "Privind acest model, ce parte a aeronavei generează cea mai mare portanță?", options: ["Fuselage", "Empenajul", "Aripa", "Motorul"], answer: 2, category: "Aerodinamică", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Airplane_vortex.jpg/512px-Airplane_vortex.jpg" },
    { q: "Care este rolul principal al ampenajului orizontal?", options: ["Asigură stabilitatea longitudinală", "Generează tracțiune", "Susține trenul de aterizare", "Creează portanță principală"], answer: 0, category: "Mecanica Zborului" },
    { q: "Ce forță este generată de motor/elice?", options: ["Greutatea", "Rezistența", "Tracțiunea", "Portanța"], answer: 2, category: "Propulsie" },
    { q: "Cum se numește mișcarea aeronavei în jurul axei sale longitudinale?", options: ["Ruliu (Roll)", "Tangaj (Pitch)", "Girație (Yaw)", "Glisare"], answer: 0, category: "Mecanica Zborului" },
    { q: "Ce material este cel mai utilizat astăzi în structura aeronavelor comerciale datorită greutății reduse?", options: ["Oțel", "Fibră de carbon / Compozite", "Lemn", "Fier"], answer: 1, category: "Structură" },
    { q: "Ce fenomen aerodinamic apare atunci când unghiul de atac depășește un punct critic?", options: ["Angajare (Stall)", "Viteza sunetului", "Efectul Coandă", "Girație"], answer: 0, category: "Aerodinamică" },
    { q: "Care dintre următoarele este un tip de motor cu reacție?", options: ["Motor cu piston", "Turboventilator (Turbofan)", "Motor electric", "Wankel"], answer: 1, category: "Propulsie" },
    { q: "Ce controlează profundorul (elevatorul)?", options: ["Mișcarea de ruliu", "Mișcarea de girație", "Mișcarea de tangaj (Pitch)", "Puterea motorului"], answer: 2, category: "Mecanica Zborului" },
    { q: "La ce ajută flapsurile unei aeronave?", options: ["Cresc viteza maximă", "Scad portanța la decolare", "Cresc portanța și rezistența pentru aterizare la viteză mică", "Opresc complet motorul"], answer: 2, category: "Aerodinamică" },
    { q: "Ce reprezintă numărul Mach?", options: ["Viteza raportată la viteza luminii", "Raportul dintre viteza aeronavei și viteza sunetului", "Presiunea din cabină", "Greutatea maximă la decolare"], answer: 1, category: "Aerodinamică" },
    { q: "Axa verticală a avionului controlează mișcarea de:", options: ["Girație (Yaw)", "Ruliu (Roll)", "Tangaj (Pitch)", "Translație"], answer: 0, category: "Mecanica Zborului" },
    { q: "Componenta principală care preia momentele de încovoiere ale aripii este:", options: ["Nervura", "Lonjeronul", "Flapsul", "Fuzelajul"], answer: 1, category: "Structură" },
    { q: "Eleronul controlează:", options: ["Altitudinea", "Direcția stânga-dreapta pe sol", "Mișcarea de ruliu", "Frânarea aerodinamică"], answer: 2, category: "Mecanica Zborului" },
    { q: "Tubul Pitot măsoară:", options: ["Temperatura exterioară", "Presiunea totală pentru a afla viteza", "Nivelul de combustibil", "Altitudinea absolută"], answer: 1, category: "Aerodinamică" }
];

let selectedQuizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let correctAnswersCount = 0;
let quizTimer;
let timeElapsed = 0;
let mistakesByCategory = {};

let isBattleMode = false;
let battleId = null;
let playerNum = null;
let opponentScore = 0;
let pollingInterval = null;

function resetQuizView() {
    clearInterval(pollingInterval);
    document.getElementById('quizStartScreen').style.display = 'block';
    document.getElementById('quizActiveScreen').style.display = 'none';
    document.getElementById('quizResultScreen').style.display = 'none';
    document.getElementById('quizMatchmakingScreen').style.display = 'none';
    document.getElementById('quizBattleResultScreen').style.display = 'none';
}

function startQuiz(isBattle, seed = null) {
    isBattleMode = isBattle;
    document.getElementById('quizMatchmakingScreen').style.display = 'none';
    document.getElementById('quizStartScreen').style.display = 'none';
    document.getElementById('quizActiveScreen').style.display = 'block';
    
    quizScore = 0; opponentScore = 0; correctAnswersCount = 0; currentQuizIndex = 0; mistakesByCategory = {};
    
    if (isBattleMode) {
        document.getElementById('quizScoreTracker').style.display = 'none';
        document.getElementById('battleScoreTracker').style.display = 'flex';
        document.getElementById('myBattleScore').innerText = '0';
        document.getElementById('oppBattleScore').innerText = '0';
        
        selectedQuizQuestions = seed.split(',').map(index => allQuizQuestions[parseInt(index)]);
        pollingInterval = setInterval(syncBattleScore, 1500);
    } else {
        document.getElementById('quizScoreTracker').style.display = 'block';
        document.getElementById('battleScoreTracker').style.display = 'none';
        document.getElementById('quizScoreTracker').innerText = `Scor: 0`;
        
        selectedQuizQuestions = allQuizQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    }
    
    loadQuizQuestion();
}

function createBattleRoom() {
    document.getElementById('quizStartScreen').style.display = 'none';
    document.getElementById('quizMatchmakingScreen').style.display = 'block';
    document.getElementById('displayInviteCode').innerText = '...';

    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invite', member_id: currentMemberId })
    }).then(res => res.json()).then(data => {
        if(data.success) {
            battleId = data.battle_id;
            playerNum = data.player;
            document.getElementById('displayInviteCode').innerText = data.room_code;
            pollingInterval = setInterval(checkMatchStatus, 2000);
        } else {
            alert('Eroare la crearea camerei.');
            resetQuizView();
        }
    });
}

function joinBattleRoom() {
    const code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
    if(!code) { alert('Te rog introdu un cod valid!'); return; }

    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_invite', member_id: currentMemberId, room_code: code })
    }).then(res => res.json()).then(data => {
        if(data.success) {
            battleId = data.battle_id;
            playerNum = data.player;
            startQuiz(true, data.seed);
        } else alert(data.message || 'Eroare la conectare.');
    });
}

function cancelBattleRoom() {
    clearInterval(pollingInterval);
    if (battleId) {
        fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end_battle', battle_id: battleId }) });
    }
    resetQuizView();
}

function checkMatchStatus() {
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_match_status', battle_id: battleId })
    }).then(res => res.json()).then(data => {
        if (data.success && data.status === 'playing') {
            clearInterval(pollingInterval);
            startQuiz(true, data.seed);
        }
    });
}

function syncBattleScore() {
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_battle', battle_id: battleId, player_num: playerNum, score: quizScore })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            opponentScore = data.opponent_score;
            document.getElementById('oppBattleScore').innerText = opponentScore;
        }
    });
}

function loadQuizQuestion() {
    timeElapsed = 0;
    const qData = selectedQuizQuestions[currentQuizIndex];
    document.getElementById('quizQuestionCounter').innerText = `${currentQuizIndex + 1}/10`;
    document.getElementById('quizQuestionText').innerText = qData.q;
    
    const quizImg = document.getElementById('quizQuestionImage');
    if (qData.image) { quizImg.src = qData.image; quizImg.style.display = 'block'; } 
    else { quizImg.src = ''; quizImg.style.display = 'none'; }
    
    const optionsContainer = document.getElementById('quizOptionsContainer');
    optionsContainer.innerHTML = '';
    qData.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-btn'; btn.innerText = opt;
        btn.onclick = () => selectQuizAnswer(index, btn);
        optionsContainer.appendChild(btn);
    });
    startQuizTimer();
}

function startQuizTimer() {
    const timerBar = document.getElementById('quizTimerBar');
    timerBar.style.width = '100%'; timerBar.style.backgroundColor = '#003366';
    clearInterval(quizTimer);
    quizTimer = setInterval(() => {
        timeElapsed++;
        let percentage = ((30 - timeElapsed) / 30) * 100;
        timerBar.style.width = percentage + '%';
        if(percentage < 40) timerBar.style.backgroundColor = '#d9534f'; 
        if (timeElapsed >= 30) { clearInterval(quizTimer); selectQuizAnswer(-1, null); }
    }, 1000);
}

function selectQuizAnswer(selectedIndex, clickedBtn) {
    clearInterval(quizTimer);
    const qData = selectedQuizQuestions[currentQuizIndex];
    const allBtns = document.querySelectorAll('.quiz-btn');
    allBtns.forEach(b => b.disabled = true);

    let bonus = 5 - Math.floor(timeElapsed / 6);
    if (bonus < 0) bonus = 0;

    if (selectedIndex === qData.answer) {
        if(clickedBtn) clickedBtn.classList.add('correct');
        quizScore += (5 + bonus); correctAnswersCount++;
        
        if(isBattleMode) document.getElementById('myBattleScore').innerText = quizScore;
        else document.getElementById('quizScoreTracker').innerText = `Scor: ${quizScore}`;
    } else {
        if(clickedBtn) clickedBtn.classList.add('wrong');
        allBtns[qData.answer].classList.add('correct');
        if (!mistakesByCategory[qData.category]) mistakesByCategory[qData.category] = 0;
        mistakesByCategory[qData.category]++;
    }

    if (isBattleMode) syncBattleScore();

    setTimeout(() => {
        currentQuizIndex++;
        if (currentQuizIndex < 10) loadQuizQuestion(); else endQuiz();
    }, 1500);
}

function endQuiz() {
    document.getElementById('quizActiveScreen').style.display = 'none';
    
    if (isBattleMode) {
        clearInterval(pollingInterval);
        document.getElementById('quizBattleResultScreen').style.display = 'block';
        document.getElementById('finalMyScore').innerText = quizScore;
        
        setTimeout(() => {
            document.getElementById('finalOppScore').innerText = opponentScore;
            const title = document.getElementById('battleOutcomeTitle');
            if (quizScore > opponentScore) { title.innerText = "Ai câștigat! 🎉"; title.style.color = "#28a745"; } 
            else if (quizScore < opponentScore) { title.innerText = "Ai pierdut! 😢"; title.style.color = "#d9534f"; } 
            else { title.innerText = "Egalitate! 🤝"; title.style.color = "#ffc107"; }
            
            if (playerNum === 1) {
                fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end_battle', battle_id: battleId }) });
            }
        }, 1500);
    } else {
        document.getElementById('quizResultScreen').style.display = 'block';
        document.getElementById('quizFinalScore').innerText = quizScore;
        let feedback = "";
        if (correctAnswersCount <= 5) feedback = "Scor mic. Trebuie să te mai pregătești!";
        else {
            if (Object.keys(mistakesByCategory).length === 0) feedback = "Senzațional! Nu ai greșit nimic!";
            else {
                let worstCategory = Object.keys(mistakesByCategory).reduce((a, b) => mistakesByCategory[a] > mistakesByCategory[b] ? a : b);
                feedback = `Te-ai descurcat foarte bine, dar aprofundează: <b>${worstCategory}</b>.`;
            }
        }
        document.getElementById('quizFeedbackMessage').innerHTML = feedback;
        saveAndFetchLeaderboard(quizScore);
    }
}

function saveAndFetchLeaderboard(scoreToSave) {
    const lbContainer = document.getElementById('quizLeaderboard');
    lbContainer.innerHTML = '<p class="placeholder-text">Se salvează și se încarcă clasamentul...</p>';

    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_quiz_score', member_id: currentMemberId, score: scoreToSave })
    }).then(() => fetch(`${API_URL}?action=get_quiz_leaderboard`))
      .then(res => res.json())
      .then(data => {
        if(data.success && data.leaderboard.length > 0) {
            lbContainer.innerHTML = '';
            data.leaderboard.forEach((p, index) => {
                let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                lbContainer.innerHTML += `<li class="leaderboard-item"><span>${medal} ${p.nume} ${p.prenume}</span><b>${p.max_score} pct</b></li>`;
            });
        } else lbContainer.innerHTML = '<p class="placeholder-text">Nu există scoruri încă.</p>';
    });
}

// ==========================================
// 9. FEED DE POSTĂRI & COMENTARII
// ==========================================
let currentPostIdForComments = null;

function togglePostsFilter() {
    isDeptFilterActive = !isDeptFilterActive;
    const btn = document.getElementById('filterPostsBtn');
    const icon = btn.querySelector('i');
    
    if (isDeptFilterActive) {
        btn.style.backgroundColor = '#28a745'; 
        icon.innerText = 'groups'; 
    } else {
        btn.style.backgroundColor = '#003366'; 
        icon.innerText = 'public'; 
    }
    
    loadPosts(true);
}

function loadPosts(reset = false) {
    if (isFetchingPosts || (!hasMorePosts && !reset)) return;

    const container = document.getElementById('postsFeedContainer');
    let limit = 5; 
    
    if (reset) {
        postsOffset = 0;
        hasMorePosts = true;
        limit = 10; 
        container.innerHTML = '<p class="placeholder-text" id="loadingPostsText">Se încarcă postările...</p>';
    } else {
        if (!document.getElementById('loadingMorePostsText')) {
            container.insertAdjacentHTML('beforeend', '<p class="placeholder-text" id="loadingMorePostsText" style="padding:10px;">Se încarcă mai multe...</p>');
        }
    }

    isFetchingPosts = true;
    let deptParam = isDeptFilterActive ? `&dept_filter=${encodeURIComponent(currentDept)}` : '';
    
    fetch(`${API_URL}?action=get_posts&member_id=${currentMemberId}&limit=${limit}&offset=${postsOffset}${deptParam}`)
    .then(res => res.json())
    .then(data => {
        isFetchingPosts = false;
        
        const loadText = document.getElementById('loadingPostsText');
        if (loadText) loadText.remove();
        const loadMoreText = document.getElementById('loadingMorePostsText');
        if (loadMoreText) loadMoreText.remove();

        if (data.success) {
            if (reset && data.posts.length === 0) {
                container.innerHTML = '<p class="placeholder-text">Nu există postări încă. Fii primul care adaugă o postare!</p>';
                hasMorePosts = false;
                return;
            }

            if (data.posts.length < limit) {
                hasMorePosts = false;
            }

            data.posts.forEach(post => {
                const isLiked = post.user_liked ? 'liked' : '';
                const likeIcon = post.user_liked ? 'favorite' : 'favorite_border';
                const authorPic = `${API_URL}?action=get_profile_pic&member_id=${post.member_id}&t=${profileCacheBuster}`;
                
                let mediaHtml = '';
                if (post.media_url) {
                    const mediaSrc = `${API_URL}?action=get_post_media&file=${post.media_url}`;
                    if (post.media_type === 'video') {
                        mediaHtml = `<video class="post-media" controls src="${mediaSrc}"></video>`;
                    } else {
                        mediaHtml = `<img class="post-media" src="${mediaSrc}" alt="Media postare">`;
                    }
                }
                
                const postDate = new Date(post.created_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

                const deleteBtnHtml = (post.member_id === currentMemberId) 
                    ? `<button onclick="deletePost(${post.id})" style="background:transparent; border:none; color:#d9534f; cursor:pointer; padding:5px;"><i class="material-icons">delete_outline</i></button>` 
                    : '';

                const postHtml = `
                    <div class="post-card" id="post-${post.id}">
                        <div class="post-header" style="justify-content: space-between;">
                            <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="openUserProfileModal(${post.member_id})">
                                <img src="${authorPic}" onerror="this.src='icon-192.png'">
                                <div class="post-header-info">
                                    <h4 style="margin: 0; font-size: 16px; color: #111;">${post.author_name}</h4>
                                    <span>${postDate}</span>
                                </div>
                            </div>
                            ${deleteBtnHtml}
                        </div>
                        ${post.description ? `<div class="post-text">${post.description}</div>` : ''}
                        ${mediaHtml}
                        <div class="post-actions">
                            <button class="post-action-btn ${isLiked}" onclick="toggleLike(${post.id}, this)">
                                <i class="material-icons">${likeIcon}</i> <span class="likes-count">${post.likes_count}</span>
                            </button>
                            <button class="post-action-btn" onclick="openCommentsModal(${post.id})">
                                <i class="material-icons">chat_bubble_outline</i> <span class="comments-count">${post.comments_count}</span>
                            </button>
                        </div>
                    </div>`;
                    
                container.insertAdjacentHTML('beforeend', postHtml);
            });
            
            postsOffset += data.posts.length;

            if (!hasMorePosts && postsOffset > 0 && !document.getElementById('endOfPostsText')) {
                container.insertAdjacentHTML('beforeend', '<p class="placeholder-text" id="endOfPostsText" style="font-size: 13px; color: #999; padding-bottom: 20px;">Nu mai sunt alte postări.</p>');
            }
        }
    }).catch(err => {
        console.error(err);
        isFetchingPosts = false;
    });
}

function updateFileName(input, labelId) {
    const label = document.getElementById(labelId);
    if (!label) return; 
    
    const labelText = label.querySelector('span');
    const icon = label.querySelector('i');
    
    const imagePreview = document.getElementById('postImagePreview');
    const videoPreview = document.getElementById('postVideoPreview');
    
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        label.style.backgroundColor = '#28a745'; 
        
        if (labelId === 'postMediaLabel') {
            const isHeic = file.type.includes('heic') || file.type.includes('heif') || file.name.toLowerCase().endsWith('.heic');
            
            if (isHeic) {
                icon.innerText = 'hourglass_empty';
                labelText.innerText = "Se pregătește...";
                
                heic2any({ blob: file, toType: "image/jpeg", quality: 0.5 }).then(convertedBlob => {
                    const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    if (imagePreview) {
                        imagePreview.src = URL.createObjectURL(finalBlob);
                        imagePreview.style.display = 'block';
                    }
                    if (videoPreview) videoPreview.style.display = 'none';
                    icon.innerText = 'check_circle';
                    labelText.innerText = "Imagine atașată";
                }).catch(e => {
                    icon.innerText = 'warning';
                    labelText.innerText = "Imagine atașată (fără preview)";
                });
            } 
            else if (file.type.startsWith('image/')) {
                if (imagePreview) {
                    imagePreview.src = URL.createObjectURL(file);
                    imagePreview.style.display = 'block';
                }
                if (videoPreview) videoPreview.style.display = 'none';
                icon.innerText = 'check_circle';
                labelText.innerText = "Imagine atașată";
            } 
            else if (file.type.startsWith('video/')) {
                if (videoPreview) {
                    videoPreview.src = URL.createObjectURL(file);
                    videoPreview.style.display = 'block';
                }
                if (imagePreview) imagePreview.style.display = 'none';
                icon.innerText = 'check_circle';
                labelText.innerText = "Video atașat";
            }
        } 
        else if (labelId === 'profileMediaLabel') {
             icon.innerText = 'check_circle';
             labelText.innerText = "Poză atașată";
        }
        
    } else {
        label.style.backgroundColor = '#666'; 
        if (labelId === 'profileMediaLabel') {
            labelText.innerText = 'Încarcă o poză nouă';
            icon.innerText = 'add_a_photo';
        } else {
            labelText.innerText = 'Adaugă imagine sau video';
            icon.innerText = 'perm_media';
            if (imagePreview) { imagePreview.src = ''; imagePreview.style.display = 'none'; }
            if (videoPreview) { videoPreview.src = ''; videoPreview.style.display = 'none'; }
        }
    }
}

function openAddPostModal() { document.getElementById('addPostModal').style.display = 'flex'; }

function closeAddPostModal() { 
    document.getElementById('addPostModal').style.display = 'none'; 
    document.getElementById('postDescription').value = '';
    
    const fileInput = document.getElementById('postMedia');
    fileInput.value = '';
    
    const imagePreview = document.getElementById('postImagePreview');
    const videoPreview = document.getElementById('postVideoPreview');
    if (imagePreview) { imagePreview.src = ''; imagePreview.style.display = 'none'; }
    if (videoPreview) { videoPreview.src = ''; videoPreview.style.display = 'none'; }
    
    if(typeof updateFileName === 'function') updateFileName(fileInput, 'postMediaLabel');

    document.getElementById('btnSubmitPost').innerText = 'Postează';
    document.getElementById('btnSubmitPost').disabled = false;
}

async function compressImageForPost(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_SIZE = 800; 
                    let width = img.width; 
                    let height = img.height;

                    if (width > height && width > MAX_SIZE) { 
                        height *= MAX_SIZE / width; 
                        width = MAX_SIZE; 
                    } else if (height > MAX_SIZE) { 
                        width *= MAX_SIZE / height; 
                        height = MAX_SIZE; 
                    }

                    canvas.width = width; 
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.5)); 
                } catch (e) {
                    reject("Eroare memorie Canvas: " + e.message);
                }
            };
            img.onerror = () => reject("Eroare de procesare a imaginii.");
            img.src = event.target.result;
        };
        reader.onerror = () => reject("Eroare la citirea fișierului.");
    });
}

async function submitPost() {
    const desc = document.getElementById('postDescription').value.trim();
    const fileInput = document.getElementById('postMedia');
    const btnSubmit = document.getElementById('btnSubmitPost');
    
    if (!desc && (!fileInput.files || fileInput.files.length === 0)) {
        alert("Trebuie să adaugi text sau un fișier media!"); return;
    }

    btnSubmit.innerText = 'Se postează...'; 
    btnSubmit.disabled = true;
    let mediaBase64 = null; let mediaType = null;

    try {
        if (fileInput.files.length > 0) {
            let file = fileInput.files[0];
            
            const isHeic = file.type.includes('heic') || file.type.includes('heif') || file.name.toLowerCase().endsWith('.heic');
            if (isHeic) {
                try {
                    const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
                    file = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                } catch (conversionError) {
                    throw new Error("Nu am putut converti imaginea HEIC de pe iPhone.");
                }
            }

            if (file.type.startsWith('image/')) {
                mediaBase64 = await compressImageForPost(file);
                mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                if (file.size > 20 * 1024 * 1024) { 
                    alert("Videoclipul este prea mare (maxim 20MB permis)!"); 
                    btnSubmit.innerText = 'Postează'; btnSubmit.disabled = false; return; 
                }
                mediaType = 'video';
                mediaBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            } else {
                throw new Error("Format nesuportat. Alege o imagine sau un video.");
            }
        }

        fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_post', member_id: currentMemberId, description: desc, media: mediaBase64, media_type: mediaType })
        })
        .then(async res => {
            if (!res.ok) throw new Error("Eroare de server.");
            return res.json();
        })
        .then(data => {
            if (data.success) { 
                closeAddPostModal(); 
                loadPosts(true); 
                loadProfilePosts(); 
            } else { 
                alert('Eroare Bază de Date: ' + data.message); 
                btnSubmit.innerText = 'Postează'; btnSubmit.disabled = false; 
            }
        })
        .catch(err => {
            alert("Eroare de la server: " + err.message);
            btnSubmit.innerText = 'Postează'; 
            btnSubmit.disabled = false;
        });

    } catch (error) {
        alert("Eroare pe dispozitiv:\n" + (error.message || error));
        btnSubmit.innerText = 'Postează'; 
        btnSubmit.disabled = false;
    }
}

function toggleLike(postId, btnEl) {
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_like', member_id: currentMemberId, post_id: postId })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            const icon = btnEl.querySelector('i');
            const countSpan = btnEl.querySelector('.likes-count');
            let count = parseInt(countSpan.innerText);
            
            if (data.liked) {
                btnEl.classList.add('liked'); icon.innerText = 'favorite'; countSpan.innerText = count + 1;
            } else {
                btnEl.classList.remove('liked'); icon.innerText = 'favorite_border'; countSpan.innerText = count - 1;
            }
        }
    });
}

function openCommentsModal(postId) {
    currentPostIdForComments = postId;
    document.getElementById('commentsModal').style.display = 'flex';
    document.getElementById('commentsList').innerHTML = '<p class="placeholder-text">Se încarcă...</p>';
    fetchComments(postId);
}

function closeCommentsModal() { document.getElementById('commentsModal').style.display = 'none'; }

function fetchComments(postId) {
    fetch(`${API_URL}?action=get_comments&post_id=${postId}`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const list = document.getElementById('commentsList');
            list.innerHTML = '';
            if (data.comments.length === 0) list.innerHTML = '<p class="placeholder-text" style="text-align:center;">Fii primul care comentează!</p>';
            data.comments.forEach(c => {
                const pic = `${API_URL}?action=get_profile_pic&member_id=${c.member_id}&t=${profileCacheBuster}`;
                
                const deleteCommentBtn = (c.member_id === currentMemberId) 
                    ? `<button onclick="deleteComment(${c.id}, ${postId})" style="background:transparent; border:none; color:#d9534f; cursor:pointer; padding:0; margin-left: 10px;"><i class="material-icons" style="font-size:16px;">delete</i></button>` : '';

                list.innerHTML += `
                    <div class="comment-item">
                        <img src="${pic}" onerror="this.src='icon-192.png'" style="cursor:pointer;" onclick="openUserProfileModal(${c.member_id})">
                        <div class="comment-box">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <h5 style="margin: 0 0 5px 0; cursor:pointer; color:#003366;" onclick="openUserProfileModal(${c.member_id})">${c.author_name}</h5>
                                ${deleteCommentBtn}
                            </div>
                            <p style="margin: 0;">${c.comment}</p>
                        </div>
                    </div>`;
            });
        }
    });
}

function submitComment() {
    const input = document.getElementById('newCommentInput');
    const txt = input.value.trim();
    if (!txt) return;

    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_comment', member_id: currentMemberId, post_id: currentPostIdForComments, comment: txt })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            input.value = '';
            fetchComments(currentPostIdForComments);
            
            const postCard = document.getElementById(`post-${currentPostIdForComments}`);
            if (postCard) {
                const countSpan = postCard.querySelector('.comments-count');
                if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;
            }
        }
    });
}

// ==========================================
// 10. POSTĂRILE PROPRII (ZONA DE PROFIL) ȘI ȘTERGERE
// ==========================================
function loadProfilePosts() {
    const container = document.getElementById('profilePostsList');
    if (!container) return; 
    
    container.innerHTML = '<p class="placeholder-text">Se încarcă postările...</p>';
    
    fetch(`${API_URL}?action=get_posts&member_id=${currentMemberId}&target_member_id=${currentMemberId}&limit=50&offset=0`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            container.innerHTML = '';
            if (data.posts.length === 0) {
                container.innerHTML = '<p class="placeholder-text" style="text-align:left; font-size:13px;">Nu ai publicat nicio postare încă.</p>';
                return;
            }
            
            data.posts.forEach(post => {
                const postDate = new Date(post.created_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                let mediaHtml = '';
                
                if (post.media_url) {
                    const mediaSrc = `${API_URL}?action=get_post_media&file=${post.media_url}`;
                    if (post.media_type === 'video') mediaHtml = `<video class="post-media" controls src="${mediaSrc}" style="max-height: 150px; margin-bottom:10px;"></video>`;
                    else mediaHtml = `<img class="post-media" src="${mediaSrc}" alt="Media" style="max-height: 150px; margin-bottom:10px;">`;
                }
                
                const isLiked = post.user_liked ? 'liked' : '';
                const likeIcon = post.user_liked ? 'favorite' : 'favorite_border';
                const likeColor = post.user_liked ? '#d9534f' : '#666';

                const postHtml = `
                    <div class="post-card" id="profile-post-${post.id}" style="padding: 12px; margin-bottom: 12px; box-shadow:none; border:1px solid #ddd;">
                        <div class="post-header" style="justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 11px; color:#777;">${postDate}</span>
                            <button onclick="deletePost(${post.id})" style="background:none; border:none; color:#d9534f; cursor:pointer; padding:0;"><i class="material-icons" style="font-size: 18px;">delete_outline</i></button>
                        </div>
                        ${post.description ? `<div class="post-text" style="font-size: 13px; margin-bottom:8px;">${post.description}</div>` : ''}
                        ${mediaHtml}
                        <div class="post-actions" style="padding-top: 5px; border:none; justify-content:flex-start; gap:15px;">
                            <button class="post-action-btn ${isLiked}" onclick="toggleLike(${post.id}, this)" style="padding: 0; background: transparent; border: none; display: flex; align-items: center; gap: 3px; font-size: 12px; color: ${likeColor};">
                                <i class="material-icons" style="font-size: 14px;">${likeIcon}</i> <span class="likes-count">${post.likes_count}</span>
                            </button>
                            <button class="post-action-btn" onclick="openCommentsModal(${post.id})" style="padding: 0; background: transparent; border: none; display: flex; align-items: center; gap: 3px; font-size: 12px; color: #666;">
                                <i class="material-icons" style="font-size: 14px;">chat_bubble_outline</i> <span class="comments-count">${post.comments_count}</span>
                            </button>
                        </div>
                    </div>`;
                container.insertAdjacentHTML('beforeend', postHtml);
            });
        } else { container.innerHTML = '<p class="placeholder-text">Eroare la încărcare.</p>'; }
    });
}

function deletePost(postId) {
    if (!confirm("Ești sigur că vrei să ștergi această postare definitiv?")) return;
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_post', member_id: currentMemberId, post_id: postId })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            const postCard = document.getElementById(`post-${postId}`);
            if (postCard) postCard.remove();
            
            const profilePostCard = document.getElementById(`profile-post-${postId}`);
            if (profilePostCard) profilePostCard.remove();
        } else alert(data.message || "Eroare la ștergere.");
    });
}

function deleteComment(commentId, postId) {
    if (!confirm("Ești sigur că vrei să ștergi acest comentariu?")) return;
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_comment', member_id: currentMemberId, comment_id: commentId })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            fetchComments(postId); 
            const postCard = document.getElementById(`post-${postId}`);
            if (postCard) {
                const countSpan = postCard.querySelector('.comments-count');
                if (countSpan) {
                    let newCount = parseInt(countSpan.innerText) - 1;
                    countSpan.innerText = newCount >= 0 ? newCount : 0;
                }
            }
        } else alert(data.message || "Eroare la ștergere.");
    });
}

// ==========================================
// 11. VIZUALIZARE PROFIL EXTERN
// ==========================================
function openUserProfileModal(targetMemberId) {
    if (!targetMemberId) return;
    
    // Dacă ai dat click pe tine însuți, te trimite la propriul profil editabil
    if (targetMemberId == currentMemberId) {
        openUserProfile();
        closeCommentsModal();
        return;
    }
    
    document.getElementById('userProfileModal').style.display = 'flex';
    document.getElementById('extProfileName').innerText = 'Se încarcă...';
    document.getElementById('extProfileDept').innerText = '...';
    document.getElementById('extProfileBio').innerHTML = '<i>Se încarcă...</i>';
    
    const img = document.getElementById('extProfileImg');
    img.src = `${API_URL}?action=get_profile_pic&member_id=${targetMemberId}&t=${profileCacheBuster}`;
    img.onerror = function() { this.onerror=null; this.src='icon-192.png'; };
    
    fetch(`${API_URL}?action=get_user_profile&member_id=${targetMemberId}`)
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            document.getElementById('extProfileName').innerText = data.nume_complet;
            document.getElementById('extProfileDept').innerText = data.departament;
            const bioText = data.bio || '';
            document.getElementById('extProfileBio').innerText = bioText.trim() !== '' ? bioText : 'Nu a adăugat nicio descriere încă.';
        } else {
            document.getElementById('extProfileName').innerText = 'Utilizator negăsit';
        }
    });
}

function closeUserProfileModal() {
    document.getElementById('userProfileModal').style.display = 'none';
}

// ==========================================
// 12. LOGICĂ DECONECTARE
// ==========================================
function logoutUser() {
    // Ștergem sesiunea salvată
    localStorage.removeItem('euroavia_session');
    
    // Dacă e pe mobil cu Capacitor, deconectăm din plugin
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            const { GoogleAuth } = window.Capacitor.Plugins;
            if (GoogleAuth) GoogleAuth.signOut();
        } catch (err) { console.warn("GoogleAuth signOut error:", err); }
    }
    
    // Reîncărcăm aplicația de la zero pentru a reseta variabilele și a arăta ecranul de login
    window.location.reload();
}