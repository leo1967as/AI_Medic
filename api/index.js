// File: /api/index.js (ฉบับอัปเกรดความทนทาน)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialization ---
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
}

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { response_mime_type: "application/json" }
});


// --- ฟังก์ชันหลัก: กำหนดระดับความเสี่ยงตามตาราง 7 สี (เหมือนเดิม) ---
const determineHealthRiskLevel = (data) => {
    // ใส่โค้ดฟังก์ชัน determineHealthRiskLevel เดิมของคุณที่นี่...
    const { blood_sugar, bp_sys, bp_dia, hba1c, has_complications } = data;
    if (has_complications) return { level: 7, name: 'โรคแทรกซ้อน', color: '#000000', advice: [ "อยู่ในภาวะเสี่ยงสูงสุด ควรพบแพทย์ด่วนหรือติดต่อ 1669", "ปฏิบัติตามคำสั่งของแพทย์อย่างเคร่งครัด", "ได้รับการตรวจติดตามอย่างใกล้ชิด", "มีผู้ดูแล/แจ้งญาติ" ] };
    if ((blood_sugar && blood_sugar >= 183) || (bp_sys && bp_dia && (bp_sys > 180 || bp_dia > 110)) || (hba1c && hba1c > 8)) return { level: 6, name: 'วิกฤต', color: '#d32f2f', advice: [ "3 อ. 3 ลด", "รับประทานยาต่อเนื่อง", "พบแพทย์ทุก 1-3 เดือน", "การปรับเปลี่ยนยาหรือการฉีดอินซูลินอาจจำเป็น", "ตรวจภาวะแทรกซ้อนอย่างน้อยปีละ 1 ครั้ง", "พบแพทย์ตามนัดเสมอ" ] };
    if ((blood_sugar && blood_sugar >= 155) || (bp_sys && bp_dia && (bp_sys >= 160 || bp_dia >= 100)) || (hba1c && hba1c >= 7)) return { level: 5, name: 'อันตราย', color: '#f57c00', advice: [ "3 อ. 3 ลด", "รับประทานยาต่อเนื่อง", "พบแพทย์ทุก 2-3 เดือน", "ตรวจภาวะแทรกซ้อนอย่างน้อยปีละ 1 ครั้ง", "หากมีอาการผิดปกติควรรีบพบแพทย์", "ได้รับการติดตามเยี่ยมบ้าน" ] };
    if ((blood_sugar && blood_sugar >= 126) || (bp_sys && bp_dia && (bp_sys >= 140 || bp_dia >= 90))) return { level: 4, name: 'เฝ้าระวัง', color: '#fbc02d', advice: [ "3 อ. 3 ลด", "รับประทานยาต่อเนื่อง", "พบแพทย์ทุก 2-3 เดือน", "ตรวจภาวะแทรกซ้อนทางตา, ไต, หัวใจ, เท้า อย่างน้อยปีละ 1 ครั้ง" ] };
    if ((blood_sugar && blood_sugar <= 125) || (bp_sys && bp_dia && (bp_sys <= 139 || bp_dia <= 89))) return { level: 3, name: 'คุมได้ดี (สำหรับผู้เป็นโรค)', color: '#4caf50', advice: [ "3 อ. 3 ลด", "รับประทานยาต่อเนื่อง", "พบแพทย์ทุก 2-3 เดือน", "ลดการบริโภคน้ำตาล", "เลิกสูบบุหรี่และสุรา" ] };
    if ((blood_sugar && blood_sugar >= 100) || (bp_sys && bp_dia && (bp_sys >= 121 || bp_dia >= 81))) return { level: 2, name: 'เสี่ยง', color: '#9ccc65', advice: [ "3 อ. 3 ลด", "ตรวจวัดความดันสม่ำเสมอทุก 1-3 เดือน", "สำหรับผู้ป่วยเบาหวานควรปรึกษาแพทย์", "งดรับประทานอาหารหวาน มัน เค็ม", "ลดการบริโภคเครื่องดื่มแอลกอฮอล์" ] };
    return { level: 1, name: 'ปกติ', color: '#4dd0e1', advice: [ "3 อ. 3 ลด ทุกสัปดาห์ ครั้งละ 30 นาที", "ออกกำลังกายสม่ำเสมอ", "ชั่งน้ำหนักและวัดรอบเอว", "ควบคุมระดับความดันและน้ำตาลทุก 1 ปี" ] };
};


