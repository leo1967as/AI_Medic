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
async function getAiAssessment(userData) {
    console.log('🤖 กำลังสร้าง Prompt และส่งให้ AI...');

    // นี่คือส่วนที่สำคัญที่สุด: การออกแบบ Prompt
    const prompt = `
      คำสั่ง: คุณคือผู้ช่วยประเมินสุขภาพเบื้องต้น หน้าที่ของคุณคือการวิเคราะห์ข้อมูลผู้ใช้และอาการที่ให้มา เพื่อให้คำแนะนำที่เป็นประโยชน์และปลอดภัย
      
      ข้อมูลผู้ใช้:
      - ชื่อ: ${userData.name}
      - อายุ: ${userData.age} ปี
      - BMI: ${userData.bmiResult.bmi} (${userData.bmiResult.category})
      - อาการที่แจ้ง: "${userData.symptoms}"

      งานของคุณ:
      วิเคราะห์ข้อมูลทั้งหมดและสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างดังนี้เท่านั้น:
      {
        "possible_conditions": [
          "ลิสต์ของภาวะหรือโรคที่ 'อาจเป็นไปได้' 2-3 อย่าง โดยเรียงจากความเป็นไปได้มากสุดไปน้อยสุด ใช้ภาษาที่เข้าใจง่าย และย้ำว่าเป็นเพียงการคาดเดาเบื้องต้น"
        ],
        "self_care_advice": [
          "คำแนะนำในการดูแลตัวเองเบื้องต้นที่สามารถทำได้ที่บ้าน (เช่น ดื่มน้ำมากๆ, พักผ่อน, รับประทานอาหารอ่อนๆ) ให้มาเป็นข้อๆ 4-5 ข้อ"
        ],
        "when_to_see_doctor": [
          "ลิสต์ของ 'สัญญาณอันตราย' ที่ผู้ใช้ควรไปพบแพทย์ทันที (เช่น หายใจลำบาก, มีไข้สูงไม่ลด, เจ็บหน้าอก) ให้มาเป็นข้อๆ 3-4 ข้อ"
        ],
        "disclaimer": "ย้ำเสมอว่านี่ไม่ใช่การวินิจฉัยทางการแพทย์ และควรปรึกษาแพทย์เพื่อการวินิจฉัยที่ถูกต้อง"
      }

      ข้อบังคับที่สำคัญที่สุด:
      1.  **ห้ามวินิจฉัยโรคเด็ดขาด!** ให้ใช้คำว่า "อาจเป็นไปได้", "อาจเกี่ยวข้องกับ", "มีแนวโน้ม" เสมอ
      2.  คำแนะนำต้องปลอดภัยและเป็นเรื่องทั่วไป ไม่แนะนำให้ใช้ยาชนิดใดชนิดหนึ่งโดยเฉพาะ
      3.  ต้องสร้างผลลัพธ์เป็น JSON ตามโครงสร้างที่กำหนดเป๊ะๆ
      4.  ฟิลด์ disclaimer ต้องมีข้อความตามที่กำหนดเสมอ
    `;

    try {
        const result = await model.generateContent(prompt);
        console.log("✅ AI ตอบกลับมาแล้ว");
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("❌ (Gemini) Error:", error);
        throw new Error("เกิดข้อผิดพลาดในการสื่อสารกับ AI");
    }
}


// --- API Endpoint ---
app.post('/api/assess', async (req, res) => {
    console.log("\nได้รับคำขอประเมินอาการใหม่...");
    const { name, age, weight, height, symptoms } = req.body;

    // -- การตรวจสอบข้อมูล --
    if (!name || !age || !weight || !height || !symptoms) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
        // 1. คำนวณ BMI
        const bmiResult = calculateBMI(parseFloat(weight), parseFloat(height));
        console.log(`คำนวณ BMI: ${bmiResult.bmi} (${bmiResult.category})`);

        // 2. ส่งข้อมูลไปให้ AI ประเมิน
        const aiAssessment = await getAiAssessment({ name, age, bmiResult, symptoms });

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