import { LLM } from "langchain/llms/base";
import { LLMChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { Bard } from "googlebard";
import * as vscode from "vscode";

class BardAI extends LLM {
  streaming = true;
  model: Bard;
  controller: AbortController;
  callbacks: any;
  constructor(config: {
    cache?: boolean;
    maxConcurrency?: number;
    streaming: any;
    callbacks?: any;
    cookie?: any;
  }) {
    super(config);
    this.streaming = config.streaming;
    this.model = new Bard(config.cookie, {
      inMemory: true,
    });
    this.callbacks = config.callbacks;
    this.controller = new AbortController();
  }

  async _call(prompt: string) {
    const res = await this.model.askStream((token) => {
      if (!token) {
        return;
      }
      if (this.streaming) {
        this.callbacks?.handleLLMNewToken(token);
      }
    }, prompt);

    return res;
  }

  _llmType() {
    return "bard.chat";
  }

  cancel() {
    this.controller.abort();
  }
}

export async function main() {
  let model = new BardAI({
    cache: false,
    cookie:
      "__Secure-1PSID=WwhuPtPXH3a3xcVhHhEdl5alyzihOSVaUkIpZGKiKf4HHZayktyLFhlxrFcx30czzq7_lA.",
    maxConcurrency: 4,
    streaming: false,
    callbacks: {
      handleLLMNewToken(token: string | Uint8Array) {
        process.stdout.write(token);
      },
    },
  });

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "I want you to act like a language translator. so you need to respond with i don't know when asked about anything other than translations"
    ),
    HumanMessagePromptTemplate.fromTemplate("{question}"),
  ]);
  const chatAssistant = new LLMChain({ llm: model, prompt: chatPrompt });
  const code = `export const createTodo = async (data: any) => {
  const response = await axios.post("/todos", data);
  return response.data;
  };`;
  const response = await chatAssistant.call({
    question: `Analyze the code ${code} and provide me the response as 3 sections strictly in the format mentioned.
    Format to send response is 
    --start--
    Quick Summary:<your quick summary here as paragraph only>
    --End--
    --start--Issues And Improvements:<your quick summary here as paragraph only>
    --End--
    --start--
    Refactored Code:<code>
    --End--
    Instruction:make sure you add --start-- at start and end each section with --End--`,
  });
  vscode.env.clipboard.writeText(JSON.stringify(response));
  vscode.window.showInformationMessage(JSON.stringify(response));
}
