// ==========================================
// 1. การตั้งค่าระบบ (กุญแจ API)
// ==========================================
const LIFF_ID = '2009854880'; // จาก LINE Developers

const SUPABASE_URL = 'https://mtvudwthoxcqnrsjhyrg.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dnVkd3Rob3hjcW5yc2poeXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MjY0NjksImV4cCI6MjA5MjUwMjQ2OX0.f5varZC-9Q-mybLwHzyanzxsgFNGX1U-B7oFkjuTRgA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. ตัวแปรเก็บข้อมูลสำหรับแอป
// ==========================================
let isVipUser = false;
let lineProfile = null;

const currencySymbols = { THB: '฿', USD: '$' };
let appCurrency = localStorage.getItem('myPocketCurrency') || 'THB';

const defaultCategories = {
  income: ['เงินเดือน', 'โบนัส', 'ขายของ', 'อื่นๆ'],
  expense: [
    'อาหาร',
    'เดินทาง',
    'ที่อยู่อาศัย',
    'น้ำไฟ/เน็ต',
    'ช้อปปิ้ง',
    'ความบันเทิง',
    'สุขภาพ',
    'อื่นๆ',
  ],
};
let categories =
  JSON.parse(localStorage.getItem('myPocketCategories')) || defaultCategories;

let appData = [];
let budgetData = {};
let subData = [];
let myChart = null;
let currentImageBase64 = null;

// ==========================================
// 3. ระบบเริ่มต้นแอป
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // ซ่อน Paywall
  document.getElementById('closePaywallBtn')?.addEventListener('click', () => {
    document.getElementById('vipPaywallModal').classList.add('d-none');
  });

  // ผูกระบบกดปุ่มเมนูด้านล่าง
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', function () {
      switchTab(this.getAttribute('data-target'), this);
    });
  });

  // ตั้งค่าวันที่เริ่มต้น
  document.getElementById('dateInput').valueAsDate = new Date();
  document.getElementById('currencySelector').value = appCurrency;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
  document.getElementById('globalStartDate').value = `${yyyy}-${mm}-01`;
  document.getElementById('globalEndDate').value = `${yyyy}-${mm}-${lastDay}`;

  // เตรียมฟอร์ม
  window.updateCategories();
  loadData();

  // เริ่มต้น LINE LIFF
  initializeLiff();
});

// เริ่มต้น LINE LIFF
async function initializeLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      lineProfile = await liff.getProfile();
      document.getElementById('userProfileImg').src = lineProfile.pictureUrl;
      document.getElementById('userProfileImg').classList.remove('d-none');
      document.getElementById('headerTitle').innerHTML = `สวัสดี, ${
        lineProfile.displayName.split(' ')[0]
      }`;

      // เช็คสถานะ VIP ใน Supabase
      checkVipStatus(lineProfile.userId, lineProfile.displayName);
    } else {
      liff.login();
    }
  } catch (err) {
    console.error('LIFF Init Error:', err);
    finishLoading(false);
  }
}

// ==========================================
// 4. ระบบ Database (Supabase)
// ==========================================
async function checkVipStatus(lineId, displayName) {
  document.getElementById('initText').innerHTML = 'กำลังตรวจสอบสถานะบัญชี...';
  try {
    let { data: user, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('line_id', lineId)
      .single();

    if (!user) {
      const { data: newUser, error: insertError } = await supabaseClient
        .from('users')
        .insert([
          { line_id: lineId, display_name: displayName, status: 'Free' },
        ])
        .select()
        .single();
      if (insertError) throw insertError;
      user = newUser;
    }

    isVipUser = user.status === 'VIP';
    setupAppMode();
    finishLoading(true);
  } catch (error) {
    console.error('Supabase Error:', error);
    finishLoading(false);
  }
}

function setupAppMode() {
  const micBtn = document.getElementById('micBtn');
  const vipBadge = document.getElementById('vipBadge');

  if (isVipUser) {
    micBtn.classList.remove('opacity-50');
    micBtn.onclick = window.startVoiceRecognition;
    if (vipBadge) vipBadge.classList.remove('d-none');
  } else {
    micBtn.classList.add('opacity-50');
    micBtn.onclick = () =>
      document.getElementById('vipPaywallModal').classList.remove('d-none');
    if (vipBadge) vipBadge.classList.add('d-none');
  }
}

function finishLoading(isSuccess) {
  setTimeout(() => {
    const loader = document.getElementById('initLoader');
    loader.classList.add('opacity-0');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 500);

    const indicator = document.getElementById('statusIndicator');
    if (indicator)
      indicator.classList.replace(
        'bg-warning',
        isSuccess ? 'bg-success' : 'bg-danger'
      );
  }, 800);
}

