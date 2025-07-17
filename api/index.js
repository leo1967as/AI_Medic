// File: /api/index.js (ฉบับสมบูรณ์ Full-new + เพศ)

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Initialization & Environment Check ---
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined in environment variables.");
    // ใน Vercel, การโยน Error จะทำให้การ build หรือการทำงานของ serverless function ล้มเหลวและ log ข้อผิดพลาด
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


// --- Helper Function 1: Rule-Based Risk Determination ---
const determineHealthRiskLevel = (data) => {
    const { blood_sugar, bp_sys, bp_dia, hba1c, has_complications } = data;

    // Level 7: โรคแทรกซ้อน (สูงสุด)
    if (has_complications) {
        return { level: 7, name: 'โรคแทรกซ้อน', color: '#000000', advice: [ "อยู่ในภาวะเสี่ยงสูงสุด ควรพบแพทย์ด่วนหรือติดต่อ 1669", "ปฏิบัติตามคำสั่งของแพทย์อย่างเคร่งครัด", "ได้รับการตรวจติดตามอย่างใกล้ชิด", "ควรมีผู้ดูแลหรือแจ้งญาติให้ทราบ" ] };
    }
    // Level 6: วิกฤต
    if ((blood_sugar && blood_sugar >= 183) || (bp_sys && bp_dia && (bp_sys > 180 || bp_dia > 110)) || (hba1c && hba1c > 8)) {
        return { level: 6, name: 'วิกฤต', color: '#d32f2f', advice: [ "ควรพบแพทย์โดยเร็วที่สุด หรือตามนัดอย่างสม่ำเสมอทุก 1 เดือน", "รับประทานยาต่อเนื่องและอาจจำเป็นต้องปรับยา", "ตรวจภาวะแทรกซ้อนที่ตา, ไต, เท้า อย่างน้อยปีละ 1 ครั้ง", "ควบคุมอาหารกลุ่ม แป้ง, น้ำตาล, ไขมัน และรสเค็ม อย่างเข้มงวด" ] };
    }
    // Level 5: อันตราย
    if ((blood_sugar && blood_sugar >= 155) || (bp_sys && bp_dia && (bp_sys >= 160 || bp_dia >= 100)) || (hba1c && hba1c >= 7)) {
        return { level: 5, name: 'อันตราย', color: '#f57c00', advice: [ "ควรพบแพทย์ทุก 1-3 เดือน เพื่อประเมินและปรับยา", "รับประทานยาตามแพทย์สั่งอย่างต่อเนื่อง", "คุมอาหารรสหวาน มัน เค็ม และออกกำลังกายสม่ำเสมอ (3 อ. 3 ลด)", "หากมีอาการผิดปกติ เช่น ตาพร่ามัว ชาปลายเท้า หรือเจ็บหน้าอก ควรรีบพบแพทย์" ] };
    }
    // Level 4: เฝ้าระวัง
    if ((blood_sugar && blood_sugar >= 126) || (bp_sys && bp_dia && (bp_sys >= 140 || bp_dia >= 90))) {
        return { level: 4, name: 'เฝ้าระวัง', color: '#fbc02d', advice: [ "พบแพทย์ทุก 2-3 เดือน เพื่อติดตามอาการ", "ปรับเปลี่ยนพฤติกรรมสุขภาพอย่างจริงจัง (3 อ. 3 ลด: อาหาร, ออกกำลังกาย, อารมณ์)", "ควรเริ่มรับประทานยาตามคำแนะนำของแพทย์ (ถ้ามี)", "ตรวจหาภาวะแทรกซ้อนทางตา, ไต, หัวใจ, เท้า อย่างน้อยปีละ 1 ครั้ง" ] };
    }
    // Level 3: คุมได้ดี (สำหรับผู้มีความเสี่ยงหรือเป็นโรคแล้ว)
    if ((blood_sugar && blood_sugar <= 125) || (bp_sys && bp_dia && (bp_sys <= 139 || bp_dia <= 89))) {
        return { level: 3, name: 'คุมได้ดี', color: '#4caf50', advice: [ "รักษาวินัยในการคุมอาหารและออกกำลังกายต่อไป", "พบแพทย์ตามนัดเพื่อติดตามอาการทุก 3-6 เดือน", "ลดการบริโภคน้ำตาลและไขมันอิ่มตัว", "รับประทานยาต่อเนื่องตามแผนการรักษา" ] };
    }
    // Level 2: เสี่ยง
    if ((blood_sugar && blood_sugar >= 100) || (bp_sys && bp_dia && (bp_sys >= 121 || bp_dia >= 81))) {
        return { level: 2, name: 'เสี่ยง', color: '#9ccc65', advice: [ "ปรับเปลี่ยนพฤติกรรม 3 อ. (อาหาร ออกกำลังกาย อารมณ์) และ 3 ลด (ลดหวาน ลดมัน ลดเค็ม)", "ตรวจวัดความดันโลหิตและระดับน้ำตาลอย่างสม่ำเสมอ (อย่างน้อยปีละครั้ง)", "ลดน้ำหนักหากมีภาวะน้ำหนักเกิน", "ปรึกษาแพทย์หรือเภสัชกรเพื่อรับคำแนะนำ" ] };
    }
    // Level 1: ปกติ
    return { level: 1, name: 'ปกติ', color: '#4dd0e1', advice: [ "ออกกำลังกายสม่ำเสมออย่างน้อย 3-5 วัน/สัปดาห์ ครั้งละ 30 นาที", "รับประทานอาหารให้ครบ 5 หมู่ หลีกเลี่ยงอาหารรสจัด", "ตรวจสุขภาพประจำปี", "รักษาน้ำหนักตัวให้อยู่ในเกณฑ์ปกติ" ] };
};


