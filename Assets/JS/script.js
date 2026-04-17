const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');
let items = [];
let editingId = null;
let currentFileHandle = null;
let drugStartPicker, drugEndPicker;

const A4_WIDTH = 1123;
const A4_HEIGHT = 794;

window.onload = function() {
    const savedHosp = localStorage.getItem('savedHospitalName');
    if (savedHosp) document.getElementById('hospitalName').value = savedHosp;

    document.getElementById('pharmaNote').addEventListener('input', updateUI);
    document.fonts.ready.then(function() { updateUI(); });

    const flatpickrConfig = {
        locale: "th",
        dateFormat: "Y-m-d",
        disableMobile: true,
        altInput: true,
        altFormat: "j F Y",
    };

    flatpickr("#reportDate", {
        ...flatpickrConfig,
        defaultDate: "today"
    });

    flatpickr("#reactionDate", flatpickrConfig);
    flatpickr("#labDate", flatpickrConfig); // 🚀 เพิ่มบรรทัดนี้ ปฏิทิน Lab จะขึ้นแล้ว!

    drugStartPicker = flatpickr("#drugStart", flatpickrConfig);
    drugEndPicker = flatpickr("#drugEnd", flatpickrConfig);

    checkUpdateNotification();
};
// =========================================
// 🚀 ระบบเปิดหน้าต่างประวัติการอัปเดต (เด้งทุกครั้ง)
// =========================================

function checkUpdateNotification() {
    document.getElementById('updateModal').style.display = 'block';
}

function closeUpdateModal() {
    document.getElementById('updateModal').style.display = 'none';
}
function saveHospital() {
    const name = document.getElementById('hospitalName').value.trim();
    localStorage.setItem('savedHospitalName', name);
    alert('บันทึกชื่อโรงพยาบาลเป็นค่าเริ่มต้นเรียบร้อยแล้วครับ');
    updateUI();
}

['hospitalName', 'patientName', 'patientHN', 'patientAN', 'reportDate', 'preparedBy'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
        this.classList.remove('is-invalid');
        updateUI();
    });
});

document.getElementById('drugOngoing').addEventListener('change', function() {
    const el = document.getElementById('drugEnd');
    if (this.checked) {
        drugEndPicker.clear();
        el.disabled = true;
        if(el.nextElementSibling) {
            el.nextElementSibling.disabled = true;
            el.nextElementSibling.style.backgroundColor = '#f1f5f9';
        }
    } else {
        el.disabled = false;
        if(el.nextElementSibling) {
            el.nextElementSibling.disabled = false;
            el.nextElementSibling.style.backgroundColor = '#fff';
        }
    }
    el.classList.remove('is-invalid');
});

document.getElementById('drugStartUnknown').addEventListener('change', function() {
    const el = document.getElementById('drugStart');
    if (this.checked) {
        drugStartPicker.clear();
        el.disabled = true;
        if(el.nextElementSibling) {
            el.nextElementSibling.disabled = true;
            el.nextElementSibling.style.backgroundColor = '#f1f5f9';
        }
    } else {
        el.disabled = false;
        if(el.nextElementSibling) {
            el.nextElementSibling.disabled = false;
            el.nextElementSibling.style.backgroundColor = '#fff';
        }
    }
    el.classList.remove('is-invalid');
});

function markInvalid(elementId) {
    const el = document.getElementById(elementId);
    el.classList.add('is-invalid');
    el.focus();
    el.addEventListener('input', function() {
        this.classList.remove('is-invalid');
    }, { once: true });
}

function addItem(type) {
    let newItem = {};
    let isValid = true;

    if (type === 'drug') {
        const nameEl = document.getElementById('drugName');
        const dose = document.getElementById('drugDose').value.trim();
        const startEl = document.getElementById('drugStart');
        const endEl = document.getElementById('drugEnd');
        const ongoing = document.getElementById('drugOngoing').checked;
        const unknown = document.getElementById('drugStartUnknown').checked;
        const firstDose = document.getElementById('drugFirstDose') ? document.getElementById('drugFirstDose').value.trim() : '';
        const lastDose = document.getElementById('drugLastDose') ? document.getElementById('drugLastDose').value.trim() : '';

        if (!nameEl.value.trim()) { markInvalid('drugName'); isValid = false; }
        if (!unknown && !startEl.value) { markInvalid('drugStart'); isValid = false; }
        if (!ongoing && !endEl.value) { markInvalid('drugEnd'); isValid = false; }

        if (!isValid) return alert('กรุณากรอกข้อมูลยาให้ครบถ้วนครับ');

        const name = nameEl.value.trim();
        newItem = {
            id: editingId || Date.now(),
            name: dose ? `${name} (${dose})` : name,
            rawName: name, dose,
            start: unknown ? null : startEl.value,
            end: ongoing ? null : endEl.value,
            ongoing, startUnknown: unknown, type: 'drug',
            firstDose: firstDose, lastDose: lastDose
        };
    } else if (type === 'reaction') {
        const nameEl = document.getElementById('reactionName');
        const dateEl = document.getElementById('reactionDate');

        if (!nameEl.value.trim()) { markInvalid('reactionName'); isValid = false; }
        if (!dateEl.value) { markInvalid('reactionDate'); isValid = false; }
        if (!isValid) return alert('กรุณาระบุอาการแพ้และวันที่ครับ');

        newItem = {
            id: editingId || Date.now(),
            name: nameEl.value.trim(),
            rawName: nameEl.value.trim(),
            start: dateEl.value,
            type: 'reaction'
        };
    } else if (type === 'lab') {
        const nameEl = document.getElementById('labName');
        const dateEl = document.getElementById('labDate');

        if (!nameEl.value.trim()) { markInvalid('labName'); isValid = false; }
        if (!dateEl.value) { markInvalid('labDate'); isValid = false; }
        if (!isValid) return alert('กรุณาระบุรายละเอียดแล็บและวันที่ครับ');

        newItem = {
            id: editingId || Date.now(),
            name: nameEl.value.trim(),
            rawName: nameEl.value.trim(),
            start: dateEl.value,
            type: 'lab'
        };
        // ล้างค่าฟอร์ม Lab
        document.getElementById('labName').value = '';
        if (document.getElementById('labDate')._flatpickr) document.getElementById('labDate')._flatpickr.clear();
    }

    if (editingId) {
        const idx = items.findIndex(i => i.id === editingId);
        if (idx !== -1) items[idx] = newItem;
    } else {
        items.push(newItem);
    }

    cancelEdit();
    updateUI();
}

