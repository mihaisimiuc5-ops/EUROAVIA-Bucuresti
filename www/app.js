// ==========================================
// 1. DATE UTILIZATOR ȘI CONFIGURĂRI
// ==========================================
let currentMemberId = null; 
let currentDept = '';  
let currentUserName = '';
let currentUserGooglePic = 'icon-192.png';
let profileCacheBuster = new Date().getTime(); // Sistem anti-cache global

const API_URL = 'https://app.euroavia-bucuresti.ro/api/server.php';
let userSavedEvents = [];
let departmentMembersLoaded = false;

// ==========================================
// 2. LOGICA DE AUTENTIFICARE GOOGLE
// ==========================================
window.onload = function () {
    google.accounts.id.initialize({
        client_id: "440151498628-lh87c1pfc7asgrohle857uls25jvnkvu.apps.googleusercontent.com",
        callback: handleCredentialResponse,
        hosted_domain: "euroavia-bucuresti.ro"
    });
    google.accounts.id.renderButton(
        document.getElementById("googleButton"),
        { theme: "outline", size: "large", text: "continue_with" }
    );
};

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    const emailUser = responsePayload.email;
    const numeUser = responsePayload.name;

    if (emailUser.endsWith('@euroavia-bucuresti.ro')) {
        
        // Salvăm poza Google ca backup global
        currentUserGooglePic = responsePayload.picture || 'icon-192.png';
        const googlePicUrl = responsePayload.picture || '';
        
        // Cerem ID-ul, numele și departamentul din baza de date pe baza email-ului + trimitem poza de pe Google ca fallback pentru server
        const fetchUrl = `${API_URL}?action=get_user_info&email=${encodeURIComponent(emailUser)}&google_pic=${encodeURIComponent(googlePicUrl)}`;
        
        fetch(fetchUrl, { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Utilizatorul a fost găsit în DB
                currentMemberId = data.id;
                currentDept = data.departament;
                currentUserName = data.nume_complet || numeUser;
            } else {
                // Utilizatorul NU a fost găsit -> alocăm ID-ul 1 ca fallback (invitat)
                console.warn("Cont negăsit în DB. Se folosește ID-ul 1.");
                currentMemberId = 1;
                currentDept = 'Vizitator';
                currentUserName = numeUser;
            }

            // Afișăm interfața aplicației
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            
            // Setăm numele și poza de profil în meniul lateral (folosind sistemul anti-cache)
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
            console.error('Eroare fetch user info:', error);
            alert("Eroare de conexiune la preluarea datelor contului.");
        });

    } else {
        alert("Eroare de acces: Te rugăm să folosești exclusiv adresa de email @euroavia-bucuresti.ro!");
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
    toggleSideMenu(); // Închidem meniul lateral
    switchTab('app-details', 'Detalii Aplicație', null); // Navigăm la noul tab de detalii
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
    if (toggleBtn) {
        if (tabId === 'tasks') toggleBtn.style.display = 'block';
        else toggleBtn.style.display = 'none';
    }
    
    if (tabId === 'members') loadDepartmentMembers();
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
    toggleSideMenu(); // Închide meniul lateral
    switchTab('profile', 'Profilul Tău', null);
    toggleProfileEditMode(false); // Deschide mereu pe modul de VIZUALIZARE
    
    // Setăm datele vizuale de bază
    document.getElementById('profilePageName').innerText = currentUserName;
    document.getElementById('profilePageDept').innerText = currentDept;

    // Setare poză profil cu Fallback la poza de pe Google
    const viewImg = document.getElementById('profilePageImg');
    viewImg.src = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
    viewImg.onerror = function() {
        this.onerror = null;
        this.src = currentUserGooglePic; // Fallback Google
    };

    // Preluare Bio din baza de date
    document.getElementById('profilePageBio').innerHTML = '<i>Se încarcă...</i>';
    fetch(`${API_URL}?action=get_user_profile&member_id=${currentMemberId}`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const bioText = data.bio || '';
            document.getElementById('profilePageBio').innerText = bioText.trim() !== '' ? bioText : 'Nu ai adăugat nicio descriere încă.';
            document.getElementById('profileBioInput').value = bioText; // Precompletare input
        }
    })
    .catch(err => {
        console.error('Eroare profil:', err);
        document.getElementById('profilePageBio').innerText = 'Eroare la încărcarea datelor.';
    });
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
                // Actualizăm live ce se vede pe ecran (Textul Bio)
                document.getElementById('profilePageBio').innerText = bioText.trim() !== '' ? bioText : 'Nu ai adăugat nicio descriere încă.';
                
                // Generăm un nou timestamp pentru a forța browserul să descarce noua imagine
                profileCacheBuster = new Date().getTime();
                const newPicUrl = `${API_URL}?action=get_profile_pic&member_id=${currentMemberId}&t=${profileCacheBuster}`;
                
                const updateImageFallback = (imgId) => {
                    const img = document.getElementById(imgId);
                    img.src = newPicUrl;
                    img.onerror = function() { this.onerror = null; this.src = currentUserGooglePic; };
                };

                updateImageFallback('profilePageImg');
                updateImageFallback('menuProfilePic');

                // Resetăm inputul și închidem formularul
                fileInput.value = '';
                toggleProfileEditMode(false); // Revenim la Vizualizare
                
                // Reîncărcăm lista de membri ca să li se schimbe poza și lor dacă intrăm pe tab
                if (document.getElementById('tab-members').classList.contains('active')) {
                    departmentMembersLoaded = false;
                    loadDepartmentMembers();
                } else {
                    departmentMembersLoaded = false; // Forțăm refresh data viitoare
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

    // Dacă utilizatorul a încărcat o poză nouă, o procesăm Base64
    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
            sendData(uploadEvent.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        // Dacă a modificat doar textul (fără poză)
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
        } else {
            alert('Eroare API: ' + data.message);
        }
    })
    .catch(error => console.error('Eroare loadDashboardData:', error));
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
        } else containerMembri.innerHTML = `<p style="color:red;">Eroare: ${data.message}</p>`;
    })
    .catch(err => containerMembri.innerHTML = `<p style="color:red;">Eroare de conexiune la server.</p>`);
}

