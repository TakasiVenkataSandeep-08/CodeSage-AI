import { HuggingFaceInference } from "langchain/llms/hf";
const model = new HuggingFaceInference({
  temperature: 0.7,
  model: "Narsil/gpt3",
  maxTokens: 250,
  apiKey: "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",
  verbose: true,
});
// const dotenv = require("dotenv");

// dotenv.config();

// const apiKey = process.env.HUGGINGFACEHUB_API_KEY;
// console.log(apiKey);

export const askAi = async (prompt: string) => {
  console.log("🚀 ~ file: HuggingFace.ts:15 ~ askAi ~ prompt:", prompt);
  try {
    const res = await model.call(prompt);
    console.log("🚀 ~ file: HuggingFace.ts:16 ~ askAi ~ res:", res);
    return { message: res };
  } catch (err) {
    console.log(err);
    return {
      message: "Something went wrong. please try again later.",
    };
  }
};