function editItem(id) {
    cancelEdit();
    const item = items.find(i => i.id === id);
    if (!item) return;

    editingId = id;
    if (item.type === 'drug') {
        document.getElementById('drugName').value = item.rawName;
        document.getElementById('drugDose').value = item.dose;

        if (document.getElementById('drugFirstDose')) {
            document.getElementById('drugFirstDose').value = item.firstDose || '';
        }
        if (document.getElementById('drugLastDose')) {
            document.getElementById('drugLastDose').value = item.lastDose || '';
        }

        // 💡 1. ส่วนจัดการ วันเริ่มยา และ Checkbox
        const startCheck = document.getElementById('drugStartUnknown');
        const startEl = document.getElementById('drugStart');
        startCheck.checked = item.startUnknown;

        if (drugStartPicker) drugStartPicker.setDate(item.startUnknown ? '' : (item.start || ''));
        else startEl.value = item.startUnknown ? '' : (item.start || '');

        // ล็อกช่องวันที่เริ่มต้น (ล็อกทั้ง input เดิม และกล่องปฏิทินของ Flatpickr)
        startEl.disabled = item.startUnknown;
        if (startEl.nextElementSibling) {
            startEl.nextElementSibling.disabled = item.startUnknown;
            startEl.nextElementSibling.style.backgroundColor = item.startUnknown ? '#e2e8f0' : '#fff'; // เปลี่ยนเป็นสีเทาถ้าถูกล็อก
        }

        // 💡 2. ส่วนจัดการ วันหยุดยา และ Checkbox
        const ongoingCheck = document.getElementById('drugOngoing');
        const endEl = document.getElementById('drugEnd');
        ongoingCheck.checked = item.ongoing;

        if (drugEndPicker) drugEndPicker.setDate(item.ongoing ? '' : (item.end || ''));
        else endEl.value = item.ongoing ? '' : (item.end || '');

        // ล็อกช่องวันที่สิ้นสุด
        endEl.disabled = item.ongoing;
        if (endEl.nextElementSibling) {
            endEl.nextElementSibling.disabled = item.ongoing;
            endEl.nextElementSibling.style.backgroundColor = item.ongoing ? '#e2e8f0' : '#fff';
        }

        document.getElementById('btnDrugAdd').innerHTML = '💾 บันทึกการแก้ไข';
        document.getElementById('btnDrugCancel').style.display = 'inline-flex';

        const targetElement = document.getElementById('drugName');
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else if (item.type === 'reaction') {
        document.getElementById('reactionName').value = item.rawName;

        const rxPicker = document.getElementById('reactionDate')._flatpickr;
        if (rxPicker) rxPicker.setDate(item.start || '');
        else document.getElementById('reactionDate').value = item.start || '';

        document.getElementById('btnReactionAdd').innerHTML = '💾 บันทึกการแก้ไข';
        document.getElementById('btnReactionCancel').style.display = 'inline-flex';

        const targetElement = document.getElementById('reactionName');
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else if (item.type === 'lab') {
        document.getElementById('labName').value = item.rawName;

        const labPicker = document.getElementById('labDate')._flatpickr;
        if (labPicker) labPicker.setDate(item.start || '');
        else document.getElementById('labDate').value = item.start || '';

        document.getElementById('btnLabAdd').innerHTML = '💾 บันทึกการแก้ไข';
        if (document.getElementById('btnLabCancel')) document.getElementById('btnLabCancel').style.display = 'inline-flex';

        const targetElement = document.getElementById('labName');
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function toggleDrugStart() {
    const isUnknown = document.getElementById('drugStartUnknown').checked;
    const startEl = document.getElementById('drugStart');

    // ถ้าไม่ทราบวันเริ่ม ให้ล้างปฏิทินทิ้ง
    if (isUnknown) {
        if(drugStartPicker) drugStartPicker.clear();
        else startEl.value = '';
    }

    startEl.disabled = isUnknown;
    if(startEl.nextElementSibling) {
        startEl.nextElementSibling.disabled = isUnknown;
        startEl.nextElementSibling.style.backgroundColor = isUnknown ? '#e2e8f0' : '#fff';
    }
}

function toggleDrugOngoing() {
    const isOngoing = document.getElementById('drugOngoing').checked;
    const endEl = document.getElementById('drugEnd');

    // ถ้ายังใช้อยู่ ให้ล้างปฏิทินวันหยุดยาทิ้ง
    if (isOngoing) {
        if(drugEndPicker) drugEndPicker.clear();
        else endEl.value = '';
    }

    endEl.disabled = isOngoing;
    if(endEl.nextElementSibling) {
        endEl.nextElementSibling.disabled = isOngoing;
        endEl.nextElementSibling.style.backgroundColor = isOngoing ? '#e2e8f0' : '#fff';
    }
}

function cancelEdit() {
    editingId = null;
    ['drugName','drugDose','drugFirstDose','drugLastDose','drugStart','drugEnd','reactionName','reactionDate','labName','labDate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.value = ''; el.classList.remove('is-invalid'); }
    });

    if(drugStartPicker) drugStartPicker.clear();
    if(drugEndPicker) drugEndPicker.clear();

    const rxPicker = document.getElementById('reactionDate')._flatpickr;
    if(rxPicker) rxPicker.clear();

    const labPicker = document.getElementById('labDate');
    if(labPicker && labPicker._flatpickr) labPicker._flatpickr.clear();

    ['drugOngoing','drugStartUnknown'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.checked = false;
    });

    const startEl = document.getElementById('drugStart');
    const endEl = document.getElementById('drugEnd');
    startEl.disabled = false;
    if(startEl.nextElementSibling) {
        startEl.nextElementSibling.disabled = false;
        startEl.nextElementSibling.style.backgroundColor = '#fff';
    }
    endEl.disabled = false;
    if(endEl.nextElementSibling) {
        endEl.nextElementSibling.disabled = false;
        endEl.nextElementSibling.style.backgroundColor = '#fff';
    }

    document.getElementById('btnDrugAdd').innerHTML = '➕ เพิ่มรายการยานี้ลงตาราง';
    document.getElementById('btnReactionAdd').innerHTML = '➕ บันทึกอาการแพ้';

    const btnLabAdd = document.getElementById('btnLabAdd');
    if(btnLabAdd) btnLabAdd.innerHTML = '➕ บันทึกข้อมูลแล็บ';

    const btnDrugCancel = document.getElementById('btnDrugCancel');
    if(btnDrugCancel) btnDrugCancel.style.display = 'none';

    const btnReactionCancel = document.getElementById('btnReactionCancel');
    if(btnReactionCancel) btnReactionCancel.style.display = 'none';

    const btnLabCancel = document.getElementById('btnLabCancel');
    if(btnLabCancel) btnLabCancel.style.display = 'none';
}

function deleteItem(id) { if(confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) { items = items.filter(i => i.id !== id); updateUI(); } }

function clearAll() {
    if(confirm('⚠️ คำเตือน: คุณต้องการล้างข้อมูลทั้งหมดบนหน้าจอใช่หรือไม่? (ข้อมูลที่ยังไม่เซฟจะสูญหาย)')) {
        items = []; cancelEdit(); document.getElementById('pharmaNote').value = '';
        ['patientName', 'patientHN', 'patientAN'].forEach(id => {
            const el = document.getElementById(id); el.value = ''; el.classList.remove('is-invalid');
        });
        currentFileHandle = null; // ตัดการเชื่อมต่อกับไฟล์เดิมเพื่อความปลอดภัย
        updateUI();
    }
}

function updateUI() {
    items.sort((a, b) => {
        if (a.startUnknown && !b.startUnknown) return -1;
        if (!a.startUnknown && b.startUnknown) return 1;
        return new Date(a.start) - new Date(b.start);
    });
    renderTable(); drawTimeline();
}

function formatLongThaiDate(dateStr) {
    if (!dateStr) return "วันที่ ......... เดือน ............................ ปี ...............";
    const d = new Date(dateStr);
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `วันที่ ${d.getDate()} เดือน ${months[d.getMonth()]} ปี ${d.getFullYear() + 543}`;
}

function formatShortThaiDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear() + 543).slice(-2)}`;
}

function renderTable() {
    const tbody = document.getElementById('itemTableBody'); tbody.innerHTML = '';
    if (items.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">ยังไม่มีข้อมูลรายการยาหรืออาการแพ้</td></tr>'; return; }

    let rxCount = 0;
    items.forEach(item => {
        let startTxt = item.startUnknown ? '<span style="color:#d97706; font-size:13px; font-weight:600;">ไม่ระบุ (ใช้มาก่อน)</span>' : formatShortThaiDate(item.start);
        let endTxt = item.type === 'drug' ? (item.ongoing ? '<span style="color:#059669; font-weight:bold;">ยังใช้อยู่</span>' : formatShortThaiDate(item.end)) : '-';
        let nameTxt = item.type === 'reaction' ? `<span style="color:#ef4444; font-weight:bold;">(R${++rxCount})</span> ${item.name}` : item.name;

        tbody.innerHTML += `<tr>
            <td><span class="type-badge ${item.type === 'drug' ? 'badge-drug' : 'badge-rx'}">${item.type.toUpperCase()}</span></td>
            <td>${nameTxt}</td><td>${startTxt}</td><td>${endTxt}</td>
            <td class="action-cell">
                <button class="btn btn-action btn-edit" onclick="editItem(${item.id})">✏️ แก้ไข</button>
                <button class="btn btn-action btn-del" onclick="deleteItem(${item.id})">🗑️ ลบ</button>
            </td>
        </tr>`;
    });
}

function wrapText(context, text, x, y, maxWidth, lineHeight, simulate = false) {
    let currentY = y;
    const paragraphs = text.split('\n');
    const hasSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter;
    const segmenter = hasSegmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

    for (let p = 0; p < paragraphs.length; p++) {
        let paragraph = paragraphs[p];
        if (paragraph.trim() === '') {
            currentY += lineHeight;
            continue;
        }

        let line = '';
        const wrapChars = (chunk) => {
            for (let i = 0; i < chunk.length; i++) {
                let char = chunk[i];
                let testLine = line + char;
                let metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    if (!simulate) context.fillText(line, x, currentY);
                    line = char;
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
        };

        if (hasSegmenter) {
            const segments = segmenter.segment(paragraph);
            for (const segment of segments) {
                let word = segment.segment;
                let testLine = line + word;
                let metrics = context.measureText(testLine);

                if (metrics.width > maxWidth) {
                    if (line !== '') {
                        if (!simulate) context.fillText(line, x, currentY);
                        line = '';
                        currentY += lineHeight;
                    }
                    if (context.measureText(word).width > maxWidth) {
                        wrapChars(word);
                    } else {
                        line = word;
                    }
                } else {
                    line = testLine;
                }
            }
        } else {
            wrapChars(paragraph);
        }

        if (line.trim() !== '') {
            if (!simulate) context.fillText(line, x, currentY);
            currentY += lineHeight;
        }
    }
    return currentY;
}

// 🌟 ระบบวาด Timeline (ฉบับแก้บัค: นำ First Dose และ Last Dose กลับมาแสดงผลในโหมด Advanced)
function drawTimeline() {
    const dpr = 4;
    const DATES_PER_PAGE = 12;

    const allDrugs = items.filter(i => i.type === 'drug');
    const reactions = items.filter(i => i.type === 'reaction');
    const labs = items.filter(i => i.type === 'lab');

    const groupedDrugs = {};
    const uniqueDrugs = [];
    allDrugs.forEach(drug => {
        const groupName = drug.rawName.trim();
        if (!groupedDrugs[groupName]) {
            groupedDrugs[groupName] = [];
            uniqueDrugs.push(groupName);
        }
        groupedDrugs[groupName].push(drug);
    });

    let datePoints = [...new Set(items.flatMap(i => [i.start, i.end].filter(Boolean)))].sort();
    if(datePoints.length === 0) datePoints = [new Date().toISOString().split('T')[0]];

    const totalPages = Math.max(1, Math.ceil(datePoints.length / DATES_PER_PAGE));

    canvas.width = A4_WIDTH * dpr;
    canvas.height = (A4_HEIGHT * totalPages) * dpr;
    canvas.style.width = A4_WIDTH + 'px';
    canvas.style.height = (A4_HEIGHT * totalPages) + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT * totalPages);

    const pLeft = 260, pRight = 100;
    const noteText = document.getElementById('pharmaNote') ? document.getElementById('pharmaNote').value.trim() : "";

    // ==========================================
    // ลอจิกเกลี่ยพื้นที่
    // ==========================================
    let globalScale = 1.0;
    let t_rowHeight = 45;
    let title_fontSize = 15;
    let adr_fontSize = 14;
    let adr_lineHeight = 24;
    let note_fontSize = 14;
    let note_lineHeight = 22;

    const hArea = 150;
    const fArea = 40;
    const pageContentMaxH = A4_HEIGHT - hArea - fArea;

    while (globalScale >= 0.35) {
        t_rowHeight = Math.max(15, 45 * globalScale);
        title_fontSize = Math.max(11, Math.floor(15 * globalScale));
        adr_fontSize = Math.max(10, Math.floor(14 * globalScale));
        adr_lineHeight = Math.floor(adr_fontSize * 1.5);
        note_fontSize = Math.max(10, Math.floor(14 * globalScale));
        note_lineHeight = Math.floor(note_fontSize * 1.4);

        const timelineH = uniqueDrugs.length * t_rowHeight;
        const eventDates = [...new Set(items.filter(it => it.type==='reaction'||it.type==='lab').map(it => it.start))];
        const adrH = eventDates.length > 0 ? (title_fontSize + 10) + (eventDates.length * adr_lineHeight) : 0;

        ctx.font = `${note_fontSize}px Sarabun, sans-serif`;
        const noteH = noteText ? (title_fontSize + 10) + wrapText(ctx, noteText, 0, 0, A4_WIDTH - 80, note_lineHeight, true) : 0;

        if (timelineH + adrH + noteH + 30 <= pageContentMaxH) break;
        globalScale -= 0.05;
    }

    const timeline_fontSize = Math.max(10, t_rowHeight < 20 ? 11 : (t_rowHeight < 30 ? 12 : Math.floor(14 * globalScale)));
    const dose_fontSize = Math.max(8, Math.floor(11 * globalScale));

    // ==========================================
    // วาดแต่ละหน้า
    // ==========================================
    for (let p = 0; p < totalPages; p++) {
        const startY = p * A4_HEIGHT;
        let currentY = startY + 40;

        // --- หัวกระดาษ ---
        const hName = document.getElementById('hospitalName').value.trim();
        const pName = document.getElementById('patientName').value || "..................................................................................";
        const pHN = document.getElementById('patientHN').value || ".........................................";
        const pAN = document.getElementById('patientAN').value || ".......................................";
        const rDate = document.getElementById('reportDate').value;
        const pBy = document.getElementById('preparedBy').value;

        ctx.fillStyle = "#1e293b";
        if (hName) {
            ctx.font = "bold 22px Sarabun, sans-serif"; ctx.textAlign = "center";
            ctx.fillText(hName, A4_WIDTH/2, currentY); currentY += 35;
        } else { currentY += 10; }

        ctx.textAlign = "left"; ctx.font = "16px Sarabun, sans-serif";
        ctx.fillText(`ชื่อผู้ป่วย: ${pName}`, 50, currentY); ctx.fillText(`HN: ${pHN}`, 450, currentY);
        ctx.fillText(`AN: ${pAN}`, 650, currentY); ctx.fillText(formatLongThaiDate(rDate), 840, currentY);

        currentY += 30;
        ctx.fillText(`จัดทำโดย: ${pBy || "........................................................."}`, 50, currentY);


        let currentX = 390;
        ctx.fillStyle="#475569"; ctx.font="bold 13px Sarabun, sans-serif"; ctx.fillText("หมายเหตุสัญลักษณ์:", currentX, currentY);
        currentX += 120; drawCircle(currentX+5, currentY-5, false, "#3b82f6"); ctx.fillStyle="#475569"; ctx.font="13px Sarabun, sans-serif"; ctx.fillText("เริ่มยา", currentX+15, currentY);
        currentX += 65; drawArrowLeft(currentX-10, currentY-5, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("รายการยาที่ได้รับมาก่อนหน้า", currentX+5, currentY);
        currentX += 155; drawCircle(currentX+15, currentY-5, true, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("หยุดยา", currentX+25, currentY);
        currentX += 60; drawArrowRight(currentX+15, currentY-5, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("กำลังใช้ยาอยู่", currentX+20, currentY);
        currentX += 105; drawArrowDown(currentX+5, currentY-0, "#ef4444"); ctx.fillStyle="#ef4444"; ctx.fillText("อาการแพ้", currentX+15, currentY);
        currentX += 80; drawArrowDown(currentX+5, currentY-0, "#8b5cf6"); ctx.fillStyle="#8b5cf6"; ctx.fillText("แล็บและอื่น ๆ", currentX+15, currentY);

        currentY += 20;

        ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "#cbd5e1";
        ctx.moveTo(50, currentY); ctx.lineTo(A4_WIDTH-50, currentY); ctx.stroke();

        const paddingTop = currentY + 35;
        const timelineBottom = paddingTop + (uniqueDrugs.length * t_rowHeight);

        const pageStartIdx = p * DATES_PER_PAGE;
        const pageEndIdx = Math.min(pageStartIdx + DATES_PER_PAGE - 1, datePoints.length - 1);
        const numDatesThisPage = pageEndIdx - pageStartIdx + 1;
        const interval = (A4_WIDTH - pLeft - pRight) / (numDatesThisPage > 1 ? numDatesThisPage - 1 : 1);

        // แกนเวลา
        for (let local_i = 0; local_i < numDatesThisPage; local_i++) {
            const global_i = pageStartIdx + local_i;
            const x = pLeft + (local_i * interval);
            ctx.setLineDash([4,4]); ctx.strokeStyle="#94a3b8";
            ctx.beginPath(); ctx.moveTo(x, paddingTop-10); ctx.lineTo(x, timelineBottom+15); ctx.stroke();
            ctx.setLineDash([]); ctx.fillStyle="#475569"; ctx.font="bold 12px Sarabun, sans-serif"; ctx.textAlign="left";
            ctx.fillText(formatShortThaiDate(datePoints[global_i]), x-25, paddingTop-15);
        }

        // วาดเส้นยา
        uniqueDrugs.forEach((drugName, i) => {
            const y = paddingTop + (i * t_rowHeight) + t_rowHeight/2;
            ctx.fillStyle="#1e293b"; ctx.font=`bold ${timeline_fontSize}px Sarabun, sans-serif`;
            ctx.textAlign = "left";
            let displayName = drugName;
            const maxTextWidth = pLeft - 40;
            if (ctx.measureText(displayName).width > maxTextWidth) {
                while (ctx.measureText(displayName + "...").width > maxTextWidth && displayName.length > 0) { displayName = displayName.slice(0, -1); }
                displayName += "...";
            }
            ctx.fillText(displayName, 20, y+4);

            const drugInstances = groupedDrugs[drugName];
            drugInstances.forEach(drug => {
                let sIdx = drug.startUnknown ? -1 : datePoints.indexOf(drug.start);
                let eIdx = drug.ongoing ? 9999 : datePoints.indexOf(drug.end);
                if (sIdx > pageEndIdx && !drug.startUnknown) return;
                if (eIdx < pageStartIdx && !drug.ongoing) return;

                let xS = (drug.startUnknown || sIdx < pageStartIdx) ? pLeft - 15 : pLeft + ((sIdx - pageStartIdx) * interval);
                let xE = (drug.ongoing || eIdx > pageEndIdx) ? (A4_WIDTH - pRight) + 15 : pLeft + ((eIdx - pageStartIdx) * interval);

                ctx.beginPath(); ctx.lineWidth=3; ctx.strokeStyle="#3b82f6";
                ctx.moveTo(xS, y); ctx.lineTo(xE, y); ctx.stroke();

                if (drug.startUnknown && p === 0) drawArrowLeft(xS, y, "#3b82f6");
                else if (sIdx < pageStartIdx) drawArrowLeft(xS, y, "#3b82f6");
                else if (!drug.startUnknown) drawCircle(xS, y, false, "#3b82f6");

                if (drug.ongoing && p === totalPages - 1) drawArrowRight(xE, y, "#3b82f6");
                else if (eIdx > pageEndIdx) drawArrowRight(xE, y, "#3b82f6");
                else if (!drug.ongoing) drawCircle(xE, y, true, "#3b82f6");

                if (drug.dose) {
                    const midX = (Math.max(xS, pLeft) + Math.min(xE, A4_WIDTH - pRight)) / 2;
                    ctx.fillStyle = "#1d4ed8"; ctx.font = `${dose_fontSize}px Sarabun, sans-serif`;
                    ctx.textAlign = "center"; ctx.fillText(drug.dose, midX, y - 5); ctx.textAlign = "left";
                }

                // ==========================================
                // 💡 ข้อมูลเชิงลึก (First Dose, Last Dose, Duration)
                // ==========================================
                const showAdvEl = document.getElementById('showAdvancedTimeline');
                if (showAdvEl && showAdvEl.checked) {
                    ctx.fillStyle = "#475569";
                    ctx.font = `${Math.max(8, dose_fontSize - 1)}px Sarabun, sans-serif`;

                    // 👉 นำ First Dose กลับมา! (วาดฝั่งซ้ายของเส้น)
                    if (drug.firstDose && sIdx >= pageStartIdx && sIdx <= pageEndIdx && !drug.startUnknown) {
                        ctx.textAlign = "right";
                        ctx.fillText(drug.firstDose, xS - 8, y + 4);
                    }

                    // 👉 นำ Last Dose กลับมา! (วาดฝั่งขวาของเส้น)
                    if (drug.lastDose && eIdx >= pageStartIdx && eIdx <= pageEndIdx && !drug.ongoing) {
                        ctx.textAlign = "left";
                        ctx.fillText(drug.lastDose, xE + 12, y + 4);
                    }

                    const drawDurationSafe = (sDateObj, eDateObj, isOngoing) => {
                        let ss = sDateObj.toISOString().split('T')[0], es = isOngoing ? datePoints[datePoints.length-1] : eDateObj.toISOString().split('T')[0];
                        let si = datePoints.indexOf(ss), ei = datePoints.indexOf(es);
                        if (si === -1) si = 0; if (ei === -1) ei = datePoints.length - 1;
                        if (ei < pageStartIdx || si > pageEndIdx) return;
                        let vxS = Math.max(pLeft, pLeft + ((si - pageStartIdx) * interval)), vxE = Math.min(A4_WIDTH - pRight, pLeft + ((ei - pageStartIdx) * interval));
                        let mx = (vxS + vxE) / 2;
                        const dd = Math.round(Math.abs(eDateObj - sDateObj) / (1000 * 60 * 60 * 24));
                        if (dd > 0) {
                            ctx.fillStyle = "#d97706"; ctx.textAlign = "center";
                            ctx.font = `bold ${Math.max(8, dose_fontSize - 1)}px Sarabun, sans-serif`;
                            ctx.fillText(dd + ' วัน', mx, y+14);
                        }
                    }

                    if (!drug.startUnknown) {
                        const drugStartDate = new Date(drug.start), drugEndDate = drug.ongoing ? new Date('9999-12-31') : new Date(drug.end);
                        const iRx = items.filter(it => (it.type==='reaction'||it.type==='lab')).filter(it => { const rd = new Date(it.start); return rd >= drugStartDate && rd <= drugEndDate; }).sort((a,b) => new Date(a.start)-new Date(b.start));
                        if (iRx.length === 0) { drawDurationSafe(drugStartDate, drug.ongoing ? new Date(datePoints[datePoints.length-1]) : drugEndDate, drug.ongoing); }
                        else {
                            let pd = drugStartDate;
                            iRx.forEach(it => { let rd = new Date(it.start); drawDurationSafe(pd, rd, false); pd = rd; });
                            let fd = drug.ongoing ? new Date(datePoints[datePoints.length-1]) : drugEndDate;
                            if (fd > pd) drawDurationSafe(pd, fd, drug.ongoing);
                        }
                    }
                    ctx.textAlign = "left"; // คืนค่าเริ่มต้นให้ Canvas
                }
            });
        });

        // วาด Lab (L) และ ADR (R)
        const pageEvents = items.filter(it => {
            let gi = datePoints.indexOf(it.start);
            return (it.type==='reaction' || it.type==='lab') && (gi >= pageStartIdx && gi <= pageEndIdx);
        });

        const conflictDates = {};
        pageEvents.forEach(ev => {
            if (!conflictDates[ev.start]) conflictDates[ev.start] = { hasLab: false, hasRx: false };
            if (ev.type === 'lab') conflictDates[ev.start].hasLab = true;
            if (ev.type === 'reaction') conflictDates[ev.start].hasRx = true;
        });

        const eventCountOnDate = {};

        pageEvents.forEach(ev => {
            let rxX = pLeft + ((datePoints.indexOf(ev.start) - pageStartIdx) * interval);

            if (conflictDates[ev.start].hasLab && conflictDates[ev.start].hasRx) {
                if (ev.type === 'lab') rxX -= 3;
                if (ev.type === 'reaction') rxX += 3;
            }

            ctx.strokeStyle = (ev.type === 'reaction') ? "#ef4444" : "#8b5cf6";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(rxX, paddingTop-10); ctx.lineTo(rxX, timelineBottom+20); ctx.stroke();
            drawArrowDown(rxX, timelineBottom+20, ctx.strokeStyle);

            if (!eventCountOnDate[ev.start]) eventCountOnDate[ev.start] = 0;
            let txtY = timelineBottom + 32 + (eventCountOnDate[ev.start] * 14);

            if(ev.type === 'reaction') {
                ctx.fillStyle="#ef4444"; ctx.font="bold 12px Sarabun, sans-serif"; ctx.textAlign="center";
                ctx.fillText(`(R${reactions.indexOf(ev)+1})`, rxX, txtY);
            } else if (ev.type === 'lab') {
                ctx.fillStyle="#7c3aed"; ctx.font="bold 12px Sarabun, sans-serif"; ctx.textAlign="center";
                ctx.fillText(`(L${labs.indexOf(ev)+1})`, rxX, txtY);
            }

            eventCountOnDate[ev.start]++;
        });

        // สรุปเหตุการณ์และ Lab ท้ายกระดาษ
        let currentBottomY = timelineBottom + 45;

        const maxEventsOnSameDay = Math.max(0, ...Object.values(eventCountOnDate));
        if (maxEventsOnSameDay > 1) currentBottomY += ((maxEventsOnSameDay - 1) * 14);

        if (pageEvents.length > 0) {
            ctx.fillStyle = "#1e293b"; ctx.font = `bold ${title_fontSize}px Sarabun, sans-serif`; ctx.textAlign = "left";
            ctx.fillText("สรุปเหตุการณ์ทางคลินิกและผลแล็บในหน้านี้:", 20, currentBottomY);
            currentBottomY += (title_fontSize + 8);

            const grouped = {};
            pageEvents.forEach(ev => {
                if (!grouped[ev.start]) grouped[ev.start] = { labs: [], reactions: [] };
                if (ev.type === 'lab') grouped[ev.start].labs.push({ name: ev.name, i: labs.indexOf(ev)+1 });
                else grouped[ev.start].reactions.push({ name: ev.name, i: reactions.indexOf(ev)+1 });
            });

            Object.keys(grouped).sort().forEach(date => {
                const data = grouped[date];
                let currentX = 40;
                ctx.font = `${adr_fontSize}px Sarabun, sans-serif`;

                if (data.labs.length > 0) {
                    ctx.fillStyle = "#7c3aed";
                    const txt = data.labs.map(l => `L${l.i}: ${l.name}`).join(", ");
                    ctx.fillText(txt, currentX, currentBottomY);
                    currentX += ctx.measureText(txt + (data.reactions.length? " | ":"")).width;
                }
                if (data.reactions.length > 0) {
                    ctx.fillStyle = "#b91c1c";
                    const txt = data.reactions.map(r => `R${r.i}: ${r.name}`).join(", ");
                    ctx.fillText(txt, currentX, currentBottomY);
                    currentX += ctx.measureText(txt).width;
                }
                ctx.fillStyle = "#64748b";
                ctx.fillText(` (${formatLongThaiDate(date)})`, currentX, currentBottomY);
                currentBottomY += adr_lineHeight;
            });
        }

        // โน้ตเภสัชกร
        if (p === totalPages - 1 && noteText) {
            currentBottomY += 10;
            ctx.fillStyle="#1e293b"; ctx.font=`bold ${title_fontSize}px Sarabun, sans-serif`;
            ctx.fillText("Pharmacist Note / Clinical Comment:", 20, currentBottomY);
            ctx.font=`${note_fontSize}px Sarabun, sans-serif`; ctx.fillStyle="#334155";
            wrapText(ctx, noteText, 40, currentBottomY + (title_fontSize + 5), A4_WIDTH - 80, note_lineHeight, false);
        }

        ctx.fillStyle="#94a3b8"; ctx.font="12px Sarabun, sans-serif"; ctx.textAlign="right";
        ctx.fillText(`หน้า ${p+1} / ${totalPages}`, A4_WIDTH - 20, startY + A4_HEIGHT - 15);
    }
}

function drawCircle(x, y, isFilled, color){ ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke(); if(isFilled){ ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fillStyle=color; ctx.fill(); } }
function drawArrowRight(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-8, y-6); ctx.lineTo(x-8, y+6); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
function drawArrowLeft(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+8, y-6); ctx.lineTo(x+8, y+6); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
function drawArrowDown(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-6, y-10); ctx.lineTo(x+6, y-10); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }

// 🌟 ระบบดาวน์โหลด PDF (รองรับ Multi-Page อัตโนมัติ)
async function exportPDF() {
    if (items.length === 0) return alert('ยังไม่มีข้อมูลยาหรืออาการแพ้สำหรับสร้าง PDF ครับ');
    if (!window.jspdf) return alert('ไม่พบไลบรารี jsPDF กรุณาตรวจสอบว่าได้เพิ่ม Script ในไฟล์ HTML แล้ว');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'px', [A4_WIDTH, A4_HEIGHT]);

    // คำนวณหาจำนวนหน้าทั้งหมดจากความสูงของ Canvas
    const canvasActualHeight = parseInt(canvas.style.height, 10);
    const totalPages = Math.round(canvasActualHeight / A4_HEIGHT);

    const marginLeft = 15;
    const marginRight = 15;
    const marginTop = 15;
    const marginBottom = 15;

    const printWidth = A4_WIDTH - marginLeft - marginRight;
    const printHeight = A4_HEIGHT - marginTop - marginBottom;

    // ลูปตัดภาพทีละหน้ากระดาษ
    for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        // สร้าง Canvas ชั่วคราวเพื่อรับภาพที่โดนหั่นมาแต่ละหน้า
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = A4_WIDTH * 4; // DPR=4
        pageCanvas.height = A4_HEIGHT * 4;
        const pCtx = pageCanvas.getContext('2d');

        // ก๊อปปี้ภาพเฉพาะความสูงของหน้านั้นๆ มาวาง
        pCtx.drawImage(canvas, 0, i * A4_HEIGHT * 4, A4_WIDTH * 4, A4_HEIGHT * 4, 0, 0, A4_WIDTH * 4, A4_HEIGHT * 4);

        // แปะลง PDF
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', marginLeft, marginTop, printWidth, printHeight);
    }

    const pName = document.getElementById('patientName').value.trim();
    const pHN = document.getElementById('patientHN').value.trim();
    const d = new Date();
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let fileName = `ADR_Timeline`;
    if (pName) fileName += `_${pName.replace(/\s+/g, '_')}`;
    if (pHN) fileName += `_HN${pHN}`;
    if (!pName && !pHN) fileName += `_ไม่ระบุผู้ป่วย`;
    fileName += `_${dateString}.pdf`;

    pdf.save(fileName);
}
// =========================================
// 📂 ระบบจัดการไฟล์ (รองรับการเซฟทับไฟล์เดิม)
// =========================================

// แยกส่วนประมวลผล JSON ออกมาเพื่อใช้ร่วมกัน
function processJSONData(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);
        if (importedData.header) {
            document.getElementById('hospitalName').value = importedData.header.hospitalName || '';
            document.getElementById('patientName').value = importedData.header.patientName || '';
            document.getElementById('patientHN').value = importedData.header.patientHN || '';
            document.getElementById('patientAN').value = importedData.header.patientAN || '';
            document.getElementById('reportDate').value = importedData.header.reportDate || '';
            document.getElementById('preparedBy').value = importedData.header.preparedBy || '';
            document.getElementById('pharmaNote').value = importedData.header.pharmaNote || '';
        }
        if (importedData.items && Array.isArray(importedData.items)) { items = importedData.items; }
        updateUI();
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        alert('📂 โหลดข้อมูลเข้าสู่ระบบเรียบร้อยแล้วครับ!');
    } catch (error) {
        alert('❌ เกิดข้อผิดพลาดในการอ่านไฟล์');
        console.error(error);
    }
}

// ฟังก์ชันเปิดไฟล์ (แบบใหม่)
async function triggerFileInput() {
    // เช็คว่าเบราว์เซอร์รองรับระบบเปิดไฟล์แบบใหม่ไหม
    if ('showOpenFilePicker' in window) {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
            });
            currentFileHandle = fileHandle; // จำไฟล์นี้ไว้เพื่อใช้เซฟทับในอนาคต!
            const file = await fileHandle.getFile();
            const text = await file.text();
            processJSONData(text);
        } catch (error) {
            if (error.name !== 'AbortError') console.error(error);
        }
    } else {
        // ถ้าไม่รองรับ (เช่นในมือถือ หรือ Safari) ให้ใช้ระบบเดิม
        document.getElementById('fileInput').click();
    }
}

// ฟังก์ชันเปิดไฟล์ (แบบเก่าสำหรับระบบที่ไม่รองรับ)
function loadDataFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        currentFileHandle = null; // แบบเก่าเซฟทับไม่ได้ ต้องเคลียร์ handle ทิ้ง
        processJSONData(e.target.result);
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ฟังก์ชันเซฟไฟล์ (แบบใหม่ เซฟทับได้)
// =========================================
// 🌟 1. ฟังก์ชันสร้างหน้าต่าง Popup ถามรูปแบบการบันทึก (Custom Modal)
// =========================================
function promptSaveOptions() {
    return new Promise((resolve) => {
        // สร้างกรอบพื้นหลังสีดำโปร่งแสง
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);";

        // สร้างกล่อง Popup
        const box = document.createElement('div');
        box.style.cssText = "background:#fff; padding:30px; border-radius:12px; width:95%; max-width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);";

        // ใส่เนื้อหาและปุ่มกด
        box.innerHTML = `
            <h3 style="margin-top:0; color:#0f766e; font-family:'Sarabun', sans-serif;">💾 เลือกรูปแบบการบันทึก</h3>
            <p style="color:#64748b; font-size:14px; margin-bottom:20px; font-family:'Sarabun', sans-serif;">คุณกำลังแก้ไขจากไฟล์เดิมที่เคยมีอยู่ ต้องการบันทึกข้อมูลนี้แบบใด?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btnOverwrite" style="background:#0f766e; color:#fff; border:none; padding:12px; border-radius:8px; cursor:pointer; font-family:'Sarabun', sans-serif; font-weight:bold; font-size:15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">📝 บันทึกทับไฟล์เดิม</button>
                <button id="btnSaveNew" style="background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:8px; cursor:pointer; font-family:'Sarabun', sans-serif; font-weight:bold; font-size:15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">📄 บันทึกเป็นไฟล์ใหม่ (Save As)</button>
                <button id="btnCancelSave" style="background:#f1f5f9; color:#ef4444; border:none; padding:10px; border-radius:8px; cursor:pointer; font-family:'Sarabun', sans-serif; font-size:14px; margin-top:5px; font-weight:600;">❌ ยกเลิก</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // ดักจับการกดปุ่มต่างๆ
        document.getElementById('btnOverwrite').onclick = () => { document.body.removeChild(overlay); resolve('overwrite'); };
        document.getElementById('btnSaveNew').onclick = () => { document.body.removeChild(overlay); resolve('save_new'); };
        document.getElementById('btnCancelSave').onclick = () => { document.body.removeChild(overlay); resolve('cancel'); };
    });
}

