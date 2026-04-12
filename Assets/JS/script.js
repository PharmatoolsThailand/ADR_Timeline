const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');
let items = [];
let editingId = null;

const A4_WIDTH = 1123;
const A4_HEIGHT = 794;

// เก็บตัวแปรของปฏิทินไว้เผื่อต้องจัดการตอนกด Disable
let drugStartPicker, drugEndPicker;

window.onload = function() {
    const savedHosp = localStorage.getItem('savedHospitalName');
    if (savedHosp) document.getElementById('hospitalName').value = savedHosp;

    // เอาโค้ด .valueAsDate = new Date() แบบเดิมออก เพราะเราจะใช้ Flatpickr จัดการแทน

    document.getElementById('pharmaNote').addEventListener('input', updateUI);
    document.fonts.ready.then(function() { updateUI(); });

    // ==========================================
    // 🌟 ตั้งค่า Flatpickr สำหรับปฏิทิน (แก้ปัญหา iOS)
    // ==========================================

    const flatpickrConfig = {
        locale: "th",
        dateFormat: "Y-m-d",
        disableMobile: true, // 🚨 บังคับให้มือถือใช้ UI ปฏิทินแบบเดียวกับ PC
        altInput: true,
        altFormat: "j F Y",
    };

    // 1. วันที่จัดทำประวัติ (ตั้งค่าให้เป็นวันปัจจุบันอัตโนมัติ)
    flatpickr("#reportDate", {
        ...flatpickrConfig,
        defaultDate: "today"
    });

    // 2. วันที่เกิดอาการแพ้
    flatpickr("#reactionDate", flatpickrConfig);

    // 3. วันที่เริ่มยา และ วันที่หยุดยา (เก็บตัวแปรไว้จัดการเปิด/ปิด)
    drugStartPicker = flatpickr("#drugStart", flatpickrConfig);
    drugEndPicker = flatpickr("#drugEnd", flatpickrConfig);
};

['hospitalName', 'patientName', 'patientHN', 'patientAN', 'reportDate', 'preparedBy'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
        this.classList.remove('is-invalid');
        updateUI();
    });
});

document.getElementById('drugOngoing').addEventListener('change', function() {
    const el = document.getElementById('drugEnd');
    if (this.checked) {
        drugEndPicker.clear(); // ล้างค่าวันที่ออก
        el.disabled = true; // ปิดการพิมพ์
        el.nextElementSibling.disabled = true; // ปิดปฏิทินของ Flatpickr
        el.nextElementSibling.style.backgroundColor = '#f1f5f9';
    } else {
        el.disabled = false;
        el.nextElementSibling.disabled = false;
        el.nextElementSibling.style.backgroundColor = '#fff';
    }
    el.classList.remove('is-invalid');
});

