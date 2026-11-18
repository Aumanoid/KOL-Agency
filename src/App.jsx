import React, { useState, useEffect } from 'react';

// ตั้งค่า Supabase ของคุณ
// หมายเหตุ: อันนี้คือ Publishable key แชร์ได้ ปลอดภัย
// ห้ามใส่ Secret key (sb_secret_...) ในโค้ดฝั่งเบราว์เซอร์เด็ดขาด
const SUPABASE_URL = "https://zuavthopicvwyegemlwm.supabase.co";
const SUPABASE_KEY = "sb_publishable_VfpGPla0C4ijMCAbZFWnIQ_3VhKL3iP";
const BUCKET_NAME = "KOL Agency";

// ฟังก์ชันกลางสำหรับเรียก Supabase REST API (Database)
async function supabaseDb(table, method = 'GET', data = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
  };
  const options = { method, headers };
  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Supabase DB Error [${table}]:`, errText);
    return null;
  }
  if (method === 'GET') {
    return await res.json();
  }
  // แก้: ถ้า POST ให้คืนข้อมูลที่สร้างด้วย จะได้เอา id มาใช้ต่อ
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : true;
  } catch {
    return true;
  }
}

// ฟังก์ชันอัปโหลดรูป/ไฟล์ขึ้น Supabase Storage - แก้แล้ว
async function uploadToStorage(file, pathPrefix = '') {
  const ext = file.name.split('.').pop();
  // แก้จุดที่ 1: เดิมเขียน Math.random().toString(36.substring(2, 7)) ผิด
  // ที่ถูกคือ Math.random().toString(36).substring(2, 8)
  const randomStr = Math.random().toString(36).substring(2, 8);
  const fileName = `${pathPrefix}${Date.now()}-${randomStr}.${ext}`;

  // ชื่อถังมีเว้นวรรค ต้อง encode ทั้งถังและชื่อไฟล์
  const encodedBucket = encodeURIComponent(BUCKET_NAME);
  // ชื่อไฟล์อาจมี / ถ้าเป็นโฟลเดอร์ ต้อง encode ทีละส่วน ไม่ encode / ทิ้ง
  const encodedFileName = fileName.split('/').map(s => encodeURIComponent(s)).join('/');

  const url = `${SUPABASE_URL}/storage/v1/object/${encodedBucket}/${encodedFileName}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'false'
    },
    body: file
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Upload failed');
  }

  // คืนลิงก์สาธารณะ
  return `${SUPABASE_URL}/storage/v1/object/public/${encodedBucket}/${encodedFileName}`;
}