// =========================================
// 🌟 2. ฟังก์ชันเซฟไฟล์ (อัปเกรดวันที่ + เรียกใช้ Popup)
// =========================================
async function saveDataToFile() {
    if (items.length === 0 && !document.getElementById('patientName').value) return alert('ยังไม่มีข้อมูลสำหรับบันทึกครับ');

    // 💡 ฟีเจอร์ใหม่: อัปเดตวันที่จัดทำ (Report Date) เป็น "วันนี้" อัตโนมัติ ก่อนเซฟ
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const reportDateEl = document.getElementById('reportDate');
    if (reportDateEl._flatpickr) {
        reportDateEl._flatpickr.setDate(todayStr); // อัปเดตในปฏิทิน
    } else {
        reportDateEl.value = todayStr; // อัปเดตในช่องกรอก
    }
    updateUI(); // สั่งให้ Canvas วาดใหม่เพื่อเปลี่ยนวันที่มุมขวาบนให้เป็นวันนี้ด้วย

    const exportData = {
        header: {
            hospitalName: document.getElementById('hospitalName').value,
            patientName: document.getElementById('patientName').value,
            patientHN: document.getElementById('patientHN').value,
            patientAN: document.getElementById('patientAN').value,
            reportDate: document.getElementById('reportDate').value,
            preparedBy: document.getElementById('preparedBy').value,
            pharmaNote: document.getElementById('pharmaNote').value
        },
        items: items
    };

    const dataStr = JSON.stringify(exportData, null, 2);

    // อัปเดตประวัติล่าสุด
    localStorage.setItem('endoPharma_fileHistory', dataStr);

    // สร้างชื่อไฟล์อัตโนมัติ (จะใช้วันที่ของวันนี้เสมอ)
    const pName = document.getElementById('patientName').value.trim();
    const pHN = document.getElementById('patientHN').value.trim();
    let fileName = `ADR_Timeline`;
    if (pName) fileName += `_${pName.replace(/\s+/g, '_')}`;
    if (pHN) fileName += `_HN${pHN}`;
    if (!pName && !pHN) fileName += `_ไม่ระบุผู้ป่วย`;
    fileName += `_${todayStr}.json`; // ใช้วันที่ล่าสุดต่อท้ายชื่อไฟล์

    if ('showSaveFilePicker' in window) {
        try {
            // 💡 ถ้ามีการเปิดไฟล์เดิมอยู่ ให้เรียก Popup ถามผู้ใช้ก่อน
            if (currentFileHandle) {
                const saveChoice = await promptSaveOptions();

                if (saveChoice === 'cancel') return; // ยกเลิกการเซฟ

                if (saveChoice === 'save_new') {
                    currentFileHandle = null; // เคลียร์ความจำไฟล์เดิม เพื่อบังคับให้ระบบสร้างไฟล์ใหม่
                }
                // ถ้าเลือก 'overwrite' currentFileHandle จะคงเดิมไว้สำหรับเขียนทับ
            }

            if (!currentFileHandle) {
                currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
                });
            }

            const writable = await currentFileHandle.createWritable();
            await writable.write(dataStr);
            await writable.close();

            const saveBtn = document.querySelector('button[onclick="saveDataToFile()"]');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '✅ บันทึกข้อมูลเรียบร้อย!';
            saveBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.style.backgroundColor = '';
            }, 2000);

            return;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Save error:', error);
                fallbackDownload(dataStr, fileName);
            }
            return;
        }
    }

    fallbackDownload(dataStr, fileName);
}