// ==========================================
// 5. ระบบจัดการหน้าและ UI
// ==========================================
function switchTab(targetId, btnElement) {
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.add('d-none');
    el.classList.remove('d-block');
  });
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.classList.remove('d-none');
    targetEl.classList.add('d-block');
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    if (btn.id === 'nav-add') return;
    btn.classList.remove('text-primary', 'active');
    btn.classList.add('text-secondary');
  });

  if (btnElement && btnElement.id !== 'nav-add') {
    btnElement.classList.remove('text-secondary');
    btnElement.classList.add('text-primary', 'active');
  }
}

window.changeCurrency = function () {
  appCurrency = document.getElementById('currencySelector').value;
  localStorage.setItem('myPocketCurrency', appCurrency);
  updateDashboard();
};

function formatMoney(amount) {
  return (
    currencySymbols[appCurrency] +
    amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ==========================================
// 6. ระบบบันทึกและดึงข้อมูลหลัก (Transactions)
// ==========================================
async function loadData() {
  // โหลดข้อมูลพื้นฐานจาก LocalStorage (สำหรับการจำลองให้ระบบใช้งานได้ทันที)
  appData = JSON.parse(localStorage.getItem('mockData')) || [];
  budgetData = JSON.parse(localStorage.getItem('mockBudgets')) || {};
  subData = JSON.parse(localStorage.getItem('mockSubs')) || [];

  updateDashboard();

  // (หากต้องการดึงธุรกรรมจาก Supabase ให้นำโค้ดมาใส่ตรงนี้ในอนาคต)
}

window.clearGlobalDate = function () {
  document.getElementById('globalStartDate').value = '';
  document.getElementById('globalEndDate').value = '';
  updateDashboard();
};

window.handleFormSubmit = function (e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  btn.innerHTML =
    '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';
  btn.disabled = true;

  const isIncome = document.getElementById('radioIncome').checked;
  const newData = {
    id: 'TXN' + Date.now(),
    date: document.getElementById('dateInput').value,
    type: isIncome ? 'รายรับ' : 'รายจ่าย',
    category: document.getElementById('categoryInput').value,
    amount: parseFloat(document.getElementById('amountInput').value),
    note: document.getElementById('noteInput').value,
    image: currentImageBase64,
  };

  // บันทึกแบบ Local
  appData.push(newData);
  localStorage.setItem('mockData', JSON.stringify(appData));
  updateDashboard();

  // คืนค่าฟอร์ม
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value = '';
  window.removeImage();
  btn.innerHTML = 'บันทึกข้อมูล';
  btn.disabled = false;
  switchTab('tab-dashboard', document.getElementById('nav-dashboard'));
};

window.deleteTransactionUI = function (id) {
  if (!confirm('🗑️ ลบรายการนี้? ข้อมูลที่ลบจะไม่สามารถกู้คืนได้')) return;
  appData = appData.filter((t) => t.id !== id);
  localStorage.setItem('mockData', JSON.stringify(appData));
  updateDashboard();
};

function updateDashboard() {
  let totalInc = 0,
    totalExp = 0,
    expensesByCat = {},
    incomesByCat = {};
  const startD = document.getElementById('globalStartDate').value;
  const endD = document.getElementById('globalEndDate').value;

  let filteredData = appData;
  if (startD || endD) {
    filteredData = appData.filter((tx) => {
      let valid = true;
      if (startD) valid = valid && tx.date >= startD;
      if (endD) valid = valid && tx.date <= endD;
      return valid;
    });
  }

  filteredData.forEach((tx) => {
    if (tx.type === 'รายรับ' || tx.type === 'income') {
      totalInc += tx.amount;
      incomesByCat[tx.category] = (incomesByCat[tx.category] || 0) + tx.amount;
    } else {
      totalExp += tx.amount;
      expensesByCat[tx.category] =
        (expensesByCat[tx.category] || 0) + tx.amount;
    }
  });

  document.getElementById('totalIncome').innerText = formatMoney(totalInc);
  document.getElementById('totalExpense').innerText = formatMoney(totalExp);
  document.getElementById('totalBalance').innerText = formatMoney(
    totalInc - totalExp
  );

  window.currentChartData = { expense: expensesByCat, income: incomesByCat };
  window.currentTotalIncome = totalInc;

  window.updateChartView();
  renderTableMobile(filteredData);
  renderBudgets(expensesByCat);
  renderSubscriptions();
}

function renderTableMobile(filteredData) {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  let displayData = [...(filteredData || appData)]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  if (displayData.length === 0) {
    list.innerHTML = `<li class="list-group-item text-center py-5 text-muted small border-0">ไม่มีประวัติในช่วงเวลานี้</li>`;
    return;
  }

  displayData.forEach((tx) => {
    const isInc = tx.type === 'รายรับ' || tx.type === 'income';
    const d = new Date(tx.date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('th-TH', { month: 'short' });
    const attachmentBadge = tx.image
      ? `<span onclick="viewImage('${tx.id}')" class="badge bg-light text-primary border border-primary border-opacity-25 ms-1" style="cursor:pointer">📎 สลิป</span>`
      : '';

    list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-start px-0 py-3 border-bottom">
                <div class="d-flex align-items-start overflow-hidden flex-grow-1">
                    <div class="bg-light border rounded-3 d-flex flex-column justify-content-center align-items-center me-3 flex-shrink-0" style="width:44px; height:44px;">
                        <span class="small fw-bold text-dark lh-1 mb-1">${day}</span><span class="text-secondary lh-1" style="font-size:10px">${month}</span>
                    </div>
                    <div class="overflow-hidden d-flex flex-column align-items-start">
                        <p class="small fw-bold text-dark mb-0 text-truncate w-100">${
                          tx.category
                        }</p>
                        <p class="text-muted mb-0 text-truncate w-100" style="font-size:11px">${
                          tx.note || '-'
                        } ${attachmentBadge}</p>
                    </div>
                </div>
                <div class="d-flex flex-column align-items-end flex-shrink-0 ps-2">
                    <span class="small fw-bold ${
                      isInc ? 'text-success' : 'text-dark'
                    }">${isInc ? '+' : '-'}${formatMoney(tx.amount)}</span>
                    <div class="d-flex gap-1 mt-2">
                        <button onclick="openEditModal('${
                          tx.id
                        }')" class="btn btn-sm btn-light text-primary py-0 px-2 fw-bold" style="font-size:10px">แก้ไข</button>
                        <button onclick="deleteTransactionUI('${
                          tx.id
                        }')" class="btn btn-sm btn-light text-danger py-0 px-2 fw-bold" style="font-size:10px">ลบ</button>
                    </div>
                </div>
            </li>
        `;
  });
}

// ==========================================
// 7. ระบบจัดการรูปภาพ และ Chart
// ==========================================
document.getElementById('imageInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      let width = img.width,
        height = img.height;
      if (width > 800) {
        height *= 800 / width;
        width = 800;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      currentImageBase64 = canvas.toDataURL('image/jpeg', 0.6);
      document.getElementById('imagePreview').src = currentImageBase64;
      document
        .getElementById('imagePreviewContainer')
        .classList.remove('d-none');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

window.removeImage = function () {
  currentImageBase64 = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('imagePreviewContainer').classList.add('d-none');
};
window.viewImage = function (id) {
  const tx = appData.find((t) => t.id === id);
  if (tx && tx.image) {
    document.getElementById('viewerImage').src = tx.image;
    document.getElementById('imageViewerModal').classList.remove('d-none');
  }
};
window.closeImageViewer = function () {
  document.getElementById('imageViewerModal').classList.add('d-none');
};

window.updateChartView = function () {
  const mode = document.getElementById('chartTypeFilter').value;
  renderChart(
    mode === 'expense'
      ? window.currentChartData.expense
      : window.currentChartData.income,
    mode
  );
};

function renderChart(data, mode) {
  const ctx = document.getElementById('expenseChart').getContext('2d');
  if (Object.keys(data).length === 0) {
    document.getElementById('expenseChart').style.display = 'none';
    document.getElementById('noDataMsg').classList.remove('d-none');
    return;
  }
  document.getElementById('expenseChart').style.display = 'block';
  document.getElementById('noDataMsg').classList.add('d-none');

  if (myChart) myChart.destroy();

  const totalInc = window.currentTotalIncome || 0;
  const labelsWithPct = Object.keys(data).map((key) => {
    const pct = totalInc > 0 ? ((data[key] / totalInc) * 100).toFixed(1) : 0;
    return mode === 'expense'
      ? `${key} (${pct}% ของรายรับ)`
      : `${key} (${pct}%)`;
  });

  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labelsWithPct,
      datasets: [
        {
          data: Object.values(data),
          backgroundColor:
            mode === 'income'
              ? ['#10B981', '#34D399', '#059669', '#6EE7B7']
              : [
                  '#EF4444',
                  '#F97316',
                  '#F59E0B',
                  '#8B5CF6',
                  '#EC4899',
                  '#3B82F6',
                ],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { family: "'Prompt'", size: 11 }, boxWidth: 12 },
        },
      },
    },
  });
}

// ==========================================
// 8. หมวดหมู่ (Categories)
// ==========================================
window.updateCategories = function () {
  const isInc = document.getElementById('radioIncome').checked;
  const catSelect = document.getElementById('categoryInput');
  const catList = isInc ? categories.income : categories.expense;

  catSelect.innerHTML =
    catList.map((c) => `<option value="${c}">${c}</option>`).join('') +
    `<option value="ADD_NEW" class="text-primary fw-bold">+ เพิ่มหมวดหมู่ใหม่...</option>`;
  document.getElementById('newCategoryContainer').classList.add('d-none');
};

window.handleCategoryChange = function () {
  if (document.getElementById('categoryInput').value === 'ADD_NEW') {
    document.getElementById('newCategoryContainer').classList.remove('d-none');
    document.getElementById('newCategoryTextInput').focus();
  } else {
    document.getElementById('newCategoryContainer').classList.add('d-none');
  }
};

window.addNewCategory = function () {
  const newCat = document.getElementById('newCategoryTextInput').value.trim();
  if (newCat) {
    const tk = document.getElementById('radioIncome').checked
      ? 'income'
      : 'expense';
    if (!categories[tk].includes(newCat)) {
      categories[tk].push(newCat);
      localStorage.setItem('myPocketCategories', JSON.stringify(categories));
    }
    window.updateCategories();
    document.getElementById('categoryInput').value = newCat;
  }
};

window.openManageCategoriesModal = function () {
  document.getElementById('manageModalTitle').innerText = `จัดการหมวดหมู่ (${
    document.getElementById('radioIncome').checked ? 'รายรับ' : 'รายจ่าย'
  })`;
  renderManageCategoriesList();
  document.getElementById('manageCategoriesModal').classList.remove('d-none');
};
window.closeManageCategoriesModal = function () {
  document.getElementById('manageCategoriesModal').classList.add('d-none');
};

function renderManageCategoriesList() {
  const tk = document.getElementById('radioIncome').checked
    ? 'income'
    : 'expense';
  document.getElementById('manageCategoryList').innerHTML = categories[tk]
    .map(
      (cat, i) => `
        <li class="list-group-item d-flex justify-content-between align-items-center bg-light mb-2 border rounded-3">
            <span class="small">${cat}</span>
            <button onclick="deleteCategory(${i}, '${tk}')" class="btn btn-sm text-danger p-0">🗑️</button>
        </li>
    `
    )
    .join('');
}
window.deleteCategory = function (i, tk) {
  if (confirm(`ลบ "${categories[tk][i]}"?`)) {
    categories[tk].splice(i, 1);
    localStorage.setItem('myPocketCategories', JSON.stringify(categories));
    renderManageCategoriesList();
    window.updateCategories();
  }
};

// ==========================================
// 9. งบประมาณ และ บิลประจำ (Budgets & Subs)
// ==========================================
function renderBudgets(expenses) {
  const cont = document.getElementById('budgetContainer');
  if (Object.keys(budgetData).length === 0)
    return (cont.innerHTML =
      '<p class="text-center text-muted small py-4 m-0">แตะที่ "ตั้งค่า" เพื่อเริ่มคุมงบ</p>');

  cont.innerHTML = Object.keys(budgetData)
    .map((cat) => {
      const spent = expenses[cat] || 0;
      const limit = budgetData[cat];
      const pct = Math.min((spent / limit) * 100, 100).toFixed(0);
      let colorClass =
        pct > 85 ? 'bg-danger' : pct > 60 ? 'bg-warning' : 'bg-success';

      return `
            <div>
                <div class="d-flex justify-content-between small fw-medium mb-1">
                    <span>${cat}</span>
                    <span class="text-secondary">${formatMoney(
                      spent
                    )} / <span class="text-dark">${formatMoney(
        limit
      )}</span></span>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    })
    .join('');
}

