# ระบบบริหารจัดการชั้นเรียน - TODO

## Phase 1: Database Schema & Backend API
- [x] ออกแบบและสร้าง Database Schema (teachers, students, subjects, classes, attendance, scores, documents)
- [x] สร้าง Migration SQL และ apply
- [x] สร้าง DB query helpers ใน server/db.ts
- [x] สร้าง tRPC routers: auth, teachers, students, subjects, classes, attendance, scores, documents

## Phase 2: Frontend Layout & Core Pages
- [x] ออกแบบ Design System (สี, ฟอนต์, component style)
- [x] สร้าง TeacherLayout สำหรับครู
- [x] หน้า Login (Manus OAuth)
- [x] หน้า Dashboard แสดงรายวิชาของครู แยกประถม/มัธยม
- [x] หน้าจัดการนักเรียน (เพิ่ม/แก้ไข/ลบ)
- [x] หน้าจัดการวิชาเรียน (เพิ่ม/แก้ไข/ลบ)
- [x] หน้าจัดการครู (Admin only)
- [x] หน้าตั้งค่าโปรไฟล์ครู

## Phase 3: เช็คชื่อและลงคะแนน
- [x] หน้าเช็คชื่อนักเรียนรายวิชา พร้อมบันทึกวันที่/เวลา
- [x] หน้าลงคะแนนนักเรียน (มัธยม: รายภาคเรียน, ประถม: รายปี)
- [x] หน้าสรุปผลการเรียนของนักเรียนแต่ละคน

## Phase 4: เอกสาร ปพ.1 และ ปพ.6
- [x] ระบบสร้างเอกสาร ปพ.1 สำหรับมัธยม (print-ready HTML)
- [x] ระบบสร้างเอกสาร ปพ.6 สำหรับประถม (print-ready HTML)
- [x] อัปโหลดไฟล์ไปยัง Cloud Storage (S3)
- [x] หน้าดาวน์โหลดเอกสารย้อนหลัง

## Phase 5: ระบบแจ้งเตือน
- [x] แจ้งเตือน Admin เมื่อมีการเพิ่มครูใหม่
- [ ] แจ้งเตือน Admin เมื่อมีการแก้ไขข้อมูลสำคัญ (planned)

## Phase 6: Testing & Checkpoint
- [x] เขียน Unit Tests สำหรับ backend procedures (23 tests)
- [x] Save checkpoint

## Bug Fixes
- [x] แก้ไข error: academicYear.getActive คืนค่า undefined เมื่อยังไม่มีปีการศึกษาที่ active
- [x] แก้ไข nested anchor tag ใน TeacherLayout, Dashboard, ClassroomDetail, ScorePage
- [x] แก้ไข bug: วิชาที่มอบหมายให้ครูแล้วไม่แสดงในหน้า Dashboard ของครูคนนั้น (สาเหตุ: AdminPage ใช้ teacherProfiles.id แทน users.id)