// ระบบดาวน์โหลดแบบดั้งเดิม (เผื่อฉุกเฉิน)
function fallbackDownload(dataStr, fileName) {
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('💾 ดาวน์โหลดไฟล์สำเร็จ (ระบบไม่รองรับการเซฟทับบนเบราว์เซอร์นี้)');
}

const naranjoQuestions = [
    { q: "1. เคยมีการสรุปหรือรายงานปฏิกิริยานี้กับยาชนิดนี้มาแล้วหรือไม่?", scores: [1, 0, 0] },
    { q: "2. อาการไม่พึงประสงค์นี้เกิดขึ้นหลังจากได้รับยาที่คิดว่าเป็นสาเหตุหรือไม่?", scores: [2, -1, 0] },
    { q: "3. อาการไม่พึงประสงค์นี้ดีขึ้นเมื่อหยุดยาดังกล่าว หรือเมื่อให้ยาต้านที่เฉพาะเจาะจง (specific antagonist) หรือไม่?", scores: [1, 0, 0] },
    { q: "4. อาการไม่พึงประสงค์ดังกล่าวเกิดขึ้นอีกเมื่อเริ่มให้ยาใหม่หรือไม่?", scores: [2, -1, 0] },
    { q: "5. มีปฏิกิริยาที่เกิดขึ้นสามารถเกิดจากสาเหตุอื่น (นอกเหนือจากยา) ของผู้ป่วยได้หรือไม่?", scores: [-1, 2, 0] },
    { q: "6. ปฏิกิริยาดังกล่าวเกิดขึ้นอีก เมื่อให้ยาหลอกหรือไม่?", scores: [-1, 1, 0] },
    { q: "7. สามารถตรวจวัดปริมาณยาได้ในเลือด (หรือของเหลวอื่น) ในปริมาณความเข้มข้นที่เป็นพิษหรือไม่?", scores: [1, 0, 0] },
    { q: "8. ปฏิกิริยารุนแรงขึ้น เมื่อเพิ่มขนาดยาหรือลดความรุนแรงลงเมื่อลดขนาดยาหรือไม่?", scores: [1, 0, 0] },
    { q: "9. ผู้ป่วยเคยมีปฏิกิริยาเหมือนหรือคล้ายคลึงกันนี้มาก่อนในการได้รับยาครั้งก่อนๆ หรือไม่?", scores: [1, 0, 0] },
    { q: "10. อาการไม่พึงประสงค์นี้ ได้รับการยืนยันโดยมีผลปฏิบัติการหรือผลจากการตรวจสอบอื่นๆยืนยัน (objective evidence)?", scores: [1, 0, 0] }
];