window.openSetBudgetModal = function () {
  document.getElementById('budgetCategorySelect').innerHTML = categories.expense
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  document.getElementById('setBudgetModal').classList.remove('d-none');
};
window.closeSetBudgetModal = function () {
  document.getElementById('setBudgetModal').classList.add('d-none');
};
window.saveNewBudget = function () {
  const cat = document.getElementById('budgetCategorySelect').value;
  const amt = parseFloat(document.getElementById('budgetAmountInput').value);
  if (!cat || isNaN(amt) || amt <= 0) return alert('กรอกตัวเลขให้ถูกต้อง');

  budgetData[cat] = amt;
  localStorage.setItem('mockBudgets', JSON.stringify(budgetData));
  updateDashboard();
  window.closeSetBudgetModal();
  document.getElementById('budgetAmountInput').value = '';
};

function renderSubscriptions() {
  const cont = document.getElementById('subscriptionList');
  const mList = document.getElementById('manageSubList');
  if (subData.length === 0) {
    cont.innerHTML =
      '<div class="text-center py-4 text-muted small">ยังไม่มีบิลประจำ</div>';
    if (mList) mList.innerHTML = '';
    return;
  }

  const curMonth = new Date().toISOString().slice(0, 7);
  cont.innerHTML = '';
  if (mList) mList.innerHTML = '';

  [...subData]
    .sort((a, b) => a.dueDay - b.dueDay)
    .forEach((sub) => {
      const isPaid = appData.some(
        (tx) =>
          tx.type === 'รายจ่าย' &&
          tx.category === sub.category &&
          tx.amount === sub.amount &&
          tx.date.startsWith(curMonth)
      );
      cont.innerHTML += `
            <div class="d-flex justify-content-between align-items-center p-3 rounded-3 border ${
              isPaid ? 'bg-light opacity-75' : 'bg-white shadow-sm'
            }">
                <div>
                    <div class="fw-bold small">${
                      sub.name
                    } <span class="text-muted" style="font-size:10px">(ดิว ${
        sub.dueDay
      })</span></div>
                    <div class="text-secondary small">฿${sub.amount.toLocaleString()}</div>
                </div>
                <div>
                    ${
                      isPaid
                        ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">จ่ายแล้ว</span>`
                        : `<button onclick="paySubscription('${sub.id}')" class="btn btn-sm btn-primary py-1 px-2" style="font-size:11px">บันทึกจ่าย</button>`
                    }
                </div>
            </div>
        `;
      if (mList) {
        mList.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center bg-light mb-2 border rounded-3 px-3 py-2">
                    <span class="small">${sub.name}</span>
                    <button onclick="deleteSubscriptionDB('${sub.id}')" class="btn btn-sm text-danger p-0">🗑️</button>
                </li>
            `;
      }
    });
}