function renderLeaders(sup, coord, container) {
    let html = '';
    if(sup) {
        const nume = sup.nume ? `${sup.nume} ${sup.prenume}` : sup.email;
        html += `
            <div class="leader-card supervisor-card">
                <div class="leader-badge">Supervizor</div>
                <h3>${nume}</h3>
                <p><i class="material-icons">email</i> <a href="mailto:${sup.email}" style="color:#555; text-decoration:none;">${sup.email}</a></p>
                ${sup.telefon ? `<p><i class="material-icons">phone</i> <a href="tel:${sup.telefon}" style="color:#555; text-decoration:none;">${sup.telefon}</a></p>` : ''}
            </div>`;
    }
    if(coord) {
        const nume = coord.nume ? `${coord.nume} ${coord.prenume}` : coord.email;
        html += `
            <div class="leader-card coordinator-card">
                <div class="leader-badge">Coordonator</div>
                <h3>${nume}</h3>
                <p><i class="material-icons">email</i> <a href="mailto:${coord.email}" style="color:#555; text-decoration:none;">${coord.email}</a></p>
                ${coord.telefon ? `<p><i class="material-icons">phone</i> <a href="tel:${coord.telefon}" style="color:#555; text-decoration:none;">${coord.telefon}</a></p>` : ''}
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
        
        // Generăm URL-ul pozei folosind ID-ul membrului + sistem anti-cache
        const picUrl = `${API_URL}?action=get_profile_pic&member_id=${m.id}&t=${profileCacheBuster}`;
        
        html += `
            <div class="member-item">
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
// 8. JOCUL QUIZ: SINGLEPLAYER & 1V1 BATTLE (INVITE)
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

// --- LOGICA PENTRU LOBBY (INVITE) ---
function createBattleRoom() {
    document.getElementById('quizStartScreen').style.display = 'none';
    document.getElementById('quizMatchmakingScreen').style.display = 'block';
    document.getElementById('displayInviteCode').innerText = '...';

    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_invite', member_id: currentMemberId })
    })
    .then(res => res.json())
    .then(data => {
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
    })
    .then(res => res.json())
    .then(data => {
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
        fetch(API_URL, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ action: 'end_battle', battle_id: battleId }) 
        });
    }
    resetQuizView();
}

function checkMatchStatus() {
    fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_match_status', battle_id: battleId })
    })
    .then(res => res.json())
    .then(data => {
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
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            opponentScore = data.opponent_score;
            document.getElementById('oppBattleScore').innerText = opponentScore;
        }
    });
}
// -----------------------------------------

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
    })
    .then(res => res.json())
    .then(() => { return fetch(`${API_URL}?action=get_quiz_leaderboard`); })
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