function formatScore(score) { return score > 0 ? `(+${score})` : `(${score})`; }

function openNaranjo() {
    const tbody = document.getElementById('naranjoBody'); tbody.innerHTML = '';
    naranjoQuestions.forEach((item, index) => {
        tbody.innerHTML += `<tr>
            <td>${item.q}</td>
            <td style="text-align:center;"><label class="radio-label"><input type="radio" name="nq${index}" value="${item.scores[0]}" onchange="calculateNaranjo()"> <span class="score-hint">${formatScore(item.scores[0])}</span></label></td>
            <td style="text-align:center;"><label class="radio-label"><input type="radio" name="nq${index}" value="${item.scores[1]}" onchange="calculateNaranjo()"> <span class="score-hint">${formatScore(item.scores[1])}</span></label></td>
            <td style="text-align:center;"><label class="radio-label"><input type="radio" name="nq${index}" value="${item.scores[2]}" checked onchange="calculateNaranjo()"> <span class="score-hint">${formatScore(item.scores[2])}</span></label></td>
        </tr>`;
    });
    calculateNaranjo(); document.getElementById('naranjoModal').style.display = "block";
}

function closeNaranjo() { document.getElementById('naranjoModal').style.display = "none"; }
window.onclick = function(e) { if (e.target == document.getElementById('naranjoModal')) closeNaranjo(); }

