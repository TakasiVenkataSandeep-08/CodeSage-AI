import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";
import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { HumanChatMessage, AIChatMessage } from "langchain/schema";
import { ChatMessage } from "../types/chat";
// import { CallbackManager } from "langchain/callbacks";

let model: ChatOpenAI;

let activeChain: ConversationChain | undefined;

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "The following is a friendly conversation between a human and an AI. The AI's name is codesense ai and it is a programming assistant with expertise on multiple programming languages and helps the user in all his programming related questions and If the AI does not know the answer to a question, it truthfully says it does not know."
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

export const askAi = async ({
  chatMessages,
  prompt,
}: {
  chatMessages?: ChatMessage[];
  prompt: string;
}): Promise<{
  message: string;
}> => {
  console.log("🚀 ~ file: OpenAi.ts:33 ~ prompt:", prompt, model, activeChain);

  try {
    if (!model) {
      return {
        message:
          "Looks like api key is missing please save your api key before trying again",
      };
    }
    if (!activeChain) {
      let memory: BufferMemory;
      if (chatMessages) {
        const pastMessages = chatMessages.map((item) =>
          item.type === "user"
            ? new HumanChatMessage(item.message)
            : new AIChatMessage(item.message)
        );
        memory = new BufferMemory({
          chatHistory: new ChatMessageHistory(pastMessages),
          returnMessages: true,
          memoryKey: "history",
        });
      } else {
        memory = new BufferMemory({
          returnMessages: true,
          memoryKey: "history",
        });
      }

      activeChain = new ConversationChain({
        memory,
        prompt: chatPrompt,
        llm: model,
        // callbacks: CallbackManager.fromHandlers({
        //   handleLLMNewToken(token: string) {
        //     process.stdout.write(token);
        //   },
        // }),
      });
    }
    console.log("🚀 ~ file: OpenAi.ts:75 ~ prompt:", prompt, activeChain);

    const res = await activeChain.call({ input: prompt });

    return { message: res.response };
  } catch (err) {
    console.log(err);
    return {
      message: "Something went wrong. please try again later.",
    };
  }
};

export const handleCloseConversation = () => {
  activeChain = undefined;
};

export const handleInitializeApi = (openAIApiKey: string) => {
  model = new ChatOpenAI({
    // streaming: true,
    temperature: 0,
    openAIApiKey,
    verbose: true,
    modelName: "gpt-3.5-turbo",
  });
};