window.openSubscriptionModal = function () {
  document.getElementById('subCategory').innerHTML = categories.expense
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  document.getElementById('subscriptionModal').classList.remove('d-none');
};
window.closeSubscriptionModal = function () {
  document.getElementById('subscriptionModal').classList.add('d-none');
};
window.saveNewSubscription = function (e) {
  e.preventDefault();
  const newSub = {
    id: 'SUB' + Date.now(),
    name: document.getElementById('subName').value,
    category: document.getElementById('subCategory').value,
    amount: parseFloat(document.getElementById('subAmount').value),
    dueDay: parseInt(document.getElementById('subDay').value),
  };
  subData.push(newSub);
  localStorage.setItem('mockSubs', JSON.stringify(subData));
  updateDashboard();
  window.closeSubscriptionModal();
  document.getElementById('subForm').reset();
};

window.paySubscription = function (id) {
  const sub = subData.find((s) => s.id === id);
  if (!sub) return;
  const txData = {
    id: 'TXN' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    type: 'รายจ่าย',
    category: sub.category,
    amount: sub.amount,
    note: `${sub.name} (บิลประจำ)`,
  };
  appData.push(txData);
  localStorage.setItem('mockData', JSON.stringify(appData));
  updateDashboard();
};
window.deleteSubscriptionDB = function (id) {
  if (!confirm('ลบบิลนี้?')) return;
  subData = subData.filter((s) => s.id !== id);
  localStorage.setItem('mockSubs', JSON.stringify(subData));
  updateDashboard();
};