function calculateNaranjo() {
    let totalScore = 0;
    for (let i = 0; i < naranjoQuestions.length; i++) {
        const selected = document.querySelector(`input[name="nq${i}"]:checked`);
        if (selected) totalScore += parseInt(selected.value);
    }
    let level = totalScore >= 9 ? "Definite (ใช่แน่)" : totalScore >= 5 ? "Probable (น่าจะใช่)" : totalScore >= 1 ? "Possible (อาจจะใช่)" : "Doubtful (น่าสงสัย)";
    let color = totalScore >= 9 ? "#c0392b" : totalScore >= 5 ? "#d35400" : totalScore >= 1 ? "#f39c12" : "#7f8c8d";

    document.getElementById('naranjoTotal').innerText = `คะแนนรวม: ${totalScore}`;
    const levelEl = document.getElementById('naranjoLevel');
    levelEl.innerText = `${level}`;
    levelEl.style.color = color;
}

// =========================================
// ฟังก์ชันดูรูปเต็มจอ (Fullscreen Image)
// =========================================
function openFullscreen() {
    if (items.length === 0) return alert('ยังไม่มีข้อมูลยาหรืออาการแพ้สำหรับแสดงผลครับ');

    // แปลง Canvas เป็นรูปภาพ PNG แบบคมชัด
    const dataURL = canvas.toDataURL("image/png");
    const imgElement = document.getElementById("expandedImg");
    imgElement.src = dataURL;

    // แสดง Modal
    document.getElementById("imageModal").style.display = "block";
}