// --- ฟังก์ชันเรียก Gemini (ใส่ Prompt เดิม) ---
async function getAiAssessment(userData, riskProfile) {
    // ใส่โค้ด Prompt เดิมของคุณที่นี่...
     const prompt = `คำสั่ง: คุณคือผู้ช่วยด้านสุขภาพ AI หน้าที่ของคุณคือการเป็น "ผู้อธิบายและให้คำแนะนำเพิ่มเติม" จากข้อมูลที่ถูกประมวลผลมาแล้ว\n\nข้อมูลผู้ใช้:\n- ชื่อ: ${userData.name}, อายุ: ${userData.age} ปี, BMI: ${userData.bmiResult.bmi} (${userData.bmiResult.category})\n- โรคประจำตัวอื่นๆ: ${userData.chronic_conditions}\n- อาการที่พิมพ์เข้ามา: "${userData.symptoms}"\n\n**ผลการประเมินเบื้องต้น (จากระบบ):**\n- ระดับความเสี่ยง: "ระดับ ${riskProfile.level} - ${riskProfile.name}"\n- คำแนะนำมาตรฐานตามหลักเกณฑ์: ${riskProfile.advice.join(', ')}\n\n**งานของคุณ:**\nสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างดังนี้เท่านั้น:\n{\n  "overall_summary": "สรุปสถานการณ์ของผู้ใช้เป็นภาษาที่เข้าใจง่าย 1-2 ประโยค โดยเชื่อมโยง 'ระดับความเสี่ยง' กับ 'อาการที่พิมพ์เข้ามา' เช่น 'จากระดับความดันที่สูงในเกณฑ์อันตราย อาการปวดศีรษะที่คุณแจ้งมาอาจเป็นสัญญาณที่เกี่ยวข้องกันค่ะ'",\n  "additional_recommendations": [\n      "ให้คำแนะนำ 'เพิ่มเติม' 3-4 ข้อ นอกเหนือจากคำแนะนำมาตรฐานที่ให้มา โดยพิจารณาจาก 'อาการที่พิมพ์เข้ามา' และ 'โรคประจำตัวอื่นๆ' ของผู้ใช้ (เช่น ถ้าผู้ใช้ปวดเข่า ให้แนะนำเรื่องการออกกำลังกายที่ลดแรงกระแทก)",\n      "อาจแนะนำเรื่องอาหารที่เหมาะสมกับระดับความเสี่ยงนั้นๆ",\n      "ย้ำเตือนถึงความสำคัญของคำแนะนำมาตรฐานข้อที่สำคัญที่สุด"\n  ],\n  "important_note": "ย้ำเสมอว่านี่เป็นเพียงการประเมินเบื้องต้น และข้อมูลจากเครื่องวัดที่บ้านอาจมีความคลาดเคลื่อน ควรปรึกษาแพทย์เพื่อรับการวินิจฉัยและการรักษาที่ถูกต้อง"\n}\n\nข้อบังคับ:\n1.  ห้ามขัดแย้งกับ 'ระดับความเสี่ยง' ที่ประเมินมาให้แล้ว\n2.  ต้องสร้าง JSON ตามโครงสร้างเป๊ะๆ และครบทุกฟิลด์`;
    try {
        const result = await model.generateContent(prompt);
        // *** [NEW] Added a robust JSON parsing check ***
        const responseText = result.response.text();
        return JSON.parse(responseText);
    } catch (error) {
        console.error("AI Response/JSON Parsing Error:", error);
        // Return a default object structure on failure so the app doesn't crash
        return {
            overall_summary: "AI ไม่สามารถประมวลผลคำแนะนำเพิ่มเติมได้ในขณะนี้",
            additional_recommendations: ["โปรดยึดตามข้อปฏิบัติหลักและปรึกษาแพทย์"],
            important_note: "ย้ำเสมอว่านี่เป็นเพียงการประเมินเบื้องต้น และข้อมูลจากเครื่องวัดที่บ้านอาจมีความคลาดเคลื่อน ควรปรึกษาแพทย์เพื่อรับการวินิจฉัยและการรักษาที่ถูกต้อง"
        };
    }
}


// --- API Endpoint (ปรับปรุงให้จัดการค่าว่าง) ---
app.post('/api/assess', async (req, res) => {
    try {
        const { name, age, weight, height, symptoms, blood_sugar, bp_sys, bp_dia, hba1c, has_complications, ...other_conditions } = req.body;
        
        // --- 1. คำนวณ BMI ---
        const bmiResult = { bmi: 'N/A', category: 'ข้อมูลไม่ครบถ้วน' };
        if (weight && height) {
            const h = parseFloat(height) / 100;
            const w = parseFloat(weight);
            if(h > 0 && w > 0) {
              const bmi = (w / (h * h)).toFixed(2);
              bmiResult.bmi = bmi;
              if (bmi < 18.5) bmiResult.category = 'น้ำหนักน้อยกว่าเกณฑ์';
              else if (bmi < 23) bmiResult.category = 'สมส่วน';
              else bmiResult.category = 'น้ำหนักเกินเกณฑ์';
            }
        }
        
        // --- 2. ประเมินระดับความเสี่ยงตามกฎ ---
        const riskProfile = determineHealthRiskLevel({
            blood_sugar: blood_sugar ? parseInt(blood_sugar, 10) : null,
            bp_sys: bp_sys ? parseInt(bp_sys, 10) : null,
            bp_dia: bp_dia ? parseInt(bp_dia, 10) : null,
            hba1c: hba1c ? parseFloat(hba1c) : null,
            has_complications: !!has_complications // Convert to boolean
        });

        // --- 3. ให้ AI อธิบายและให้คำแนะนำเพิ่มเติม ---
        const aiAnalysis = await getAiAssessment({ name, age, bmiResult, symptoms, ...other_conditions }, riskProfile);
        
        res.json({ userInfo: { name, age }, bmi: bmiResult, riskProfile, aiAnalysis });

    } catch (error) {
        // เพิ่มการ Log Error ที่นี่
        console.error("Error in /api/assess handler:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการประมวลผลบนเซิร์ฟเวอร์", details: error.message });
    }
});

export default app;