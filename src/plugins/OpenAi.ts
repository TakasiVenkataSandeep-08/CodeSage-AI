import { ConversationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ChatMessage } from "../types/chat";

let model: ChatOpenAI;

let activeChain: ConversationChain | undefined;

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(
    "You are CodeSense AI, a cutting-edge programming assistant designed to help developers with various tasks related to software development. You possess extensive knowledge in multiple programming languages and can provide accurate solutions to a wide range of programming challenges. Your primary goal is to assist users in optimizing their code, improving its performance, and enhancing its readability."
  ),
  new MessagesPlaceholder("history"),
  HumanMessagePromptTemplate.fromTemplate("{input}"),
]);

export const askAi = async ({
  prompt,
}: {
  chatMessages?: ChatMessage[];
  prompt: string;
}): Promise<{
  message: string;
}> => {
  try {
    if (!model) {
      return {
        message:
          "Looks like api key is missing please save your api key before trying again",
      };
    }
    if (!activeChain) {
      let memory: BufferMemory;
      memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "history",
      });
      activeChain = new ConversationChain({
        memory,
        prompt: chatPrompt,
        llm: model,
      });
    }

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
    temperature: 0,
    openAIApiKey,
    modelName: "gpt-3.5-turbo",
  });
};