document.getElementById('drugStartUnknown').addEventListener('change', function() {
    const el = document.getElementById('drugStart');
    if (this.checked) {
        drugStartPicker.clear();
        el.disabled = true;
        el.nextElementSibling.disabled = true;
        el.nextElementSibling.style.backgroundColor = '#f1f5f9';
    } else {
        el.disabled = false;
        el.nextElementSibling.disabled = false;
        el.nextElementSibling.style.backgroundColor = '#fff';
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

        if (!nameEl.value.trim()) { markInvalid('drugName'); isValid = false; }
        if (!unknown && !startEl.value) { markInvalid('drugStart'); isValid = false; }
        if (!ongoing && !endEl.value) { markInvalid('drugEnd'); isValid = false; }

        if (!isValid) return alert('กรุณากรอกข้อมูลยาในช่องที่มีกรอบสีแดงให้ครบถ้วนครับ');

        const name = nameEl.value.trim();
        const fullName = dose ? `${name} (${dose})` : name;
        newItem = {
            id: editingId || Date.now(),
            name: fullName, rawName: name, dose,
            start: unknown ? null : startEl.value,
            end: ongoing ? null : endEl.value,
            ongoing, startUnknown: unknown, type: 'drug'
        };
    } else {
        const nameEl = document.getElementById('reactionName');
        const dateEl = document.getElementById('reactionDate');

        if (!nameEl.value.trim()) { markInvalid('reactionName'); isValid = false; }
        if (!dateEl.value) { markInvalid('reactionDate'); isValid = false; }

        if (!isValid) return alert('กรุณาระบุลักษณะอาการที่พบและวันที่ให้ครบถ้วนครับ');

        newItem = { id: editingId || Date.now(), name: nameEl.value.trim(), rawName: nameEl.value.trim(), start: dateEl.value, end: null, type: 'reaction' };
    }

    if (editingId) {
        const idx = items.findIndex(i => i.id === editingId);
        if (idx !== -1) items[idx] = newItem;
    } else items.push(newItem);

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
        document.getElementById('drugStartUnknown').checked = item.startUnknown;

        // จัดการเรื่องปฏิทิน Flatpickr
        if (drugStartPicker) {
            drugStartPicker.setDate(item.start || '');
        } else {
            document.getElementById('drugStart').value = item.start || '';
        }

        document.getElementById('drugStart').disabled = item.startUnknown;
        document.getElementById('drugOngoing').checked = item.ongoing;

        if (drugEndPicker) {
            drugEndPicker.setDate(item.end || '');
        } else {
            document.getElementById('drugEnd').value = item.end || '';
        }

        document.getElementById('drugEnd').disabled = item.ongoing;
        document.getElementById('btnDrugAdd').innerHTML = '💾 บันทึกการแก้ไข';
        document.getElementById('btnDrugCancel').style.display = 'inline-flex';

        // โฟกัสและเลื่อนมาที่ช่อง "ชื่อยา" ให้อยู่กึ่งกลางจอ
        const targetElement = document.getElementById('drugName');
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else {
        document.getElementById('reactionName').value = item.rawName;

        // จัดการเรื่องปฏิทิน Flatpickr สำหรับอาการแพ้
        const rxPicker = document.getElementById('reactionDate')._flatpickr;
        if (rxPicker) {
            rxPicker.setDate(item.start || '');
        } else {
            document.getElementById('reactionDate').value = item.start || '';
        }

        document.getElementById('btnReactionAdd').innerHTML = '💾 บันทึกการแก้ไข';
        document.getElementById('btnReactionCancel').style.display = 'inline-flex';

        // โฟกัสและเลื่อนมาที่ช่อง "อาการแพ้" ให้อยู่กึ่งกลางจอ
        const targetElement = document.getElementById('reactionName');
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function cancelEdit() {
    editingId = null;
    ['drugName','drugDose','drugStart','drugEnd','reactionName','reactionDate'].forEach(id => {
        const el = document.getElementById(id);
        el.value = ''; el.classList.remove('is-invalid');
    });

    // เคลียร์ปฏิทิน
    if(drugStartPicker) drugStartPicker.clear();
    if(drugEndPicker) drugEndPicker.clear();
    document.getElementById('reactionDate')._flatpickr.clear();

    // รีเซ็ตสถานะปุ่ม
    ['drugOngoing','drugStartUnknown'].forEach(id => document.getElementById(id).checked = false);

    // เปิดการใช้งาน Input ปฏิทินกลับมา
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
    document.getElementById('btnDrugCancel').style.display = 'none';
    document.getElementById('btnReactionCancel').style.display = 'none';
}

function deleteItem(id) { if(confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) { items = items.filter(i => i.id !== id); updateUI(); } }

function clearAll() {
    if(confirm('⚠️ คำเตือน: คุณต้องการล้างข้อมูลทั้งหมดบนหน้าจอใช่หรือไม่? (ข้อมูลที่ยังไม่เซฟจะสูญหาย)')) {
        items = []; cancelEdit(); document.getElementById('pharmaNote').value = '';
        ['patientName', 'patientHN', 'patientAN'].forEach(id => {
            const el = document.getElementById(id); el.value = ''; el.classList.remove('is-invalid');
        });
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
    if (!dateStr) return "วันที่ ......... ............................ พ.ศ. ...............";
    const d = new Date(dateStr);
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `วันที่จัดทำ ${d.getDate()} ${months[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
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

// 🌟 ระบบวาด Timeline
function drawTimeline() {
    const dpr = window.devicePixelRatio || 1;
    const drugs = items.filter(i => i.type === 'drug');
    const reactions = items.filter(i => i.type === 'reaction');

    canvas.width = A4_WIDTH * dpr;
    canvas.height = A4_HEIGHT * dpr;
    canvas.style.width = A4_WIDTH + 'px';
    canvas.style.height = A4_HEIGHT + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

    // 1. วาด Header
    const hName = document.getElementById('hospitalName').value.trim();
    const pName = document.getElementById('patientName').value || ".................................................................................";
    const pHN = document.getElementById('patientHN').value || "........................................";
    const pAN = document.getElementById('patientAN').value || "......................................";
    const rDate = document.getElementById('reportDate').value;
    const pBy = document.getElementById('preparedBy').value;

    ctx.fillStyle = "#1e293b";
    let currentY = 40;

    if (hName) {
        ctx.font = "bold 22px Sarabun, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(hName, A4_WIDTH/2, currentY); currentY += 35;
    } else { currentY += 10; }

    ctx.textAlign = "left"; ctx.font = "16px Sarabun, sans-serif";
    ctx.fillText(`ชื่อผู้ป่วย: ${pName}`, 50, currentY); ctx.fillText(`HN: ${pHN}`, 450, currentY);
    ctx.fillText(`AN: ${pAN}`, 650, currentY); ctx.fillText(formatLongThaiDate(rDate), 840, currentY);

    currentY += 30;
    ctx.fillText(`จัดทำโดย: ${pBy || "................................................................................"}`, 50, currentY);

    // 🌟 ย้าย Legend ขึ้นมาไว้ตรงนี้
    currentY += 0;
    let currentX = 450;
    ctx.fillStyle="#475569"; ctx.font="bold 13px Sarabun, sans-serif"; ctx.fillText("หมายเหตุสัญลักษณ์:", currentX, currentY);
    currentX += 120; drawCircle(currentX+5, currentY-5, false, "#3b82f6"); ctx.fillStyle="#475569"; ctx.font="13px Sarabun, sans-serif"; ctx.fillText("เริ่มยา", currentX+15, currentY);
    currentX += 65; drawArrowLeft(currentX-10, currentY-5, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("ไม่สามารถระบุวันเริ่มได้", currentX+5, currentY);
    currentX += 125; drawCircle(currentX+15, currentY-5, true, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("หยุดยา", currentX+25, currentY);
    currentX += 65; drawArrowRight(currentX+15, currentY-5, "#3b82f6"); ctx.fillStyle="#475569"; ctx.fillText("กำลังใช้ยาอยู่", currentX+20, currentY);
    currentX += 105; drawArrowDown(currentX+5, currentY-0, "#ef4444"); ctx.fillStyle="#ef4444"; ctx.fillText("วันที่เกิดอาการแพ้", currentX+15, currentY);

    currentY += 20; // เพิ่มระยะห่างก่อนขีดเส้นใต้
    ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "#cbd5e1";
    ctx.moveTo(50, currentY); ctx.lineTo(A4_WIDTH-50, currentY); ctx.stroke();

    if (items.length === 0) return;

    // 🌟 2. คำนวณพื้นที่และการปรับขนาด (Scaling Engine)
    const paddingTop = currentY + 40;
    const maxAvailableHeight = A4_HEIGHT - paddingTop - 20; // ลดพื้นที่ขอบล่างเหลือ 20px เพราะย้าย Legend ไปแล้ว

    // ตั้งค่าเริ่มต้น (ขนาดมาตรฐาน)
    let globalScale = 1.0;
    let t_rowHeight = 45;
    let title_fontSize = 15;
    let adr_fontSize = 14;
    let adr_lineHeight = 24;
    let note_fontSize = 14;
    let note_lineHeight = 22;

    let idealAdrH = reactions.length > 0 ? 30 + (reactions.length * 24) : 0;
    ctx.font = "14px Sarabun, sans-serif";
    const noteText = document.getElementById('pharmaNote').value.trim();
    let idealNoteH = noteText ? 35 + wrapText(ctx, noteText, 0, 0, A4_WIDTH - 80, 22, true) : 0;

    let spaceLeftForTimeline = maxAvailableHeight - idealAdrH - idealNoteH - 20;

    if (spaceLeftForTimeline >= (drugs.length * 25)) {
        t_rowHeight = Math.min(45, spaceLeftForTimeline / (drugs.length || 1));
    } else {
        // ย่อส่วนร่วมกันทั้งหมด
        while (globalScale >= 0.4) {
            t_rowHeight = Math.max(16, 45 * globalScale);
            title_fontSize = Math.max(12, Math.floor(15 * globalScale));
            adr_fontSize = Math.max(11, Math.floor(14 * globalScale));
            adr_lineHeight = Math.floor(adr_fontSize * 1.6);
            note_fontSize = Math.max(10, Math.floor(14 * globalScale));
            note_lineHeight = Math.floor(note_fontSize * 1.5);

            let simTimelineH = (drugs.length * t_rowHeight);
            let simAdrH = reactions.length > 0 ? (title_fontSize + 10) + (reactions.length * adr_lineHeight) : 0;

            ctx.font = `${note_fontSize}px Sarabun, sans-serif`;
            let simNoteH = noteText ? (title_fontSize + 10) + wrapText(ctx, noteText, 0, 0, A4_WIDTH - 80, note_lineHeight, true) : 0;

            if (simTimelineH + simAdrH + simNoteH + 20 <= maxAvailableHeight) {
                break;
            }
            globalScale -= 0.02;
        }
    }

    const timeline_fontSize = t_rowHeight < 20 ? 11 : (t_rowHeight < 30 ? 12 : Math.max(12, Math.floor(14 * globalScale)));
    const timelineBottom = paddingTop + (drugs.length * t_rowHeight);

    // 3. เริ่มวาด Timeline ยา
    let datePoints = [...new Set(items.flatMap(i => [i.start, i.end].filter(Boolean)))].sort();
    if(datePoints.length === 0) datePoints = [new Date().toISOString().split('T')[0]];

    const pLeft = 260, pRight = 100, chartW = A4_WIDTH - pLeft - pRight;
    const interval = chartW / (datePoints.length > 1 ? datePoints.length - 1 : 1);
    const getX = (d) => pLeft + (datePoints.indexOf(d) * interval);

    // 🌟 เส้นประแนวตั้ง - ปรับให้สีเข้มขึ้น
    datePoints.forEach(d => {
        const x = getX(d);
        ctx.setLineDash([4,4]);
        ctx.strokeStyle="#94a3b8"; // สีเข้มขึ้นให้อ่านง่าย (Slate-400)
        ctx.beginPath(); ctx.moveTo(x, paddingTop-10); ctx.lineTo(x, timelineBottom+20); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle="#475569"; ctx.font="bold 13px Sarabun, sans-serif";
        ctx.fillText(formatShortThaiDate(d), x-25, paddingTop-20);
    });

    drugs.forEach((drug, i) => {
        const y = paddingTop + (i * t_rowHeight) + t_rowHeight/2;
        const xS = drug.startUnknown ? pLeft - 30 : getX(drug.start);
        const lastX = getX(datePoints[datePoints.length-1]);
        const xE = drug.ongoing ? Math.max(lastX + 40, A4_WIDTH - pRight + 30) : getX(drug.end);

        ctx.fillStyle="#1e293b";
        ctx.font=`${timeline_fontSize}px Sarabun, sans-serif`;
        let displayName = drug.name;
        const maxTextWidth = pLeft - 50;
        if (ctx.measureText(displayName).width > maxTextWidth) {
            while (ctx.measureText(displayName + "...").width > maxTextWidth && displayName.length > 0) {
                displayName = displayName.slice(0, -1);
            }
            displayName += "...";
        }
        ctx.fillText(displayName, 20, y+4);

        ctx.beginPath(); ctx.lineWidth=3; ctx.strokeStyle="#3b82f6";
        ctx.moveTo(xS, y); ctx.lineTo(xE, y); ctx.stroke();

        if (drug.startUnknown) drawArrowLeft(xS, y, "#3b82f6"); else drawCircle(xS, y, false, "#3b82f6");
        if (drug.ongoing) drawArrowRight(xE, y, "#3b82f6"); else drawCircle(xE, y, true, "#3b82f6");
    });

    reactions.forEach((rx, i) => {
        const x = getX(rx.start); ctx.strokeStyle="#ef4444"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x, paddingTop-10); ctx.lineTo(x, timelineBottom+30); ctx.stroke();
        drawArrowDown(x, timelineBottom+30, "#ef4444"); ctx.fillStyle="#ef4444"; ctx.font="bold 14px Sarabun, sans-serif";
        ctx.fillText(`(R${i+1})`, x-12, timelineBottom+50);
    });

    // 4. วาดส่วนท้าย (ADR และ Note)
    let currentBottomY = timelineBottom + 65;

    if (reactions.length > 0) {
        ctx.fillStyle="#1e293b"; ctx.font=`bold ${title_fontSize}px Sarabun, sans-serif`;
        ctx.fillText("สรุปลำดับเหตุการณ์อาการไม่พึงประสงค์ (ADR):", 20, currentBottomY-5);
        reactions.forEach((rx, i) => {
            ctx.font=`${adr_fontSize}px Sarabun, sans-serif`; ctx.fillStyle="#b91c1c";
            ctx.fillText(`R${i+1}: ${rx.name} (${formatShortThaiDate(rx.start)})`, 40, currentBottomY + (title_fontSize + 5) + (i*adr_lineHeight));
        });
        currentBottomY += (title_fontSize + 10) + (reactions.length * adr_lineHeight);
    }

    if (noteText) {
        currentBottomY += -5;
        ctx.fillStyle="#1e293b"; ctx.font=`bold ${title_fontSize}px Sarabun, sans-serif`;
        ctx.fillText("Pharmacist Note", 20, currentBottomY);
        ctx.font=`${note_fontSize}px Sarabun, sans-serif`; ctx.fillStyle="#334155";

        currentBottomY = wrapText(ctx, noteText, 40, currentBottomY + (title_fontSize + 5), A4_WIDTH - 80, note_lineHeight, false);
    }
}

function drawCircle(x, y, isFilled, color){ ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke(); if(isFilled){ ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fillStyle=color; ctx.fill(); } }
function drawArrowRight(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-8, y-6); ctx.lineTo(x-8, y+6); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
function drawArrowLeft(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+8, y-6); ctx.lineTo(x+8, y+6); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
function drawArrowDown(x, y, color){ ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-6, y-10); ctx.lineTo(x+6, y-10); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }

async function exportPDF() {
    if (items.length === 0) return alert('ยังไม่มีข้อมูลยาหรืออาการแพ้สำหรับสร้าง PDF ครับ');
    if (!window.jspdf) return alert('ไม่พบไลบรารี jsPDF กรุณาตรวจสอบว่าได้เพิ่ม Script ในไฟล์ HTML แล้ว');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'px', [A4_WIDTH, A4_HEIGHT]);
    const imgData = canvas.toDataURL('image/jpeg', 1.0);

    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH, A4_HEIGHT);

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

function saveDataToFile() {
    if (items.length === 0 && !document.getElementById('patientName').value) return alert('ยังไม่มีข้อมูลสำหรับบันทึกครับ');

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
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const pName = document.getElementById('patientName').value.trim();
    const pHN = document.getElementById('patientHN').value.trim();
    const d = new Date();
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let fileName = `ADR_Timeline`;
    if (pName) fileName += `_${pName.replace(/\s+/g, '_')}`;
    if (pHN) fileName += `_HN${pHN}`;
    if (!pName && !pHN) fileName += `_ไม่ระบุผู้ป่วย`;
    fileName += `_${dateString}.json`;

    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function triggerFileInput() { document.getElementById('fileInput').click(); }
function loadDataFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
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
    };
    reader.readAsText(file);
    event.target.value = '';
}

const naranjoQuestions = [
    { q: "1. เคยมีการสรุปหรือรายงานปฏิกิริยานี้กับยาชนิดนี้มาแล้วหรือไม่?", scores: [1, 0, 0] },
    { q: "2. อาการไม่พึงประสงค์นี้เกิดขึ้นหลังจากได้รับยาที่คิดว่าเป็นสาเหตุหรือไม่?", scores: [2, -1, 0] },
    { q: "3. อาการไม่พึงประสงค์นี้ดีขึ้นเมื่อหยุดยาดังกล่าว หรือเมื่อให้ยาต้านที่เฉพาะเจาะจง (specific antagonist) หรือไม่?", scores: [1, 0, 0] },
    { q: "4. อาการไม่พึงประสงค์ดังกล่าวเกิดขึ้นอีกเมื่อเริ่มให้ยาใหม่หรือไม่?", scores: [2, -1, 0] },
    { q: "5. มปฏิกิริยาที่เกิดขึ้นสามารถเกิดจากสาเหตุอื่น (นอกเหนือจากยา) ของผู้ป่วยได้หรือไม่?", scores: [-1, 2, 0] },
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