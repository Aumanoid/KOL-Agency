KOL Report Studio - วิธีเอาขึ้น Vercel แบบจับมือทำ

ขั้นที่ 1: เตรียมไฟล์
- ไฟล์ทั้งหมดในโฟลเดอร์นี้คือเว็บตัวจริงแล้ว

ขั้นที่ 2: สมัคร Vercel
1. เปิด vercel.com
2. กด Sign Up > Continue with GitHub (ใช้ GitHub เดียวกับที่จะเก็บโค้ด)
3. ถ้ายังไม่มี GitHub สมัครก่อนที่ github.com

ขั้นที่ 3: เอาโค้ดขึ้น GitHub
วิธีง่ายสุด: ใน GitHub กด New Repository ชื่อ kol-report-studio > Upload files > ลากไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไป > Commit

ขั้นที่ 4: เอาขึ้น Vercel
1. ใน Vercel กด Add New > Project
2. เลือก Repository kol-report-studio ที่เพิ่งอัปโหลด
3. กด Import
4. ตรง Environment Variables ใส่ 2 ตัว (ถ้าใช้โค้ดนี้ไม่ต้องใส่ก็ได้ เพราะใส่ค่าไว้ในโค้ดแล้ว แต่แนะนำให้ใส่แบบนี้เพื่อความปลอดภัย):
   - NEXT_PUBLIC_SUPABASE_URL = https://zuavthopicvwyegemlwm.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_... (Publishable key ของคุณ)
5. กด Deploy รอ 1-2 นาที

ขั้นที่ 5: สร้างตารางใน Supabase
1. เปิด Supabase > โปรเจกต์ kol-report > SQL Editor > New Query
2. ในเว็บที่ deploy แล้ว กดปุ่ม คัดลอกโค้ด SQL ตั้งค่า Supabase
3. เอามาวางใน SQL Editor แล้วกด Run
4. ไปที่ Storage > KOL Agency > ตั้งเป็น Public แล้ว

ขั้นที่ 6: ลองใช้งานจริง
1. เปิดลิงก์ Vercel ที่ได้ (เช่น https://kol-report-studio.vercel.app)
2. กด เปิดโหมดแก้ไข
3. ลากรูปมาวางในกล่อง KOL รูปต้องขึ้นทันที และเปิดใหม่แล้วรูปยังอยู่
4. ถ้ารูปหาย ให้เช็กว่า Bucket เป็น Public และใส่กุญแจถูกหรือยัง

สำคัญ:
- ห้ามใส่ Secret key (sb_secret_...) ในโค้ดเด็ดขาด ใช้แค่ Publishable key
- ชื่อถังต้องเป็น KOL Agency เป๊ะๆ มีเว้นวรรค
- ถ้าอัปโหลดแล้วขึ้น 403 แปลว่า Storage Policy ยังไม่เปิดให้อัปโหลด ให้ไปที่ Supabase > Storage > KOL Agency > Policies > อนุญาต INSERT ให้ public หรือ authenticated
