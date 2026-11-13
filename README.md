# AutoPHG — Web Portfolio

เว็บพอร์ตของ AutoPHG (Roblox Content Creator) — ธีมดำ/แดง พร้อมตัวละคร Roblox แบบ 3D ที่ขยับตามการเลื่อนหน้า
เป็นเว็บ static ล้วน ไม่ต้อง build: เปิดด้วย static server ตัวไหนก็ได้ หรือ deploy ผ่าน GitHub Pages

```
index.html            โครงหน้าและข้อความทั้งหมด
css/style.css         สไตล์ (ตัวแปรสี/ฟอนต์อยู่บนสุดของไฟล์)
js/main.js            ตัวโหลด, คีย์เฟรมกล้องตามการเลื่อน, coverflow, บัตรห้อยคอ (verlet), เมนู contact, cursor, เสียง
js/scene.js           ฉาก WebGL (three.js): โมเดล, ท่าทาง (POSES), ฉากแอ็กชัน (ACTS), แสง, เอฟเฟกต์
js/vendor/            three.js r170 (MIT)
media/model/autophg.glb   โมเดลตัวละคร (แปลงจาก OBJ ที่ export จาก Roblox Studio)
media/fonts/          MN Chut Phiset (ฟอนต์หัวข้อ) — ฟอนต์เชิงพาณิชย์ของ MANEE MEEFONT ตรวจสิทธิ์ใช้งานบนเว็บก่อนเผยแพร่
media/img, media/video    รูป, รอยสาดสี (slash.svg / burst.svg) และวิดีโอ
tools/                สคริปต์เตรียม asset (ไม่ได้ใช้ตอนรันเว็บ)
```

โซนต่าง ๆ: HOME → STORY (PLAY / CUT / POST) → COLLAB (Hamster Hub + งานอีเวนต์) → WORK → SHOP (เสื้อกลุ่ม Roblox) → TAC (ธีมกาแล็กซี่) → DISCORD (ตัวเลขสมาชิกดึงสดจาก Discord) → ABOUT (บัตรห้อยคอ) → CONTACT (เมนูแบบเกมสองชั้น: เลือกหมวด → เลือกลิงก์ ใช้เมาส์หรือ ↑ ↓ Enter Esc)

เสียง: ปุ่ม SOUND มุมขวาบน เป็นเสียงสังเคราะห์ในเบราว์เซอร์ (ไม่มีไฟล์เพลง) ปิดเป็นค่าเริ่มต้น

## แก้ข้อมูลที่เปลี่ยนบ่อย

| อยากแก้ | แก้ที่ |
| --- | --- |
| คลิปในหมวด THE WORK (id, ชื่อ, ยอดวิว) | `WORK` ด้านบนของ `js/main.js` |
| ตัวเลขผู้ติดตาม / จำนวนคลิป | `.hero__stats` ใน `index.html` (ทั้งข้อความและ `data-to`) |
| ลิงก์ติดต่อ / รายการในเมนู | `.pm__item` ใน `index.html` (`data-pose` = ท่าตัวละคร, `data-info` = ข้อความใต้เมนู) |
| ตำแหน่ง/มุมกล้อง/ท่าของตัวละครในแต่ละช่วง | `buildKeys()` ใน `js/main.js` |
| ท่าทางของตัวละคร / ฉาก landing + ฟันดาบ | `P` (ท่า) และ `ACTS` (ลำดับเวลา) ใน `js/scene.js` |
| รอยสาดสี | `python tools/make_splats.py media/img` |
| รายชื่อเสื้อ | `TEES` ใน `js/main.js` (รูปอยู่ที่ `media/img/shirts/s00–s15.webp` ตัดจากภาพหน้ากลุ่มด้วย `tools/prep_merch.py`) |
| ลิงก์ Discord | `data-invite` ใน `index.html` (ใส่รหัสคำเชิญ ตัวเลขสมาชิกจะอัปเดตเอง) |
| เมนู CONTACT | `.pm__item` (หมวด) และ `.pms__list[data-k]` (แถวลิงก์ของแต่ละหมวด) ใน `index.html` |

## อัปเดตโมเดลตัวละคร

Export ตัวละครจาก Roblox Studio เป็น `.obj` (คลิกขวาที่โมเดล → Export Selection) แล้วรัน

```bash
python tools/obj2glb.py "<model.obj>" "<โฟลเดอร์ texture>" "<โฟลเดอร์ texture สำรอง>" media/model/autophg.glb
```

สคริปต์จะแยกชิ้นส่วน R15 + accessory แล้วใส่ข้อต่อให้ (ชื่อ group ใน OBJ ต้องตรงกับตาราง `NODES` ในสคริปต์)

## ดูในเครื่อง

```bash
python -m http.server 5173
```

แล้วเปิด http://localhost:5173
