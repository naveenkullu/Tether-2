import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function generateSituationAnalysis(data) {
    try {
        const prompt = `
You are Tether AI.

Analyze the following Safe Walk situation.

Current Risk: ${data.risk}

Safe Score:
${data.score}

Area:
${data.area}

Weather:
${data.weather}

Battery:
${data.battery}%

Day/Night:
${data.dayNight}

Walking Speed:
${data.speed}

Nearby Police:
${data.police}

Nearby Hospital:
${data.hospital}

Risk Reasons:

${(data.reasons || []).join("\n")}

Return ONLY one professional paragraph.
Maximum 90 words.
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;
    } catch (err) {
        console.error(err);
        return "Tether AI could not analyse the situation.";
    }
}
export async function generateIncidentSummary(data) {

    try {

        const prompt = `
You are Tether AI.

Generate a professional Safe Walk Summary.

Duration:
${data.duration}

Highest Risk:
${data.highestRisk}

Final Score:
${data.finalScore}

Area:
${data.area}

Events:

${(data.events || []).join("\n")}

Return ONLY JSON.

{
"summary":"",
"recommendation":""
}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return JSON.parse(response.text.replace(/```json|```/g,""));

    } catch(e){

        return {
            summary:"Safe Walk completed successfully.",
            recommendation:"No further action required."
        };

    }

}