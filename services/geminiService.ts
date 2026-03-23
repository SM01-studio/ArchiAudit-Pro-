import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisReport, OptimizationRequest, OptimizationResult, OptimizedOption } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ARCHITECT_ANALYSIS_INSTRUCTION = `
You are a World-Class Residential Design Director. 
Your goal is to critique floor plans with the rigor of a top-tier architectural firm.
Output must be structured JSON.
`;

// Helper to clean and parse JSON from Markdown code blocks
const parseJSON = (text: string) => {
  try {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '');
    }
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Invalid JSON format received from AI");
  }
};

/**
 * Image Generation Helper - EXCLUSIVELY USES GEMINI 2.5 FLASH IMAGE
 * Optimized for Architectural Rationality & Structural Integrity.
 */
const generatePlanImage = async (prompt: string, imageBase64: string): Promise<string> => {
    try {
        console.log("Attempting Image Gen: gemini-2.5-flash-image");
        
        // Crafted prompt to act as a "Layout Engine" with strict physical constraints
        const flashPrompt = `${prompt} 
        
        CRITICAL ARCHITECTURAL RULES (STRICT COMPLIANCE):
        1. **STRUCTURE (SAFETY)**: 
           - **SOLID BLACK WALLS** are Load-Bearing Shear Walls. **DO NOT MOVE OR DELETE THEM.**
           - **THIN LINES** are Partition Walls. You **SHOULD** demolish or move them to optimize space.
           
        2. **CIRCULATION (FLOW)**: 
           - **ENTRANCE ZONE**: The main entry door MUST open into a clear Foyer. **ABSOLUTELY NO KITCHEN CABINETS OR WALLS BLOCKING THE ENTRANCE.**
           - **HALLWAYS**: Must be straight and at least 1m wide.
           
        3. **ZONING (LOGIC)**: 
           - **KITCHEN**: Place adjacent to Dining. If "Open Concept", remove the thin wall between them.
           - **PLUMBING**: Keep Bathrooms/Toilets roughly in their original quadrants (do not move a toilet to the middle of a bedroom).
           
        4. **STYLE**: 
           - Keep the exact "Black & White CAD" style of the original. 
           - Draw standard architectural furniture symbols.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: {
                parts: [
                    { text: flashPrompt },
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
                ]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData && part.inlineData.data) return part.inlineData.data;
        }
    } catch (e) {
        console.error("Image generation failed", e);
    }

    return ""; // Return empty string if fail
};

export const analyzeFloorPlan = async (request: OptimizationRequest): Promise<AnalysisReport> => {
  
  const callAnalysisApi = async (useTools: boolean) => {
    let prompt = `
      Task: Deep Architectural Audit.
      Context: Type=${request.planType}, Position=${request.positioning}, SpecialReq=${request.specialRequirements || 'None'}.
      
      ACTIONS:
      ${useTools ? '1. USE GOOGLE SEARCH to find "Residential Floor Plan Design Standards 2024".' : '1. Use your internal expert knowledge.'}
      2. Critique the floor plan against luxury standards.
      3. Return valid JSON matching the following structure exactly:
      {
        "summary": "string",
        "summaryCn": "string",
        "items": [
          {
            "category": "string",
            "categoryCn": "string",
            "status": "pass" | "fail" | "warning",
            "observation": "string",
            "observationCn": "string"
          }
        ]
      }
    `;

    const config: any = {
      systemInstruction: ARCHITECT_ANALYSIS_INSTRUCTION,
    };

    if (useTools) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          summaryCn: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                categoryCn: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["pass", "fail", "warning"] },
                observation: { type: Type.STRING },
                observationCn: { type: Type.STRING },
              },
              required: ["category", "categoryCn", "status", "observation", "observationCn"],
            },
          },
        },
        required: ["summary", "summaryCn", "items"],
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: request.image } },
          { text: prompt },
        ],
      },
      config: config,
    });

    if (response.text) {
      return useTools ? parseJSON(response.text) : JSON.parse(response.text);
    }
    throw new Error("No text returned from Gemini API");
  };

  try {
    console.log("Attempting analysis with Google Search...");
    return await callAnalysisApi(true);
  } catch (error: any) {
    console.warn("Google Search Analysis failed. Retrying with standard model...", error);
    try {
      return await callAnalysisApi(false);
    } catch (fallbackError: any) {
      console.error("Critical Analysis Failure:", fallbackError);
      return {
        summary: "Analysis service is currently experiencing high traffic. Proceeding to manual optimization.",
        summaryCn: "分析服务暂时繁忙。请直接进入优化步骤。",
        items: []
      };
    }
  }
};

export const generateOptimizations = async (request: OptimizationRequest, analysis: AnalysisReport): Promise<OptimizationResult> => {
  // 1. Logic Generation - Refined for ANNOTATION RELIABILITY
  const logicPrompt = `
    Role: Senior Architect.
    Task: Create 2 rational renovation strategies based on the floor plan image.
    
    ANALYSIS INSTRUCTION:
    - **Black Solid Walls** = Structural (Keep).
    - **Thin Lines** = Partitions (Remove/Move).
    
    REQUIRED OUTPUT:
    You MUST return a JSON object with two options.
    **CRITICAL**: Each option MUST include an 'annotations' array with 4-6 specific items describing changes.
    
    STRATEGY 1: "Rational Improvement"
    - Fix functionality issues (e.g. storage, door swing).
    - Ensure entrance is clear.
    - Optimize furniture size.
    
    STRATEGY 2: "Layout Transformation"
    - **Demolish thin walls** to create Open Kitchen (LDK) or larger Master Suite.
    - **Check**: Is the Kitchen blocking the entrance? If yes, MOVE IT.
    - Improve flow between rooms.
    
    Coordinates (x,y) should be 0-100 percentage.
  `;

  let strategies: any = {};
  
  try {
      const strategyResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: [
            { inlineData: { mimeType: "image/jpeg", data: request.image } }, 
            { text: logicPrompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              option1: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  annotations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        textCn: { type: Type.STRING },
                        location: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } }
                      }
                    }
                  }
                }
              },
              option2: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  annotations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        textCn: { type: Type.STRING },
                        location: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      strategies = JSON.parse(strategyResponse.text || "{}");
  } catch (e) {
      console.error("Strategy Logic Failed", e);
      // Fallback strategies to avoid crash
      strategies = { 
          option1: { description: "General optimization", annotations: [] }, 
          option2: { description: "Layout overhaul", annotations: [] } 
      };
  }

  // 2. Image Generation - Using the STRICT & RATIONAL prompt logic
  const createPrompt = (strategyName: string, details: string) => `
    Task: Professional Architectural Renovation Plan.
    
    INPUT: Floor plan image.
    
    STRICT GEOMETRY RULES:
    1. **KEEP**: All thick black solid walls (Structural).
    2. **MODIFY**: Thin internal partition walls can be removed/moved.
    
    FUNCTIONAL REQUIREMENTS:
    - **Strategy**: ${strategyName}
    - **Entrance**: KEEP CLEAR. Do not put furniture or walls blocking the main door.
    - **Kitchen**: Functional placement near Dining. 
    - **Bedrooms**: Rational bed placement (headboard against solid wall, not window).
    - **Furniture**: Standard architectural scale.
    
    Specific Details: ${details}
    
    OUTPUT STYLE:
    - Clear, legible 2D CAD plan. 
    - Black walls, White background.
  `;

  const [img1, img2] = await Promise.all([
     generatePlanImage(createPrompt("Rational Optimization", strategies.option1?.description || "Optimize layout"), request.image),
     generatePlanImage(createPrompt("LDK Spatial Flow", strategies.option2?.description || "Open plan renovation"), request.image)
  ]);

  return {
    option1: { id: "opt1", imageUrl: img1 || request.image, annotations: strategies.option1?.annotations || [] },
    option2: { id: "opt2", imageUrl: img2 || request.image, annotations: strategies.option2?.annotations || [] }
  };
};

export const refineOptimization = async (currentOption: OptimizedOption, userFeedback: string): Promise<OptimizedOption> => {
   const logicPrompt = `
    Request: "${userFeedback}".
    Update annotations. Output JSON.
  `;
   let newAnnotations = currentOption.annotations;
   try {
       const response = await ai.models.generateContent({
         model: "gemini-2.5-flash", 
         contents: logicPrompt,
         config: {
           responseMimeType: "application/json",
           responseSchema: {
             type: Type.OBJECT,
             properties: {
               annotations: {
                 type: Type.ARRAY,
                 items: {
                   type: Type.OBJECT,
                   properties: {
                     id: { type: Type.NUMBER },
                     text: { type: Type.STRING },
                     textCn: { type: Type.STRING },
                     location: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } }
                   }
                 }
               }
             }
           }
         }
       });
       const data = JSON.parse(response.text || "{}");
       if (data.annotations && data.annotations.length > 0) {
           newAnnotations = data.annotations;
       }
   } catch (e) {
       console.warn("Refinement logic failed", e);
   }

   // REDRAW Image using Flash
   const imagePrompt = `
      Task: UPDATE floor plan based on feedback.
      Feedback: "${userFeedback}"
      
      CONSTRAINTS:
      - Preserve Structural Walls (Thick black lines).
      - Ensure RATIONAL layout (don't block doors, reasonable furniture sizes).
      - Modify internal thin walls only.
   `;

   const newImage = await generatePlanImage(imagePrompt, currentOption.imageUrl);

   if (!newImage) {
        throw new Error("No new image generated");
   }

   return {
     ...currentOption,
     imageUrl: newImage,
     annotations: newAnnotations
   };
};
