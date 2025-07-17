// File: /api/index.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { response_mime_type: "application/json" }
});

// --- Helper Functions ---

/**
 * คำนวณ BMI และจัดหมวดหมู่
 * @param {number} weight - น้ำหนัก (kg)
 * @param {number} height - ส่วนสูง (cm)
 * @returns {object} ผลลัพธ์ BMI และหมวดหมู่
 */
const calculateBMI = (weight, height) => {
    if (!weight || !height || height <= 0) {
        return { bmi: 0, category: 'ข้อมูลไม่ถูกต้อง' };
    }
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);
    let category = '';
    if (bmi < 18.5) category = 'น้ำหนักน้อยกว่าเกณฑ์';
    else if (bmi >= 18.5 && bmi <= 22.9) category = 'ปกติ (สมส่วน)';
    else if (bmi >= 23 && bmi <= 24.9) category = 'น้ำหนักเกิน';
    else if (bmi >= 25 && bmi <= 29.9) category = 'โรคอ้วนระดับที่ 1';
    else category = 'โรคอ้วนระดับที่ 2 (อันตราย)';
    return { bmi, category };
};


/**
 * สร้าง Prompt และเรียก Gemini AI
 * @param {object} userData - ข้อมูลผู้ใช้ (name, age, bmiResult, symptoms)
 * @returns {Promise<object>} ผลลัพธ์การวิเคราะห์จาก AI
 */
// ใน api/index.js - ฟังก์ชัน getAiAssessment (ฉบับอัปเกรด)
// ใน api/index.js - แก้ไขเฉพาะฟังก์ชัน getAiAssessment
async function getAiAssessment(userData) {
    console.log('🤖 กำลังสร้าง Prompt (ละเอียด+จัดระดับความเสี่ยง) และส่งให้ AI...');

    const prompt = `
      คำสั่ง: คุณคือผู้ช่วยประเมินสุขภาพเบื้องต้น หน้าที่ของคุณคือวิเคราะห์ข้อมูลผู้ใช้และอาการอย่างละเอียด เพื่อให้คำแนะนำที่ปลอดภัยและจัดลำดับความเสี่ยง

      **ข้อมูลผู้ใช้แบบละเอียด:**
      - ชื่อ: ${userData.name}
      - อายุ: ${userData.age} ปี
      - BMI: ${userData.bmiResult.bmi} (${userData.bmiResult.category})
      - โรคประจำตัว: ${userData.chronic_conditions || "ไม่มีข้อมูล"}
      - ยาที่ทานประจำ: ${userData.medications || "ไม่มีข้อมูล"}
      - ประวัติการแพ้: ${userData.allergies || "ไม่มีข้อมูล"}
      
      **รายละเอียดอาการที่แจ้ง:**
      - อาการหลัก: "${userData.symptoms}"
      - เป็นมานาน: ${userData.duration || "ไม่ได้ระบุ"}
      - ความรุนแรง (0-10): ${userData.severity || "ไม่ได้ระบุ"}

      **งานของคุณ:**
      วิเคราะห์ข้อมูลทั้งหมด แล้วสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างดังนี้เท่านั้น:
      {
        "primary_analysis": "สรุปการวิเคราะห์เบื้องต้น 1-2 ประโยค โดยอ้างอิงข้อมูลทั้งหมด",
        "possible_conditions": [
          { "condition": "ชื่อภาวะสุขภาพที่อาจเกี่ยวข้อง #1", "risk": "high" },
          { "condition": "ชื่อภาวะสุขภาพที่อาจเกี่ยวข้อง #2", "risk": "medium" },
          { "condition": "ชื่อภาวะสุขภาพที่อาจเกี่ยวข้อง #3", "risk": "low" }
        ],
        "self_care_advice": ["คำแนะนำในการดูแลตัวเองเบื้องต้น 4-5 ข้อ"],
        "when_to_see_doctor": ["ลิสต์ 'สัญญาณอันตราย' ที่ผู้ใช้ควรไปพบแพทย์ทันที"],
        "disclaimer": "ย้ำเสมอว่านี่ไม่ใช่การวินิจฉัยทางการแพทย์ และควรปรึกษาแพทย์เพื่อการวินิจฉัยที่ถูกต้อง"
      }

      **ข้อบังคับสำคัญที่สุด:**
      1.  ในฟิลด์ "possible_conditions" ให้สร้างเป็น Array ของ Object เสมอ
      2.  แต่ละ Object ต้องมี key "condition" (ชื่อภาวะ) และ "risk" (ระดับความเสี่ยง)
      3.  **สำหรับ "risk" ให้ใช้ค่าใดค่าหนึ่งจากนี้เท่านั้น: 'high' (เสี่ยงสูงสุด), 'medium' (เสี่ยงปานกลาง), 'low' (เสี่ยงต่ำ) โดยประเมินจากความรุนแรงของอาการและข้อมูลโรคประจำตัว**
      4.  เรียงลำดับรายการใน "possible_conditions" จาก 'high' ไป 'low'
      5.  ห้ามวินิจฉัยโรคเด็ดขาด และต้องสร้าง JSON ให้ครบทุกฟิลด์ตามโครงสร้างเป๊ะๆ
    `;

    try {
        const result = await model.generateContent(prompt);
        console.log("✅ AI ตอบกลับมาพร้อมระดับความเสี่ยงแล้ว");
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("❌ (Gemini) Error:", error);
        throw new Error("เกิดข้อผิดพลาดในการสื่อสารกับ AI");
    }
}


// --- API Endpoint ---
app.post('/api/assess', async (req, res) => {
    console.log("\nได้รับคำขอประเมินอาการใหม่...");
    const { name, age, weight, height, symptoms, duration, severity, chronic_conditions, medications, allergies } = req.body;

    // -- การตรวจสอบข้อมูล --
    if (!name || !age || !weight || !height || !symptoms) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
        // 1. คำนวณ BMI
        const bmiResult = calculateBMI(parseFloat(weight), parseFloat(height));
        console.log(`คำนวณ BMI: ${bmiResult.bmi} (${bmiResult.category})`);

        // 2. ส่งข้อมูลไปให้ AI ประเมิน
        const aiAssessment = await getAiAssessment({ 
        name, age, bmiResult, symptoms, 
        duration, severity, chronic_conditions, medications, allergies // << ข้อมูลใหม่
    });
        // 3. รวมผลลัพธ์ทั้งหมดแล้วส่งกลับ
        const finalResponse = {
            userInfo: { name, age, weight, height },
            bmi: bmiResult,
            assessment: aiAssessment
        };
        
        res.json(finalResponse);

    } catch (error) {
        console.error("เกิดข้อผิดพลาดใน /api/assess:", error);
        res.status(500).json({ error: error.message || "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" });
    }
});


// Export a single handler for Vercel
export default app;