export default function App() {
  const [campaignId] = useState('camp-default-01');
  const [campaignName, setCampaignName] = useState('แคมเปญเปิดตัวโครงการใหม่ (Default Campaign)');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState(1);

  const [kols, setKols] = useState([]);
  const [reviews, setReviews] = useState({});
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const camps = await supabaseDb('campaigns', 'GET', null, `?id=eq.${campaignId}`);
      if (camps && camps.length > 0) {
        setCampaignName(camps[0].name);
      } else {
        await supabaseDb('campaigns', 'POST', { id: campaignId, name: campaignName });
      }

      const kolList = await supabaseDb('kols', 'GET', null, `?campaign_id=eq.${campaignId}&order=created_at.asc`);
      if (kolList) setKols(kolList);

      const revList = await supabaseDb('content_reviews', 'GET');
      if (revList) {
        const revMap = {};
        revList.forEach(r => { revMap[r.kol_id] = r; });
        setReviews(revMap);
      }

      const repList = await supabaseDb('reports', 'GET');
      if (repList) {
        const repMap = {};
        repList.forEach(r => { repMap[r.kol_id] = r; });
        setReports(repMap);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleUpdateCampaignName(newName) {
    setCampaignName(newName);
    await supabaseDb('campaigns', 'PATCH', { name: newName }, `?id=eq.${campaignId}`);
  }

  async function handleAddKol() {
    const newKol = {
      id: 'kol-' + Date.now(),
      campaign_id: campaignId,
      name: 'ชื่อ KOL ใหม่',
      image_url: '',
      sample_video_url: '',
      sample_video_type: 'external',
      platforms: [{ platform: 'TikTok', followers: 100000, price: 15000 }]
    };
    setKols([...kols, newKol]);
    await supabaseDb('kols', 'POST', newKol);
  }

  // แก้จุดที่ 2: ตอน PATCH อย่าส่ง id / created_at / campaign_id ซ้ำ จะได้ไม่ error
  async function handleUpdateKol(kolId, updatedFields) {
    const updated = kols.map(k => k.id === kolId ? { ...k, ...updatedFields } : k);
    setKols(updated);
    const target = updated.find(k => k.id === kolId);
    const { id, created_at, campaign_id, ...patchData } = target;
    await supabaseDb('kols', 'PATCH', patchData, `?id=eq.${kolId}`);
  }

  async function handleDeleteKol(kolId) {
    if (!confirm('ต้องการลบ KOL คนนี้ออกจากแคมเปญใช่หรือไม่?')) return;
    setKols(kols.filter(k => k.id !== kolId));
    await supabaseDb('kols', 'DELETE', null, `?id=eq.${kolId}`);
  }

  // ฟังก์ชันลากรูป / เลือกไฟล์ - เพิ่มใหม่ให้ใช้งานได้จริง
  async function handleImageUpload(kolId, file) {
    if (!file) return;
    // 1. โชว์พรีวิวทันที ไม่ต้องรออัปโหลด
    const previewUrl = URL.createObjectURL(file);
    handleUpdateKol(kolId, { image_url: previewUrl });
    setUploadingId(kolId);
    try {
      // 2. อัปโหลดขึ้นถังข้างหลัง
      const publicUrl = await uploadToStorage(file, 'kols/');
      // 3. พอได้ลิงก์ถาวรแล้ว เปลี่ยนจากพรีวิวเป็นลิงก์ถาวร
      handleUpdateKol(kolId, { image_url: publicUrl });
    } catch (e) {
      alert('อัปโหลดรูปไม่สำเร็จ: ' + e.message + '\nลองเช็กว่าสร้างตาราง + ตั้งค่า Bucket เป็น Public แล้วหรือยัง');
      console.error(e);
    }
    setUploadingId(null);
  }

  async function handleSaveReport(kolId, field, value) {
    const currentRep = reports[kolId] || { kol_id: kolId, post_date: '', post_links: [], views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, engagement: 0 };
    const updatedRep = { ...currentRep, [field]: value };
    setReports({ ...reports, [kolId]: updatedRep });

    const exist = await supabaseDb('reports', 'GET', null, `?kol_id=eq.${kolId}`);
    if (exist && exist.length > 0) {
      const { kol_id, ...patchData } = updatedRep;
      await supabaseDb('reports', 'PATCH', patchData, `?kol_id=eq.${kolId}`);
    } else {
      await supabaseDb('reports', 'POST', updatedRep);
    }
  }

  async function handleAddComment(kolId, commentText) {
    if (!commentText.trim()) return;
    const currentRev = reviews[kolId] || { kol_id: kolId, video_url: '', comments: [] };
    const newComment = {
      author: isEditMode ? 'เอเจนซี' : 'ลูกค้า',
      text: commentText,
      createdAt: new Date().toLocaleString('th-TH')
    };
    const updatedComments = [...(currentRev.comments || []), newComment];
    const updatedRev = { ...currentRev, comments: updatedComments };
    setReviews({ ...reviews, [kolId]: updatedRev });

    const exist = await supabaseDb('content_reviews', 'GET', null, `?kol_id=eq.${kolId}`);
    if (exist && exist.length > 0) {
      const { kol_id, ...patchData } = updatedRev;
      await supabaseDb('content_reviews', 'PATCH', patchData, `?kol_id=eq.${kolId}`);
    } else {
      await supabaseDb('content_reviews', 'POST', updatedRev);
    }
  }

  const copySqlScript = () => {
    const sqlText = `-- สคริปต์สร้างตาราง Supabase SQL - เอาไปวางใน Supabase > SQL Editor > Run
create table if not exists campaigns ( id text primary key, name text not null, created_at timestamptz default now() );
create table if not exists kols ( id text primary key, campaign_id text references campaigns(id) on delete cascade, name text not null, image_url text, sample_video_url text, sample_video_type text default 'external', platforms jsonb default '[]'::jsonb, created_at timestamptz default now() );
create table if not exists content_reviews ( kol_id text primary key references kols(id) on delete cascade, video_url text, video_type text default 'external', comments jsonb default '[]'::jsonb );
create table if not exists reports ( kol_id text primary key references kols(id) on delete cascade, post_date text, post_links jsonb default '[]'::jsonb, views numeric default 0, likes numeric default 0, comments numeric default 0, shares numeric default 0, saves numeric default 0, reach numeric default 0, engagement numeric default 0, backend_screenshot_url text, good_comment_screenshot_url text );
alter table campaigns enable row level security;
alter table kols enable row level security;
alter table content_reviews enable row level security;
alter table reports enable row level security;
create policy "Public Access Campaigns" on campaigns for all using (true) with check (true);
create policy "Public Access KOLs" on kols for all using (true) with check (true);
create policy "Public Access Reviews" on content_reviews for all using (true) with check (true);
create policy "Public Access Reports" on reports for all using (true) with check (true);
-- อย่าลืม: ไปที่ Storage > KOL Agency > ตั้งเป็น Public แล้ว
-- ใน Storage > Policies ต้องอนุญาตให้อัปโหลดได้ด้วย ไม่งั้นจะขึ้น 403`;
    navigator.clipboard.writeText(sqlText);
    alert('คัดลอกโค้ด SQL สำเร็จ! นำไปวางใน Supabase SQL Editor ได้เลยครับ');
  };

  if (loading) return <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      <header className="bg-blue-900 text-white px-4 py-3 shadow-md sticky top-0 z-50 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-3">
          {isEditMode ? (
            <input type="text" value={campaignName} onChange={(e) => handleUpdateCampaignName(e.target.value)} className="bg-blue-800 px-2 py-1 rounded text-lg font-bold border border-blue-600 focus:outline-none" />
          ) : (
            <h1 className="text-lg font-bold">{campaignName}</h1>
          )}
          <span className="text-xs bg-blue-700 px-2 py-0.5 rounded-full text-blue-200">{isEditMode ? 'โหมดแก้ไข (Agency)' : 'โหมดดูอย่างเดียว (Client)'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copySqlScript} className="bg-blue-700 hover:bg-blue-600 text-xs px-3 py-1.5 rounded font-medium">📋 คัดลอกโค้ด SQL ตั้งค่า Supabase</button>
          <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1.5 rounded text-xs font-semibold ${isEditMode ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'}`}>{isEditMode ? '🔒 ล็อกโหมด (ออกจากการแก้ไข)' : '🔑 เปิดโหมดแก้ไข'}</button>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('คัดลอกลิงก์แคมเปญสำเร็จ!'); }} className="bg-emerald-600 hover:bg-emerald-700 text-xs px-3 py-1.5 rounded font-semibold">🔗 แชร์ลิงก์</button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-4 flex gap-6 shadow-sm">
        <button onClick={() => setActiveTab(1)} className={`py-3 font-semibold text-sm border-b-2 ${activeTab === 1 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>แท็บ 1: หน้าเสนอ KOL ({kols.length})</button>
        <button onClick={() => setActiveTab(2)} className={`py-3 font-semibold text-sm border-b-2 ${activeTab === 2 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>แท็บ 2: ตรวจคอนเทนต์ก่อนโพสต์</button>
        <button onClick={() => setActiveTab(3)} className={`py-3 font-semibold text-sm border-b-2 ${activeTab === 3 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>แท็บ 3: รีพอร์ท</button>
      </div>

      <main className="p-4 max-w-5xl mx-auto">
        {activeTab === 1 && (
          <div>
            {isEditMode && <button onClick={handleAddKol} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded font-semibold">+ เพิ่ม KOL</button>}
            <div className="grid gap-4">
              {kols.map(kol => (
                <div key={kol.id} className="bg-white rounded-xl shadow p-4 relative">
                  {isEditMode && <button onClick={() => handleDeleteKol(kol.id)} className="absolute top-2 left-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs">X</button>}
                  {/* รูป - แก้บั๊กลากแล้วไม่ขึ้น: แยกกล่องลากออกจากปุ่มกดเลือกไฟล์ */}
                  <div className="mb-3">
                    {kol.image_url ? (
                      <img src={kol.image_url} alt={kol.name} className="w-full h-48 object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">ยังไม่มีรูป</div>
                    )}
                    {isEditMode && (
                      <div className="mt-2">
                        <DragDropBox kolId={kol.id} uploading={uploadingId === kol.id} onFile={(file) => handleImageUpload(kol.id, file)} />
                        <div className="flex gap-2 mt-2">
                          <label className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded cursor-pointer hover:bg-blue-700">กดเพื่อเลือกไฟล์
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files[0]) handleImageUpload(kol.id, e.target.files[0]); e.target.value = ''; }} />
                          </label>
                          <span className="text-xs text-slate-400 self-center">หรือลากรูปมาวางในกล่องด้านบนได้เลย</span>
                        </div>
                        <input type="text" placeholder="หรือแปะลิงก์รูปจากไดรฟ์ (.jpg / .png) ตรงนี้ ห้ามแปะลิงก์หน้าโปรไฟล์" value={kol.image_url?.startsWith('blob:') ? '' : kol.image_url || ''} onChange={(e) => handleUpdateKol(kol.id, { image_url: e.target.value })} className="mt-2 w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                    )}
                  </div>
                  {isEditMode ? (
                    <input value={kol.name} onChange={(e) => handleUpdateKol(kol.id, { name: e.target.value })} className="w-full border rounded px-2 py-1 font-bold text-lg mb-2" />
                  ) : (
                    <h2 className="font-bold text-lg mb-2">{kol.name}</h2>
                  )}
                  {/* แพลตฟอร์ม */}
                  <div className="space-y-1 mb-3">
                    {(kol.platforms || []).map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-sm">
                        {isEditMode ? (
                          <>
                            <select value={p.platform} onChange={(e) => { const newPlats = [...kol.platforms]; newPlats[idx].platform = e.target.value; handleUpdateKol(kol.id, { platforms: newPlats }); }} className="border rounded px-1 py-1"><option>YouTube</option><option>TikTok</option><option>Instagram</option><option>Facebook</option><option>Others</option></select>
                            <input type="number" value={p.followers} onChange={(e) => { const newPlats = [...kol.platforms]; newPlats[idx].followers = Number(e.target.value); handleUpdateKol(kol.id, { platforms: newPlats }); }} placeholder="ผู้ติดตาม" className="border rounded px-2 py-1 w-24" />
                            <input type="number" value={p.price} onChange={(e) => { const newPlats = [...kol.platforms]; newPlats[idx].price = Number(e.target.value); handleUpdateKol(kol.id, { platforms: newPlats }); }} placeholder="ราคา" className="border rounded px-2 py-1 w-24" />
                            <button onClick={() => { const newPlats = kol.platforms.filter((_, i) => i !== idx); handleUpdateKol(kol.id, { platforms: newPlats }); }} className="text-red-500 text-xs">x</button>
                          </>
                        ) : (
                          <span className="text-slate-600">{p.platform} | {p.followers?.toLocaleString()} ผู้ติดตาม | <span className="text-slate-400 text-xs">฿{p.price?.toLocaleString()} บาท</span></span>
                        )}
                      </div>
                    ))}
                    {isEditMode && <button onClick={() => handleUpdateKol(kol.id, { platforms: [...(kol.platforms || []), { platform: 'TikTok', followers: 0, price: 0 }] })} className="text-blue-600 text-sm">+ เพิ่มแพลตฟอร์ม</button>}
                  </div>
                  {/* คลิปตัวอย่าง */}
                  <div>
                    {isEditMode && <input value={kol.sample_video_url || ''} onChange={(e) => handleUpdateKol(kol.id, { sample_video_url: e.target.value })} placeholder="วางลิงก์คลิปตัวอย่าง - ไดรฟ์เล่นในนี้ได้ ลิงก์อื่นเปิดแท็บใหม่" className="w-full border rounded px-2 py-1.5 text-sm mb-2" />}
                    {kol.sample_video_url && (
                      <a href={kol.sample_video_url} target="_blank" rel="noreferrer" className="block bg-blue-50 text-blue-700 text-center py-2 rounded text-sm font-semibold">▶ กดดูคลิปตัวอย่าง</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            {kols.map(kol => {
              const rev = reviews[kol.id] || { video_url: '', comments: [] };
              return (
                <div key={kol.id} className="bg-white rounded-xl shadow p-4 flex gap-4" style={{ minHeight: 200 }}>
                  <div className="w-1/2">
                    <p className="font-bold mb-2">{kol.name}</p>
                    {isEditMode && <input value={rev.video_url || ''} onChange={(e) => { const newRev = { ...rev, kol_id: kol.id, video_url: e.target.value, comments: rev.comments || [] }; setReviews({ ...reviews, [kol.id]: newRev }); }} placeholder="วางลิงก์คลิป - ไดรฟ์เล่นในนี้ได้" className="w-full border rounded px-2 py-1.5 text-sm mb-2" />}
                    {rev.video_url ? <a href={rev.video_url} target="_blank" rel="noreferrer" className="block bg-slate-900 text-white text-center py-8 rounded">▶ กดดูคลิป</a> : <div className="bg-slate-100 py-8 text-center rounded text-slate-400 text-sm">ยังไม่มีคลิป</div>}
                  </div>
                  <div className="w-1/2 flex flex-col">
                    <div className="flex-1 overflow-y-auto max-h-[140px] space-y-2 pr-1">
                      {(rev.comments || []).map((c, i) => <div key={i} className="bg-slate-50 p-2 rounded text-sm"><b>{c.author}</b> <span className="text-slate-400 text-xs">{c.createdAt}</span><div>{c.text}</div></div>)}
                      {(rev.comments || []).length === 0 && <p className="text-slate-400 text-sm">ยังไม่มีคอมเมนต์</p>}
                    </div>
                    <CommentBox onSend={(txt) => handleAddComment(kol.id, txt)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
            <p className="font-bold mb-3">รีพอร์ท - กรอกทีเดียวทุก KOL</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50"><th className="text-left p-2">KOL</th><th className="p-2">Views</th><th className="p-2">Likes</th><th className="p-2">Comments</th><th className="p-2">Shares</th><th className="p-2">Saves</th></tr></thead>
              <tbody>
                {kols.map(kol => {
                  const rep = reports[kol.id] || {};
                  return (
                    <tr key={kol.id} className="border-t">
                      <td className="p-2 font-medium">{kol.name}</td>
                      {['views','likes','comments','shares','saves'].map(f => (
                        <td key={f} className="p-2"><input type="number" value={rep[f] || 0} onChange={(e) => handleSaveReport(kol.id, f, Number(e.target.value))} className="w-20 border rounded px-1 py-1" /></td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// กล่องลากวางแยกต่างหาก - แก้บั๊กที่ label เดิมทำให้ onDrop ไม่ทำงาน
function DragDropBox({ kolId, uploading, onFile }) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget === e.target) setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition ${isDragging ? 'border-blue-600 bg-blue-100 text-blue-800 scale-[1.01]' : 'border-blue-300 bg-blue-50 text-blue-600'}`}
    >
      {uploading ? 'กำลังอัปโหลด...' : isDragging ? 'ปล่อยรูปตรงนี้ได้เลย!' : 'ลากรูปมาวางตรงนี้ได้เลย'}
    </div>
  );
}

function CommentBox({ onSend }) {
  const [text, setText] = useState('');
  return (
    <div className="flex gap-2 mt-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์คอมเมนต์..." className="flex-1 border rounded px-2 py-1.5 text-sm" />
      <button onClick={() => { onSend(text); setText(''); }} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-semibold">ส่ง</button>
    </div>
  );
}
