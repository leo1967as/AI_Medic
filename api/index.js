// File: /api/index.js (ฉบับแก้ไข: เพิ่มฟังก์ชัน delay ที่หายไป)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialization & Environment Check ---
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined.");
    throw new Error("GEMINI_API_KEY is not defined.");
}

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { response_mime_type: "application/json" }
});

// --- Helper Function: Calculate BMI (ไม่มีการแก้ไข) ---
const calculateBMI = (weight, height) => {
    if (!weight || !height || height <= 0) return { value: 0, category: 'ข้อมูลไม่ถูกต้อง' };
    const heightInMeters = parseFloat(height) / 100;
    const bmiValue = (parseFloat(weight) / (heightInMeters * heightInMeters)).toFixed(2);
    let category = '';
    if (bmiValue < 18.5) category = 'น้ำหนักน้อยกว่าเกณฑ์';
    else if (bmiValue < 23) category = 'น้ำหนักปกติ (สมส่วน)';
    else if (bmiValue < 25) category = 'น้ำหนักเกิน';
    else if (bmiValue < 30) category = 'โรคอ้วนระดับที่ 1';
    else category = 'โรคอ้วนระดับที่ 2 (อันตราย)';
    return { value: bmiValue, category: category };
};

// --- Helper Function: AI Analysis (ไม่มีการแก้ไข) ---
async function getAiAnalysis(userData) {
    console.log("🤖 กำลังสร้าง Prompt สำหรับการวิเคราะห์สุขภาพทั่วไป...");
    const prompt = `
      คำสั่ง: คุณคือผู้ช่วย AI ด้านสุขภาพที่มีความละเอียดรอบคอบและห่วงใยผู้ใช้งาน หน้าที่ของคุณคือวิเคราะห์ข้อมูลสุขภาพเบื้องต้นอย่างละเอียด และให้คำแนะนำที่ปลอดภัย, ชัดเจน, และนำไปปฏิบัติได้จริง
      **ข้อมูลผู้ใช้:**
      - ชื่อ: ${userData.name}, อายุ: ${userData.age} ปี, เพศ: ${userData.sex}
      - ดัชนีมวลกาย (BMI): ${userData.bmi.value} (จัดอยู่ในเกณฑ์: ${userData.bmi.category})
      - อาการปัจจุบันที่แจ้ง: "${userData.symptoms}"
      **งานของคุณ (สำคัญที่สุด):**
      วิเคราะห์ข้อมูลทั้งหมด แล้วสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างตามนี้ **เท่านั้น**:
      {
        "primary_assessment": "เขียนบทสรุปวิเคราะห์ภาพรวมสุขภาพของผู้ใช้จากข้อมูลทั้งหมด โดยใช้ภาษาที่เข้าใจง่ายและแสดงความห่วงใย ควรมีความยาว 2-3 ประโยค",
        "risk_analysis": [{"condition": "ชื่อภาวะสุขภาพ/โรคที่อาจเกี่ยวข้อง #1", "risk_level": "high", "rationale": "คำอธิบายเหตุผล"}, {"condition": "ชื่อภาวะสุขภาพ/โรคที่อาจเกี่ยวข้อง #2", "risk_level": "medium", "rationale": "คำอธิบายเหตุผล"}],
        "self_care": ["คำแนะนำในการดูแลตัวเองเบื้องต้น ข้อที่ 1", "ข้อที่ 2", "ข้อที่ 3 (อย่างน้อย 3-5 ข้อ)"],
        "dietary_recommendations": {"foods_to_eat": ["รายการอาหารที่ควรกิน"], "foods_to_avoid": ["รายการอาหารที่ควรหลีกเลี่ยง"]},
        "red_flags": ["สัญญาณอันตรายข้อที่ 1 ที่ควรรีบไปพบแพทย์ทันที", "สัญญาณอันตรายข้อที่ 2"],
        "disclaimer": "นี่เป็นเพียงการประเมินเบื้องต้นจาก AI และไม่ใช่การวินิจฉัยทางการแพทย์ ควรปรึกษาแพทย์หรือผู้เชี่ยวชาญเพื่อรับการวินิจฉัยที่ถูกต้องและเหมาะสมกับตัวคุณ"
      }
      **ข้อบังคับในการสร้างผลลัพธ์:**
      1.  สำหรับ "risk_level" ให้ใช้ค่าใดค่าหนึ่งเท่านั้น: 'high' (สีแดง), 'medium' (สีส้ม), 'low' (สีเหลือง), 'info' (สีฟ้า)
      2.  เรียงลำดับ "risk_analysis" จากความเสี่ยงสูงสุดไปต่ำสุด
      3.  ต้องสร้าง JSON ให้ครบทุกฟิลด์ ห้ามขาดหรือเกิน
      4.  เนื้อหาต้องปลอดภัย ห้ามวินิจฉัยโรคเด็ดขาด แต่ใช้คำว่า "ภาวะที่อาจเกี่ยวข้อง"
    `;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// ==========================================================
// vvvvv   จุดที่แก้ไข: เพิ่ม Helper Function ที่ขาดไป   vvvvv
// ==========================================================
// --- Helper Function: ฟังก์ชันสำหรับหน่วงเวลา ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// ==========================================================
// ^^^^^^^^^^^^^^^  สิ้นสุดจุดที่แก้ไข   ^^^^^^^^^^^^^^^^^^^^
// ==========================================================


// --- API Endpoint: The Main Logic Handler (ไม่มีการแก้ไข) ---
app.post('/api/assess', async (req, res) => {
    try {
        const { name, age, sex, weight, height, symptoms } = req.body;
        if (!name || !age || !weight || !height || !symptoms) {
            return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน", details: "กรุณากรอกข้อมูลให้ครบถ้วน" });
        }
        console.log(`ได้รับคำขอจาก: ${name}, อายุ: ${age}`);

        const bmi = calculateBMI(weight, height);
        console.log(`คำนวณ BMI ได้: ${bmi.value} (${bmi.category})`);

        let analysis;
        let lastAiError = null;
        const maxRetries = 5;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Attempt ${attempt}/${maxRetries}] กำลังเรียกใช้ AI...`);
                analysis = await getAiAnalysis({ name, age, sex, bmi, symptoms });
                console.log(`✅ [Attempt ${attempt}] สำเร็จ: วิเคราะห์ AI สำหรับ ${name} เรียบร้อย`);
                lastAiError = null; // สำเร็จแล้ว ไม่ต้องเก็บ Error
                break; // ออกจาก loop เมื่อสำเร็จ
            } catch (aiError) {
                lastAiError = aiError;
                console.error(`❌ [Attempt ${attempt}] ล้มเหลว: ${aiError.message}`);
                if (attempt < maxRetries) {
                    const waitTime = 2000; // รอ 2 วินาที
                    console.log(`...กำลังรอ ${waitTime / 1000} วินาที ก่อนลองอีกครั้ง...`);
                    await delay(waitTime);
                }
            }
        }

        if (lastAiError) {
            console.error(`🚨 ไม่สามารถเชื่อมต่อ AI ได้หลังจากการพยายามครบ ${maxRetries} ครั้ง`);
            analysis = {
                primary_assessment: "ไม่สามารถสร้างบทวิเคราะห์จาก AI ได้ เนื่องจากปัญหาการเชื่อมต่อเซิร์ฟเวอร์ชั่วคราว",
                risk_analysis: [ { condition: "การเชื่อมต่อ AI ขัดข้อง", risk_level: "info", rationale: "ระบบไม่สามารถติดต่อ AI เพื่อทำการวิเคราะห์ความเสี่ยงได้ในขณะนี้" } ],
                self_care: ["โปรดลองอีกครั้งในภายหลัง", "หากอาการน่ากังวล ควรปรึกษาแพทย์โดยตรง"],
                dietary_recommendations: { foods_to_eat: [], foods_to_avoid: [] },
                red_flags: ["หากอาการแย่ลงอย่างรวดเร็ว ควรรีบไปพบแพทย์ทันที"],
                disclaimer: `เกิดข้อผิดพลาดในการสื่อสารกับ AI หลังจากพยายาม ${maxRetries} ครั้ง: ${lastAiError.message}`
            };
        }
        
        res.status(200).json({
            userInfo: { name, age, sex },
            bmi: bmi,
            analysis: analysis
        });

    } catch (error) {
        console.error("เกิดข้อผิดพลาดรุนแรงใน /api/assess:", error);
        res.status(500).json({
            error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์",
            details: error.message || "ไม่สามารถระบุสาเหตุได้"
        });
    }
});

export default app;