function closeFullscreen() {
    document.getElementById("imageModal").style.display = "none";
}

// ปิดรูปภาพเมื่อคลิกที่พื้นที่สีดำรอบๆ รูประหว่างที่เปิดอยู่
window.addEventListener('click', function(e) {
    const imgModal = document.getElementById('imageModal');
    if (e.target === imgModal) {
        closeFullscreen();
    }
});

// --- ระบบประเมินผื่น SCARs BSA ---
function openBSAModal() {
    document.getElementById('bsaSkinModal').style.display = 'flex';
}

function closeBSAModal() {
    document.getElementById('bsaSkinModal').style.display = 'none';
}

// ปิด Modal เมื่อคลิกพื้นที่ว่างข้างนอก
window.onclick = function(event) {
    let modal = document.getElementById('bsaSkinModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
}

function toggleSkinBSA(element) {
    // สลับคลาส selected (เปลี่ยนสีเป็นสีแดง)
    element.classList.toggle('selected');
    calculateSkinBSA();
}

function calculateSkinBSA() {
    let total = 0;
    const selectedParts = document.querySelectorAll('.bsa-part.selected');
    selectedParts.forEach(part => {
        total += parseFloat(part.getAttribute('data-percent'));
    });

    // 💡 จัดการทศนิยมให้แม่นยำ (เช่น 6.00 ให้โชว์ 6, ถ้า 1.25 ให้โชว์ 1.25)
    let formattedTotal = parseFloat(total.toFixed(2));
    document.getElementById('skinBsaTotal').innerText = formattedTotal;

    let severityText = "";
    if (formattedTotal > 0 && formattedTotal <= 10) {
        severityText = "SJS (Stevens-Johnson syndrome): ผิวหนังลอก ≤ 10%";
    } else if (formattedTotal > 10 && formattedTotal < 30) {
        severityText = "SJS/TEN Overlap: ผิวหนังลอก 10% - 30%";
    } else if (formattedTotal >= 30) {
        severityText = "TEN (Toxic Epidermal Necrolysis): ผิวหนังลอก ≥ 30%";
    } else {
        severityText = ""; // ซ่อนถ้ายกเลิกจนเหลือ 0
    }
    document.getElementById('scarSeverity').innerText = severityText;
}

// ฟังก์ชันคัดลอกผลประเมินไปใส่ในช่อง Pharmacist Note อัตโนมัติ
function copyBSAtoNote() {
    const total = document.getElementById('skinBsaTotal').innerText;
    if (total == 0) return alert("กรุณาเลือกพื้นที่ผื่นก่อนครับ");

    const noteEl = document.getElementById('pharmaNote');
    const severity = document.getElementById('scarSeverity').innerText;

    let textToAdd = `\n[การประเมินผื่น]: กินพื้นที่ร่างกาย ${total}% (${severity})`;

    noteEl.value = noteEl.value + textToAdd;
    updateUI(); // อัปเดต Timeline
    closeBSAModal();
}

// ฟังก์ชันจัดการตอนกดปุ่ม
function selectDress(groupId, btnElement, value) {
    // 1. ล้างสถานะ active ของปุ่มทั้งหมดในกลุ่มเดียวกัน
    const group = document.getElementById(groupId);
    const buttons = group.querySelectorAll('.dress-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // 2. ใส่สถานะ active ให้ปุ่มที่ถูกกด
    btnElement.classList.add('active');

    // 3. เก็บค่าคะแนนลงในกล่องแม่
    group.setAttribute('data-val', value);

    // 4. สั่งคำนวณใหม่
    calculateDress();
}

// ฟังก์ชันคำนวณและแสดงผล (ปรับให้ดึงค่าจากปุ่มแทน Select)
function calculateDress() {
    let total = 0;

    // ดึงค่าจากกล่องทุกอันมาบวกกัน
    for(let i=1; i<=10; i++) {
        const group = document.getElementById('dress-g' + i);
        if(group) {
            total += parseInt(group.getAttribute('data-val'));
        }
    }

    document.getElementById('dressTotal').innerText = total;

    let level = "";
    if (total >= 6) {
        level = "Definite (ใช่แน่นอน)";
        document.getElementById('dressLevel').style.color = "#b91c1c"; // แดง
    } else if (total >= 4) {
        level = "Probable (น่าจะใช่)";
        document.getElementById('dressLevel').style.color = "#ea580c"; // ส้ม
    } else if (total >= 2) {
        level = "Possible (อาจจะใช่)";
        document.getElementById('dressLevel').style.color = "#ca8a04"; // เหลือง
    } else {
        level = "No case (ไม่ใช่)";
        document.getElementById('dressLevel').style.color = "#14b8a6"; // สีเขียวเหมือนในรูป
    }

    document.getElementById('dressLevel').innerText = `ระดับความน่าจะเป็น: ${level}`;
}

// ==========================================
// ระบบประเมิน RegiSCAR DRESS Score
// ==========================================

function openDressModal() {
    const modal = document.getElementById('dressModal');
    if(modal) {
        modal.style.display = 'flex';
        calculateDress(); // คำนวณค่าเริ่มต้นเมื่อเปิด
    } else {
        alert("หาหน้าต่าง DRESS ไม่เจอครับ เช็คว่าใส่โค้ด HTML หรือยัง");
    }
}

function closeDressModal() {
    document.getElementById('dressModal').style.display = 'none';
}

function selectDress(groupId, btnElement, value) {
    const group = document.getElementById(groupId);
    const buttons = group.querySelectorAll('.dress-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    btnElement.classList.add('active');
    group.setAttribute('data-val', value);

    calculateDress();
}

function calculateDress() {
    let total = 0;
    for(let i=1; i<=10; i++) {
        const group = document.getElementById('dress-g' + i);
        if(group) {
            total += parseInt(group.getAttribute('data-val'));
        }
    }

    const totalEl = document.getElementById('dressTotal');
    const levelEl = document.getElementById('dressLevel');

    if(totalEl && levelEl) {
        totalEl.innerText = total;

        let level = "";
        if (total >= 6) {
            level = "Definite (ใช่แน่นอน)";
            levelEl.style.color = "#b91c1c";
        } else if (total >= 4) {
            level = "Probable (น่าจะใช่)";
            levelEl.style.color = "#ea580c";
        } else if (total >= 2) {
            level = "Possible (อาจจะใช่)";
            levelEl.style.color = "#ca8a04";
        } else {
            level = "No case (ไม่ใช่)";
            levelEl.style.color = "#14b8a6";
        }
        levelEl.innerText = `ระดับความน่าจะเป็น: ${level}`;
    }
}

function copyDRESStoNote() {
    const total = document.getElementById('dressTotal').innerText;
    const levelStr = document.getElementById('dressLevel').innerText.replace('ระดับความน่าจะเป็น: ', '');
    const noteEl = document.getElementById('pharmaNote');

    if(noteEl) {
        let textToAdd = `\n[การประเมิน RegiSCAR DRESS]: ได้ ${total} คะแนน (${levelStr})`;
        noteEl.value = noteEl.value + textToAdd;
        if (typeof updateUI === 'function') updateUI();
    }
    closeDressModal();
}

// ระบบดักคลิกพื้นหลัง (รวมทุก Modal)
window.onclick = function(event) {
    let naranjoModal = document.getElementById('naranjoModal');
    let bsaModal = document.getElementById('bsaSkinModal');
    let dressModal = document.getElementById('dressModal');

    if (event.target === naranjoModal) naranjoModal.style.display = "none";
    if (event.target === bsaModal) bsaModal.style.display = "none";
    if (event.target === dressModal) dressModal.style.display = "none";
}