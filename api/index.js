// File: /api/index.js (ฉบับใหม่: API สำหรับประเมินสุขภาพทั่วไป)

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

// --- Helper Function: Calculate BMI ---
const calculateBMI = (weight, height) => {
    if (!weight || !height || height <= 0) {
        return { value: 0, category: 'ข้อมูลไม่ถูกต้อง' };
    }
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

// --- Helper Function: AI Analysis ---
async function getAiAnalysis(userData) {
    console.log("🤖 กำลังสร้าง Prompt สำหรับการวิเคราะห์สุขภาพทั่วไป...");
    const prompt = `
      คำสั่ง: คุณคือผู้ช่วย AI ด้านสุขภาพที่มีความละเอียดรอบคอบและห่วงใยผู้ใช้งาน หน้าที่ของคุณคือวิเคราะห์ข้อมูลสุขภาพเบื้องต้นอย่างละเอียด และให้คำแนะนำที่ปลอดภัย, ชัดเจน, และนำไปปฏิบัติได้จริง

      **ข้อมูลผู้ใช้:**
      - ชื่อ: ${userData.name}
      - อายุ: ${userData.age} ปี
      - เพศ: ${userData.sex}
      - ดัชนีมวลกาย (BMI): ${userData.bmi.value} (จัดอยู่ในเกณฑ์: ${userData.bmi.category})
      - อาการปัจจุบันที่แจ้ง: "${userData.symptoms}"

      **งานของคุณ (สำคัญที่สุด):**
      วิเคราะห์ข้อมูลทั้งหมด แล้วสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างตามนี้ **เท่านั้น**:
      {
        "primary_assessment": "เขียนบทสรุปวิเคราะห์ภาพรวมสุขภาพของผู้ใช้จากข้อมูลทั้งหมด โดยใช้ภาษาที่เข้าใจง่ายและแสดงความห่วงใย ควรมีความยาว 2-3 ประโยค",
        "risk_analysis": [
          {
            "condition": "ชื่อภาวะสุขภาพ/โรคที่อาจเกี่ยวข้องกับอาการ #1",
            "risk_level": "high",
            "rationale": "คำอธิบายสั้นๆ ว่าทำไมถึงประเมินว่ามีความเสี่ยงนี้ โดยอ้างอิงจากอาการและข้อมูลผู้ใช้"
          },
          {
            "condition": "ชื่อภาวะสุขภาพ/โรคที่อาจเกี่ยวข้องกับอาการ #2",
            "risk_level": "medium",
            "rationale": "คำอธิบายเหตุผล"
          },
          {
            "condition": "คำแนะนำทั่วไปที่ไม่ใช่โรค",
            "risk_level": "info",
            "rationale": "อาจเป็นคำแนะนำเรื่องการพักผ่อนไม่เพียงพอ หรือความเครียด"
          }
        ],
        "self_care": [
          "คำแนะนำในการดูแลตัวเองเบื้องต้น ข้อที่ 1",
          "คำแนะนำในการดูแลตัวเองเบื้องต้น ข้อที่ 2",
          "คำแนะนำในการดูแลตัวเองเบื้องต้น ข้อที่ 3 (ควรมีอย่างน้อย 3-5 ข้อ)"
        ],
        "dietary_recommendations": {
          "foods_to_eat": ["รายการอาหารที่ควรกินเพื่อบรรเทาหรือส่งเสริมสุขภาพตามอาการ", "ตัวอย่าง: ผักใบเขียว, ปลาที่มีไขมันดี"],
          "foods_to_avoid": ["รายการอาหารที่ควรหลีกเลี่ยง", "ตัวอย่าง: อาหารแปรรูป, เครื่องดื่มที่มีน้ำตาลสูง"]
        },
        "red_flags": [
          "สัญญาณอันตรายข้อที่ 1 ที่ผู้ใช้ควรรีบไปพบแพทย์ทันที",
          "สัญญาณอันตรายข้อที่ 2",
          "ตัวอย่าง: หากอาการปวดหัวรุนแรงขึ้นอย่างกะทันหัน"
        ],
        "disclaimer": "นี่เป็นเพียงการประเมินเบื้องต้นจาก AI และไม่ใช่การวินิจฉัยทางการแพทย์ ควรปรึกษาแพทย์หรือผู้เชี่ยวชาญเพื่อรับการวินิจฉัยที่ถูกต้องและเหมาะสมกับตัวคุณ"
      }

      **ข้อบังคับในการสร้างผลลัพธ์:**
      1.  สำหรับ "risk_level" ให้ใช้ค่าใดค่าหนึ่งเท่านั้น: 'high' (สีแดง-เสี่ยงสูง), 'medium' (สีส้ม-เสี่ยงปานกลาง), 'low' (สีเหลือง-เสี่ยงน้อย), 'info' (สีเขียว/ฟ้า-เป็นข้อมูล/คำแนะนำทั่วไป)
      2.  เรียงลำดับรายการใน "risk_analysis" จากความเสี่ยงสูงสุดไปต่ำสุด
      3.  ต้องสร้าง JSON ให้ครบทุกฟิลด์ตามโครงสร้างที่กำหนด ห้ามขาดหรือเกิน
      4.  เนื้อหาต้องปลอดภัย ห้ามวินิจฉัยโรคเด็ดขาด แต่ให้ใช้คำว่า "ภาวะที่อาจเกี่ยวข้อง" หรือ "อาจมีความเสี่ยง"
      5.  ให้คำแนะนำที่เฉพาะเจาะจงกับข้อมูลที่ได้รับ เช่น ถ้าผู้ใช้น้ำหนักเกิน ควรมีคำแนะนำเรื่องการควบคุมน้ำหนัก
    `;
    
    try {
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดระหว่างการเรียกใช้ Gemini AI:", error);
        // โยน Error ต่อไปให้ Endpoint หลักจัดการ
        throw new Error(`การสื่อสารกับ AI ล้มเหลว: ${error.message}`);
    }
}

// --- API Endpoint: The Main Logic Handler ---
app.post('/api/assess', async (req, res) => {
    try {
        const { name, age, sex, weight, height, symptoms } = req.body;

        // --- Server-side Validation ---
        if (!name || !age || !weight || !height || !symptoms) {
            return res.status(400).json({ 
                error: "ข้อมูลไม่ครบถ้วน",
                details: "กรุณากรอกข้อมูล ชื่อ, อายุ, เพศ, น้ำหนัก, ส่วนสูง, และอาการปัจจุบันให้ครบถ้วน"
            });
        }
        
        console.log(`ได้รับคำขอจาก: ${name}, อายุ: ${age}`);

        // 1. Calculate BMI
        const bmi = calculateBMI(weight, height);
        console.log(`คำนวณ BMI ได้: ${bmi.value} (${bmi.category})`);

        // 2. Get AI Analysis
        const analysis = await getAiAnalysis({ name, age, sex, bmi, symptoms });
        console.log(`✅ วิเคราะห์ AI สำเร็จสำหรับ ${name}`);

        // 3. Combine and send response
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