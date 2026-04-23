// ==========================================
// 1. การตั้งค่าระบบ (ใส่กุญแจ 3 ดอกของคุณที่นี่!)
// ==========================================
const LIFF_ID = '2009854880'; // จาก LINE Developers
const SUPABASE_URL = 'https://mtvudwthoxcqnrsjhyrg.supabase.co/rest/v1/';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dnVkd3Rob3hjcW5yc2poeXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MjY0NjksImV4cCI6MjA5MjUwMjQ2OX0.f5varZC-9Q-mybLwHzyanzxsgFNGX1U-B7oFkjuTRgA'; // จาก Supabase

// สร้างตัวเชื่อมต่อ Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ตัวแปรเก็บข้อมูล
let isVipUser = false;
let lineProfile = null;

// ==========================================
// 2. ระบบเริ่มต้นแอป
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // ซ่อน Paywall
  document.getElementById('closePaywallBtn')?.addEventListener('click', () => {
    document.getElementById('vipPaywallModal').classList.add('d-none');
  });

  initializeLiff();
});

// เริ่มต้น LINE LIFF
async function initializeLiff() {
  try {
    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      lineProfile = await liff.getProfile();

      // อัปเดตหน้าตา Header
      document.getElementById('userProfileImg').src = lineProfile.pictureUrl;
      document.getElementById('userProfileImg').classList.remove('d-none');
      document.getElementById('headerTitle').innerHTML = `สวัสดี, ${
        lineProfile.displayName.split(' ')[0]
      }`;

      // เช็คข้อมูลลูกค้าใน Supabase
      checkVipStatus(lineProfile.userId, lineProfile.displayName);
    } else {
      liff.login();
    }
  } catch (err) {
    console.error('LIFF Init Error:', err);
  }
}

// ==========================================
// 3. ระบบ Database (Supabase)
// ==========================================

// เช็คสถานะ VIP
async function checkVipStatus(lineId, displayName) {
  document.getElementById('initText').innerHTML = 'กำลังตรวจสอบสถานะบัญชี...';

  // ค้นหาลูกค้าในตาราง users
  let { data: user, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('line_id', lineId)
    .single();

  // ถ้าไม่มีข้อมูลแปลว่าเป็นลูกค้าใหม่ -> ให้บันทึกข้อมูลลงตาราง
  if (!user) {
    const { data: newUser } = await supabaseClient
      .from('users')
      .insert([{ line_id: lineId, display_name: displayName, status: 'Free' }])
      .select()
      .single();
    user = newUser;
  }

  // ตรวจสอบสถานะ
  isVipUser = user.status === 'VIP';
  setupAppMode();
  finishLoading(true);
}

function setupAppMode() {
  const micBtn = document.getElementById('micBtn');
  const vipBadge = document.getElementById('vipBadge');

  if (isVipUser) {
    // VIP: ปลดล็อกไมค์
    micBtn.classList.remove('opacity-50');
    micBtn.onclick = () =>
      alert('พร้อมใช้งาน AI แล้วครับ (โค้ดบันทึกเสียงจะอยู่ที่นี่)');
    if (vipBadge) vipBadge.classList.remove('d-none');
  } else {
    // Free: ล็อกไมค์
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
    setTimeout(() => (loader.style.display = 'none'), 500);

    const indicator = document.getElementById('statusIndicator');
    if (indicator)
      indicator.classList.replace(
        'bg-warning',
        isSuccess ? 'bg-success' : 'bg-danger'
      );
  }, 800);
}
