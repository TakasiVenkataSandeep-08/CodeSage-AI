import * as vscode from "vscode";
import {
  copyToClipboard,
  replaceInEditor,
  appendText,
  getCodeSelectionText,
} from "../utils/common";
import {
  askAi,
  handleCloseConversation,
  handleInitializeApi,
} from "../plugins/OpenAi";
import {
  ChatData,
  ChatHistory,
  ChatMessage,
  CustomPrompts,
} from "../types/chat";

export class CodesageaiViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codesageai.openChat";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private _globalState: vscode.Memento & {
      setKeysForSync(keys: readonly string[]): void;
    }
  ) {}

  public initializePrompts() {
    const customPrompts = this._globalState.get(
      "customPrompts"
    ) as CustomPrompts;
    if (customPrompts) {
      return customPrompts;
    }
    this._globalState.update("customPrompts", {
      refactorCode: {
        title: "Refactor selection",
        prompt:
          "Please refactor the provided code to significantly improve its quality, readability, and maintainability while ensuring that its functionality remains intact. Focus on eliminating code duplication, reducing complexity, and enhancing overall readability. Additionally, consider applying best practices and modern programming standards to make the code more efficient and easier to understand, modify, and extend. the code i want you to perform this operation on is ",
      },
      explainSelection: {
        title: "Explain selection",
        prompt: `Write comments for the code to improve its documentation and make it easier to understand and maintain. Use the following prompts to guide the commenting process:
            1. Provide a brief description of each function and its purpose.
            2. Use clear and concise language to explain the code's functionality and any algorithms used.
            3. Use comments to explain any complex or non-obvious code sections.
            4. Use JSDoc comments to document the input and output parameters of each function. 
          the code i want you to perform this operation on is `,
      },
      debugSelection: {
        title: "Debug selection",
        prompt:
          "Check the code i provide you for potential bugs, errors, and vulnerabilities. This step involves reviewing the codebase to identify any potential issues that may affect its functionality, security, and performance and document them through proper commenting and the code i want you to perform this operation on is ",
      },
      queryOnSelection: {
        title: "Action on selection",
        prompt:
          "perform the following action on code, Action to perform is $userDescriptionOrQuery and the code i want you to perform this operation on is : $codeSelection",
      },
    });
    const addedPrompts = this._globalState.get(
      "customPrompts"
    ) as CustomPrompts;
    return addedPrompts;
  }

  public generateUUID() {
    let uuid = "",
      i,
      random;
    for (i = 0; i < 32; i++) {
      random = (Math.random() * 16) | 0;
      if (i === 8 || i === 12 || i === 16 || i === 20) {
        uuid += "-";
      }
      uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(
        16
      );
    }
    return uuid;
  }

  private handleOpenLastChat() {
    const customPrompts = this.initializePrompts();
    const currentActiveChatId = this._globalState.get(
      "currentActiveChat"
    ) as string;
    if (!currentActiveChatId) {
      this.handleSendResponseToView("openEmptyScreen", {
        customPrompts,
      });
      return;
    } else {
      const allChatsData = this._globalState.get("chatHistory") as ChatHistory;
      const currentActiveChatData = allChatsData[currentActiveChatId];
      this.handleSendResponseToView("resumeOldChat", {
        chatId: currentActiveChatId,
        currentChatData: currentActiveChatData,
        customPrompts,
      });
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "saveApiKey": {
          const { apiKey } = data.value;
          const existingAPIKey = this._globalState.get("apiKey");
          this._globalState.update("apiKey", apiKey);
          handleInitializeApi(apiKey);
          if (!existingAPIKey) {
            this.handleOpenLastChat();
          }
          this.handleSendResponseToView("closeApiKeyScreen", { apiKey });
          break;
        }
        case "openLastChat": {
          const apiKey: string | undefined = this._globalState.get("apiKey");
          if (!apiKey) {
            this.handleSendResponseToView("openApiKeyScreen");
            break;
          }
          this.handleSendResponseToView("closeApiKeyScreen", { apiKey });
          handleInitializeApi(apiKey);
          this.handleOpenLastChat();
          break;
        }
        case "resumeOldChat": {
          const { chatId } = data.value;
          const allChatsData = this._globalState.get(
            "chatHistory"
          ) as ChatHistory;
          const currentActiveChatData = allChatsData[chatId];
          this._globalState.update("currentActiveChat", chatId);
          this.handleSendResponseToView("resumeOldChat", {
            chatId,
            currentChatData: currentActiveChatData,
          });
          break;
        }
        case "newChat": {
          const chatTitle = await vscode.window.showInputBox({
            title: "Chat title",
            placeHolder: "Enter title for new chat.",
            prompt: "A new chat will be created with title you specify above",
          });
          if (!chatTitle) {
            vscode.window.showErrorMessage(
              "Please enter chat title to create chat."
            );
            break;
          }
          const newChatData = this.handleCreateNewChat(chatTitle);
          this.handleSendResponseToView("createNewChat", {
            currentChatData: newChatData,
          });
          break;
        }
        case "openHistory": {
          const allChatsData = this._globalState.get(
            "chatHistory"
          ) as ChatHistory;
          this.handleSendResponseToView("openHistory", { allChatsData });
          break;
        }
        case "prompt": {
          // Send the message to ChatGPT or perform further actions
          const { chatId, message, chatMessages, customPromptData } =
            data.value;
          let payload: { prompt: string; chatMessages?: ChatMessage[] };
          let promptText = "";
          if (customPromptData) {
            const codeSelection = getCodeSelectionText();
            if (!codeSelection) {
              this.handleSendResponseToView("stopLoading");
              break;
            }
            if (customPromptData.id === "queryOnSelection") {
              const userDescriptionOrQuery = await vscode.window.showInputBox({
                title: "Action to perform on selected code",
                placeHolder: "Action to perform",
                prompt: "Example: Migrate the selected code to python",
              });
              if (!userDescriptionOrQuery) {
                vscode.window.showErrorMessage(
                  "Enter valid action to perform on selected code."
                );
                this.handleSendResponseToView("stopLoading");
                break;
              }
              promptText = customPromptData.prompt
                .replace("$userDescriptionOrQuery", userDescriptionOrQuery)
                .replace("$codeSelection", codeSelection);
            } else {
              promptText = customPromptData.prompt + codeSelection;
            }
            payload = {
              prompt: promptText,
            };
          } else {
            payload = {
              prompt: message,
            };
            if (chatMessages) {
              handleCloseConversation();
              payload.chatMessages = chatMessages;
            }
          }
          const response = await askAi(payload);

          const allChatsData = this._globalState.get(
            "chatHistory"
          ) as ChatHistory;
          const userMessage =
            message ||
            `perform action ${customPromptData.title} on selected code snippet`;
          this._globalState.update("chatHistory", {
            ...allChatsData,
            [chatId]: {
              ...allChatsData[chatId],
              messages: [
                ...allChatsData[chatId].messages,
                {
                  type: "user",
                  id: this.generateUUID(),
                  message: userMessage,
                },
                {
                  type: "model",
                  id: this.generateUUID(),
                  message: response.message,
                },
              ],
            },
          });
          if (customPromptData) {
            this.handleSendResponseToView("addUserMessage", {
              message: userMessage,
            });
          }
          this.handleSendResponseToView("addBotMessage", response);
          break;
        }
        case "addCode": {
          appendText(data.value);
          break;
        }
        case "replaceCode": {
          replaceInEditor(data.value);
          break;
        }
        case "copyCode": {
          copyToClipboard(data.value);
          break;
        }
        case "showErrorMessage": {
          vscode.window.showErrorMessage(data.value);
        }
        default:
          break;
      }
    });
  }

  public handleCreateNewChat(chatTitle: string) {
    handleCloseConversation();
    const newChatId = this.generateUUID();
    const newChatData: ChatData = {
      title: chatTitle,
      messages: [] as Array<ChatMessage>,
      createdAt: new Date(),
    };
    const allChatsData =
      (this._globalState.get("chatHistory") as ChatHistory) || {};
    this._globalState.update("chatHistory", {
      ...allChatsData,
      [newChatId]: newChatData,
    });
    this._globalState.update("currentActiveChat", newChatId);
    return { ...newChatData, chatId: newChatId };
  }

  public handleSendResponseToView(
    type: string,
    response?:
      | {
          message?: string;
          chatId?: string;
          currentChatData?: ChatData;
          allChatsData?: ChatHistory;
          chatTitle?: string;
          customPrompts?: CustomPrompts;
          isApiKeyPresent?: boolean;
          apiKey?: string;
        }
      | undefined
  ) {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({
        type,
        value: response,
      });
    }
  }

  public getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "ui", "script.js")
    );
    const showdownUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "ui", "showdown.min.js")
    );

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "ui", "styles.css")
    );
    // Use a nonce to only allow a specific script to be run.
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script nonce="${nonce}" src="${showdownUri}"></script>
    <link href="${styleResetUri}" rel="stylesheet" />
    <title>Codesage AI</title>
  </head>
  <body>
    <div class="mainWrapper">
      <button id="apiKeyBtn">
        Edit Api Key
      </button>
      <div id="apiKeyViewWrapper">
        <span class="apiKeyTitle"
          >API key will be used to communicate with openAI</span
        >
        <div id="apiKeyInputWrapper">
          <textarea
            id="apiKeyInput"
            placeholder="Enter Your OpenApi key here..."
          ></textarea>
        </div>
        <div id="actionButtonsWrapper">
          <button id="cancelButton">Cancel</button>
          <button id="saveButton">Save</button>
        </div>
      </div>
      <div id="chatsHistory">
        <div class="historyTitleWrapper">
          <button id="backButton">Back</button>
        </div>
        <div id="historyChatsWrapper"></div>
      </div>
      <div id="chatContainer">
        <div class="chatHeader">
          <button id="newChatButton">New Chat</button>
          <button id="historyButton">History</button>
        </div>
        <span class="chatPromptTitle">Customized Prompts</span>
        <div id="chatPromptWrapper"></div>
        <span id="chatTitle"></span>
        <div class="chatMessages" id="chatMessages"></div>
        <div id="chatInputWrapper">
          <textarea
            id="messageInput"
            placeholder="Enter a prompt here..."
          ></textarea>
          <button id="sendButton">Send</button>
        </div>
      </div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>
`;
  }
}