// ==========================================
// 10. ระบบแก้ไข (Edit Transaction)
// ==========================================
window.openEditModal = function (id) {
  const tx = appData.find((t) => t.id === id);
  if (!tx) return;
  document.getElementById('editTxId').value = tx.id;
  document.getElementById('editDate').value = tx.date;
  document.getElementById('editAmount').value = tx.amount;
  document.getElementById('editNote').value = tx.note || '';

  const isInc = tx.type === 'รายรับ' || tx.type === 'income';
  document.getElementById('editTypeIncome').checked = isInc;
  document.getElementById('editTypeExpense').checked = !isInc;

  window.updateEditCategories(tx.category);
  document.getElementById('editTransactionModal').classList.remove('d-none');
};
window.closeEditModal = function () {
  document.getElementById('editTransactionModal').classList.add('d-none');
};
window.updateEditCategories = function (sel) {
  const isInc = document.getElementById('editTypeIncome').checked;
  document.getElementById('editCategory').innerHTML = (
    isInc ? categories.income : categories.expense
  )
    .map((c) => `<option value="${c}">${c}</option>`)
    .join('');
  if (sel) document.getElementById('editCategory').value = sel;
};
window.submitEditTransaction = function (e) {
  e.preventDefault();
  const id = document.getElementById('editTxId').value;
  const isInc = document.getElementById('editTypeIncome').checked;

  const updated = {
    id: id,
    date: document.getElementById('editDate').value,
    type: isInc ? 'รายรับ' : 'รายจ่าย',
    category: document.getElementById('editCategory').value,
    amount: parseFloat(document.getElementById('editAmount').value),
    note: document.getElementById('editNote').value,
    image: appData.find((t) => t.id === id)?.image || null,
  };

  const idx = appData.findIndex((t) => t.id === id);
  if (idx !== -1) appData[idx] = updated;

  localStorage.setItem('mockData', JSON.stringify(appData));
  updateDashboard();
  window.closeEditModal();
};