// --- Helper Function 2: AI-Powered Explanation ---
async function getAiAssessment(userData, riskProfile) {
    const prompt = `
      คำสั่ง: คุณคือผู้ช่วยด้านสุขภาพ AI หน้าที่ของคุณคือการเป็น "ผู้อธิบายและให้คำแนะนำเพิ่มเติม" จากข้อมูลที่ถูกประมวลผลมาแล้ว

      **ข้อมูลผู้ใช้:**
      - ชื่อ: ${userData.name}, อายุ: ${userData.age} ปี, เพศ: ${userData.sex}
      - BMI: ${userData.bmiResult.bmi} (${userData.bmiResult.category})
      - โรคประจำตัวอื่นๆ (ถ้ามี): ${userData.other_conditions || "ไม่ได้ระบุ"}
      - อาการที่พิมพ์เข้ามา: "${userData.symptoms || "ไม่ได้ระบุอาการเฉพาะ"}"

      **ผลการประเมินเบื้องต้น (จากระบบตามกฎ):**
      - ระดับความเสี่ยง: "ระดับ ${riskProfile.level} - ${riskProfile.name}"
      - คำแนะนำมาตรฐานตามหลักเกณฑ์: ${riskProfile.advice.join(', ')}

      **งานของคุณ:**
      วิเคราะห์ข้อมูลทั้งหมด แล้วสร้างผลลัพธ์เป็น JSON object ที่มีโครงสร้างดังนี้เท่านั้น:
      {
        "overall_summary": "สรุปสถานการณ์ของผู้ใช้เป็นภาษาที่เข้าใจง่าย 1-2 ประโยค โดยเชื่อมโยง 'ระดับความเสี่ยง' กับข้อมูลอื่นๆ เช่น 'จากค่าความดันโลหิตที่อยู่ในเกณฑ์เฝ้าระวัง ประกอบกับคุณเป็นเพศชายและมีภาวะน้ำหนักเกิน จึงมีความจำเป็นอย่างยิ่งที่ต้องควบคุมอาหารและออกกำลังกายเพื่อลดความเสี่ยงโรคหัวใจ'",
        "additional_recommendations": [
            "ให้คำแนะนำ 'เพิ่มเติม' ที่เฉพาะเจาะจง 3-4 ข้อ นอกเหนือจากคำแนะนำมาตรฐาน โดยพิจารณาจาก 'เพศ', 'อาการที่พิมพ์เข้ามา' และ 'โรคประจำตัวอื่นๆ' (เช่น ถ้าผู้ใช้เป็นเพศหญิงและปวดท้องน้อย ให้แนะนำเรื่องการสังเกตความผิดปกติของประจำเดือน, ถ้าอาการคือปวดเข่า ให้แนะนำเรื่องการออกกำลังกายที่ลดแรงกระแทก)",
            "อาจแนะนำชนิดของอาหารที่ควรเน้นหรือหลีกเลี่ยงเป็นพิเศษสำหรับระดับความเสี่ยงนี้",
            "ย้ำเตือนถึงความสำคัญของคำแนะนำมาตรฐานข้อที่สำคัญที่สุดสำหรับผู้ใช้รายนี้"
        ],
        "important_note": "ย้ำเสมอว่านี่เป็นเพียงการประเมินเบื้องต้น และข้อมูลจากเครื่องวัดที่บ้านอาจมีความคลาดเคลื่อน ควรปรึกษาแพทย์เพื่อรับการวินิจฉัยและการรักษาที่ถูกต้อง"
      }

      ข้อบังคับที่สำคัญ:
      1. ห้ามขัดแย้งกับ 'ระดับความเสี่ยง' ที่ประเมินมาให้แล้ว
      2. ให้นำข้อมูล 'เพศ' มาเป็นปัจจัยสำคัญในการวิเคราะห์
      3. ต้องสร้าง JSON ตามโครงสร้างเป๊ะๆ และครบทุกฟิลด์
    `;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}


// --- API Endpoint: The Main Logic Handler ---
app.post('/api/assess', async (req, res) => {
    try {
        // 1. Destructure all expected data from request body
        const {
            name, age, sex, weight, height,
            symptoms, blood_sugar, bp_sys, bp_dia,
            hba1c, has_complications,
            // Capture any other potential fields
            ...other_conditions
        } = req.body;

        // 2. Calculate BMI
        const bmiResult = { bmi: 'N/A', category: 'ข้อมูลไม่ครบถ้วน' };
        if (weight && height) {
            const h = parseFloat(height) / 100;
            const w = parseFloat(weight);
            if(h > 0 && w > 0) {
              const bmi = (w / (h * h)).toFixed(2);
              bmiResult.bmi = bmi;
              if (bmi < 18.5) bmiResult.category = 'น้ำหนักน้อยกว่าเกณฑ์';
              else if (bmi < 23) bmiResult.category = 'สมส่วน';
              else if (bmi < 25) bmiResult.category = 'น้ำหนักเกิน';
              else if (bmi < 30) bmiResult.category = 'โรคอ้วนระดับที่ 1';
              else bmiResult.category = 'โรคอ้วนระดับที่ 2';
            }
        }

        // 3. Evaluate risk based on rules
        const riskProfile = determineHealthRiskLevel({
            // Parse inputs safely, providing null if empty or invalid
            blood_sugar: blood_sugar ? parseInt(blood_sugar, 10) : null,
            bp_sys: bp_sys ? parseInt(bp_sys, 10) : null,
            bp_dia: bp_dia ? parseInt(bp_dia, 10) : null,
            hba1c: hba1c ? parseFloat(hba1c) : null,
            has_complications: !!has_complications // Ensures it's a boolean
        });

        // 4. Get additional, contextual advice from AI
        // const aiAnalysis = await getAiAssessment(
        //     { name, age, sex, bmiResult, symptoms, other_conditions },
        //     riskProfile
        // );
    let aiAnalysis;
        try {
            console.log("กำลังเรียกใช้ AI เพื่อขอคำแนะนำเพิ่มเติม...");
            aiAnalysis = await getAiAssessment(
                { name, age, sex, bmiResult, symptoms, other_conditions },
                riskProfile
            );
            console.log("✅ ได้รับคำแนะนำเพิ่มเติมจาก AI สำเร็จ");

        } catch (aiError) {
            // **การเปลี่ยนแปลงที่ 2:** จัดการข้อผิดพลาดจาก AI โดยเฉพาะ
            console.error("❌ เกิดข้อผิดพลาดระหว่างการสื่อสารกับ Google AI:", aiError.message);

            // ถ้าไม่มี AI Analysis เราจะสร้าง object สำรองขึ้นมา
            aiAnalysis = {
                overall_summary: "ไม่สามารถสร้างบทวิเคราะห์จาก AI ได้เนื่องจากปัญหาการเชื่อมต่อ",
                additional_recommendations: ["โปรดยึดตามข้อปฏิบัติหลักตามเกณฑ์ที่แสดง และปรึกษาแพทย์เพื่อความปลอดภัย"],
                important_note: aiError.message // **ส่งข้อความ Error จริงๆ ไปแสดงผล!**
            };
        }
        // 5. Combine all results and send back to frontend
        res.json({
            userInfo: { name, age, sex }, // Include sex in user info
            bmi: bmiResult,
            riskProfile: riskProfile,   // Rule-based result
            aiAnalysis: aiAnalysis      // AI-based explanation
        });

        
    } catch (error) {
        // **การเปลี่ยนแปลงที่ 3:** Catch block นี้จะจัดการข้อผิดพลาดร้ายแรงอื่นๆ ที่ไม่ใช่จาก AI
        console.error("Unhandled Error in /api/assess:", error);

        // กำหนดข้อความ Error ที่จะส่งกลับไปให้ Frontend
        let errorMessage = "เกิดข้อผิดพลาดไม่ทราบสาเหตุบนเซิร์ฟเวอร์";
        let statusCode = 500;

        // ตัวอย่างการวิเคราะห์ Error เพิ่มเติม
        if (error.message.includes("GEMINI_API_KEY")) {
            errorMessage = "การตั้งค่าเซิร์ฟเวอร์ไม่สมบูรณ์ (API Key Error)";
            statusCode = 503; // Service Unavailable
        }
        
        res.status(statusCode).json({
            error: "เกิดข้อผิดพลาดในการประมวลผล",
            details: errorMessage
        });
    }
});

export default app;